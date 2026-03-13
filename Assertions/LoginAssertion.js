const { test, expect } = require('@playwright/test');
const assertion = require('../Helper/AssertionHelper');

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
            { name: 'Wrong Username & Password', expected: 'ERROR' },
            { name: 'Correct Credentials',       expected: 'SUCCESS' },
        ];
    }

    async run(testInfo) {
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

        // One structured HTML summary in the detail panel
        await assertion.attachStepSummary(
            'Login Scenarios',
            results.map(r => ({
                name:     r.scenario.name,
                expected: r.expectText,
                actual:   r.actualText,
                pass:     r.isPass,
                detail:   r.isPass ? 'Correct UI behaviour' : `Got "${r.result}", expected "${r.scenario.expected}"`
            })),
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