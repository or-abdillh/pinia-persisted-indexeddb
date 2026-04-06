import type { StorageAdapter } from '../types'

/**
 * In-memory storage adapter.
 *
 * Adapter terakhir dalam fallback chain. Tidak ada data yang dipersist ke disk —
 * semua state hilang saat halaman di-reload atau tab ditutup.
 *
 * Digunakan ketika semua storage backend lain (IndexedDB, localStorage,
 * sessionStorage) tidak tersedia atau gagal diinisialisasi.
 */
export class MemoryAdapter implements StorageAdapter {
  readonly name = 'memory'

  private readonly store = new Map<string, string>()

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }
}
