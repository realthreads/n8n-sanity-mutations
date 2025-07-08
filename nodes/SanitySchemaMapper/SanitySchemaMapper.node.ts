// IMPORTANT: To resolve TypeScript errors for lodash, you must install its type definitions
// Run: npm i --save-dev @types/lodash
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import set from 'lodash/set';

// --- HELPER FUNCTIONS ---

/**
 * Generates a random key for Portable Text blocks and other array items.
 * @param {number} length The length of the key.
 * @returns {string} A random alphanumeric string.
 */
function generateRandomKey(length = 12): string {
	const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}

/**
 * Finds the type of a field from the Sanity schema based on its path.
 * @param {any} schema The parsed Sanity document schema.
 * @param {string} path The field path (e.g., 'slug.current' or 'body').
 * @returns {string | null} The type of the field, or null if not found.
 */
function getFieldTypeFromSchema(schema: any, path: string): string | null {
	const fieldName = path.split('.')[0];
	const field = schema.fields.find((f: any) => f.name === fieldName);
	if (!field) return null;

	// Handle nested fields like 'slug.current'
	if (path.includes('.') && field.type === 'slug') {
		return 'slug';
	}

	// For array of blocks (Portable Text)
	if (field.type === 'array' && field.of?.some((t: any) => t.type === 'block')) {
		return 'portableText';
	}

	return field.type;
}

/**
 * Transforms an input value into the correct Sanity format based on its schema type.
 * @param {any} value The input value from the user mapping.
 * @param {string | null} type The determined Sanity field type.
 * @returns {any} The transformed value ready for Sanity.
 */
function transformValue(value: any, type: string | null): any {
	switch (type) {
		case 'slug':
			return { _type: 'slug', current: value };
		case 'reference':
			return { _type: 'reference', _ref: value };
		case 'image':
			return { _type: 'image', asset: { _type: 'reference', _ref: value } };
		case 'file':
			return { _type: 'file', asset: { _type: 'reference', _ref: value } };
		case 'portableText':
			if (typeof value !== 'string') return value; // Assume it's already formatted
			return [
				{
					_type: 'block',
					_key: generateRandomKey(),
					style: 'normal',
					children: [{ _type: 'span', text: value, marks: [] }],
					markDefs: [],
				},
			];
		default:
			// For string, number, boolean, text, etc., return as is.
			return value;
	}
}

export class SanitySchemaMapper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sanity Schema Mapper',
		icon: 'file:sanitySchemaMapper.svg',
		name: 'sanitySchemaMapper',
		group: ['transform'] as const,
		version: 1,
		description: 'Takes a Sanity schema and input data, then transforms it into a valid Sanity document.',
		defaults: {
			name: 'Sanity Mapper',
		},
		inputs: [{ type: NodeConnectionType.Main, displayName: 'Input' }],
		outputs: [{ type: NodeConnectionType.Main, displayName: 'Output' }],
		properties: [
			{
				displayName: 'Sanity Document Schema',
				name: 'schema',
				type: 'json',
				required: true,
				default: '',
				description: 'Paste the JSON schema for your Sanity document type. Found in your Sanity project schema files.',
			},
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const schemaString = this.getNodeParameter('schema', 0, '') as string;
		const { mappings } = this.getNodeParameter('mappings', 0, { values: [] }) as {
			mappings: { values: { sanityField: string; inputValue: any }[] };
		};

		let schema: any;
		try {
			schema = JSON.parse(schemaString);
		} catch (error) {
			throw new NodeOperationError(this.getNode(), 'Invalid Sanity Schema JSON provided.');
		}

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const outputDocument: { [key: string]: any } = {
				_type: schema.name,
			};

			for (const rule of mappings.values) {
				const sanityFieldPath = rule.sanityField;
				const inputValue = rule.inputValue;

				// Determine the field type from the schema
				const fieldType = getFieldTypeFromSchema(schema, sanityFieldPath);

				// Transform the value based on its type
				const transformedValue = transformValue(inputValue, fieldType);

				// Set the transformed value on the output document
				set(outputDocument, sanityFieldPath, transformedValue);
			}

			returnData.push({
				json: outputDocument,
				pairedItem: { item: itemIndex },
			});
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
