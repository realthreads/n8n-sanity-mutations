"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitySchemaMapper = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const set_1 = __importDefault(require("lodash/set"));
function generateRandomKey(length = 12) {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
function getFieldTypeFromSchema(schema, path) {
    var _a;
    if (!schema || !Array.isArray(schema.fields)) {
        return null;
    }
    const fieldName = path.split('.')[0];
    const field = schema.fields.find((f) => f.name === fieldName);
    if (!field)
        return null;
    if (path.includes('.') && field.type === 'slug') {
        return 'slug';
    }
    if (field.type === 'array' && ((_a = field.of) === null || _a === void 0 ? void 0 : _a.some((t) => t.type === 'block'))) {
        return 'portableText';
    }
    return field.type;
}
function transformValue(value, type) {
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
            if (typeof value !== 'string')
                return value;
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
            return value;
    }
}
class SanitySchemaMapper {
    constructor() {
        this.description = {
            displayName: 'Sanity Schema Mapper',
            name: 'sanitySchemaMapper',
            icon: 'file:sanitySchemaMapper.svg',
            group: ['transform'],
            version: 1,
            description: 'Takes a Sanity schema and input data, then transforms it into a valid Sanity document.',
            defaults: {
                name: 'Sanity Mapper',
            },
            inputs: [{ type: "main", displayName: 'Input' }],
            outputs: [{ type: "main", displayName: 'Output' }],
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
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const schemaString = this.getNodeParameter('schema', 0, '');
        const mappings = this.getNodeParameter('mappings', 0, { values: [] });
        let schema;
        try {
            schema = JSON.parse(schemaString);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Invalid Sanity Schema JSON provided.');
        }
        if (!schema.name || !Array.isArray(schema.fields)) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Schema must be a valid document schema object with "name" and "fields" properties.');
        }
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            const outputDocument = {
                _type: schema.name,
            };
            for (const rule of mappings.values) {
                const sanityFieldPath = rule.sanityField;
                const inputValue = rule.inputValue;
                const fieldType = getFieldTypeFromSchema(schema, sanityFieldPath);
                const transformedValue = transformValue(inputValue, fieldType);
                (0, set_1.default)(outputDocument, sanityFieldPath, transformedValue);
            }
            returnData.push({
                json: outputDocument,
                pairedItem: { item: itemIndex },
            });
        }
        return [this.helpers.returnJsonArray(returnData)];
    }
}
exports.SanitySchemaMapper = SanitySchemaMapper;
//# sourceMappingURL=SanitySchemaMapper.node.js.map