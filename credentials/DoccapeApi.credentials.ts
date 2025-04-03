import {
	IAuthenticateGeneric,
	Icon,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DoccapeApi implements ICredentialType {
	name = 'doccapeApi';
	displayName = 'DocCape API';
	documentationUrl = 'https://api.doccape.de/api-docs';
	icon: Icon = 'file:doccape.svg';
	properties: INodeProperties[] = [
			{
					displayName: 'API Base URL',
					name: 'apiBaseUrl',
					type: 'string',
					default: 'https://api.doccape.de',
					required: true,
					description: 'Base URL of the DocCape API',
			},
			{
					displayName: 'API Key',
					name: 'apiKey',
					type: 'string',
					typeOptions: {
							password: true,
					},
					default: '',
					required: true,
					description: 'Your DocCape API Key',
			},
	];

	authenticate: IAuthenticateGeneric = {
			type: 'generic',
			properties: {
					headers: {
							Authorization: '={{ "Bearer " + $credentials.apiKey }}',
					},
			},
	};
}
