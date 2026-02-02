class LoginAndProjectPage {
  constructor(page) {
    this.page = page;
  }

  async loginAndOpenProject() {
    await this.page.goto('https://d6nchqu50azsp.cloudfront.net', {
      waitUntil: 'networkidle',
    });

    await this.page.fill(
      'input[placeholder="Enter your email"]',
      'sameer.l@logycent.com'
    );
    await this.page.fill(
      'input[placeholder="Enter your password"]',
      'Sameer.l&5542'
    );

    await this.page.click('button:has-text("Login")');

    await this.page.getByText('Projects').waitFor({ timeout: 60000 });

    await this.page.getByText('weldNumEdit').first().click();
    await this.page.getByRole('tab', { name: 'Production' }).click();

    await this.page.waitForSelector('table tbody tr', { timeout: 60000 });
  }
}

module.exports = LoginAndProjectPage;
