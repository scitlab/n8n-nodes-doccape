import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	Icon,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DoccapeApi implements ICredentialType {
	name = 'doccapeApi';
	displayName = 'Doccape API';
	documentationUrl = 'https://github.com/scitlab/n8n-nodes-doccape#credentials';
	icon: Icon = {
		light: 'file:doccape_new.svg',
		dark: 'file:doccape_new_border.svg',
	};
	properties: INodeProperties[] = [
			{
					displayName: 'API Base URL',
					name: 'apiBaseUrl',
					type: 'string',
					default: 'https://app.doccape.de',
					required: true,
					description: 'Base URL of the doccape API',
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
					description: 'Your doccape API key',
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

	test: ICredentialTestRequest = {
			request: {
					baseURL: '={{ $credentials.apiBaseUrl }}',
					url: '/api/external/v1/text-labels',
					method: 'GET',
			},
	};
}
