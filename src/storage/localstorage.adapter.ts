import type { StorageAdapter } from '../types'

/**
 * localStorage adapter.
 *
 * Fallback pertama dari IndexedDB. Data persisten lintas sesi browser.
 * Batas kapasitas ~5 MiB per origin.
 *
 * Semua operasi dibungkus Promise agar konsisten dengan interface
 * StorageAdapter yang async-first.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'localStorage'

  async getItem(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key)
  }
}

/**
 * Cek apakah localStorage tersedia dan dapat digunakan untuk baca-tulis.
 *
 * localStorage bisa gagal karena:
 * - Sandboxed iframe (SecurityError)
 * - Quota penuh (QuotaExceededError) — tapi hanya pada write
 * - Private mode pada beberapa browser lama
 * - Disabled via kebijakan enterprise
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const TEST_KEY = '__pinia_idb_ls_test__'
    window.localStorage.setItem(TEST_KEY, '1')
    window.localStorage.removeItem(TEST_KEY)
    return true
  } catch {
    return false
  }
}
