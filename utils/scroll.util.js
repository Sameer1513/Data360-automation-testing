async function autoScroll(container) {
  // Get scroll limits
  const { maxScrollTop, maxScrollLeft } = await container.evaluate(el => ({
    maxScrollTop: el.scrollHeight - el.clientHeight,
    maxScrollLeft: el.scrollWidth - el.clientWidth,
  }));

  // Vertical scroll
  for (let y = 0; y <= maxScrollTop; y += 300) {
    await container.evaluate((el, y) => el.scrollTo(0, y), y);
    await new Promise(r => setTimeout(r, 300));
  }

  // Horizontal scroll
  for (let x = 0; x <= maxScrollLeft; x += 300) {
    await container.evaluate((el, x) => el.scrollTo(x, 0), x);
    await new Promise(r => setTimeout(r, 300));
  }

  // Reset view (important)
  await container.evaluate(el => el.scrollTo(0, 0));
}

module.exports = { autoScroll };
