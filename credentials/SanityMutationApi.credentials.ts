import {
	ICredentialType,
	INodeProperties,
	ICredentialTestRequest,
} from 'n8n-workflow';

/**
 * This is the credentials file for the Sanity API.
 * It defines the fields that will be displayed to the user when they
 * create new credentials for the Sanity node in the n8n UI.
 */
export class SanityMutationApi implements ICredentialType {
	name = 'sanityMutationApi';
	displayName = 'SanityMutation API';
	documentationUrl = 'https://www.sanity.io/docs/http-api';
	properties: INodeProperties[] = [
		{
			displayName: 'Project ID',
			name: 'projectId',
			type: 'string',
			default: '',
			placeholder: 'pgr1234z',
			description: 'The ID of your Sanity project',
			required: true,
		},
		{
			displayName: 'Dataset',
			name: 'dataset',
			type: 'string',
			default: 'production',
			placeholder: 'production',
			description: 'The dataset to connect to within your project',
			required: true,
		},
		{
			displayName: 'API Token',
			name: 'token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Your Sanity API token with at least write permissions',
			required: true,
		},
	];

	/**
	 * Tests the provided credentials by making a simple query to the Sanity API.
	 */
	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '=https://{{$credentials.projectId}}.api.sanity.io/v2021-10-21/data/query/{{$credentials.dataset}}',
			qs: {
				// This is a placeholder query designed to be fast and return no data.
				// Its only purpose is to validate the credentials.
				query: `*[_type == "sanity.project" && _id == "sane-project-name"]`,
			},
			headers: {
				'Accept': 'application/json',
				'Authorization': '=Bearer {{$credentials.token}}',
			},
		},
	};
}
