// IMPORTANT: To resolve TypeScript errors for lodash, you must install its type definitions
// Run: npm i --save-dev @types/lodash
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType, // Add this import
	NodeOperationError
} from 'n8n-workflow';
import set from 'lodash/set';

/**
 * Helper function to generate a random key for Portable Text blocks.
 * Sanity requires unique keys for items in an array.
 * @returns {string} A random 12-character string.
 */
function generateRandomKey(length = 12): string {
	const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}

export class SanitySchemaMapper implements INodeType {
	description: INodeTypeDescription = {
		// - SECTION 1: NODE IDENTITY (from our plan) -
		displayName: 'Sanity Schema Mapper',
		name: 'sanitySchemaMapper',
		// FIX: The 'group' property also requires `as const` for strict type checking.
		group: ['transform'] as const,
		version: 1,
		description: 'Takes a Sanity schema and input data, then transforms it into a valid Sanity document.',
		defaults: {
			name: 'Sanity Mapper',
		},
		// FIX: Use `as const` to tell TypeScript to infer a specific tuple type, not a general string array.
   inputs: [{
        type: NodeConnectionType.Main,
        displayName: 'Input',
    }],
    outputs: [{
        type: NodeConnectionType.Main,
        displayName: 'Output',
    }],
		properties: [
			// - SECTION 2: NODE PROPERTIES (UI) (from our plan) -

			// 1. Sanity Schema Input
			{
				displayName: 'Sanity Document Schema',
				name: 'schema',
				type: 'json',
				required: true,
				default: '',
				description: 'Paste the JSON schema for your Sanity document type. Found in your Sanity project schema files.',
			},

			// 2. Field Mappings
			{
				displayName: 'Field Mappings',
				name: 'mappings',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				description: 'Map incoming data fields to your Sanity schema fields',
				placeholder: 'Add Mapping Rule',
				default: {},
				options: [
					{
						name: 'values',
						displayName: 'Mapping',
						values: [
							{
								displayName: 'Sanity Field Path',
								name: 'sanityField',
								type: 'string',
								default: 'title',
								description: 'The path to the target field in the Sanity document (e.g., title, slug.current, author)',
							},
							{
								displayName: 'Input Value',
								name: 'inputValue',
								type: 'string',
								default: '={{ $json.someValue }}',
								description: 'The value or expression from the incoming data to map to the Sanity field',
							},
						],
					},
				],
			},
		],
	};

	// - SECTION 3: EXECUTION LOGIC (from our plan) -
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get the node parameters as defined in the properties array
		const schemaString = this.getNodeParameter('schema', 0) as string;
		const { mappings } = this.getNodeParameter('mappings', 0) as {
			mappings: { values: { sanityField: string; inputValue: any }[] };
		};

		let schema: any;
		try {
			schema = JSON.parse(schemaString);
		} catch (error) {
			new NodeOperationError(this.getNode(), 'Invalid Sanity Schema JSON provided.')
		}

		// Iterate over each item passed from the previous node
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const outputDocument: { [key: string]: any } = {};

			// Set the document type from the schema name
			outputDocument._type = schema.name;

			// Process each mapping rule defined by the user
			for (const rule of mappings.values) {
				const sanityFieldPath = rule.sanityField;
				const inputValue = rule.inputValue;

				// TODO: SECTION 4 - FIELD TYPE TRANSFORMATION LOGIC
				// This is where we will implement the "special sauce".
				// For now, we'll just do a direct mapping.
				// In the next step, we will:
				// 1. Look up the field type from the schema.
				// 2. Transform the `inputValue` based on its type (slug, reference, portable text, etc.).
				// 3. Set the transformed value.

				const transformedValue = inputValue; // Placeholder for transformation

				// Use lodash.set to handle nested paths like 'slug.current'
				set(outputDocument, sanityFieldPath, transformedValue);
			}

			// Prepare the data for the next node
			returnData.push({
				json: outputDocument,
				pairedItem: { item: itemIndex },
			});
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
