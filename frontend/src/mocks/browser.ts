/**
 * MSW Browser Worker Setup
 * Initialize MSW for browser environment
 */

import { setupWorker } from "msw/browser"
import { handlers } from "./handlers"

// Create MSW worker with all handlers
export const worker = setupWorker(...handlers)

// Start the worker
export const startMockWorker = async () => {
  if (import.meta.env.DEV) {
    await worker.start({
      onUnhandledRequest: "bypass", // Don't warn about unhandled requests
      serviceWorker: {
        url: "/mockServiceWorker.js",
      },
    })
    console.log("[MSW] Mock Service Worker started")
  }
}
