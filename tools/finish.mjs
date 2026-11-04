// Runs at the end of every `astro build`, whichever build command is used.
// Adds the header and strip photos to the inner pages and the trackside tool to Damper Adjustment Explained.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export default function finish() {
  return { name: 'tftr-finish', hooks: { 'astro:build:done': ({ dir }) => {
    const dist = fileURLToPath(dir);
    const pages = JSON.parse(fs.readFileSync(path.join(here, 'page-photos.json'), 'utf8'));
    for (const [key, p] of Object.entries(pages)) {
      const f = path.join(dist, key, 'index.html'); let s = fs.readFileSync(f, 'utf8');
      let done = 0;
      s = s.replace(/(<section class="page-hero[^>]*>)/, (m) => { done++;
        const tag = m.replace('class="page-hero', 'class="page-hero' + (p.kind === 'kit' ? ' is-kit' : ''));
        if (p.kind === 'kit') return tag + `<figure class="page-hero-panel"><img class="page-hero-img" src="/assets/pages/${p.img}" alt="${p.cap}">` + (p.cap ? `<figcaption>${p.cap}</figcaption>` : '') + '</figure>';
        return tag + `<img class="page-hero-img" src="/assets/pages/${p.img}" alt="" style="object-position:${p.fx}% ${p.fy}%">`;
      });
      if (!done) throw new Error('no page hero on ' + key);
      const strip = '<div class="photo-strip">' + p.strip.map((i) => `<figure><img src="/assets/pages/${i}" alt="" loading="lazy"></figure>`).join('') + '</div>';
      const a = s.indexOf('</main>'), ends = [...s.slice(0, a).matchAll(/<\/section>/g)].map((m) => m.index + 10);
      const at = ends.length > 2 ? ends[1] : ends[ends.length - 1];
      s = s.slice(0, at) + strip + s.slice(at);
      fs.writeFileSync(f, s);
    }
    const g = path.join(dist, 'damper-adjustment-explained/index.html'); let s = fs.readFileSync(g, 'utf8');
    if (!s.includes('assets/guide.js')) {
      s = s.replace('</head>', '<script>document.documentElement.classList.add("g-on")</script><link rel="stylesheet" href="/assets/guide.css"></head>').replace('</body>', '<script src="/assets/guide.js"></script></body>');
      fs.writeFileSync(g, s);
    }
  } } };
}
