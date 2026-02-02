class ProductionPassAnalysisPage {
  constructor(page) {
    this.page = page;
    this.allRedValues = [];
  }

  /* ===================== UTIL ===================== */

  async pause(ms) {
    await this.page.waitForTimeout(ms);
  }

  /* ===================== COLUMN HELPERS ===================== */

  async getColumnIndexByName(columnName) {
    const headers = this.page.locator('table thead th');
    const count = await headers.count();

    for (let i = 0; i < count; i++) {
      const text = (await headers.nth(i).innerText()).toLowerCase();
      if (text.includes(columnName.toLowerCase())) {
        console.log(`✅ Column "${columnName}" found at index ${i + 1}`);
        return i + 1;
      }
    }

    throw new Error(`❌ Column "${columnName}" not found`);
  }

  async getActionsColumnIndexFromRow() {
    const firstRow = this.page.locator('table tbody tr').first();
    const cells = firstRow.locator('td');
    const count = await cells.count();

    for (let i = 0; i < count; i++) {
      const hasButton = await cells.nth(i).locator('button').count();
      if (hasButton) {
        console.log(`✅ Actions column detected at index ${i + 1}`);
        return i + 1;
      }
    }

    throw new Error('❌ Actions column not detected');
  }

  /* ===================== PRODUCTION → EYE-1 (UNCHANGED LOGIC) ===================== */

  async openProductionEye() {
    await this.page.waitForSelector('table tbody tr', { timeout: 60000 });

    const weldDataCol = await this.getColumnIndexByName('Weld Data');
    const firstRow = this.page.locator('table tbody tr').first();

    await firstRow.scrollIntoViewIfNeeded();

    const eye = firstRow.locator(
      `td:nth-child(${weldDataCol}) button`
    ).first();

    console.log('👁 Eye-1 → Production (Weld Data)');
    await eye.click({ force: true });

    // ✅ wait for Pass tab and switch
    const passTab = this.page.getByRole('tab', { name: 'Pass' });
    await passTab.waitFor({ state: 'visible', timeout: 60000 });
    await passTab.click();

    // ✅ lock Pass view
    await this.page.waitForSelector(
      'table thead th',
      { timeout: 60000 }
    );

    console.log('✅ Pass view locked');
  }


async getColumnIndexIgnoringIcons(columnName) {
  const headers = this.page.locator('table thead th');
  const count = await headers.count();

  for (let i = 0; i < count; i++) {
    const rawText = await headers.nth(i).innerText();

    const cleanText = rawText
      .replace(/[^\w\s]/gi, '') // remove icons/symbols
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (cleanText.includes(columnName.toLowerCase())) {
      console.log(`✅ Column "${columnName}" matched as "${rawText}" at index ${i + 1}`);
      return i + 1;
    }
  }

  throw new Error(`❌ Column "${columnName}" not found (icons ignored)`);
}

/* ===================== PASS → EYE-2 (FINAL, FIXED) ===================== */

async openPassEyes() {
  await this.page.waitForSelector('table tbody tr', { timeout: 60000 });

  // 🔥 EXACTLY like Eye-1
  const eyeCol = await this.getColumnIndexIgnoringIcons('Actions');

  const rows = this.page.locator('table tbody tr');
  const totalRows = await rows.count();

  console.log(`📋 REAL rows detected: ${totalRows}`);

  // Start from row 2
  for (let i = 1; i < totalRows; i++) {
    const row = rows.nth(i);
    const eyeCell = row.locator(`td:nth-child(${eyeCol})`);

    console.log(`👁 Eye-2 → Row ${i + 1}`);

    await eyeCell.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    // 🔥 CLICK THE CELL (NOT ICON)
    await eyeCell.click({ force: true });

    // ✅ REAL navigation check
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForSelector('table', { timeout: 60000 });

    console.log('✅ Data Analysis opened');

    await this.scanDataAnalysis(this.page);

    // 🔙 Return EXACTLY like user
    await this.page.goBack();
    await this.page.waitForSelector('table tbody tr', { timeout: 60000 });
    await this.page.waitForTimeout(500);
  }

  console.log('✅ All Eye-2 rows processed');
}



  /* ===================== DATA ANALYSIS ===================== */

  async scanDataAnalysis(container) {
    if (!container) {
    container = this.page;
  }
    const rows = container.locator('table tbody tr');
    const rowCount = await rows.count();

    for (let r = 0; r < rowCount; r++) {
      const row = rows.nth(r);
      await row.scrollIntoViewIfNeeded();
      await this.pause(100);

      const cells = row.locator('td');
      const cellCount = await cells.count();

      for (let c = 0; c < cellCount; c++) {
        const data = await cells.nth(c).evaluate(el => {
          const bg = getComputedStyle(el).backgroundColor;
          const value = el.innerText.trim();
          return {
            isRed: bg.includes('255, 0, 0'),
            value,
          };
        });

        if (data.isRed && data.value && !isNaN(data.value)) {
          this.allRedValues.push(Number(data.value));
        }
      }
    }
  }

  /* ===================== MAIN FLOW ===================== */

  async collectRedValues() {
    await this.openProductionEye(); // Eye-1 (stable)
    await this.openPassEyes();      // Eye-2 (now stable)

    console.log(
      this.allRedValues.length
        ? `🚨 Collected ${this.allRedValues.length} red values`
        : '✅ No red values found'
    );

    return this.allRedValues;
  }
}

module.exports = ProductionPassAnalysisPage;
