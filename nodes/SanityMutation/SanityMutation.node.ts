import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	ICredentialDataDecryptedObject,
	IDataObject,
	NodeConnectionType,
} from 'n8n-workflow';

/**
 * This is the complete structure for the Sanity n8n node.
 * It defines the node's properties for the UI and contains the
 * full execution logic to communicate with the Sanity Mutations API.
 */
export class SanityMutation implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sanity Mutation',
		name: 'sanityMutation',
		icon: 'file:sanityMutation.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Create, Update, and Delete documents in Sanity.io',
		defaults: {
			name: 'Sanity',
		},
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		credentials: [
			{
				name: 'sanityMutationApi',
				required: true,
			},
		],
		properties: [
			// ... (All properties remain the same)
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'hidden',
				default: 'document',
				noDataExpression: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a document',
					},
					{
						name: 'Create if Not Exists',
						value: 'createIfNotExists',
						action: 'Create a document if it does not exist',
					},
					{
						name: 'Create or Replace',
						value: 'createOrReplace',
						action: 'Create or replace a document',
					},
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete a document',
					},
					{
						name: 'Patch (Update)',
						value: 'patch',
						action: 'Patch partially update a document',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				placeholder: 'doc-ID-12345',
				description:
					'The ID of the document to operate on. If creating and left blank, a random ID will be generated.',
				displayOptions: {
					show: {
						operation: ['create', 'createOrReplace', 'createIfNotExists', 'delete', 'patch'],
					},
				},
			},
			{
				displayName: 'Document Data',
				name: 'documentJson',
				type: 'json',
				typeOptions: {
					alwaysOpen: true,
				},
				default: '{}',
				description:
					'The JSON data for the document or patch operation. For "Create", this is the full document. For "Patch", this specifies the patch operations.',
				displayOptions: {
					show: {
						operation: ['create', 'createOrReplace', 'createIfNotExists', 'patch'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Return Documents',
						name: 'returnDocuments',
						type: 'boolean',
						default: true,
						description: 'Whether to return the full document(s) in the response',
					},
					{
						displayName: 'API Version',
						name: 'apiVersion',
						type: 'string',
						default: 'v2024-06-21',
						description: 'The Sanity API version to use',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = (await this.getCredentials(
			'sanityMutationApi',
		)) as ICredentialDataDecryptedObject;
		const projectId = credentials.projectId as string;
		const dataset = credentials.dataset as string;
		const token = credentials.token as string;

		if (!projectId || !dataset || !token) {
			throw new NodeOperationError(this.getNode(), 'Credentials are not valid!');
		}

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex, '') as string;
				const documentId = this.getNodeParameter('documentId', itemIndex, '') as string;

				const documentJsonString = this.getNodeParameter('documentJson', itemIndex, '{}') as string;
				let documentJson: IDataObject;
				try {
					documentJson = JSON.parse(documentJsonString);
				} catch (e) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid JSON in "Document Data" field: ${e.message}`,
						{ itemIndex },
					);
				}

				const options = this.getNodeParameter('options', itemIndex, {}) as {
					returnDocuments?: boolean;
					apiVersion?: string;
				};

				const apiVersion = options.apiVersion || 'v2024-06-21';
				const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/mutate/${dataset}`;

				const mutations: IDataObject[] = [];
				const mutationPayload: IDataObject = {};

				// ** BUG FIX: Added separate logic for the patch operation **
				if (operation === 'delete') {
					if (!documentId) {
						throw new NodeOperationError(
							this.getNode(),
							'Document ID is required for delete operation.',
						);
					}
					mutationPayload[operation] = { id: documentId };
				} else if (operation === 'patch') {
					if (!documentId) {
						throw new NodeOperationError(
							this.getNode(),
							'Document ID is required for patch operation.',
						);
					}
					const patchData = { ...documentJson };
					// A patch operation requires the ID to be at the top level of the patch object, with the key 'id'
					patchData.id = documentId;
					mutationPayload[operation] = patchData;
				} else {
					// Handles create, createOrReplace, createIfNotExists
					const createData = { ...documentJson };
					// A create operation can optionally have an ID, with the key '_id'
					if (documentId) {
						createData._id = documentId;
					}
					mutationPayload[operation] = createData;
				}
				mutations.push(mutationPayload);

				const responseData = await this.helpers.httpRequest({
					method: 'POST',
					url,
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: { mutations },
					qs: {
						returnDocuments: options.returnDocuments,
					},
					json: true,
				});

				const results = (responseData as IDataObject).results as IDataObject[];
				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(results),
					{ itemData: { item: itemIndex } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionErrorData = {
						json: {
							error: error.message,
						},
						pairedItem: {
							item: itemIndex,
						},
					};
					returnData.push(executionErrorData);
					continue;
				}

				if (error.isAxiosError && error.response && error.response.data) {
					const detailedError = JSON.stringify(error.response.data, null, 2);
					throw new NodeOperationError(this.getNode(), `Sanity API Error: ${detailedError}`, {
						itemIndex,
					});
				}

				throw error;
			}
		}

		return this.prepareOutputData(returnData);
	}
}
