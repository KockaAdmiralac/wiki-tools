import {WebhookClient} from 'discord.js';
import {
    Config,
    readDataFile,
    writeDataFile
} from './util.js';

export interface Diff<T> {
    added: T[];
    removed: T[];
}

export interface CategorizedDiff<T> {
    [category: string]: Diff<T>;
}

function truncateList<T>(items: T[], formatItem: (item: T) => string) {
    const formattedItems = items.map(formatItem);
    const pickedItems = [];
    let messageLength = 0;
    for (const item of formattedItems) {
        if (messageLength + item.length + 1 > 4000) {
            pickedItems.push('- …');
            break;
        }
        messageLength += item.length + 1;
        pickedItems.push(item);
    }
    return pickedItems.join('\n');
}

export async function getDiffAndUpdate<T, K>(wikiId: string, fileName: string, current: T, differ: (current: T, previous: T) => CategorizedDiff<K>) {
    const previous = await readDataFile(wikiId, fileName, {});
    const diff = differ(previous, current);
    await writeDataFile(wikiId, fileName, current);
    return diff;
}

export interface MaintenanceMap<T> {
    [key: string]: T[];
}

interface MapDiffer<T> {
    (current: MaintenanceMap<T>, previous: MaintenanceMap<T>): CategorizedDiff<T>;
}

export function compareMapsBase<T>(includes: (arr: T[], elem: T) => boolean, previous: MaintenanceMap<T>, current: MaintenanceMap<T>): CategorizedDiff<T> {
    const diff: CategorizedDiff<T> = {};
    const allKeys = Array.from(new Set([
        ...Object.keys(previous),
        ...Object.keys(current)
    ]));
    for (const key of allKeys) {
        const previousItems = previous[key] || [];
        const currentItems = current[key] || [];
        const added = currentItems.filter(p => !includes(previousItems, p));
        const removed = previousItems.filter(p => !includes(currentItems, p));
        if (added.length > 0 || removed.length > 0) {
            diff[key] = { added, removed };
        }
    }
    return diff;
}

export function compareStringMaps(previous: MaintenanceMap<string>, current: MaintenanceMap<string>): CategorizedDiff<string> {
    return compareMapsBase((arr: string[], elem: string) => arr.includes(elem), previous, current);
}

export function compareMaps<T>(key: keyof T): MapDiffer<T> {
    const includes = (arr: T[], elem: T) =>
        Boolean(arr.find(elem2 => elem[key] === elem2[key]));
    return function(previous: MaintenanceMap<T>, current: MaintenanceMap<T>): CategorizedDiff<T> {
        return compareMapsBase(includes, previous, current);
    };
}

interface DiscordSendOptions<T> {
    config: Config,
    diff: CategorizedDiff<T>,
    addedTitle: (category: string) => string,
    removedTitle: (category: string) => string,
    formatItem: (item: T) => string
}

function embedCharCount(embed: any): number {
    return embed.title.length + embed.description.length;
}

export async function sendToDiscord<T>({config, diff, addedTitle, removedTitle, formatItem}: DiscordSendOptions<T>) {
    const allEmbeds = [];
    for (const [category, {added, removed}] of Object.entries(diff)) {
        if (added.length > 0) {
            allEmbeds.push({
                title: addedTitle(category).slice(0, 256),
                color: 0xFF0000,
                description: truncateList(added, formatItem)
            });
        }
        if (removed.length > 0) {
            allEmbeds.push({
                title: removedTitle(category).slice(0, 256),
                color: 0x00FF00,
                description: truncateList(removed, formatItem)
            });
        }
    }
    const webhook = new WebhookClient(config.webhook);
    let totalCharacterCount = 0;
    let embeds: any[] = [];
    while (allEmbeds.length > 0) {
        const embed = allEmbeds.shift();
        const charCount = embedCharCount(embed);
        if (embeds.length >= 10 || totalCharacterCount + charCount > 6000) {
            await webhook.send({embeds});
            embeds = [];
            totalCharacterCount = 0;
        }
        embeds.push(embed);
        totalCharacterCount += charCount;
    }
    if (embeds.length > 0) {
        await webhook.send({embeds});
    }
    webhook.destroy();
}

