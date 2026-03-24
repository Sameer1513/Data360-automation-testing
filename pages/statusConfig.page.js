const locators = require('../Locators/StatusConfigLocators.page');
const { expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper.js');

class StatusConfigPage {
  constructor(page) {
    this.page = page;
  }

  async applyStatusConfiguration(slopeIn = 0, slopeOut = 0) {
    console.log(`⚙️ Applying Slopes (always saves): In ${slopeIn}s | Out ${slopeOut}s`);

    // Always navigate into Status Configuration, apply values (including 0), click Save,
    // then return to Production so downstream extraction starts from a stable state.
    await locators.productionTab(this.page).click();
    await locators.statusConfigBtn(this.page).click();

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
    } catch (e) {
      console.log('⚠️ Save confirmation missing');
    }

    assertion.log(
      `Status Config (In:${slopeIn}, Out:${slopeOut})`,
      saved ? 'Saved Successfully' : 'Save Failed/Timeout',
      'Status Configuration Applied',
      saved ? 'PASS' : 'FAIL'
    );

    console.log('Returning to Production table...');
    const backArrow = locators.backBtn(this.page);
    await backArrow.click();

    // --- CRITICAL SYNC POINT ---
    console.log('⏳ Waiting for Production table to load rows...');
    await locators.tableRows(this.page).first().waitFor({ state: 'visible', timeout: 15000 });
  }
}
module.exports = StatusConfigPage;