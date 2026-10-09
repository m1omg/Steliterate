// Browser check: the game played under a browser's page translation stays live (the player's friend
// reads it translated into Czech, 9 Oct). Chrome's translation swaps each text node for <font>
// elements holding the translation; Preact went on updating its own text nodes out of the page, so
// the turn count, η and every tooltip froze at their first value (src/ui/translateGuard.ts). Here a
// stand-in translator does the same (in one replace, or a <font> put in before the text node and
// the text node taken out), uppercasing as its "translation", while turns are played.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('translate', { seed: 1000 });
  const { page } = ck;
  await page.evaluate(() => {
    let flip = 0;
    const done = new WeakSet();
    const skip = (n) => {
      const p = n.parentElement;
      return !p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName) || p.closest('font');
    };
    const wrap = (n) => {
      if (!n.isConnected || !n.data.trim() || skip(n) || done.has(n)) return;
      done.add(n);
      const outer = document.createElement('font');
      outer.style.verticalAlign = 'inherit';
      const inner = document.createElement('font');
      inner.style.verticalAlign = 'inherit';
      inner.textContent = n.data.toUpperCase();
      outer.appendChild(inner);
      if (flip++ % 2) n.parentNode.replaceChild(outer, n);
      else {
        n.parentNode.insertBefore(outer, n);
        n.parentNode.removeChild(n);
      }
    };
    const sweep = (root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const list = [];
      while (w.nextNode()) list.push(w.currentNode);
      list.forEach(wrap);
    };
    const ui = document.getElementById('ui');
    sweep(ui);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') {
          done.delete(m.target);
          wrap(m.target);
        }
        for (const n of m.addedNodes) {
          if (n.nodeType === 3) {
            done.delete(n);
            wrap(n);
          } else if (n.nodeType === 1 && n.tagName !== 'FONT') sweep(n);
        }
      }
    }).observe(ui, { childList: true, subtree: true, characterData: true });
  });
  await page.waitForTimeout(300);
  const shown = () =>
    page.evaluate(() => ({
      turn: window.__stel.state().turn,
      sci: document.querySelector('.chrono-era .sci')?.textContent ?? '',
      eta: document.querySelector('.chrono-time .eta')?.textContent ?? '',
      fonts: document.querySelectorAll('#ui font').length,
    }));
  const first = await shown();
  check(first.fonts > 50 && first.sci === first.sci.toUpperCase(), `the page is "translated" (${first.fonts} <font> stand-ins; "${first.sci}")`);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window.__stel.state().pending.length = 0));
    await page.locator('button.endturn').click();
    await page.waitForTimeout(1000);
    for (let k = 0; k < 6 && (await page.locator('.modal').count()); k++) {
      const b = page.locator('.modal .choice:not([disabled]), .modal button:has-text("CONTINUE"), .modal button:has-text("CLOSE"), .modal button:has-text("BEGIN")').first();
      if (await b.count()) await b.click({ timeout: 3000 }).catch(() => {});
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
  // (three turns of the Dusk leave η as it was to four decimals: take it a tenfold on)
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.years *= 10;
    s.eta = Math.log10(s.years);
    window.__stel.refresh();
  });
  await page.waitForTimeout(300);
  const later = await shown();
  console.log(`  turn ${first.turn} "${first.sci}" ${first.eta} → turn ${later.turn} "${later.sci}" ${later.eta}`);
  check(later.turn > first.turn && later.sci.includes(`TURN ${later.turn} `), `the turn shown follows the game (turn ${later.turn}: "${later.sci}")`);
  check(later.eta !== first.eta, `η follows the game (${first.eta} → ${later.eta})`);
  check(later.sci === later.sci.toUpperCase(), 'what changed is translated again');
  // the panel follows the selection
  const names = await page.evaluate(() => {
    const s = window.__stel.state();
    return Object.values(s.systems)
      .filter((x) => s.civ.known[x.id])
      .slice(0, 4)
      .map((x) => ({ id: x.id, name: x.name }));
  });
  let follows = 0;
  for (const x of names) {
    await page.evaluate((id) => window.__stel.select('system', id), x.id);
    await page.waitForTimeout(350);
    const h2 = await page.evaluate(() => document.querySelector('.drawer h2')?.textContent ?? '');
    if (h2 === x.name.toUpperCase()) follows++;
    else console.log(`  panel: "${h2}" for ${x.name}`);
  }
  check(follows === names.length, `the panel's title follows each selection (${follows} of ${names.length})`);
  // each tooltip says its own thing
  let tipsRight = 0;
  const sels = ['button.endturn', '.rail button >> nth=0', '.rail button >> nth=1', '.rail button >> nth=2'];
  for (const sel of sels) {
    const el = page.locator(sel).first();
    await el.hover();
    await page.waitForTimeout(250);
    const want = ((await el.getAttribute('data-tip')) ?? '').split('\n')[0].toUpperCase();
    const tip = await page.evaluate(() => document.querySelector('.tip')?.firstElementChild?.textContent ?? '');
    if (tip === want) tipsRight++;
    else console.log(`  tip: "${tip.slice(0, 50)}" for "${want.slice(0, 50)}"`);
  }
  check(tipsRight === sels.length, `each tooltip shows its own text (${tipsRight} of ${sels.length})`);
  // no text left behind twice: a stand-in and its text node never both show
  const doubled = await page.evaluate(() => {
    const t = document.querySelector('.chrono-era .sci');
    return t ? [...t.childNodes].filter((n) => n.nodeType === 3 && n.data.trim()).length : -1;
  });
  check(doubled === 0, `no English left beside its translation (${doubled} bare text nodes in the age line)`);
  await ck.shot('translate.png');
  await finish('TRANSLATE', ck);
});
