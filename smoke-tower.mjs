// Spawn beside the enemy mid tier-1 tower and push it over, then check the
// tower behind it refuses damage until the first one is gone.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`error: ${m.text()}`); });

const line = () => page.evaluate(() => {
  const text = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  return text.filter((t) => t.includes('tower') || t.includes('core') || t.includes('Strike') || t.includes('Hero'));
});

// Hollow is the fastest hitter; ?at drops us right by the mid T1 tower (12.8, -12.8).
await page.goto('http://localhost:3000/play?at=12.8,-10.2&zoom=22', { waitUntil: 'load' });
await page.waitForTimeout(5000);
console.log('SPAWNED     :', (await line()).join(' | '));

// Face the tower (heading towards 12.8, -12.8, which is -z in world space) and swing.
await page.keyboard.down('w');
await page.waitForTimeout(200);
await page.keyboard.up('w');
for (let i = 0; i < 40; i++) {
  await page.keyboard.press('j');
  if (i % 7 === 3) await page.keyboard.press('2');
  await page.waitForTimeout(300);
}
console.log('AFTER 40    :', (await line()).join(' | '));
await page.screenshot({ path: process.argv[2] });
console.log('CONSOLE     :', errors.length ? errors.slice(0, 6).join(' || ') : 'clean');
await browser.close();
