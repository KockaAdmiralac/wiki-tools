import { readFile, writeFile } from 'fs/promises';

export interface Config {
    configName: string;
    baseUrl: string;
    articlePath: string;
    scriptPath: string;
    namespaces: number[];
    querypages: string[];
    webhook: {
        id: string;
        token: string;
    };
    username?: string
    password?: string
}

export async function readJSON(fileName: string): Promise<any> {
    const json = await readFile(fileName, 'utf8');
    return JSON.parse(json);
}

export async function readJSONOrDefault(fileName: string, fallback: any) {
    try {
        return await readJSON(fileName);
    } catch (error: any) {
        if (error && error.code === 'ENOENT') {
            return fallback;
        }
        throw error;
    }
}

export function getApiUrl(config: Config, language: string = 'en'): string {
    if (language === 'en') {
        return `${config.baseUrl}${config.scriptPath}/api.php`;
    }
    return `${config.baseUrl}/${language}${config.scriptPath}/api.php`;
}

export function getPageUrl(config: Config, page: string, language: string = 'en'): string {
    return `${config.baseUrl}${config.articlePath}/${encodeURIComponent(page)}`;
}

export async function writeJSON(fileName: string, json: any) {
    const jsonString = JSON.stringify(json, null, 4);
    await writeFile(fileName, jsonString);   
}
