module.exports = {
    // Inputs
    emailInput: (page) => page.locator('#email')
        .or(page.locator('input[name="email"]'))
        .or(page.locator('input[placeholder="Enter your email"]')),
    
    passwordInput: (page) => page.locator('#password')
        .or(page.locator('input[name="password"]'))
        .or(page.locator('input[placeholder="Enter your password"]')),

    // Buttons & Icons
    eyeIcon: (page, passwordLocator) => passwordLocator.locator('..').locator('button')
        .or(passwordLocator.locator('..').locator('svg, span, div').last()),

    checkbox: (page) => page.locator('#remember-me')
        .or(page.locator('input[type="checkbox"]')),

    loginButton: (page) => page.locator('button[type="submit"]')
        .or(page.locator('button:has-text("Login")')),

    // Success Detection
    projectsText: (page) => page.locator('text=Projects')
};