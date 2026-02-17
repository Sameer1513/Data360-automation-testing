class StatusConfigPage {
  constructor(page) {
    this.page = page;
  }

  async applyStatusConfiguration(slopeIn = 0, slopeOut = 0) {

    
    if (slopeIn > 0 || slopeOut > 0) {
      console.log(`⚙️ Applying Slopes: In ${slopeIn}s | Out ${slopeOut}s`);

      await this.page.getByRole('tab', { name: 'Production' }).click();
      await this.page.getByRole('button', { name: 'Status Configuration' }).click();

      await this.page.locator('div').filter({ hasText: /^In:$/ }).locator('input').fill(slopeIn.toString());
      await this.page.locator('div').filter({ hasText: /^Out:$/ }).locator('input').fill(slopeOut.toString());

      console.log('Clicking Save...');
      await this.page.getByRole('button', { name: 'Save' }).click();

      const toast = this.page.locator('text=Status Configuration saved successfully!');
      await toast.waitFor({ state: 'visible', timeout: 10000 });
      console.log('✅ Save Confirmed.');

      console.log('Returning to Production table...');
      const backArrow = this.page.locator('button:has(svg.lucide-arrow-left), button[aria-label="Back"]').first();
      await backArrow.click();
    } else {
      console.log('⏩ Slopes are 0. Navigating directly to Production tab.');
      await this.page.getByRole('tab', { name: 'Production' }).click();
    }

    // --- CRITICAL SYNC POINT ---
    // This must be outside the 'if' so that Step 4/5 always see the table
    console.log('⏳ Waiting for Production table to load rows...');
    await this.page.waitForSelector('table tbody tr', { state: 'visible', timeout: 15000 });
}
}
module.exports = StatusConfigPage;