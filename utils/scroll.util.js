// utils/scroll.util.js
async function autoScroll(locator) {
  if (!(await locator.isVisible())) return;

  await locator.evaluate(async (el) => {
    await new Promise((resolve) => {
      let lastScrollTop = -1;
      let stableCount = 0;
      const maxStable = 5;
      const distance = 150;

      const timer = setInterval(() => {
        el.scrollBy(0, distance);

        // If scrollTop stops changing, assume bottom reached
        if (el.scrollTop === lastScrollTop) {
          stableCount++;
        } else {
          stableCount = 0;
          lastScrollTop = el.scrollTop;
        }

        // Stop after stability
        if (stableCount >= maxStable) {
          clearInterval(timer);
          resolve();
        }
      }, 200);

      // 🛑 Absolute safety timeout
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 15000);
    });
  });
}

module.exports = { autoScroll };
