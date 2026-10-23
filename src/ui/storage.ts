// localStorage can be unavailable (private mode, blocked site data); the game still
// works without it, it just won't remember anything between visits.

export function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Nothing to do: see above.
  }
}
