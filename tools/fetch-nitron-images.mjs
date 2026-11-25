// Downloads Nitron's own product photo for each kit on the TFTR Nitron pages.
// Source: https://www.nitron.com (official dealer use). Run from the site folder:
//   node tools/fetch-nitron-images.mjs
// Saves photos to public/images/nitron/ and a list to tools/nitron-images.json
import fs from 'node:fs';
import path from 'node:path';

const STEMS = 'NTCAP010 NTCBM011 NTCBM014 NTCBM022 NTCBM027 NTCBM029 NTCBM032 NTCHO010 NTCLO010 NTCLO011 NTCLO012 NTCLO013 NTCLO014 NTCLO017 NTCLO019 NTCLO020 NTCLO022 NTCLO023 NTCLO025 NTCLO030 NTCLO031 NTCLO032 NTCMA011 NTCMA014 NTCPO013 NTCPO021 NTCPO023 NTCPO024 NTCPO028 NTCPO030 NTCPO031 NTCPO036 NTCPO038 NTCPO042 NTCSU015 NTCTO012 NTCTO014 NTCTO017 NTCTV010 NTCTV011 NTCTV012 NTCTV013 NTCTV014 NTCTV015 NTCTV016 NTCTV017'.split(' ');
const API = 'https://www.nitron.com/wp-json/wc/store/v1/products';
const OUT = path.join('public', 'images', 'nitron');
const LIST = path.join('tools', 'nitron-images.json');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh) TooFastToRace dealer image sync', 'Accept': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if (res.status === 400) return [];
    console.log(`  waiting (${res.status}) ...`);
    await sleep(4000 * attempt);
  }
  throw new Error('Could not read ' + url);
}

// Pick a version about 1000px wide when Nitron offers one, otherwise the original.
function pickImage(img) {
  if (!img) return null;
  const options = [];
  if (img.srcset) {
    for (const part of img.srcset.split(',')) {
      const [u, w] = part.trim().split(/\s+/);
      const width = parseInt(w, 10);
      if (u && width) options.push({ u, width });
    }
  }
  const good = options.filter((o) => o.width >= 800 && o.width <= 1400).sort((a, b) => a.width - b.width);
  return good.length ? good[0].u : img.src;
}

fs.mkdirSync(OUT, { recursive: true });
const results = {};
let downloaded = 0, skipped = 0, noImage = 0;

for (const stem of STEMS) {
  console.log(stem);
  let products = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await getJson(`${API}?search=${stem}&per_page=50&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    products = products.concat(batch);
    if (batch.length < 50) break;
    await sleep(600);
  }
  for (const p of products) {
    const sku = (p.sku || '').trim();
    if (!sku.toUpperCase().startsWith(stem)) continue;
    const key = sku.replace(/_+$/, '');
    const url = pickImage(p.images && p.images[0]);
    const entry = { sku, name: p.name, page: p.permalink, source: url || '', file: '' };
    if (!url) {
      noImage++;
    } else {
      const ext = (path.extname(new URL(url).pathname) || '.jpg').toLowerCase();
      const file = key.replace(/\+/g, '-').replace(/[^A-Za-z0-9_-]/g, '') + ext;
      const dest = path.join(OUT, file);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        skipped++;
      } else {
        const res = await fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
        if (res.ok) {
          fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
          downloaded++;
          await sleep(300);
        } else {
          console.log(`  could not download ${url} (${res.status})`);
          results[key] = entry;
          continue;
        }
      }
      entry.file = '/images/nitron/' + file;
    }
    results[key] = entry;
  }
  await sleep(800);
}

fs.writeFileSync(LIST, JSON.stringify(results, null, 1));
console.log(`\nFinished. ${downloaded} photos downloaded, ${skipped} already there, ${noImage} kits with no photo on Nitron's site.`);
console.log(`List saved to ${LIST}`);
