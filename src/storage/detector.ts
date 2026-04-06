import { openDB, deleteDB } from 'idb'
import type { StorageAdapter, FallbackStrategy, GlobalPluginOptions } from '../types'
import { IndexedDBAdapter } from './indexeddb.adapter'
import { LocalStorageAdapter, isLocalStorageAvailable } from './localstorage.adapter'
import { SessionStorageAdapter, isSessionStorageAvailable } from './sessionstorage.adapter'
import { MemoryAdapter } from './memory.adapter'

// ---------------------------------------------------------------------------
// IndexedDB Static Availability Check
// ---------------------------------------------------------------------------

/**
 * Pemeriksaan statik (synchronous) apakah IndexedDB kemungkinan besar tersedia.
 *
 * Menggunakan heuristik dari localForage untuk mendeteksi:
 * 1. Keberadaan global `indexedDB`
 * 2. Keberadaan `IDBKeyRange` (hilang di Samsung/HTC Android < 4.4)
 * 3. Safari lama (pre-10.1) yang implementasi IDB-nya broken
 *    — dideteksi via ketiadaan native `fetch`
 *
 * Mengembalikan `false` berarti IDB pasti tidak bisa dipakai.
 * Mengembalikan `true` berarti IDB *mungkin* bisa dipakai (perlu probe runtime).
 */
export function isIndexedDBLikelyAvailable(): boolean {
  try {
    // SSR / Node.js: indexedDB tidak ada
    if (typeof indexedDB === 'undefined') return false

    // Samsung/HTC Android < 4.4: IDB ada tapi IDBKeyRange hilang
    if (typeof IDBKeyRange === 'undefined') return false

    // Safari lama (pre-10.1): IDB ada tapi implementasinya broken.
    // Proxy: native fetch hadir di Safari >= 10.1
    // `openDatabase` (WebSQL) adalah indikator lingkungan Safari lama.
    // Diakses via window untuk menghindari error TypeScript pada API deprecated.
    const isSafariLike =
      typeof (window as unknown as Record<string, unknown>)['openDatabase'] !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      /Safari/.test(navigator.userAgent) &&
      !/Chrome/.test(navigator.userAgent) &&
      !/Chromium/.test(navigator.userAgent)

    if (isSafariLike) {
      const hasNativeFetch =
        typeof fetch === 'function' && fetch.toString().includes('[native code')
      if (!hasNativeFetch) return false
    }

    return true
  } catch {
    // Akses ke global melempar (sandboxed iframe, dll)
    return false
  }
}

// ---------------------------------------------------------------------------
// IndexedDB Runtime Probe
// ---------------------------------------------------------------------------

/**
 * Probe runtime: coba buka, baca, dan hapus database test secara nyata.
 *
 * Ini adalah satu-satunya cara yang andal untuk mendeteksi:
 * - Safari private mode (pre-14): `openDB` throw UnknownError
 * - Sandboxed iframe: throw SecurityError
 * - Database corrupt: throw UnknownError
 * - Corporate/enterprise policy: throw SecurityError
 *
 * @returns true jika IDB benar-benar bisa digunakan, false sebaliknya
 */
async function probeIndexedDB(): Promise<boolean> {
  const PROBE_DB = '__pinia_idb_probe__'
  try {
    const db = await openDB(PROBE_DB, 1, {
      upgrade(db) {
        db.createObjectStore('probe')
      },
    })
    db.close()
    await deleteDB(PROBE_DB)
    return true
  } catch {
    // Pastikan database probe dihapus meski gagal
    try { await deleteDB(PROBE_DB) } catch { /* ignore */ }
    return false
  }
}

// ---------------------------------------------------------------------------
// Adapter Resolution
// ---------------------------------------------------------------------------

/**
 * Menentukan dan menginisialisasi StorageAdapter yang tepat
 * berdasarkan ketersediaan storage dan konfigurasi fallback.
 *
 * Urutan prioritas:
 *   IndexedDB → localStorage → sessionStorage → memory
 *
 * @param options - Global plugin options
 * @returns Tuple [adapter yang dipilih, error jika terjadi fallback]
 */
export async function resolveAdapter(
  options: GlobalPluginOptions,
): Promise<{ adapter: StorageAdapter; fallbackError: Error | null }> {
  const {
    fallback = 'localStorage',
    dbName = 'pinia-store',
    storeName = 'states',
    onStorageFallback,
    debug = false,
  } = options

  // --- Coba IndexedDB ---
  const staticOk = isIndexedDBLikelyAvailable()
  if (staticOk) {
    const runtimeOk = await probeIndexedDB()
    if (runtimeOk) {
      if (debug) console.debug('[pinia-idb] Using IndexedDB adapter')
      return {
        adapter: new IndexedDBAdapter(dbName, storeName),
        fallbackError: null,
      }
    }
  }

  // IndexedDB tidak tersedia — tentukan fallback
  const idbError = new Error(
    staticOk
      ? 'IndexedDB runtime probe failed (private mode, security policy, or corruption)'
      : 'IndexedDB is not available in this environment',
  )

  if (debug) {
    console.warn(`[pinia-idb] IndexedDB unavailable: ${idbError.message}`)
  }

  // Jika fallback 'none', kembalikan MemoryAdapter tapi tandai sebagai "no persistence"
  if (fallback === 'none') {
    const adapter = new MemoryAdapter()
    if (debug) console.warn('[pinia-idb] Fallback disabled. State will NOT be persisted.')
    onStorageFallback?.(idbError, adapter)
    return { adapter, fallbackError: idbError }
  }

  // --- Coba localStorage ---
  if (fallback === 'localStorage' || fallback === 'sessionStorage' || fallback === 'memory') {
    if (isLocalStorageAvailable()) {
      const adapter = new LocalStorageAdapter()
      if (debug) console.warn('[pinia-idb] Falling back to localStorage')
      onStorageFallback?.(idbError, adapter)
      return { adapter, fallbackError: idbError }
    }
  }

  // --- Coba sessionStorage ---
  if (fallback === 'sessionStorage' || fallback === 'memory') {
    if (isSessionStorageAvailable()) {
      const adapter = new SessionStorageAdapter()
      if (debug) console.warn('[pinia-idb] Falling back to sessionStorage (data will not persist across sessions)')
      onStorageFallback?.(idbError, adapter)
      return { adapter, fallbackError: idbError }
    }
  }

  // --- Last resort: in-memory ---
  const adapter = new MemoryAdapter()
  if (debug) console.warn('[pinia-idb] Falling back to in-memory storage (no persistence)')
  onStorageFallback?.(idbError, adapter)
  return { adapter, fallbackError: idbError }
}
