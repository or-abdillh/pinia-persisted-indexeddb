import type { StateTree } from 'pinia'
import type { StorageAdapter, PersistedRecord } from './types'

// ---------------------------------------------------------------------------
// Read / Write State via StorageAdapter
// ---------------------------------------------------------------------------

/**
 * Baca PersistedRecord dari storage.
 *
 * @returns Record tersimpan, atau null jika belum ada / gagal dibaca
 */
export async function readState(
  adapter: StorageAdapter,
  key: string,
  debug = false,
): Promise<PersistedRecord | null> {
  try {
    const raw = await adapter.getItem(key)
    if (raw == null) return null

    const record = JSON.parse(raw) as PersistedRecord

    // Validasi minimal: harus punya field `state` dan `version`
    if (typeof record.state !== 'string' || typeof record.version !== 'number') {
      if (debug) {
        console.warn(`[pinia-idb] Stored record for key "${key}" has invalid shape, ignoring.`)
      }
      return null
    }

    return record
  } catch (err) {
    if (debug) console.warn(`[pinia-idb] Failed to read state for key "${key}":`, err)
    return null
  }
}

/**
 * Tulis state ke storage dalam bentuk PersistedRecord.
 *
 * @param state   - State yang akan disimpan (sudah difilter omit)
 * @param version - Versi skema state saat ini
 */
export async function writeState(
  adapter: StorageAdapter,
  key: string,
  state: Partial<StateTree>,
  version: number,
  serialize: (s: Partial<StateTree>) => string,
  debug = false,
): Promise<void> {
  try {
    const record: PersistedRecord = {
      state: serialize(state),
      version,
    }
    await adapter.setItem(key, JSON.stringify(record))
  } catch (err) {
    if (debug) console.warn(`[pinia-idb] Failed to write state for key "${key}":`, err)
  }
}

/**
 * Hapus persisted state dari storage.
 */
export async function deleteState(
  adapter: StorageAdapter,
  key: string,
  debug = false,
): Promise<void> {
  try {
    await adapter.removeItem(key)
  } catch (err) {
    if (debug) console.warn(`[pinia-idb] Failed to delete state for key "${key}":`, err)
  }
}
