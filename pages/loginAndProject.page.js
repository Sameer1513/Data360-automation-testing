const { expect, test } = require('@playwright/test');
const credentials = require('../Global/LoginPageCredential.page');
const locators = require('../Locators/LoginPageLocators.page');

class LoginAndProjectPage {
    constructor(page) {
        this.page = page;
        this.url = credentials.url;
        this.correctEmail = credentials.correctEmail;
        this.correctPassword = credentials.correctPassword;
    }

    // Mutation logic preserved
    getWrongEmail() {
        return this.correctEmail.replace('.l@', '@');
    }

    getWrongPassword() {
        return this.correctPassword.replace('&', '');
    }

   async attemptLogin(email, password, attemptNo) {
        console.log(`Attempt ${attemptNo}: ${email || '(empty)'} | ${password || '(empty)'}`);

        // Wait for the page to be ready
        await this.page.goto(this.url, { waitUntil: 'load' });

        const emailInput = locators.emailInput(this.page).first();
        const passwordInput = locators.passwordInput(this.page).first();

        await emailInput.fill(email || '');
        await passwordInput.fill(password || '');

        const eyeIcon = locators.eyeIcon(this.page, passwordInput);
        if (await eyeIcon.isVisible().catch(() => false)) {
            await eyeIcon.click();
        }

        const checkbox = locators.checkbox(this.page);
        if (await checkbox.isVisible().catch(() => false)) {
            await checkbox.check();
        }

        // --- CLICK LOGIN ---
        await locators.loginButton(this.page).first().click();

        // --- DYNAMIC FIX: RACE CONDITION ---
        // We wait for the first thing that happens: Success OR Error OR HTML5 Validation
        try {
            return await Promise.race([
                // 1. Wait for Project text to appear (Success)
                this.page.waitForSelector('text=/Projects/i', { state: 'attached', timeout: 30000 })
                    .then(() => 'SUCCESS'),

                // 2. Wait for Error message to appear (Error)
                this.page.waitForSelector('text=/error|invalid|failed|network|something went wrong/i', { state: 'visible', timeout: 30000 })
                    .then(() => 'ERROR'),

                // 3. Check for HTML5 Validation (Empty Field)
                this.page.waitForFunction(() => document.querySelector('input:invalid') !== null, { timeout: 30000 })
                    .then(() => 'EMPTY_FIELD')
            ]);
        } catch (error) {
            // If nothing happens after 30 seconds, it's a true failure
            console.error(`Attempt ${attemptNo} timed out waiting for UI response.`);
            return 'NO_CHANGE';
        }
    }

    async loginAndOpenProject(projectName) {
        const scenarios = [
        //     { name: 'Empty Email & Password', email: '', password: '', retries: 1, expected: 'EMPTY_FIELD' },
        //     { name: 'Wrong Password', email: this.correctEmail, password: this.getWrongPassword(), retries: 1, expected: 'ERROR' },
        //     { name: 'Wrong Username', email: this.getWrongEmail(), password: this.correctPassword, retries: 1, expected: 'ERROR' },
        //     { name: 'Wrong Username & Password', email: this.getWrongEmail(), password: this.getWrongPassword(), retries: 1, expected: 'ERROR' },
            { name: 'Correct Credentials', email: this.correctEmail, password: this.correctPassword, retries: 1, expected: 'SUCCESS' },
        ];

        for (const scenario of scenarios) {
            let lastResult;
            
            // We run the attempt logic outside the step first to determine the pass/fail string
            lastResult = await this.attemptLogin(scenario.email, scenario.password, 1);
            const statusIndicator = (lastResult === scenario.expected) ? 'pass' : 'fail';

            // EDIT: This naming convention mimics your required Selenium-style output
            await test.step(`Scenario Attempt: Attempt 1: Resulted in (with test case) ${lastResult} ${statusIndicator}`, async () => {
                
                test.info().annotations.push({
                    type: 'Scenario Attempt',
                    description: `Attempt 1: Resulted in ${lastResult}`
                });

                // ASSERTION: This is what triggers the Green/Red checkmark in the HTML report
                expect(lastResult, `Failed: ${scenario.name}`).toBe(scenario.expected);

                if (lastResult === 'SUCCESS') {
                    console.log('Login successful 🎉');
                    return; 
                }
            });

            if (scenario.name === 'Correct Credentials' && lastResult === 'SUCCESS') return;
        }
    }
}

module.exports = LoginAndProjectPage;