import {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
	sleep,
} from 'n8n-workflow';

/**
 * Pre-send hook: encodes the binary input and builds the document upload config.
 * Use Pseudonyms toggles each text label between FULL_PSEUDONYMIZATION and SUPPRESSION.
 * Image Anonymization Type is applied to each selected image label.
 */
const prepareFileUploadBody = async function (
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName') as string;
	this.helpers.assertBinaryData(binaryPropertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(binaryPropertyName);

	const usePseudonyms = this.getNodeParameter('usePseudonymsFile') as boolean;
	const textLabels = (this.getNodeParameter('textLabelsFile') as string)
		.split(',')
		.map((label) => label.trim())
		.filter((label) => label.length > 0);
	const imageLabels = (this.getNodeParameter('imageLabelsFile') as string)
		.split(',')
		.map((label) => label.trim())
		.filter((label) => label.length > 0);
	const imageAnonymizationType = this.getNodeParameter('imageAnonymizationType') as string;

	requestOptions.body = {
		content: buffer.toString('base64'),
		config: {
			textAnonymization: {
				labelsConfig: textLabels.map((name) => ({
					name,
					config: usePseudonyms
						? { type: 'FULL_PSEUDONYMIZATION', pseudonym: name }
						: { type: 'SUPPRESSION', suppressionLength: 4 },
				})),
			},
			imageAnonymization: {
				labelsConfig: imageLabels.map((name) => ({
					name,
					anonymizationType: imageAnonymizationType,
				})),
			},
		},
	};

	return requestOptions;
};

/** Returns a readable message from an unknown thrown value. */
const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
};

/**
 * Sends an HTTP request authenticated with the node's `doccapeApi` credentials.
 */
const requestWithDoccapeAuthentication = async function (
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<unknown> {
	const authenticatedRequest = this.helpers.httpRequestWithAuthentication as unknown as (
		this: IExecuteSingleFunctions,
		credentialsType: string,
		options: IHttpRequestOptions,
	) => Promise<unknown>;

	return await authenticatedRequest.call(this, 'doccapeApi', requestOptions);
};

/** Deletes a document from doccape by ID. Retries once on failure. */
const deleteDocument = async function (
	this: IExecuteSingleFunctions,
	baseURL: string,
	documentId: string,
): Promise<void> {
	const requestOptions: IHttpRequestOptions = {
		baseURL,
		method: 'DELETE',
		url: `/api/external/v1/documents/${encodeURIComponent(documentId)}`,
		json: true,
	};

	try {
		await requestWithDoccapeAuthentication.call(this, requestOptions);
	} catch {
		await sleep(1_000);
		await requestWithDoccapeAuthentication.call(this, requestOptions);
	}
};

/**
 * Post-receive hook for file anonymization: polls document status until complete,
 * downloads the anonymized result as binary data, optionally fetches detected PIIs,
 * and optionally deletes the remote document.
 */
const completeFileAnonymization = async function (
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const uploadResponse = response.body as IDataObject;
	const rawDocumentId = uploadResponse.documentId;

	if (typeof rawDocumentId !== 'string' && typeof rawDocumentId !== 'number') {
		throw new NodeOperationError(
			this.getNode(),
			'doccape did not return a document ID after uploading the file',
		);
	}

	const documentId = String(rawDocumentId);
	const credentials = await this.getCredentials('doccapeApi');
	const baseURL = credentials.apiBaseUrl as string;
	const deleteAfterAnonymization = this.getNodeParameter(
		'deleteAfterAnonymization',
	) as boolean;
	const includeDetectedPiis = this.getNodeParameter(
		'includeDetectedPiis',
		false,
	) as boolean;
	const pollingIntervalSeconds = this.getNodeParameter(
		'pollingIntervalSeconds',
	) as number;
	const pollingTimeoutMinutes = this.getNodeParameter(
		'pollingTimeoutMinutes',
	) as number;
	const pollingIntervalMs = pollingIntervalSeconds * 1_000;
	const pollingTimeoutMs = pollingTimeoutMinutes * 60 * 1_000;
	let cleanupAttempted = false;

	/** Deletes the remote document once if `deleteAfterAnonymization` is enabled. */
	const cleanup = async (): Promise<void> => {
		if (deleteAfterAnonymization && !cleanupAttempted) {
			cleanupAttempted = true;
			await deleteDocument.call(this, baseURL, documentId);
		}
	};

	try {
		const pollingStartedAt = Date.now();
		const failureStatuses = new Set([
			'ERROR',
			'PREVIEW_ERROR',
			'QUOTA_EXCEEDED',
			'QUOTA_ERROR',
		]);

		while (true) {
			if (Date.now() - pollingStartedAt >= pollingTimeoutMs) {
				throw new NodeOperationError(
					this.getNode(),
					`Timed out waiting for document ${documentId} after ${pollingTimeoutMinutes} minutes`,
				);
			}

			const statusResponse = await requestWithDoccapeAuthentication.call(this, {
				baseURL,
				method: 'GET',
				url: `/api/external/v1/documents/${encodeURIComponent(documentId)}/status`,
				json: true,
			}) as IDataObject;
			const status = statusResponse.status;

			if (status === 'COMPLETED') {
				break;
			}

			if (typeof status === 'string' && failureStatuses.has(status)) {
				throw new NodeOperationError(
					this.getNode(),
					`doccape reported status "${status}" while anonymizing document ${documentId}`,
				);
			}

			// Unknown / in-progress statuses keep polling until COMPLETED, failure, or timeout.
			await sleep(pollingIntervalMs);
		}

		const resultRequest = requestWithDoccapeAuthentication.call(this, {
			baseURL,
			method: 'GET',
			url: `/api/external/v1/documents/${encodeURIComponent(documentId)}/result`,
			returnFullResponse: true,
			encoding: 'arraybuffer',
		}) as Promise<IN8nHttpFullResponse>;

		const piisRequest = includeDetectedPiis
			? (requestWithDoccapeAuthentication.call(this, {
					baseURL,
					method: 'GET',
					url: `/api/external/v1/documents/${encodeURIComponent(documentId)}/result/piis`,
					json: true,
				}) as Promise<IDataObject>)
			: Promise.resolve(undefined);

		const [resultResponse, piis] = await Promise.all([resultRequest, piisRequest]);

		let contentDisposition = resultResponse.headers['content-disposition'] ?? '';
		if (typeof contentDisposition !== 'string') {
			contentDisposition = String(contentDisposition);
		}
		const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
		const fileName = fileNameMatch?.[1] ?? 'anonymized-file.bin';
		const contentType = resultResponse.headers['content-type'];
		const mimeType = typeof contentType === 'string'
			? contentType.split(';')[0]
			: undefined;
		const binaryData = await this.helpers.prepareBinaryData(
			resultResponse.body as Buffer,
			fileName,
			mimeType,
		);

		// Cleanup must not discard a successful anonymization result.
		let deleted = false;
		let cleanupError: string | undefined;
		if (deleteAfterAnonymization) {
			try {
				await cleanup();
				deleted = true;
			} catch (error) {
				cleanupError = getErrorMessage(error);
			}
		}

		const json: IDataObject = {
			...(deleted ? {} : { documentId }),
			status: 'COMPLETED',
			deleted,
		};

		if (cleanupError !== undefined) {
			json.cleanupError = cleanupError;
		}

		if (includeDetectedPiis) {
			json.piis = piis;
		}

		return [
			{
				json,
				binary: {
					data: binaryData,
				},
			},
		];
	} catch (error) {
		try {
			await cleanup();
		} catch (cleanupError) {
			throw new NodeOperationError(
				this.getNode(),
				`${getErrorMessage(error)} Cleanup also failed: ${getErrorMessage(cleanupError)}`,
			);
		}

		if (error instanceof NodeOperationError) {
			// Already a node error with proper context; re-wrapping would nest the message.
			// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
			throw error;
		}

		throw new NodeOperationError(this.getNode(), getErrorMessage(error));
	}
};

export class Doccape implements INodeType {
		description: INodeTypeDescription = {
				displayName: 'doccape Anonymization',
				name: 'doccape',
				group: ['transform'],
				icon: {
					light: 'file:doccape_new.svg',
					dark: 'file:doccape_new_border.svg',
				},
				version: 2,
				description: 'Anonymize text and files using the doccape API',
				subtitle: '={{ $parameter["operation"] }}',
				defaults: {
						name: 'doccape Anonymization',
				},
				credentials: [
						{
								name: 'doccapeApi',
								required: true,
						},
				],
				requestDefaults: {
						baseURL: '={{ $credentials.apiBaseUrl }}',
						headers: {
							Accept: 'application/json',
							'Content-Type': 'application/json',
						},
				},
				inputs: [NodeConnectionTypes.Main],
				outputs: [NodeConnectionTypes.Main],
				properties: [
					{
						displayName: 'Resource',
						name: 'resource',
						type: 'options',
						noDataExpression: true,
						options: [
							{
								name: 'Text',
								value: 'anonymizeText',
							},
							{
								name: 'File',
								value: 'anonymizeFile',
							},
						],
						default: 'anonymizeText',
					},
					// Operations
					// Operation text anonymization
					{
						displayName: 'Operation',
						name: 'operation',
						type: 'options',
						noDataExpression: true,
						displayOptions: {
							show: {
								resource: [
									'anonymizeText',
								],
							},
						},
						options: [
							{
								name: 'Anonymize Text',
								value: 'anonymizeText',
								action: 'Anonymize text using doccape',
								description: 'Send text to the doccape API for anonymization',
								routing: {
									request: {
										method: 'POST',
										url: '/api/external/v1/text',
										body: {
											text: '={{ $parameter["text"] }}',
											usePseudonyms: '={{ $parameter["usePseudonyms"] }}',
											textLabels: '={{ $parameter["textLabels"].split(",").map(l => l.trim()).filter(Boolean) }}',
										},
										json: true,
									},
								},
							},
						],
						default: 'anonymizeText',
					},
					// Operation file anonymization
					{
						displayName: 'Operation',
						name: 'operation',
						type: 'options',
						noDataExpression: true,
						displayOptions: {
							show: {
								resource: [
									'anonymizeFile',
								],
							},
						},
						options: [
							{
								name: 'Anonymize File',
								value: 'anonymizeFile',
								action: 'Anonymize file using doccape',
								description: 'Upload a binary file, wait for anonymization, and return the anonymized file',
								routing: {
									request: {
										method: 'POST',
										url: '/api/external/v1/documents/upload',
										body: {
											content: '',
										},
										json: true,
									},
									send: {
										preSend: [
											prepareFileUploadBody,
										],
									},
									output: {
										postReceive: [
											completeFileAnonymization,
										],
									},
								},
							},
						],
						default: 'anonymizeFile',
					},
					// Properties
					// Properties for text anonymization
					{
							displayName: 'Text',
							name: 'text',
							type: 'string',
							default: '',
							placeholder: 'e.g. John visited Berlin last Tuesday.',
							required: true,
							description: 'The text to be anonymized',
							displayOptions: {
								show: {
									operation: [
										'anonymizeText',
									],
								},
							},
					},
					{
							displayName: 'Use Pseudonyms',
							name: 'usePseudonyms',
							type: 'boolean',
							default: true,
							description: 'Whether to use pseudonyms (e.g. "PER-1" or "LOC-1") or a generic placeholder (****) to replace detected PIIs',
							displayOptions: {
								show: {
									operation: [
										'anonymizeText',
									],
								},
							},
					},
					{
							displayName: 'PII Classes to Detect',
							name: 'textLabels',
							type: 'string',
							default: 'PER,STR,LOC,ORG',
							placeholder: 'e.g. PER,STR,LOC,ORG',
							description: 'Comma-separated list of PII categories to anonymize (e.g., PER,STR,LOC,ORG)',
							displayOptions: {
								show: {
									operation: [
										'anonymizeText',
									],
								},
							},
					},
					// Properties for file anonymization
					{
						displayName: 'Input Binary Field Name',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'File',
						required: true,
						description: 'Name of the input binary field containing the file to anonymize. For Form Trigger uploads this is usually the field label (e.g. File).',
						displayOptions: {
							show: {
								operation: [
									'anonymizeFile',
								],
							},
						},
					},
					{
						displayName: 'Delete Document After Anonymization',
						name: 'deleteAfterAnonymization',
						type: 'boolean',
						default: true,
						description: 'Whether to delete the document from doccape after completion, errors, or timeouts',
						displayOptions: {
							show: {
								operation: [
									'anonymizeFile',
								],
							},
						},
					},
					{
						displayName: 'Include Detected PIIs',
						name: 'includeDetectedPiis',
						type: 'boolean',
						default: false,
						description: 'Whether to include detected PIIs in the JSON output under piis. This payload is sensitive and must not be sent to chat models or agents.',
						displayOptions: {
							show: {
								operation: [
									'anonymizeFile',
								],
							},
						},
					},
					{
						displayName: 'Polling Interval (Seconds)',
						name: 'pollingIntervalSeconds',
						type: 'number',
						default: 5,
						typeOptions: {
							minValue: 5,
						},
						description: 'How often to check the doccape document status while waiting for completion',
						displayOptions: {
							show: {
								operation: [
									'anonymizeFile',
								],
							},
						},
					},
					{
						displayName: 'Polling Timeout (Minutes)',
						name: 'pollingTimeoutMinutes',
						type: 'number',
						default: 10,
						typeOptions: {
							minValue: 1,
						},
						description: 'Maximum time to wait for document anonymization before failing',
						displayOptions: {
							show: {
								operation: [
									'anonymizeFile',
								],
							},
						},
					},
					{
						displayName: 'Text PII Classes to Detect',
						name: 'textLabelsFile',
						type: 'string',
						default: 'PER,STR,LOC,ORG',
						placeholder: 'e.g. PER,STR,LOC,ORG',
						description: 'Comma-separated list of PII categories to anonymize (e.g., PER,STR,LOC,ORG)',
						displayOptions: {
							show: {
								operation: [
									'anonymizeFile',
								],
							},
						},
					},
					{
						displayName: 'Supported text labels can be retrieved via <a href="https://docs.doccape.de/docs/api/list-text-labels" target="_blank">doccape API docs</a>.',
						name: 'textLabelsNotice',
						type: 'notice',
						default: '',
						displayOptions: {
						  show: {
							operation: [
								'anonymizeText',
								'anonymizeFile',
							],
						  },
						},
					  },
					{
							displayName: 'Use Pseudonyms',
							name: 'usePseudonymsFile',
							type: 'boolean',
							default: true,
							description: 'Whether to use pseudonyms (e.g. "PER-1" or "LOC-1") or a generic placeholder (****) to replace detected PIIs',
							displayOptions: {
								show: {
									operation: [
										'anonymizeFile',
									],
								},
							},
					},
					{
						displayName: 'Image PII Classes to Detect',
						name: 'imageLabelsFile',
						type: 'string',
						default: 'face',
						placeholder: 'Enter PII categories (comma-separated)',
						description: 'Comma-separated list of PII categories to anonymize (e.g., text,face,licence_plate,qr_code)',
						displayOptions: {
							show: {
								operation: [
									'anonymizeFile',
								],
							},
						},
					},
					{
						displayName: 'Supported image labels can be retrieved via <a href="https://docs.doccape.de/docs/api/list-image-labels" target="_blank">doccape API docs</a>.',
						name: 'imageLabelsNotice',
						type: 'notice',
						default: '',
						displayOptions: {
						  show: {
							operation: [
								'anonymizeFile',
							],
						  },
						},
					  },
					{
							displayName: 'Image Anonymization Type',
							name: 'imageAnonymizationType',
							type: 'options',
							description: 'Type of image anonymization to apply',
							options: [
								{name: 'Mask', value: 'MASK'},
								{name: 'Blur', value: 'BLUR'},
								{name: 'Pixelate', value: 'PIXELATE'},
							],
							default: 'MASK',
							displayOptions: {
								show: {
									operation: [
										'anonymizeFile',
									],
								},
							},
					},
				],
				usableAsTool: undefined,
		};
}
