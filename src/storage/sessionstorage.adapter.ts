import type { StorageAdapter } from '../types'

/**
 * sessionStorage adapter.
 *
 * Fallback kedua setelah localStorage. Data hanya bertahan selama sesi tab —
 * hilang saat tab atau browser ditutup.
 *
 * Batas kapasitas ~5 MiB per origin (sama dengan localStorage).
 *
 * Catatan: sessionStorage tidak dishare antar tab walaupun same-origin.
 */
export class SessionStorageAdapter implements StorageAdapter {
  readonly name = 'sessionStorage'

  async getItem(key: string): Promise<string | null> {
    try {
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    window.sessionStorage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    window.sessionStorage.removeItem(key)
  }
}

/**
 * Cek apakah sessionStorage tersedia dan dapat digunakan.
 * Penyebab kegagalan sama dengan localStorage.
 */
export function isSessionStorageAvailable(): boolean {
  try {
    const TEST_KEY = '__pinia_idb_ss_test__'
    window.sessionStorage.setItem(TEST_KEY, '1')
    window.sessionStorage.removeItem(TEST_KEY)
    return true
  } catch {
    return false
  }
}
