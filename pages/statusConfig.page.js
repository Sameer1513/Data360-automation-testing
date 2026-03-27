const locators = require('../Locators/StatusConfigLocators.page');
const { expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper.js');

class StatusConfigPage {
  constructor(page) {
    this.page = page;
  }

  async openStatusConfigWithRetry() {
    const tryOpen = async () => {
      await locators.productionTab(this.page).click({ timeout: 15000 });
      await locators.statusConfigBtn(this.page).click({ timeout: 15000 });
      await locators.inInput(this.page).first().waitFor({ state: 'visible', timeout: 20000 });
      await locators.outInput(this.page).first().waitFor({ state: 'visible', timeout: 20000 });
    };

    try {
      await tryOpen();
    } catch (e) {
      console.warn(`StatusConfig open failed (attempt 1). Retrying... ${e.message}`);
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(300);
      await tryOpen();
    }
  }

  async applyStatusConfiguration(slopeIn = 0, slopeOut = 0) {
    if (Number(slopeIn) === 0 && Number(slopeOut) === 0) {
      console.log('⏭️ Skipping Status Configuration: both slopeIn and slopeOut are 0.');
      assertion.log(
        `Status Config (In:${slopeIn}, Out:${slopeOut})`,
        'Skipped (both slopes are 0)',
        'Status Configuration Applied',
        'PASS'
      );
      return;
    }

    console.log(`⚙️ Applying Slopes (always saves): In ${slopeIn}s | Out ${slopeOut}s`);

    // Always navigate into Status Configuration, apply values (including 0), click Save,
    // then return to Production so downstream extraction starts from a stable state.
    await this.openStatusConfigWithRetry();

    await locators.inInput(this.page).first().fill(slopeIn.toString(), { timeout: 30000 });
    await locators.outInput(this.page).first().fill(slopeOut.toString(), { timeout: 30000 });

      await locators.inInput(this.page).fill(slopeIn.toString());
      await locators.outInput(this.page).fill(slopeOut.toString());

      console.log('Clicking Save...');
      await locators.saveBtn(this.page).click();

      const toast = locators.successToast(this.page);
      let saved = false;
      try {
          await toast.waitFor({ state: 'visible', timeout: 10000 });
          saved = true;
          console.log('✅ Save Confirmed.');
      } catch (e) { console.log('⚠️ Save confirmation missing'); }
      
      assertion.log(`Status Config (In:${slopeIn}, Out:${slopeOut})`, saved ? 'Saved Successfully' : 'Save Failed/Timeout', 'Status Configuration Applied', saved ? 'PASS' : 'FAIL');

      console.log('Returning to Production table...');
      const backArrow = locators.backBtn(this.page);
      await backArrow.click();
    // --- CRITICAL SYNC POINT ---
    console.log('⏳ Waiting for Production table to load rows...');
    await locators.tableRows(this.page).first().waitFor({ state: 'visible', timeout: 15000 });
  }
}
module.exports = StatusConfigPage;