import { test, expect, loginAs, TEST_USERS } from '../fixtures/test-fixtures'

test.describe('Alerts Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
    await page.goto('/alerts')
  })

  test('displays alerts page header', async ({ page }) => {
    await expect(page.locator('h1:has-text("Alerts")')).toBeVisible()
    await expect(page.locator('text=Manage alert rules and notifications')).toBeVisible()
  })

  test('has tab navigation', async ({ page }) => {
    await expect(page.locator('button:has-text("Overview")')).toBeVisible()
    await expect(page.locator('button:has-text("History")')).toBeVisible()
    await expect(page.locator('button:has-text("Rules")')).toBeVisible()
    await expect(page.locator('button:has-text("Subscriptions")')).toBeVisible()
  })

  test('overview tab shows stats', async ({ page }) => {
    // Default tab is overview
    await page.waitForLoadState('networkidle')

    // Should show alert statistics
    await expect(page.locator('text=Total').first()).toBeVisible()
  })

  test('can switch to history tab', async ({ page }) => {
    await page.click('button:has-text("History")')
    await page.waitForLoadState('networkidle')

    // History tab should show alert history or empty state
    const historyContent = page.locator('table, text=No alerts, text=No recent')
    await expect(historyContent.first()).toBeVisible({ timeout: 5000 })
  })

  test('can switch to rules tab', async ({ page }) => {
    await page.click('button:has-text("Rules")')
    await page.waitForLoadState('networkidle')

    // Rules tab should show rules table or empty state
    const rulesContent = page.locator('table, text=No rules, button:has-text("Create")')
    await expect(rulesContent.first()).toBeVisible({ timeout: 5000 })
  })

  test('can switch to subscriptions tab', async ({ page }) => {
    await page.click('button:has-text("Subscriptions")')
    await page.waitForLoadState('networkidle')

    // Subscriptions tab should show subscriptions or empty state
    const subsContent = page.locator('table, text=No subscriptions, button:has-text("Create")')
    await expect(subsContent.first()).toBeVisible({ timeout: 5000 })
  })

  test('refresh button works', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()

    await refreshButton.click()
    // Should trigger data refresh without error
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1:has-text("Alerts")')).toBeVisible()
  })

  test('active tab is highlighted', async ({ page }) => {
    // Overview tab should be active by default
    const overviewTab = page.locator('button:has-text("Overview")')
    await expect(overviewTab).toHaveClass(/text-orange/)

    // Click History tab
    await page.click('button:has-text("History")')
    const historyTab = page.locator('button:has-text("History")')
    await expect(historyTab).toHaveClass(/text-orange/)
  })
})

test.describe('Alert Detail Modal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
    await page.goto('/alerts')
  })

  test('clicking alert opens detail modal', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Find clickable alert row (if any alerts exist)
    const alertRow = page.locator('tr[data-testid="alert-row"], [data-testid="alert-item"]').first()

    if (await alertRow.isVisible()) {
      await alertRow.click()
      // Modal should appear
      await expect(page.locator('[role="dialog"], .modal, [data-testid="alert-detail-modal"]')).toBeVisible({ timeout: 3000 })
    }
  })
})

test.describe('Alert Rules Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
    await page.goto('/alerts')
    await page.click('button:has-text("Rules")')
    await page.waitForLoadState('networkidle')
  })

  test('create rule button is visible', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")')
    await expect(createButton.first()).toBeVisible()
  })

  test('clicking create opens rule form', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first()
    await createButton.click()

    // Form modal should appear
    await expect(page.locator('[role="dialog"], .modal, form')).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Alert Notifications (UI)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
  })

  test('notification bell icon in header', async ({ page }) => {
    // Look for bell icon in the layout
    const bellIcon = page.locator('svg.lucide-bell, [data-testid="notification-bell"]')
    await expect(bellIcon.first()).toBeVisible({ timeout: 5000 })
  })
})
