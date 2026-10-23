// Load the stage once and print any page error with its stack (file:line), e.g. after a copy change breaks a scene.
//   node tools/stage_errors.mjs <job root>
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
const ROOT = process.argv[2];
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 608 } });
p.on('pageerror', e => console.log('PAGEERROR', e.stack || e.message));
await p.goto(pathToFileURL(ROOT + '/stage.html').href);
try { await p.evaluate(() => window.ready); console.log('ready ok'); } catch (e) { console.log('READY FAILED', (e.stack || e.message).split('\n').slice(0, 8).join('\n')); }
await b.close();
