const loginConfig = require('../Global/LoginPageCredential.page');

// Locator helpers for `pages/loginAndProject.page.js` and `Assertions/LoginAssertion.js`
// Keep selectors aligned with the `LoginPage` class below.
function emailInput(page) {
    return page.locator('#email, input[name="email"], input[placeholder="Enter your email"]');
}

function passwordInput(page) {
    return page.locator('#password, input[name="password"], input[placeholder="Enter your password"]');
}

function loginButton(page) {
    return page.locator('button[type="submit"], button:has-text("Login")');
}

function checkbox(page) {
    return page.locator('#remember-me');
}

function eyeIcon(page, _passwordInput) {
    return page.locator('svg.lucide-eye, button:has(svg.lucide-eye)');
}

class LoginPage {
    constructor(page) {
        this.page = page;

        // Inputs (robust selectors to handle minor DOM changes)
        this.userEmail = page.locator('#email, input[name="email"], input[placeholder="Enter your email"]');
        this.userPassword = page.locator('#password, input[name="password"], input[placeholder="Enter your password"]');

        // Buttons & checkbox
        this.loginButton = page.locator('button[type="submit"], button:has-text("Login")');
        this.rememberMeCheckbox = page.locator('#remember-me');

        // Eye icon toggle for password visibility
        this.passwordEyeIcon = page.locator('svg.lucide-eye, button:has(svg.lucide-eye)').first();

        // Error message
        this.errorMessage = page.locator('div.text-red-600.bg-red-50.rounded-md.p-3');
    }

    async goTo() {
        await this.page.goto(loginConfig.url);
        // Wait specifically for the email field to be visible to ensure
        // the login page is fully rendered before continuing.
        await this.userEmail.first().waitFor({ state: 'visible', timeout: 15000 });
    }

    async loginApplication(email, password) {
        await this.userEmail.fill('');
        await this.userEmail.fill(email);

        await this.userPassword.fill('');
        await this.userPassword.fill(password);

        await this.loginButton.click();
        await this.page.waitForLoadState('networkidle');

        const { ProjectsPage } = require('./ProjectsPage');
        return new ProjectsPage(this.page);
    }

    async loginApplicationWithRememberMe(email, password, rememberMe) {
        await this.userEmail.fill('');
        await this.userEmail.fill(email);

        await this.userPassword.fill('');
        await this.userPassword.fill(password);

        if (rememberMe) {
            const isChecked = await this.rememberMeCheckbox.isChecked();
            if (!isChecked) {
                await this.rememberMeCheckbox.check();
            }
        }

        await this.loginButton.click();
        await this.page.waitForLoadState('networkidle');

        const { ProjectsPage } = require('./ProjectsPage');
        return new ProjectsPage(this.page);
    }

    async submitInvalidLogin(email, password) {
        await this.userEmail.fill('');
        await this.userEmail.fill(email);

        await this.userPassword.fill('');
        await this.userPassword.fill(password);

        await this.loginButton.click();
    }

    async waitForErrorMessageToAppear() {
        await this.errorMessage.waitFor({ state: 'visible' });
    }

    async getErrorMessage() {
        try {
            await this.errorMessage.waitFor({ state: 'visible' });
            return (await this.errorMessage.textContent())?.trim() || '';
        } catch {
            return '';
        }
    }

    async isErrorMessageDisplayed() {
        try {
            await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
            return await this.errorMessage.isVisible();
        } catch {
            return false;
        }
    }

    async isLoginPageDisplayed() {
        try {
            await this.userEmail.first().waitFor({ state: 'visible', timeout: 15000 });
            const [emailVisible, passwordVisible, buttonVisible] = await Promise.all([
                this.userEmail.first().isVisible(),
                this.userPassword.first().isVisible(),
                this.loginButton.first().isVisible()
            ]);
            return emailVisible && passwordVisible && buttonVisible;
        } catch {
            return false;
        }
    }

    async getHTML5ValidationMessage(locator) {
        return await locator.evaluate(el => el.validationMessage || '');
    }

    async getEmailValidationMessage() {
        return await this.getHTML5ValidationMessage(this.userEmail);
    }

    async attemptLoginWithEmptyCredentials() {
        await this.userEmail.fill('');
        await this.userPassword.fill('');
        await this.loginButton.click();
    }

    async attemptLoginWithInvalidEmailFormat(invalidEmail, password) {
        await this.userEmail.fill('');
        await this.userEmail.fill(invalidEmail);

        await this.userPassword.fill('');
        await this.userPassword.fill(password);

        await this.loginButton.click();
    }

    // ===== Additional helpers for tests (remember-me & eye icon) =====

    async isRememberMeChecked() {
        try {
            return await this.rememberMeCheckbox.isChecked();
        } catch {
            return false;
        }
    }

    async setPassword(password) {
        await this.userPassword.fill('');
        await this.userPassword.fill(password);
    }

    async isPasswordEyeIconVisible() {
        try {
            return await this.passwordEyeIcon.isVisible();
        } catch {
            return false;
        }
    }

    async togglePasswordVisibility() {
        await this.passwordEyeIcon.click();
    }

    async getPasswordInputType() {
        return (await this.userPassword.first().getAttribute('type')) || '';
    }

    async isPasswordMasked() {
        const type = await this.getPasswordInputType();
        return type.toLowerCase() === 'password';
    }

    async isPasswordVisible() {
        const type = await this.getPasswordInputType();
        return type.toLowerCase() === 'text';
    }
}

module.exports = {
    LoginPage,
    loginConfig,
    emailInput,
    passwordInput,
    loginButton,
    checkbox,
    eyeIcon
};