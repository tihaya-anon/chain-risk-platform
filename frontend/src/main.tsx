import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import { WebSocketProvider, ToastContainer } from "./components/notification"
import "./index.css"
import { initTheme } from "./store/theme"

// Initialize theme before render to prevent flash
initTheme()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Enable MSW in development mode
async function enableMocking() {
  if (import.meta.env.DEV) {
    const { startMockWorker } = await import("./mocks")
    return startMockWorker()
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WebSocketProvider>
            <App />
            <ToastContainer />
          </WebSocketProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>
  )
})
