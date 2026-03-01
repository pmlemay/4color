import { useEffect, useRef } from 'react'

const POLL_INTERVAL = 2 * 60 * 1000 // 2 minutes
const BASE = import.meta.env.BASE_URL

export function useAutoUpdate() {
  const knownBuildTime = useRef<number | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>

    const check = async () => {
      try {
        const res = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const buildTime = data.buildTime as number
        if (!buildTime) return

        if (knownBuildTime.current === null) {
          // First check — just record the current version
          knownBuildTime.current = buildTime
        } else if (buildTime !== knownBuildTime.current) {
          // New version available — reload
          window.location.reload()
        }
      } catch {
        // Network error, skip
      }
    }

    // Initial check after a short delay (don't block startup)
    const initialTimeout = setTimeout(check, 5000)
    // Then poll periodically
    timer = setInterval(check, POLL_INTERVAL)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(timer)
    }
  }, [])
}
