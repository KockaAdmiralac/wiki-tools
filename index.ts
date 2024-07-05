import { argv, exit } from 'process';
import Ajv, {JSONSchemaType} from 'ajv';
import { Config, readJSON } from './lib/util.js';
import scripts from './scripts/index.js';

const schema: JSONSchemaType<Config> = {
    type: 'object',
    properties: {
        baseUrl: {
            type: 'string',
            pattern: '^https?://.*$'
        },
        articlePath: {
            type: 'string',
            pattern: '^/.*$'
        },
        scriptPath: {
            type: 'string',
            pattern: '^/.*$'
        },
        namespaces: {
            type: 'array',
            items: {
                type: 'number',
                minimum: 0
            }
        },
        querypages: {
            type: 'array',
            items: {
                type: 'string'
            }
        },
        webhook: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    pattern: '\\d+'
                },
                token: {
                    type: 'string'
                }
            },
            required: ['id', 'token'],
            additionalProperties: false
        },
        username: {
            type: 'string',
            nullable: true
        },
        password: {
            type: 'string',
            nullable: true
        }
    },
    required: [
        'baseUrl',
        'articlePath',
        'scriptPath',
        'namespaces',
        'querypages',
        'webhook'
    ],
    additionalProperties: false
};

async function readConfigFile(filePath: string): Promise<Config> {
    try {
        const config = await readJSON(filePath);
        const ajv = new Ajv();
        const validate = ajv.compile(schema);
        if (!validate(config)) {
            throw new Error(`Invalid configuration: ${ajv.errorsText(validate.errors)}`);
        }
        return config;
    } catch (error: any) {
        throw new Error(`Error reading configuration file: ${error.message}`);
    }
}

async function main() {
    const scriptName = argv[2];
    const configPath = argv[3];
    if (!scriptName || !configPath) {
        console.error('Script name and configuration path required.');
        exit(1);
    }
    const config = await readConfigFile(configPath);
    if (!scripts[scriptName]) {
        console.error(`Unknown script: '${scriptName}'.`)
        exit(1);
    }
    const scriptArgs = argv.slice(4);
    await scripts[scriptName](config, scriptArgs);
}

main();
