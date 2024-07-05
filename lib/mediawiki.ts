import {Mwn} from 'mwn';

export async function getAllPageTitles(bot: Mwn): Promise<string[]> {
    const response = await bot.continuedQuery({
        action: 'query',
        list: 'allpages',
        apnamespace: 0,
        aplimit: 'max',
        apfilterredir: 'nonredirects'
    });
    return response
        .flatMap(page => ((page.query || {}).allpages || [])
            .map((page: any) => page.title));
}
