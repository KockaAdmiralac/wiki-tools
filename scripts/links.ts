import { Mwn } from 'mwn';
import { SingleBar } from 'cli-progress';
import { isIP } from 'net';
import {
    MaintenanceMap,
    compareMaps,
    getDiffAndUpdate,
    sendToDiscord
} from '../lib/discord.js';
import {
    Config,
    getApiUrl,
    getPageUrl
} from '../lib/util.js';

interface ExternalLinksMap {
    [link: string]: string[];
}

interface LinkHttpError {
    status: number;
    statusText: string;
}

type LinkErrorBase = {
    type: 'http';
    error: LinkHttpError;
} | {
    type: 'fetch';
    error: {
        cause: {
            code: string;
        }
    };
};
type LinkError = LinkErrorBase & {
    link: string;
    pages: string[];
}

type SortedLinkErrors = MaintenanceMap<LinkError>;

function isPrivateIP(ip: string): boolean {
    if (!isIP(ip)) {
        return false;
    }
    return ip.startsWith('10.') ||
           ip.startsWith('172.16.') ||
           ip.startsWith('192.168.') ||
           ip.startsWith('127.');
}

function shouldSkipLink(link: string): boolean {
    const url = new URL(link);
    return !['http:', 'https:'].includes(url.protocol) ||
           isPrivateIP(url.hostname) ||
           url.hostname === 'localhost' ||
           url.hostname === 'mega.nz';
}

async function fetchExternalLinks(bot: Mwn, namespaces: number[]): Promise<ExternalLinksMap> {
    const externalLinksMap: ExternalLinksMap = {};
    for await (const response of bot.continuedQueryGen({
        action: 'query',
        eulimit: 'max',
        eunamespace: namespaces,
        euprop: 'title|url',
        list: 'exturlusage'
    })) {
        if (!response || !response.query) {
            continue;
        }
        for (const {title, url} of response.query.exturlusage) {
            if (shouldSkipLink(url)) {
                continue;
            }
            externalLinksMap[url] = externalLinksMap[url] || [];
            externalLinksMap[url].push(title);
        }
    }
    return externalLinksMap;
}

async function checkExternalLink(link: string, method: string = 'HEAD'): Promise<LinkErrorBase | undefined> {
    try {
        const response = await fetch(link, {
            method,
            signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) {
            return {
                type: 'http',
                error: {
                    status: response.status,
                    statusText: response.statusText
                }
            };
        }
    } catch (error: any) {
        return {
            type: 'fetch',
            error: error
        };
    }
}

async function checkExternalLinks(externalLinksMap: ExternalLinksMap): Promise<LinkError[]> {
    const progressBar = new SingleBar({});
    progressBar.start(Object.keys(externalLinksMap).length, 0);
    const errors: LinkError[] = [];
    for (const [link, pages] of Object.entries(externalLinksMap)) {
        const linkError = await checkExternalLink(link);
        if (linkError) {
            errors.push({
                ...linkError,
                link,
                pages
            });
        }
        progressBar.increment();
    }
    progressBar.stop();
    return errors;
}

function sortErrors(errors: LinkError[]): SortedLinkErrors {
    const result: SortedLinkErrors = {};
    for (const error of errors) {
        const key = (error.type === 'http') ?
            error.error.status :
            error.error.cause?.code;
        result[key] = result[key] || [];
        result[key].push(error);
    }
    return result;
}

async function retryErrors(errors: SortedLinkErrors ): Promise<SortedLinkErrors> {
    const methodNotAllowedErrors = errors[405];
    delete errors[405];
    for (const {link, pages} of methodNotAllowedErrors) {
        const linkError = await checkExternalLink(link, 'GET');
        if (linkError) {
            errors[linkError.type] = errors[linkError.type] || [];
            errors[linkError.type].push({
                ...linkError,
                link,
                pages
            });
        }
    }
    return errors;
}

export async function main(config: Config) {
    const bot = new Mwn({
        apiUrl: getApiUrl(config),
        silent: true,
        userAgent: 'MediaWiki link checker'
    });
    const externalLinksMap = await fetchExternalLinks(bot, config.namespaces);
    const errors = await checkExternalLinks(externalLinksMap);
    const sortedErrors = sortErrors(errors);
    const retriedErrors = await retryErrors(sortedErrors);
    const diff = await getDiffAndUpdate(config.wikiId, 'link-errors', retriedErrors, compareMaps('link'));
    const pageToMdLink = (p: string) => `[${p}](<${getPageUrl(config, p)}>)`;
    await sendToDiscord({
        addedTitle: type => `New ${type} link errors`,
        removedTitle: type => `Resolved ${type} link errors`,
        config,
        diff,
        formatItem: ({link, pages}) => `- <${link}>: ${pages.map(pageToMdLink).join(', ')}`
    });
}
