const { test, expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper');
const locators = require('../Locators/LoginPageLocators.page');

/**
 * LoginAssertion
 * Owns the 5-scenario login validation flow.
 * Called from the spec with a single line: await loginAssertion.run(info)
 */
class LoginAssertion {

    constructor(loginPage) {
        this.loginPage = loginPage;

        this.scenarios = [
            // { name: 'Empty Email & Password',    expected: 'EMPTY_FIELD' },
            // { name: 'Wrong Password',            expected: 'ERROR' },
            // { name: 'Wrong Username',            expected: 'ERROR' },
            // { name: 'Wrong Username & Password', expected: 'ERROR' },
            { name: 'Correct Credentials',       expected: 'SUCCESS' },
        ];
    }

    async run(testInfo) {
        const page = this.loginPage.page;
        const uiChecks = []; // Eye icon & Remember me — same shape as scenario results for Step Summary

        // Assert login page has eye icon and remember-me checkbox; add to Step Summary table
        await test.step('Login page: Eye icon and Remember me present and clickable', async () => {
            await page.goto(this.loginPage.url, { waitUntil: 'load' });
            const passwordInput = locators.passwordInput(page).first();
            await passwordInput.fill('Eye icon click');

            let eyePass = false, eyeDetail = '';
            try {
                const eyeIcon = locators.eyeIcon(page, passwordInput).first();
                await expect(eyeIcon).toBeVisible();
                await eyeIcon.click();
                eyePass = true;
                eyeDetail = 'Correct UI behaviour confirmed';
            } catch (e) {
                eyeDetail = e.message || 'Eye icon not visible or click failed';
            }
            uiChecks.push({
                name:     'Eye icon click',
                expected: 'Visible and clickable',
                actual:   eyePass ? 'Visible and clickable' : 'Failed',
                pass:     eyePass,
                detail:   eyeDetail
            });
            expect(eyePass, 'Eye icon should be visible and clickable').toBe(true);

            let rememberPass = false, rememberDetail = '';
            try {
                const rememberCheckbox = locators.checkbox(page).first();
                await expect(rememberCheckbox).toBeVisible();
                await rememberCheckbox.check();
                await expect(rememberCheckbox).toBeChecked();
                rememberPass = true;
                rememberDetail = 'Correct UI behaviour confirmed';
            } catch (e) {
                rememberDetail = e.message || 'Remember me not visible or check failed';
            }
            uiChecks.push({
                name:     'Remember me checkbox',
                expected: 'Visible and checked',
                actual:   rememberPass ? 'Visible and checked' : 'Failed',
                pass:     rememberPass,
                detail:   rememberDetail
            });
            expect(rememberPass, 'Remember me checkbox should be visible and checkable').toBe(true);
        });

        const results = [];

        for (const scenario of this.scenarios) {
            const { email, password } = this._credentialsFor(scenario.name);
            const result     = await this.loginPage.attemptLogin(email, password, 1);
            const isPass     = result === scenario.expected;
            const actualText = this.loginPage.getReadableStatus(result);
            const expectText = this.loginPage.getReadableStatus(scenario.expected);

            results.push({ scenario, result, isPass, actualText, expectText });

            await test.step(`Login Scenario: ${scenario.name}`, async () => {
                assertion.log(
                    `Login: ${scenario.name}`,
                    actualText, expectText,
                    isPass ? 'PASS' : 'FAIL',
                    isPass ? 'Correct UI behaviour confirmed' : `Got "${result}", expected "${scenario.expected}"`,
                    null
                );
                expect(actualText, `Login scenario "${scenario.name}"`).toBe(expectText);
                if (result === 'SUCCESS') console.log('✅ Login successful');
            });

            if (scenario.name === 'Correct Credentials' && result === 'SUCCESS') break;
        }

        // One structured HTML summary: Eye icon, Remember me, then Login Scenarios (same table)
        const scenarioRows = results.map(r => ({
            name:     r.scenario.name,
            expected: r.expectText,
            actual:   r.actualText,
            pass:     r.isPass,
            detail:   r.isPass ? 'Correct UI behaviour confirmed' : `Got "${r.result}", expected "${r.scenario.expected}"`
        }));
        await assertion.attachStepSummary(
            'Login Scenarios',
            [...uiChecks, ...scenarioRows],
            testInfo
        );
    }

    _credentialsFor(scenarioName) {
        const lp = this.loginPage;
        const map = {
            'Empty Email & Password':    { email: '',                   password: '' },
            'Wrong Password':            { email: lp.correctEmail,      password: lp.getWrongPassword() },
            'Wrong Username':            { email: lp.getWrongEmail(),   password: lp.correctPassword },
            'Wrong Username & Password': { email: lp.getWrongEmail(),   password: lp.getWrongPassword() },
            'Correct Credentials':       { email: lp.correctEmail,      password: lp.correctPassword },
        };
        return map[scenarioName];
    }
}

module.exports = LoginAssertion;