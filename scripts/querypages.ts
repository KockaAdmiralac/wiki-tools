import { Mwn } from 'mwn';
import {
    MaintenanceMap,
    compareStringMaps,
    getDiffAndUpdate,
    sendToDiscord
} from '../lib/discord.js';
import {
    Config,
    getApiUrl,
    getPageUrl
} from '../lib/util.js';

type QueryPageMap = MaintenanceMap<string>;

async function fetchQueryPage(bot: Mwn, qppage: string): Promise<string[]> {
    const responses: any[] = await bot.continuedQuery({
        action: 'query',
        list: 'querypage',
        qppage,
        qplimit: 'max'
    });
    return responses
        .flatMap(r => r.query.querypage.results)
        .map(result => result.title);
}

async function fetchQueryPages(bot: Mwn, querypages: string[]): Promise<QueryPageMap> {
    const result: QueryPageMap = {};
    for (const querypage of querypages) {
        if (querypage === 'LintErrors') {
            continue;
        }
        result[querypage] = await fetchQueryPage(bot, querypage);
    }
    return result;
}

async function fetchLintErrors(bot: Mwn): Promise<QueryPageMap> {
    const responses: any[] = await bot.continuedQuery({
        action: 'query',
        list: 'linterrors',
        lntlimit: 'max'
    });
    const result: QueryPageMap = {};
    for (const response of responses) {
        for (const {title, category} of response?.query?.linterrors || []) {
            const formattedCategory = `LintErrors/${category}`;
            result[formattedCategory] = result[formattedCategory] || [];
            result[formattedCategory].push(title);
        }
    }
    return result;
}

export async function main(config: Config) {
    const bot = new Mwn({
        apiUrl: getApiUrl(config),
        silent: true,
        userAgent: 'MediaWiki link checker'
    });
    const queryPages = await fetchQueryPages(bot, config.querypages);
    const lintErrorsEnabled = config.querypages.includes('LintErrors');
    const lintErrors = lintErrorsEnabled ? await fetchLintErrors(bot) : {};
    const queryLintPages = {...queryPages, ...lintErrors};
    const diff = await getDiffAndUpdate('querypages.json', queryLintPages, compareStringMaps);
    await sendToDiscord<string>({
        addedTitle: page => `New reports on ${page}`,
        removedTitle: page => `Resolved reports on ${page}`,
        config,
        diff,
        formatItem: page => `- [${page}](<${getPageUrl(config, page)}>)`
    });
}
