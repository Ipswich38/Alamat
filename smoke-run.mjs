// Smoke run: load the arena, let it settle, fight, and report what the page said.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: undefined, executablePath: process.env.CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto('http://localhost:3000/play', { waitUntil: 'load' });
await page.waitForTimeout(6000);

const read = async () => page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
console.log('AFTER LOAD  :', await read());

// Walk toward the middle of the map and swing at whatever is there.
await page.mouse.move(640, 400);
for (const key of ['w', 'd']) await page.keyboard.down(key);
await page.waitForTimeout(2500);
for (const key of ['w', 'd']) await page.keyboard.up(key);
for (let i = 0; i < 6; i++) {
  await page.keyboard.press('j');
  await page.waitForTimeout(350);
}
await page.keyboard.press('1');
await page.waitForTimeout(600);
await page.keyboard.press('2');
await page.waitForTimeout(600);
await page.keyboard.press('r');
await page.waitForTimeout(1200);
console.log('AFTER FIGHT :', await read());

await page.screenshot({ path: process.argv[2] ?? 'arena.png' });
console.log('CONSOLE     :', errors.length ? errors.slice(0, 12).join(' || ') : 'clean');
await browser.close();
