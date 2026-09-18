import { useEffect, useState } from 'react'

/**
 * Persists state to localStorage under `key`. Falls back to `initialValue`
 * when nothing is stored yet, or when localStorage is unavailable
 * (private browsing, quota errors, etc).
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore write errors (quota exceeded, privacy mode, etc.)
    }
  }, [key, value])

  return [value, setValue]
}
