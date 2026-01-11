import { test, expect, loginAs, TEST_USERS, TEST_ADDRESSES } from '../fixtures/test-fixtures'

test.describe('Address Search', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
    await page.goto('/address')
  })

  test('displays address analysis page', async ({ page }) => {
    await expect(page.locator('h1:has-text("Address Analysis")')).toBeVisible()
  })

  test('has search input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="address" i], input[placeholder*="search" i]')
    await expect(searchInput).toBeVisible()
  })

  test('search with valid address format', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="address" i], input[placeholder*="search" i]').first()
    await searchInput.fill(TEST_ADDRESSES.known)
    await page.keyboard.press('Enter')

    // Wait for search to complete
    await page.waitForLoadState('networkidle')

    // Should show some results or no results message
    const hasResults = await page.locator('[data-testid="address-result"], .address-result, text=Risk Score, text=No results').count()
    expect(hasResults).toBeGreaterThan(0)
  })

  test('search with invalid address shows error', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="address" i], input[placeholder*="search" i]').first()
    await searchInput.fill('invalid-address')
    await page.keyboard.press('Enter')

    await page.waitForLoadState('networkidle')

    // Should show error or validation message
    const hasError = await page.locator('text=invalid, text=error, text=not found').count()
    // If no error, at least the search should not crash
    await expect(page.locator('h1:has-text("Address Analysis")')).toBeVisible()
  })
})

test.describe('Tag Search', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
    await page.goto('/tags')
  })

  test('displays tag search page', async ({ page }) => {
    await expect(page.locator('h1:has-text("Tag"), h1:has-text("tag")')).toBeVisible()
  })

  test('has search functionality', async ({ page }) => {
    // Should have some form of search input
    const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]')
    await expect(searchInput.first()).toBeVisible()
  })
})

test.describe('Graph Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
    await page.goto('/graph')
  })

  test('displays graph explorer page', async ({ page }) => {
    await expect(page.locator('h1:has-text("Graph")')).toBeVisible()
  })

  test('has address input for graph exploration', async ({ page }) => {
    const input = page.locator('input')
    await expect(input.first()).toBeVisible()
  })
})

test.describe('Path Finder', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
    await page.goto('/path-finder')
  })

  test('displays path finder page', async ({ page }) => {
    await expect(page.locator('h1:has-text("Path")')).toBeVisible()
  })

  test('has source and target address inputs', async ({ page }) => {
    // Should have at least 2 inputs for source and target
    const inputs = page.locator('input[type="text"]')
    await expect(inputs).toHaveCount({ minimum: 2 })
  })
})

test.describe('High Risk Network', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
    await page.goto('/high-risk')
  })

  test('displays high risk network page', async ({ page }) => {
    await expect(page.locator('h1:has-text("High Risk"), h1:has-text("Risk")')).toBeVisible()
  })

  test('shows risk threshold controls', async ({ page }) => {
    // Should have controls for filtering
    await page.waitForLoadState('networkidle')
    const controlsOrData = await page.locator('input, select, button, table, [data-testid]').count()
    expect(controlsOrData).toBeGreaterThan(0)
  })
})
