const { expect } = require('@playwright/test');
const credentials = require('../Global/LoginPageCredential.page');
const locators    = require('../Locators/LoginPageLocators.page');

/**
 * LoginAndProjectPage
 * Handles browser interaction only.
 * All assertion/reporting logic lives in assertions/LoginAssertion.js
 */
class LoginAndProjectPage {

    constructor(page) {
        this.page            = page;
        this.url             = credentials.url;
        this.correctEmail    = credentials.correctEmail;
        this.correctPassword = credentials.correctPassword;
    }

    getWrongEmail()    { return this.correctEmail.replace('.l@', '@'); }
    getWrongPassword() { return this.correctPassword.replace('&', ''); }

    getReadableStatus(status) {
        return {
            'SUCCESS':     'Login Successful',
            'ERROR':       'Login Failed (Invalid Credentials)',
            'EMPTY_FIELD': 'Login Failed (Empty Fields — Validation Triggered)',
            'NO_CHANGE':   'Login Failed (No UI Response)',
        }[status] || status;
    }

    async attemptLogin(email, password) {
        await this.page.goto(this.url, { waitUntil: 'load' });

        const emailInput    = locators.emailInput(this.page).first();
        const passwordInput = locators.passwordInput(this.page).first();

        await emailInput.fill(email || '');
        await passwordInput.fill(password || '');

        const eyeIcon = locators.eyeIcon(this.page, passwordInput);
        if (await eyeIcon.isVisible().catch(() => false)) await eyeIcon.click();

        const checkbox = locators.checkbox(this.page);
        if (await checkbox.isVisible().catch(() => false)) await checkbox.check();

        await locators.loginButton(this.page).first().click();

        try {
            return await Promise.race([
                this.page.waitForSelector('text=/Projects/i', { state: 'attached', timeout: 30000 })
                    .then(() => 'SUCCESS'),
                this.page.waitForSelector('text=/error|invalid|failed|network|something went wrong/i', { state: 'visible', timeout: 30000 })
                    .then(() => 'ERROR'),
                this.page.waitForFunction(() => document.querySelector('input:invalid') !== null, { timeout: 30000 })
                    .then(() => 'EMPTY_FIELD'),
            ]);
        } catch {
            return 'NO_CHANGE';
        }
    }
}

module.exports = LoginAndProjectPage;