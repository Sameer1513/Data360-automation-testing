const { test, expect } = require('@playwright/test');

/**
 * LoginAssertion
 * Only logs in with valid credentials (from loginPage = loginAndProject, fed by test-data).
 * No eye/remember-me assertions, no step summary. Just login and proceed.
 */
class LoginAssertion {

    constructor(loginPage) {
        this.loginPage = loginPage;
    }

    async run(_testInfo) {
        const email = this.loginPage.correctEmail;
        const password = this.loginPage.correctPassword;

        await test.step('Login with valid credentials', async () => {
            const result = await this.loginPage.attemptLogin(email, password);
            expect(result, 'Login should succeed').toBe('SUCCESS');
        });
    }
}

module.exports = LoginAssertion;
