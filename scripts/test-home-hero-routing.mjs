#!/usr/bin/env node
/** Smart routing: home hero → Toolkit vs TVC Brain */
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { routeHeroQuery } = require(join(ROOT, 'js/home-hero-search.js'));

function check(name, cond) {
    if (!cond) throw new Error(name);
    console.log('OK', name);
}

check('IMPA code → store', routeHeroQuery('791801').type === 'toolkit' && routeHeroQuery('791801').href.includes('/store/791801'));
check('JIS spec → toolkit', routeHeroQuery('JIS 10K 50A').type === 'toolkit');
check('54B formula → toolkit', routeHeroQuery('54B 0.985').type === 'toolkit');
check('RPM hunting → brain', routeHeroQuery('Yanmar 6N21L RPM 헌팅 원인은?').type === 'brain');
check('boiler fault → brain', routeHeroQuery('보일러 착화 불량 조치').type === 'brain');
check('long english → brain', routeHeroQuery('cargo pump mechanical seal leak troubleshooting').type === 'brain');

console.log('\nHome hero routing tests passed.');
