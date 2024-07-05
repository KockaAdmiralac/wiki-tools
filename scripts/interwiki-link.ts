import { writeFile } from 'fs/promises';
import { createInterface } from 'readline/promises';
import { Mwn } from 'mwn';
import { Config, getApiUrl, readJSONOrDefault } from '../lib/util.js';
import { getAllPageTitles } from '../lib/mediawiki.js';
import { InterwikiMap } from '../lib/interwiki-util.js';

export async function main(config: Config) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.log('wtf');
    const interwiki: InterwikiMap = await readJSONOrDefault('interwiki.json', {});
    const langCode = await rl.question('Enter the language code (e.g., pt-br): ');
    const enBot = new Mwn({
        apiUrl: getApiUrl(config),
        silent: true,
        userAgent: 'Interlanguage linker'
    });
    const langBot = new Mwn({
        apiUrl: getApiUrl(config, langCode),
        silent: true,
        userAgent: 'Interlanguage linker'
    });
    const enPages = await getAllPageTitles(enBot);
    const langPages = await getAllPageTitles(langBot);
    const enPageSet = new Set(enPages);

    for (const langPage of langPages) {
        if (Object.values(interwiki).some(t => t[langCode] === langPage)) {
            // Page already registered.
            continue;
        }
        while (true) {
            let enPage = await rl.question(`Enter the English page name for "${langPage}" (enter < to skip): `);
            if (enPage === '<') {
                break;
            }
            if (!enPage) {
                // If an empty string is entered, use the language page name.
                enPage = langPage;
            }
            if (!enPageSet.has(enPage)) {
                const suggestions = enPages.filter(page => page.startsWith(enPage));
                console.error(`Page "${enPage}" not found on the English wiki.`);
                if (suggestions.length > 0) {
                    console.info('Suggestions:', suggestions.join(', '));
                } else {
                    console.error('No suggestions found.');
                }
            } else {
                if (!interwiki[enPage]) {
                    interwiki[enPage] = {};
                }
                interwiki[enPage][langCode] = langPage;
                break;
            }
        }
    }
    await writeFile('interwiki.json', JSON.stringify(interwiki, null, 4));
    rl.close();
}
