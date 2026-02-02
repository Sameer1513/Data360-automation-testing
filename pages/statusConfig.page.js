class StatusConfigPage {
  constructor(page) {
    this.page = page;
  }

  async applyStatusConfig(values) {
    if (!values.length) {
      console.log('✅ No red values found');
      return;
    }

    const min = Math.min(...values) - 5;
    const max = Math.max(...values) + 5;

    console.log(`⚙ Applying Status Config: ${min} → ${max}`);

    await this.page.getByRole('button', { name: 'Status Configuration' }).click();
    await this.page.getByText('Status Configuration').waitFor();

    const mins = this.page.locator('input[placeholder="Min"]');
    const maxs = this.page.locator('input[placeholder="Max"]');

    for (let i = 0; i < await mins.count(); i++) {
      await mins.nth(i).fill(String(min));
      await maxs.nth(i).fill(String(max));
    }

    await this.page.getByRole('button', { name: 'Save' }).click();
    console.log('💾 Status Configuration saved');
  }
}

module.exports = StatusConfigPage;
