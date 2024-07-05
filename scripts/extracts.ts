import {promisify} from 'util';
import {Mwn} from 'mwn';
import {
    Config,
    getApiUrl
} from '../lib/util.js';
import {getAllPageTitles} from '../lib/mediawiki.js';

const wait = promisify(setTimeout);

async function purgePages(bot: Mwn, pages: string[]) {
    const batchSize = 30;
    for (let batchStart = 0; batchStart < pages.length; batchStart += batchSize) {
        const batch = pages.slice(batchStart, batchStart + batchSize);
        console.log(await bot.purge(batch));
        await wait(62 * 1000);
    }
}

async function queryExtracts(bot: Mwn, pages: string[]) {
    await bot.massQuery({
        prop: 'extracts',
        exintro: true,
        exchars: 525,
        explaintext: true,
        exsectionformat: 'plain',
        titles: pages
    }, 'titles');
}

export async function main(config: Config) {
    const bot = new Mwn({
        apiUrl: getApiUrl(config),
        silent: true,
        userAgent: 'TextExtracts fixer'
    });
    const pages = await getAllPageTitles(bot);
    await purgePages(bot, pages);
    await queryExtracts(bot, pages);
}
