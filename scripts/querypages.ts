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
        result[querypage] = await fetchQueryPage(bot, querypage);
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
    const diff = await getDiffAndUpdate('querypages.json', queryPages, compareStringMaps);
    await sendToDiscord<string>({
        addedTitle: page => `New reports on ${page}`,
        removedTitle: page => `Resolved reports on ${page}`,
        config,
        diff,
        formatItem: page => `- [${page}](<${getPageUrl(config, page)}>)`
    });
}
