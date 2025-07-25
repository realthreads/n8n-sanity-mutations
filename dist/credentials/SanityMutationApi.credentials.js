"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanityMutationApi = void 0;
class SanityMutationApi {
    constructor() {
        this.name = 'sanityMutationApi';
        this.displayName = 'SanityMutation API';
        this.documentationUrl = 'https://www.sanity.io/docs/http-api';
        this.properties = [
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
        this.test = {
            request: {
                method: 'GET',
                url: '=https://{{$credentials.projectId}}.api.sanity.io/v2021-10-21/data/query/{{$credentials.dataset}}',
                qs: {
                    query: `*[_type == "sanity.project" && _id == "sane-project-name"]`,
                },
                headers: {
                    'Accept': 'application/json',
                    'Authorization': '=Bearer {{$credentials.token}}',
                },
            },
        };
    }
}
exports.SanityMutationApi = SanityMutationApi;
//# sourceMappingURL=SanityMutationApi.credentials.js.map