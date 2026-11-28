const { chromium } = require('playwright');
(async () => {
  const [,, file, outdir, ...pairs] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1400 } });
  await p.goto('file://' + file, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  for (const pr of pairs) { const [id, name] = pr.split('='); await (await p.$('#' + id)).screenshot({ path: outdir + '/' + name }); }
  console.log(await p.evaluate(() => [...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family))].join(',')));
  await b.close();
})();
