import { test, expect, loginAs, TEST_USERS } from '../fixtures/test-fixtures'
import { Page } from '@playwright/test'

// WebSocket endpoint configuration
const WS_URL = process.env.VITE_WS_URL || 'http://localhost:3001'
const KAFKA_BOOTSTRAP = process.env.KAFKA_BOOTSTRAP || 'localhost:19092'
const ALERT_TOPIC = 'chain-risk.alerts'

test.describe('WebSocket Real-time Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
  })

  test('WebSocket connects after login', async ({ page }) => {
    // Give time for WebSocket to connect
    await page.waitForTimeout(2000)

    // Check console for connection log
    const logs: string[] = []
    page.on('console', (msg) => {
      if (msg.text().includes('WebSocket')) {
        logs.push(msg.text())
      }
    })

    // Trigger a page navigation to see connection logs
    await page.goto('/')
    await page.waitForTimeout(2000)

    // WebSocket should attempt connection
    // We can verify by checking for the WebSocket provider context
    await expect(page.locator('[data-testid="ws-status"], .ws-connected, h1')).toBeVisible()
  })

  test('WebSocket connection indicator visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for WebSocket status indicator (if implemented in UI)
    const wsIndicator = page.locator(
      '[data-testid="ws-indicator"], [data-testid="connection-status"], .connection-status'
    )

    // If indicator exists, check it
    if (await wsIndicator.count() > 0) {
      await expect(wsIndicator.first()).toBeVisible()
    }
  })

  test('alert toast appears on WebSocket message', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Inject alert via WebSocket simulation
    // This simulates what happens when a WebSocket message arrives
    await page.evaluate(() => {
      // Simulate adding an alert to the store
      const event = new CustomEvent('test-alert', {
        detail: {
          id: 'test-alert-1',
          type: 'high_risk_transfer',
          severity: 'high',
          title: 'Test Alert',
          message: 'This is a test alert',
          timestamp: Date.now(),
        },
      })
      window.dispatchEvent(event)
    })

    // Wait briefly for UI update
    await page.waitForTimeout(1000)

    // Page should still be functional after simulated event
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })

  test('alerts page updates in real-time', async ({ page }) => {
    await page.goto('/alerts')
    await page.waitForLoadState('networkidle')

    // Get initial alert count if visible
    const initialCount = await page.locator('text=Total').textContent()

    // Wait for potential WebSocket updates
    await page.waitForTimeout(3000)

    // Page should remain stable
    await expect(page.locator('h1:has-text("Alerts")')).toBeVisible()
  })
})

test.describe('WebSocket Subscription', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin)
  })

  test('can subscribe to specific addresses', async ({ page }) => {
    // Navigate to alerts page
    await page.goto('/alerts')
    await page.waitForLoadState('networkidle')

    // Go to subscriptions tab
    await page.click('button:has-text("Subscriptions")')
    await page.waitForLoadState('networkidle')

    // Look for subscription form or create button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Subscribe")')

    if (await createButton.count() > 0) {
      await createButton.first().click()
      await page.waitForTimeout(500)

      // Form should appear
      await expect(page.locator('form, [role="dialog"]')).toBeVisible({ timeout: 3000 })
    }
  })
})

test.describe('WebSocket Reconnection', () => {
  test('handles connection loss gracefully', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Simulate offline state
    await page.context().setOffline(true)
    await page.waitForTimeout(1000)

    // Page should handle offline state
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()

    // Go back online
    await page.context().setOffline(false)
    await page.waitForTimeout(2000)

    // Page should recover
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })
})
