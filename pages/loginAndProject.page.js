
class LoginAndProjectPage {
  constructor(page) {
    this.page = page;
    this.url = 'https://d6nchqu50azsp.cloudfront.net/login'

    // Actual credentials
    this.correctEmail = 'sameer.l@logycent.com';
    this.correctPassword = 'Sameer.l&5542';
  }

  // Utility: small mutation for username
  getWrongEmail() {
    return this.correctEmail.replace('.l@', '@'); // sameer@logycent.com
  }

  // Utility: small mutation for password
  getWrongPassword() {
    return this.correctPassword.replace('&', ''); // Sameer.l5542
  }

async attemptLogin(email, password, attemptNo) {
  console.log(`Attempt ${attemptNo}: ${email || '(empty)'} | ${password || '(empty)'}`);

  await this.page.goto(this.url, { waitUntil: 'networkidle' });

  const emailInput = this.page.locator('input[placeholder="Enter your email"]');
  const passwordInput = this.page.locator('input[placeholder="Enter your password"]');

  // 2. Fill the inputs using the locators
  await emailInput.fill(email || '');
  await passwordInput.fill(password || '');

  // 3. Eye icon click (Now using the passwordInput LOCATOR, not the string)
  const eyeIcon = passwordInput.locator('..').locator('svg, span, div').last();
  
  if (await eyeIcon.isVisible().catch(() => false)) {
    await eyeIcon.click();
  }

  // Click checkbox if present
  const checkbox = this.page.locator('input[type="checkbox"]');
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.check();
  }

  // Click Login
  await this.page.click('button:has-text("Login")');

  // Short wait for page updates
  await this.page.waitForTimeout(2000);

  // Check for empty fields
  const invalidCount = await this.page.locator('input:invalid').count();
  if (invalidCount > 0) {
    console.warn('Captured HTML5 validation: Please fill in the required fields.');
    return 'EMPTY_FIELD';
  }

  // Check for error messages
  const errors = await this.page.locator('text=/error|invalid|failed|network|something went wrong/i').allTextContents();
  if (errors.length > 0) {
    console.warn('Captured errors:', errors.join(' | '));
    return 'ERROR';
  }

  // ✅ Robust Projects detection
  try {
    await this.page.locator('text=Projects').waitFor({ timeout: 20000 }); // wait up to 20s
    return 'SUCCESS';
  } catch {
    return 'NO_CHANGE';
  }
}



  async loginAndOpenProject(projectName) {
    const scenarios = [
      // {
      //   name: 'Empty Email & Password',
      //   email: '',
      //   password: '',
      //   retries: 1,
      // },
      // {
      //   name: 'Wrong Password',
      //   email: this.correctEmail,
      //   password: this.getWrongPassword(),
      //   retries: 1,
      // },
      // {
      //   name: 'Wrong Username',
      //   email: this.getWrongEmail(),
      //   password: this.correctPassword,
      //   retries: 1,
      // },
      // {
      //   name: 'Wrong Username & Password',
      //   email: this.getWrongEmail(),
      //   password: this.getWrongPassword(),
      //   retries: 1,
      // },
      {
        name: 'Correct Credentials',
        email: this.correctEmail,
        password: this.correctPassword,
        retries: 1,
      },
    ];

    for (const scenario of scenarios) {
      console.log(`\nScenario: ${scenario.name}`);

      for (let i = 1; i <= scenario.retries; i++) {
        const result = await this.attemptLogin(scenario.email, scenario.password, i);

        if (result === 'SUCCESS') {
          console.log('Login successful 🎉');
          

          return; // Stop execution after successful login
        } else if (result === 'EMPTY_FIELD') {
          console.log('Skipped attempt due to empty required fields.');
          break; // Skip retries for empty fields
        } else {
          console.log(`Attempt ${i} result: ${result}`);
        }
      }
    }

    throw new Error('Login failed after all scenarios');
  }
}

module.exports = LoginAndProjectPage;

