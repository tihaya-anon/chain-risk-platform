import { test, expect, loginAs, TEST_USERS } from '../fixtures/test-fixtures'

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
  })

  test('displays dashboard header', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
    await expect(page.locator('text=Real-time on-chain risk monitoring')).toBeVisible()
  })

  test('displays stat cards', async ({ page }) => {
    // Wait for stats to load
    await page.waitForLoadState('networkidle')

    // Check stat cards are present
    await expect(page.locator('text=Last Block')).toBeVisible()
    await expect(page.locator('text=Processed TXs')).toBeVisible()
    await expect(page.locator('text=High Risk')).toBeVisible()
    await expect(page.locator('text=Pending Alerts')).toBeVisible()
  })

  test('displays recent alerts section', async ({ page }) => {
    await expect(page.locator('text=Recent Alerts')).toBeVisible()
    await expect(page.locator('a:has-text("View All")')).toBeVisible()
  })

  test('displays alert summary section', async ({ page }) => {
    await expect(page.locator('text=Alert Summary (24h)')).toBeVisible()
    await expect(page.locator('text=Critical')).toBeVisible()
    await expect(page.locator('text=High')).toBeVisible()
  })

  test('displays quick access links', async ({ page }) => {
    await expect(page.locator('text=Quick Access')).toBeVisible()
    await expect(page.locator('a:has-text("Address Analysis")')).toBeVisible()
    await expect(page.locator('a:has-text("Alert Management")')).toBeVisible()
    await expect(page.locator('a:has-text("Graph Explorer")')).toBeVisible()
    await expect(page.locator('a:has-text("Path Finder")')).toBeVisible()
    await expect(page.locator('a:has-text("Tag Search")')).toBeVisible()
  })

  test('displays high-risk addresses table', async ({ page }) => {
    await expect(page.locator('text=High-Risk Addresses')).toBeVisible()
    await expect(page.locator('text=Addresses with risk score ≥ 0.7')).toBeVisible()
  })

  test('refresh button works', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()

    // Click refresh
    await refreshButton.click()

    // Check for loading indicator (animate-spin on the RefreshCw icon)
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 2000 })
  })

  test('quick links navigate correctly', async ({ page }) => {
    // Test Address Analysis link
    await page.click('a:has-text("Address Analysis")')
    await expect(page).toHaveURL('/address')

    // Go back and test another link
    await page.goBack()
    await page.click('a:has-text("Alert Management")')
    await expect(page).toHaveURL('/alerts')
  })

  test('view all alerts link works', async ({ page }) => {
    await page.click('a:has-text("View All")')
    await expect(page).toHaveURL('/alerts')
  })

  test('responsive layout', async ({ page }) => {
    // Default viewport should show grid layout
    await expect(page.locator('.grid')).toHaveCount({ minimum: 1 })

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(500) // Wait for layout to adjust

    // Page should still be functional
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })
})
