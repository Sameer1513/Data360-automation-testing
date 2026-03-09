const locators = require('../Locators/StatusConfigLocators.page');

class StatusConfigPage {
  constructor(page) {
    this.page = page;
  }

  async applyStatusConfiguration(slopeIn = 0, slopeOut = 0) {

    
    if (slopeIn > 0 || slopeOut > 0) {
      console.log(`⚙️ Applying Slopes: In ${slopeIn}s | Out ${slopeOut}s`);

      await locators.productionTab(this.page).click();
      await locators.statusConfigBtn(this.page).click();

      await locators.inInput(this.page).fill(slopeIn.toString());
      await locators.outInput(this.page).fill(slopeOut.toString());

      console.log('Clicking Save...');
      await locators.saveBtn(this.page).click();

      const toast = locators.successToast(this.page);
      await toast.waitFor({ state: 'visible', timeout: 10000 });
      console.log('✅ Save Confirmed.');

      console.log('Returning to Production table...');
      const backArrow = locators.backBtn(this.page);
      await backArrow.click();
    } else {
      console.log('⏩ Slopes are 0. Navigating directly to Production tab.');
      await locators.productionTab(this.page).click();
    }

    // --- CRITICAL SYNC POINT ---
    // This must be outside the 'if' so that Step 4/5 always see the table
    console.log('⏳ Waiting for Production table to load rows...');
    await locators.tableRows(this.page).first().waitFor({ state: 'visible', timeout: 15000 });
}
}
module.exports = StatusConfigPage;