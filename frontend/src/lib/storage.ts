import * as SecureStore from 'expo-secure-store';

// Small key/value storage for app preferences (Keychain / Keystore). The web build uses
// storage.web.ts instead. Values should stay small: SecureStore warns above 2 KB.

export async function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key).catch(() => null);
}

export async function setItem(key: string, value: string) {
  await SecureStore.setItemAsync(key, value).catch(() => {});
}

export async function removeItem(key: string) {
  await SecureStore.deleteItemAsync(key).catch(() => {});
}
