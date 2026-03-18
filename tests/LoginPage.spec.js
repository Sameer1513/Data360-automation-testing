const { test, expect } = require('@playwright/test');
const { POManager } = require('../Locators/POManager');
const loginTestData = require('../test-data/loginTestData.json');

test.describe('Login Page - Playwright', () => {
    let page;
    let poManager;
    let loginPage;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        poManager = new POManager(page);
        loginPage = poManager.getLoginPage();
        await loginPage.goTo();
    });

    test.afterEach(async () => {
        await page.close();
    });

    test('successfulLogin', async () => {
        await expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        const email = loginTestData.validUser.email;
        const password = loginTestData.validUser.password;

        const projectsPage = await loginPage.loginApplication(email, password);

        expect(await projectsPage.isProjectsPageDisplayed()).toBeTruthy();
        const headerText = await projectsPage.getProjectsHeaderText();
        expect(headerText).toBe('Projects');
    });

    test('loginWithInvalidCredentials', async () => {
        await expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        await loginPage.submitInvalidLogin('invalid@example.com', 'wrongpassword');
        await loginPage.waitForErrorMessageToAppear();

        expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        expect(await loginPage.isErrorMessageDisplayed()).toBeTruthy();
        const errorMsg = await loginPage.getErrorMessage();
        expect(errorMsg).toContain('Sign in failed');
    });

    test('loginWithEmptyCredentials', async () => {
        await expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        await loginPage.attemptLoginWithEmptyCredentials();
        await page.waitForTimeout(500);

        expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        const emailValidationMsg = await loginPage.getEmailValidationMessage();

        expect(emailValidationMsg.length).toBeGreaterThan(0);
    });

    test('loginWithInvalidEmailFormat', async () => {
        await expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        await loginPage.attemptLoginWithInvalidEmailFormat('ssss', 'password123');
        await page.waitForTimeout(500);

        expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        const emailValidationMsg = await loginPage.getEmailValidationMessage();
        expect(emailValidationMsg.length).toBeGreaterThan(0);

        expect(emailValidationMsg).toContain("Please include an '@' in the email address");
    });

    test('loginApplicationWithRememberMe', async () => {
        await expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        const email = loginTestData.validUser.email;
        const password = loginTestData.validUser.password;

        // Ensure checkbox starts unchecked (or at least assert its state)
        const initiallyChecked = await loginPage.isRememberMeChecked();
        if (!initiallyChecked) {
            // loginApplicationWithRememberMe(true) will check it before submit
        }

        const projectsPage = await loginPage.loginApplicationWithRememberMe(
            email,
            password,
            true
        );

        expect(await projectsPage.isProjectsPageDisplayed()).toBeTruthy();
        const headerText = await projectsPage.getProjectsHeaderText();
        expect(headerText).toBe('Projects');
    });

    test('passwordEyeIconTogglesVisibility', async () => {
        await expect(await loginPage.isLoginPageDisplayed()).toBeTruthy();

        const password = loginTestData.validUser.password;
        await loginPage.setPassword(password);

        // Eye icon should be present and initially password should be masked
        expect(await loginPage.isPasswordEyeIconVisible()).toBeTruthy();
        expect(await loginPage.isPasswordMasked()).toBeTruthy();

        // Toggle visibility
        await loginPage.togglePasswordVisibility();

        // After toggle, password should be visible (input type="text")
        expect(await loginPage.isPasswordVisible()).toBeTruthy();
    });
});

