import { create } from "zustand"
import { persist } from "zustand/middleware"

type Theme = "light" | "dark" | "system"

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "theme-storage" }
  )
)

/** Apply theme to document */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  if (isDark) {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

/** Initialize theme on app load */
export function initTheme() {
  const stored = localStorage.getItem("theme-storage")
  const theme: Theme = stored ? JSON.parse(stored).state?.theme || "system" : "system"
  applyTheme(theme)

  // Listen for system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const currentTheme = useThemeStore.getState().theme
    if (currentTheme === "system") {
      applyTheme("system")
    }
  })
}
