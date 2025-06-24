import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	ICredentialDataDecryptedObject,
	NodeConnectionType ,
	IDataObject,
} from 'n8n-workflow';

/**
 * This is the complete structure for the Sanity n8n node.
 * It defines the node's properties for the UI and contains the
 * full execution logic to communicate with the Sanity Mutations API.
 */
export class SanityMutation implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SanityMutation',
		name: 'sanityMutation',
		// You can find a suitable icon on websites like simpleicons.org
		// The format is 'file:sanity.svg'
		icon: 'file:sanityMutation.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Create, Update, and Delete documents in Sanity.io',
		defaults: {
			name: 'Sanity',
		},
		// Re-added inputs and outputs as they are required by the INodeTypeDescription interface.
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
		credentials: [
			{
				name: 'sanityApi',
				required: true,
			},
		],
		properties: [
			// -- RESOURCE FIELD --
			// For this node, the resource is always 'document'.
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'hidden',
				default: 'document',
				noDataExpression: true,
			},

			// -- OPERATION FIELD --
			// This is the core dropdown for selecting the mutation type.
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

			// -- DOCUMENT ID FIELD --
			// Required for Patch and Delete, optional for Create operations.
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				placeholder: 'doc-ID-12345',
				description: 'The ID of the document to operate on. If creating and left blank, a random ID will be generated.',
				displayOptions: {
					show: {
						operation: ['create', 'createOrReplace', 'createIfNotExists', 'delete', 'patch'],
					},
				},
			},

			// -- DOCUMENT DATA / PAYLOAD FIELD --
			// A JSON editor for the document content or patch data.
			{
				displayName: 'Document Data',
				name: 'documentJson',
				type: 'json',
				typeOptions: {
					alwaysOpen: true,
				},
				default: '{}',
				description: 'The JSON data for the document or patch operation. For "Create", this is the full document. For "Patch", this specifies the patch operations.',
				displayOptions: {
					show: {
						operation: ['create', 'createOrReplace', 'createIfNotExists', 'patch'],
					},
				},
			},

			// -- ADDITIONAL OPTIONS --
			// A collection of optional parameters for more control.
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

	/**
	 * The 'execute' function is the heart of the node.
	 * It runs for each item that arrives at the node's input.
	 *
	 * @param this IExecuteFunctions
	 * @returns INodeExecutionData[][]
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// 1. Get credentials
		const credentials = (await this.getCredentials('sanityMutationApi')) as ICredentialDataDecryptedObject;
		const projectId = credentials.projectId as string;
		const dataset = credentials.dataset as string;
		const token = credentials.token as string;

		if (!projectId || !dataset || !token) {
			throw new NodeOperationError(this.getNode(), 'Credentials are not valid!');
		}

		// 2. Loop through input items
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// 3. Get node parameters for the current item
				const operation = this.getNodeParameter('operation', itemIndex, '') as string;
				const documentId = this.getNodeParameter('documentId', itemIndex, '') as string;
				const documentJson = this.getNodeParameter('documentJson', itemIndex, {}) as IDataObject;
				const options = this.getNodeParameter('options', itemIndex, {}) as {
					returnDocuments?: boolean;
					apiVersion?: string;
				};

				const apiVersion = options.apiVersion || 'v2024-06-21';

				// 4. Construct the Sanity API URL
				const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/mutate/${dataset}`;

				// 5. Build the mutation payload
				const mutations: IDataObject[] = [];
				const mutationPayload: IDataObject = {};

				if (operation === 'delete') {
					if (!documentId) throw new NodeOperationError(this.getNode(), 'Document ID is required for delete operation.');
					mutationPayload[operation] = { id: documentId };
				} else {
					// Corrected the type of docData to allow adding properties.
					const docData: IDataObject = { ...documentJson };
					if (documentId) {
						docData._id = documentId;
					}
					mutationPayload[operation] = docData;
				}
				mutations.push(mutationPayload);

				// 6. Make the HTTP request
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

				// 7. Format the response and return it
				const results = (responseData as IDataObject).results as IDataObject[];
				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(results),
					{ itemData: { item: itemIndex } },
				);
				returnData.push(...executionData);

			} catch (error) {
				// 8. Error Handling
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
				throw error;
			}
		}

		// 9. Return the data for the next node
		return this.prepareOutputData(returnData);
	}
}
