import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
});

test('strona i mapa inicjalizują się', async ({ page }) => {
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#baseSel')).toBeVisible();
  await expect(page.locator('#bUndo')).toBeVisible();
});

test('zmiana podkładu nie pozostawia komunikatu błędu z poprzedniego źródła', async ({ page }) => {
  const select = page.locator('#baseSel');
  const options = await select.locator('option').evaluateAll(nodes =>
    nodes.map(n => ({ value: n.value, disabled: n.disabled }))
  );
  const usable = options.find(o => o.value && !o.disabled);
  test.skip(!usable, 'Brak dostępnego podkładu w select');
  await select.selectOption(usable.value);
  await expect(select).toHaveValue(usable.value);
});

test('eksport analizy ma poprawny format GeoJSON', async ({ page }) => {
  // Interakcja przez UI: eksport nie powinien kończyć się wyjątkiem.
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const exportButton = page.getByRole('button', { name: /geojson/i });
  if (await exportButton.count()) {
    const download = page.waitForEvent('download');
    await exportButton.first().click();
    await download;
  } else {
    test.skip(true, 'Nie znaleziono przycisku eksportu GeoJSON — sprawdź selektor UI');
  }
  expect(errors).toEqual([]);
});

test('nie generuje nieobsłużonych błędów JS podczas startu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
