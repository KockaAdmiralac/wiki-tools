import { Mwn } from 'mwn';
import { InterwikiMap } from '../lib/interwiki-util.js';
import { Config, getApiUrl, readJSONOrDefault } from '../lib/util.js';

function transformInterwikiData(data: InterwikiMap, language: string): InterwikiMap {
    if (language === 'en') {
        return data;
    }
    const transformedData: InterwikiMap = {};
    for (const [englishTitle, translations] of Object.entries(data)) {
        const translatedTitle = translations[language];
        if (translatedTitle) {
            if (!transformedData[translatedTitle]) {
                transformedData[translatedTitle] = {};
            }
            transformedData[translatedTitle]['en'] = englishTitle;
            for (const [lang, title] of Object.entries(translations)) {
                if (lang !== language) {
                    transformedData[translatedTitle][lang] = title;
                }
            }
        }
    }
    return transformedData;
}

export async function main(config: Config, args: string[]) {
    const targetLanguage = args[0] || 'en';
    const interwikiData = transformInterwikiData(await readJSONOrDefault('interwiki.json', {}), targetLanguage);
    const bot = new Mwn({
        apiUrl: getApiUrl(config, targetLanguage),
        username: config.username,
        password: config.password,
        userAgent: 'Interwiki link updater'
    });
    await bot.login();
    for (const [page, translations] of Object.entries(interwikiData)) {
        try {
            await bot.edit(page, ({content}) => {
                const noInterlang = content.replace(/\n\[\[[a-z\-]+:[^\]]+\]\]/g, '');
                const newInterlanguageLinks = Object.entries(translations)
                    .map(([lang, title]) => `[[${lang}:${title}]]`)
                    .join('\n');
                const text = `${noInterlang}\n${newInterlanguageLinks}`;
                return {
                    bot: true,
                    minor: true,
                    summary: 'Updated interlanguage links',
                    text,
                    watchlist: 'nochange'
                };
            });
            console.info(`Updated interlanguage links on page: ${page}`);
        } catch (error: any) {
            if (error && error.code === 'protectedpage') {
                console.error('Cannot edit', page, 'due to protection!');
            } else {
                throw error;
            }
        }
    }
}
