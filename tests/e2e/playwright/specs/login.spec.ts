import { test, expect, TEST_USERS } from '../fixtures/test-fixtures'

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('displays login form correctly', async ({ page }) => {
    await expect(page.locator('text=Chain Risk Platform')).toBeVisible()
    await expect(page.locator('text=Sign in to access the dashboard')).toBeVisible()
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toHaveText('Sign in')
  })

  test('shows demo account info', async ({ page }) => {
    await expect(page.locator('text=Demo accounts:')).toBeVisible()
    await expect(page.locator('text=admin / admin123')).toBeVisible()
    await expect(page.locator('text=user / user123')).toBeVisible()
  })

  test('has theme toggle', async ({ page }) => {
    // Theme toggle should be visible
    const themeToggle = page.locator('button').filter({ has: page.locator('svg') }).first()
    await expect(themeToggle).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.fill('input[type="text"]', 'wronguser')
    await page.fill('input[type="password"]', 'wrongpass')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Invalid username or password')).toBeVisible({ timeout: 5000 })
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.fill('input[type="text"]', TEST_USERS.admin.username)
    await page.fill('input[type="password"]', TEST_USERS.admin.password)
    await page.click('button[type="submit"]')

    await page.waitForURL('/', { timeout: 10000 })
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('login button shows loading state', async ({ page }) => {
    await page.fill('input[type="text"]', TEST_USERS.admin.username)
    await page.fill('input[type="password"]', TEST_USERS.admin.password)

    // Click and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // Button should show loading indicator (has animate-spin class or disabled)
    await expect(submitButton).toBeDisabled({ timeout: 1000 })
  })

  test('redirects authenticated user to dashboard', async ({ page }) => {
    // First login
    await page.fill('input[type="text"]', TEST_USERS.admin.username)
    await page.fill('input[type="password"]', TEST_USERS.admin.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')

    // Navigate to login page
    await page.goto('/login')

    // Should redirect back to dashboard
    await expect(page).toHaveURL('/')
  })

  test('form validation - empty fields', async ({ page }) => {
    await page.fill('input[type="text"]', '')
    await page.fill('input[type="password"]', '')

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // Form should not submit (required validation)
    await expect(page).toHaveURL('/login')
  })
})
