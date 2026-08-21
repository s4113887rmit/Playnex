export default async function run(page, ui) {
  const results = {};

  const testGenres = ['rpg', 'adventure', 'racing', 'horror', 'merch'];

  for (const genre of testGenres) {
    await page.goto(`http://localhost:3000/shopping.html?genre=${genre}`);
    await page.waitForSelector('.shop-grid');
    await page.waitForTimeout(300);

    results[genre] = {
      checked: await page.evaluate((g) => {
        const cb = document.querySelector(`input[name="genre"][value="${g}"]`);
        return cb ? cb.checked : false;
      }, genre),
      items: await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.shop-grid .card__title a')).map(el => el.textContent.trim());
      })
    };
  }

  return results;
}

