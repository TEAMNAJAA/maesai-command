/* Shared steps for the scripts/probe-*.mjs screen checks. */

/** Get from T0 to the act-1 summary. Since the crisis night (E, 20 Oct) the battle opens first in
    Beginner / Expert (officer mode resolves it on its own) — play it with the assistant's best cards,
    then continue. Resolves once [data-act1-next] is on screen. */
export async function passBoss(page, { timeout = 60000 } = {}) {
  await page.waitForSelector('[data-boss], [data-act1-next]', { timeout })
  for (let i = 0; i < 12 && await page.locator('[data-boss]').count(); i++) {
    if (await page.locator('[data-boss-continue]').count()) { await page.locator('[data-boss-continue]').click(); continue }
    await page.waitForFunction(() => { const b = document.querySelector('[data-boss]'); return !b || b.dataset.bossBusy === '0' }, null, { timeout: 30000 })
    if (!(await page.locator('[data-boss]').count()) || await page.locator('[data-boss-result]').count()) continue
    const picks = await page.evaluate(() => window.__maesai?.bossBest?.() || [])
    for (const id of picks) await page.locator(`[data-boss-card="${id}"]`).click()
    await page.locator('[data-boss-end]').click()
  }
  await page.waitForSelector('[data-act1-next]', { timeout })
}
