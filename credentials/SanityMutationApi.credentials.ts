import {
	ICredentialType,
	INodeProperties,
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
}
