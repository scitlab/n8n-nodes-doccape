import { INodeType, INodeTypeDescription } from 'n8n-workflow';

export class Doccape implements INodeType {
		description: INodeTypeDescription = {
				displayName: 'Doccape Anonymization',
				name: 'doccape',
				group: ['transform'],
				icon: 'file:doccape.svg',
				version: 1,
				description: 'Anonymizes text using the DocCape API',
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
								displayName: 'Operation',
								name: 'operation',
								type: 'options',
								noDataExpression: true,
								options: [
										{
												name: 'Anonymize Text',
												value: 'anonymizeText',
												action: 'Anonymize text using doc cape',
												description: 'Send text to the DocCape API for anonymization',
												routing: {
														request: {
																method: 'POST',
																headers: {
																	'Content-Type': 'application/json',
																},
																url: '={{ $credentials.apiBaseUrl }}/api/external/v1/text',
																body: {
																	text: '={{ $parameter["text"] }}',
																	usePseudonyms: '={{ $parameter["usePseudonyms"] }}',
																	textLabels: '={{ $parameter["textLabels"].split(",") }}',
																},
																json: true,
														},
														output: {
																postReceive: [
																	{
																			type: 'rootProperty',
																			properties: {
																				property: 'pseudonymizedText'
																			}
																	},
															],
														},
												},
										},
								],
								default: 'anonymizeText',
						},
						{
								displayName: 'Text',
								name: 'text',
								type: 'string',
								default: '',
								placeholder: 'Enter text to anonymize',
								required: true,
								description: 'The text to be anonymized',
						},
						{
								displayName: 'Pseudonymization',
								name: 'usePseudonyms',
								type: 'boolean',
								default: true,
								description: 'Whether to enable pseudonymization (replaces PII with unique identifiers) or to disable for full anonymization (replaces PII with generic placeholders)',
						},
						{
								displayName: 'PII Classes to Detect',
								name: 'textLabels',
								type: 'string',
								default: 'PER,STR,LOC,ORG',
								placeholder: 'Enter PII categories (comma-separated)',
								description: 'Comma-separated list of PII categories to anonymize (e.g., PER,STR,LOC,ORG)',
						},
				],
		};
}
