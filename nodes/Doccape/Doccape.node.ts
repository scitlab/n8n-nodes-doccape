import { INodeType, INodeTypeDescription, IExecuteSingleFunctions, INodeExecutionData, IN8nHttpFullResponse } from 'n8n-workflow';


const createBinaryPropertyWithFilename = async function (
  this: IExecuteSingleFunctions,
  items: INodeExecutionData[],
  response: IN8nHttpFullResponse
): Promise<INodeExecutionData[]> {
    // Get raw data from response.body
    const rawData = response.body;

    // Extract file name from Content-Disposition header
    let contentDisposition = response.headers['content-disposition'] || '';
    if (typeof contentDisposition !== 'string') {
        contentDisposition = String(contentDisposition);
    }
    const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    const fileName = fileNameMatch?.[1] || 'downloaded-file.bin';

    // Use helper to wrap data as binary
    const binaryData = await this.helpers.prepareBinaryData(
        rawData,
        fileName,
    );

    // Add binary property to the first item
    items[0].binary = {
        data: binaryData,
    };

    return items;
};

export class Doccape implements INodeType {
		description: INodeTypeDescription = {
				displayName: 'Doccape Anonymization',
				name: 'doccape',
				group: ['transform'],
				icon: 'file:doccape.svg',
				version: 1,
				description: 'Anonymizes text using the doccape API',
				defaults: {
						name: 'Doccape Anonymization',
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
				inputs: ['main'],
				outputs: ['main'],
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
										url: '={{ $credentials.apiBaseUrl }}/api/external/v1/text',
										body: {
											text: '={{ $parameter["text"] }}',
											usePseudonyms: '={{ $parameter["usePseudonyms"] }}',
											textLabels: '={{ $parameter["textLabels"].split(",") }}',
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
								description: 'Send file to the doccape API for anonymization',
								routing: {
									request: {
										method: 'POST',
										url: '={{ $credentials.apiBaseUrl }}/api/external/v1/documents/upload',
										body: {
											content: '={{ $parameter.fileInput }}',
											config: {
												textAnonymization: {
													labelsConfig: '={{ $parameter.textLabelsFile.split(",").map(l => ({ name: l.trim(), config: $parameter.textAnonymizationType === "FULL_PSEUDONYMIZATION"  ? { type: $parameter.textAnonymizationType, pseudonym: l.trim() } : { type: "SUPPRESSION", suppressionLength: 4 } })) }}'
												},
												imageAnonymization: {
													labelsConfig: '={{ $parameter.imageLabelsFile.split(",").map(l => ({ name: l.trim(), anonymizationType: $parameter.imageAnonymizationType })) }}'
												}
											}
										},
										json: true,
									},
								},
							},
							{
								name: 'File Status',
								value: 'fileStatus',
								action: 'Get file status using doccape',
								description: 'Check the status of a file in the doccape API',
								routing: {
									request: {
										method: 'GET',
										url: '={{ $credentials.apiBaseUrl }}/api/external/v1/documents/{{ $parameter.fileId }}/status',
										json: true,
									},
								},
							},
							{
								name: 'File Download',
								value: 'fileDownload',
								action: 'Download anonymized file from doccape',
								description: 'Download the anonymized file from the doccape API',
								routing: {
									request: {
										method: 'GET',
										url: '={{ $credentials.apiBaseUrl }}/api/external/v1/documents/{{ $parameter.fileId }}/result',
										returnFullResponse: true,
										encoding: "arraybuffer",
									},
									output: {
										postReceive: [
											createBinaryPropertyWithFilename,
										]
									}
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
							placeholder: 'Enter text to anonymize',
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
							displayName: 'Pseudonymization',
							name: 'usePseudonyms',
							type: 'boolean',
							default: true,
							description: 'Whether to enable pseudonymization (replaces PII with unique identifiers) or to disable for full anonymization (replaces PII with generic placeholders)',
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
							placeholder: 'Enter PII categories (comma-separated)',
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
							displayName: 'File as Base64',
							name: 'fileInput',
							type: 'string',
							default: 'data',
							placeholder: 'Enter file to anonymize',
							required: true,
							description: 'The file to be anonymized. If you have binary data, use the "Extract from File" node to convert the file data to Base64 format.',
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
						placeholder: 'Enter PII categories (comma-separated)',
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
							displayName: 'Text Anonymization Type',
							name: 'textAnonymizationType',
							type: 'options',
							options: [
								{name: 'Pseudonymization', value: 'FULL_PSEUDONYMIZATION'},
								{name: 'Anonymization', value: 'SUPPRESSION'},
							],
							default: 'FULL_PSEUDONYMIZATION',
							description: 'Whether to use text pseudonymization (replaces PII with unique identifiers) or to use full anonymization (replaces PII with generic placeholders)',
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
						default: 'text,face,license_plate,qr_code',
						placeholder: 'Enter PII categories (comma-separated)',
						description: 'Comma-separated list of PII categories to anonymize (e.g., text,face,license_plate,qr_code)',
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
					// Properties for file status and download
					{
							displayName: 'File ID',
							name: 'fileId',
							type: 'number',
							default: '',
							description: 'The ID of the file to check status for',
							displayOptions: {
								show: {
									operation: [
										'fileStatus',
										'fileDownload',
									],
								},
							},
					},
				],
		};
}
