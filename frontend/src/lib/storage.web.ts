// expo-secure-store has no web implementation, so the web build keeps preferences in localStorage.

export async function getItem(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the value then lasts until reload.
  }
}

export async function removeItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored to clear.
  }
}
