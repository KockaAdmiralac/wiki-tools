import { Config } from '../lib/util.js';
import { main as extracts } from './extracts.js';
import { main as interwikiEdit } from './interwiki-edit.js';
// import { main as interwikiLink } from './interwiki-link.js';
import { main as links } from './links.js';
import { main as querypages } from './querypages.js';

const scripts: Record<string, (config: Config, args: string[]) => Promise<void>> = {
    extracts,
    interwikiEdit,
    'interwiki-edit': interwikiEdit,
    // interwikiLink,
    // 'interwiki-link': interwikiLink,
    links,
    querypages
};

export default scripts;
