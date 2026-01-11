import { test as base, expect, type Page, type BrowserContext } from '@playwright/test'

// Test user credentials
export const TEST_USERS = {
  admin: { username: 'admin', password: 'admin123', role: 'admin' },
  user: { username: 'user', password: 'user123', role: 'user' },
} as const

// Test addresses
export const TEST_ADDRESSES = {
  known: '0x1234567890abcdef1234567890abcdef12345678',
  highRisk: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
} as const

// Auth state storage path
const AUTH_STATE_PATH = 'playwright/.auth/user.json'

// Extended test with authentication fixture
export const test = base.extend<{
  authenticatedPage: Page
  adminPage: Page
}>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, TEST_USERS.user)
    await use(page)
    await context.close()
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, TEST_USERS.admin)
    await use(page)
    await context.close()
  },
})

// Re-export expect
export { expect }

// Login helper
export async function loginAs(
  page: Page,
  user: { username: string; password: string }
) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.fill('input[type="text"]', user.username)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 10000 })
  await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 })
}

// Logout helper
export async function logout(page: Page) {
  // Look for logout button in user menu
  await page.click('[data-testid="user-menu"]')
  await page.click('[data-testid="logout-button"]')
  await page.waitForURL('/login')
}

// Wait for loading to complete
export async function waitForLoading(page: Page) {
  // Wait for any loading spinners to disappear
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('.animate-spin')
    return spinners.length === 0
  }, { timeout: 10000 })
}

// Assert no console errors
export async function assertNoConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  return errors
}

// Mock API response helper
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: unknown
) {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}
