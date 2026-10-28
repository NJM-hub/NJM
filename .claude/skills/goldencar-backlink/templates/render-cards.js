const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 1200 } });
  await p.goto('file://' + process.argv[2], { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const names = { c1: '01_공항의전_의전서비스_공항픽업_골든카.png', c2: '02_공항픽업_vs_공항의전_골든카.png', c3: '03_공항의전_공항픽업_체크리스트_골든카.png' };
  for (const id of Object.keys(names)) await (await p.$('#' + id)).screenshot({ path: names[id] });
  console.log(await p.evaluate(() => [...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family).join(',')));
  await b.close();
})();
