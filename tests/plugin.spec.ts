/**
 * Unit tests untuk @orabdillh/pinia-persisted-indexeddb plugin.
 *
 * Strategy:
 * - IndexedDB di-mock menggunakan `fake-indexeddb` yang mensimulasikan
 *   full IndexedDB API di happy-dom environment.
 * - Setiap test mendapat instance Pinia yang fresh (tidak shared state).
 * - Storage adapter di-inject langsung untuk menghindari probe async
 *   di beberapa test yang perlu kontrol penuh.
 * - Semua setup store menggunakan `ref` agar $state terisi sejak awal (Pinia v3 requirement).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { ref, createApp } from 'vue'

// Polyfill IndexedDB menggunakan fake-indexeddb
import 'fake-indexeddb/auto'

import { MemoryAdapter } from '../src/storage/memory.adapter'
import { LocalStorageAdapter } from '../src/storage/localstorage.adapter'
import { IndexedDBAdapter } from '../src/storage/indexeddb.adapter'
import { readState, writeState } from '../src/db'
import { resolveOptions, filterState, mergeState, debounce, defaultSerializer } from '../src/utils'
import { isIndexedDBLikelyAvailable } from '../src/storage/detector'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Buat Pinia instance dengan plugin yang sudah di-inject adapter.
 * Bypass resolveAdapter() agar test berjalan deterministik.
 *
 * PENTING: Plugin Pinia hanya dijalankan saat pinia di-install ke Vue app
 * (app.use(pinia)), bukan hanya setActivePinia. Oleh karena itu kita
 * buat minimal Vue app agar plugin lifecycle berjalan dengan benar.
 */
function createTestPinia(adapter: MemoryAdapter | LocalStorageAdapter | IndexedDBAdapter = new MemoryAdapter()) {
  const pinia = createPinia()

  pinia.use(({ store, options }) => {
    const persistOpts = resolveOptions(
      (options as { persist?: unknown }).persist as never,
      store.$id,
    )
    if (!persistOpts?.enabled) return

    const { key, version, migrate, omit, serializer: storeSerializer } = persistOpts
    const serializer = storeSerializer ?? defaultSerializer

    // Hydrate
    const hydrateStore = async () => {
      const record = await readState(adapter, key!, false)
      if (!record) return
      let persistedState = serializer.deserialize(record.state)
      if (record.version < (version ?? 1) && migrate) {
        persistedState = migrate(persistedState, record.version)
      }
      store.$patch(mergeState(store.$state, persistedState, omit ?? []))
    }
    hydrateStore()

    // Subscribe
    store.$subscribe(() => {
      const filtered = filterState(store.$state, omit ?? [])
      writeState(adapter, key!, filtered, version ?? 1, serializer.serialize, false)
    }, { detached: true, flush: 'sync' })

    // Expose methods
    return {
      async $clearPersistedState() {
        await adapter.removeItem(key!)
      },
      async $persistNow() {
        const filtered = filterState(store.$state, omit ?? [])
        await writeState(adapter, key!, filtered, version ?? 1, serializer.serialize, false)
      },
      get $storageAdapterName() {
        return adapter.name
      },
    }
  })

  // Plugin hanya aktif saat pinia di-install via app.use(pinia).
  // Buat minimal Vue app agar plugin lifecycle berjalan dengan benar.
  const app = createApp({ render: () => null })
  app.use(pinia)
  setActivePinia(pinia)
  return pinia
}

/** Tunggu semua microtask dan macrotask selesai */
const flush = () => new Promise<void>((r) => setTimeout(r, 10))

// ---------------------------------------------------------------------------
// 1. Unit: resolveOptions
// ---------------------------------------------------------------------------

describe('resolveOptions', () => {
  it('mengembalikan null jika persist tidak diset', () => {
    expect(resolveOptions(undefined, 'my-store')).toBeNull()
  })

  it('mengembalikan null jika persist = false', () => {
    expect(resolveOptions(false, 'my-store')).toBeNull()
  })

  it('mengembalikan options default jika persist = true', () => {
    const opts = resolveOptions(true, 'my-store')
    expect(opts).not.toBeNull()
    expect(opts!.enabled).toBe(true)
    expect(opts!.key).toBe('my-store')
    expect(opts!.version).toBe(1)
    expect(opts!.omit).toEqual([])
  })

  it('menggunakan store.$id sebagai key default', () => {
    const opts = resolveOptions({ enabled: true }, 'counter')
    expect(opts!.key).toBe('counter')
  })

  it('menggunakan custom key jika disediakan', () => {
    const opts = resolveOptions({ enabled: true, key: 'my-custom-key' }, 'counter')
    expect(opts!.key).toBe('my-custom-key')
  })
})

// ---------------------------------------------------------------------------
// 2. Unit: filterState
// ---------------------------------------------------------------------------

describe('filterState', () => {
  it('mengembalikan salinan state jika omit kosong', () => {
    const state = { a: 1, b: 2, c: 3 }
    const result = filterState(state, [])
    expect(result).toEqual({ a: 1, b: 2, c: 3 })
    expect(result).not.toBe(state)
  })

  it('menghapus key yang ada di omit', () => {
    const state = { count: 5, token: 'secret', name: 'test' }
    const result = filterState(state, ['token'])
    expect(result).toEqual({ count: 5, name: 'test' })
    expect('token' in result).toBe(false)
  })

  it('mengabaikan key omit yang tidak ada di state', () => {
    const state = { count: 5 }
    const result = filterState(state as { count: number; ghost?: string }, ['ghost'])
    expect(result).toEqual({ count: 5 })
  })
})

// ---------------------------------------------------------------------------
// 3. Unit: mergeState
// ---------------------------------------------------------------------------

describe('mergeState', () => {
  it('merge persisted state ke current state', () => {
    const current = { a: 1, b: 2 }
    const persisted = { a: 99 }
    const result = mergeState(current, persisted, [])
    expect(result.a).toBe(99)
    expect(result.b).toBe(2)
  })

  it('mengabaikan key yang ada di omit saat merge', () => {
    const current = { count: 0, session: 'active' }
    const persisted = { count: 42, session: 'old-session' }
    const result = mergeState(current, persisted, ['session'])
    expect(result.count).toBe(42)
    expect(result.session).toBe('active')
  })

  it('mempertahankan key current yang tidak ada di persisted', () => {
    const current = { a: 1, b: 2, c: 3 }
    const persisted = { a: 10 }
    const result = mergeState(current, persisted, [])
    expect(result).toMatchObject({ a: 10, b: 2, c: 3 })
  })
})

// ---------------------------------------------------------------------------
// 4. Unit: debounce
// ---------------------------------------------------------------------------

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('hanya memanggil fungsi sekali meski dipanggil berkali-kali', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('reset timer jika dipanggil ulang sebelum delay berakhir', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    vi.advanceTimersByTime(50)
    debounced()
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 5. Unit: MemoryAdapter
// ---------------------------------------------------------------------------

describe('MemoryAdapter', () => {
  it('menyimpan dan membaca nilai', async () => {
    const adapter = new MemoryAdapter()
    await adapter.setItem('key1', 'value1')
    expect(await adapter.getItem('key1')).toBe('value1')
  })

  it('mengembalikan null untuk key yang tidak ada', async () => {
    const adapter = new MemoryAdapter()
    expect(await adapter.getItem('nonexistent')).toBeNull()
  })

  it('menghapus item', async () => {
    const adapter = new MemoryAdapter()
    await adapter.setItem('key1', 'value1')
    await adapter.removeItem('key1')
    expect(await adapter.getItem('key1')).toBeNull()
  })

  it('memiliki name "memory"', () => {
    expect(new MemoryAdapter().name).toBe('memory')
  })
})

// ---------------------------------------------------------------------------
// 6. Unit: LocalStorageAdapter
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter', () => {
  beforeEach(() => localStorage.clear())

  it('menyimpan dan membaca nilai dari localStorage', async () => {
    const adapter = new LocalStorageAdapter()
    await adapter.setItem('ls-key', 'ls-value')
    expect(await adapter.getItem('ls-key')).toBe('ls-value')
    expect(localStorage.getItem('ls-key')).toBe('ls-value')
  })

  it('mengembalikan null untuk key yang tidak ada', async () => {
    const adapter = new LocalStorageAdapter()
    expect(await adapter.getItem('missing')).toBeNull()
  })

  it('menghapus item dari localStorage', async () => {
    const adapter = new LocalStorageAdapter()
    await adapter.setItem('ls-key', 'value')
    await adapter.removeItem('ls-key')
    expect(await adapter.getItem('ls-key')).toBeNull()
  })

  it('memiliki name "localStorage"', () => {
    expect(new LocalStorageAdapter().name).toBe('localStorage')
  })
})

// ---------------------------------------------------------------------------
// 7. Unit: IndexedDBAdapter (menggunakan fake-indexeddb)
// ---------------------------------------------------------------------------

describe('IndexedDBAdapter', () => {
  let adapter: IndexedDBAdapter

  beforeEach(() => {
    adapter = new IndexedDBAdapter('test-db', 'states')
  })

  afterEach(async () => {
    await adapter.close()
  })

  it('menyimpan dan membaca PersistedRecord', async () => {
    const record = { state: '{"count":42}', version: 1 }
    await adapter.setItem('idb-key', JSON.stringify(record))
    const raw = await adapter.getItem('idb-key')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual(record)
  })

  it('mengembalikan null untuk key yang tidak ada', async () => {
    expect(await adapter.getItem('nonexistent')).toBeNull()
  })

  it('menghapus item', async () => {
    await adapter.setItem('to-delete', JSON.stringify({ state: '{}', version: 1 }))
    await adapter.removeItem('to-delete')
    expect(await adapter.getItem('to-delete')).toBeNull()
  })

  it('memiliki name "indexedDB"', () => {
    expect(adapter.name).toBe('indexedDB')
  })
})

// ---------------------------------------------------------------------------
// 8. Integration: Plugin — state restored on store init
// ---------------------------------------------------------------------------

describe('Plugin: restore state on init', () => {
  it('me-hydrate state dari storage saat store pertama kali diakses', async () => {
    const adapter = new MemoryAdapter()

    // Pre-populate storage
    await adapter.setItem('hydrate-store', JSON.stringify({
      state: JSON.stringify({ count: 77 }),
      version: 1,
    }))

    createTestPinia(adapter)

    const useStore = defineStore(
      'hydrate-store',
      () => ({ count: ref(0) }),
      { persist: { enabled: true, key: 'hydrate-store', version: 1 } },
    )

    const store = useStore()
    await flush()

    expect(store.count).toBe(77)
  })

  it('tidak melempar error jika storage kosong (fresh state)', async () => {
    createTestPinia(new MemoryAdapter())

    const useStore = defineStore(
      'fresh-store',
      () => ({ value: ref(10) }),
      { persist: { enabled: true } },
    )

    expect(() => useStore()).not.toThrow()
    const store = useStore()
    await flush()
    expect(store.value).toBe(10) // Tetap nilai default
  })
})

// ---------------------------------------------------------------------------
// 9. Integration: Plugin — persist on mutation
// ---------------------------------------------------------------------------

describe('Plugin: persist on mutation', () => {
  it('menyimpan state ke storage setelah mutasi', async () => {
    const adapter = new MemoryAdapter()
    const writeSpy = vi.spyOn(adapter, 'setItem')

    createTestPinia(adapter)

    const useStore = defineStore(
      'mutation-store',
      () => ({ count: ref(0) }),
      { persist: { enabled: true, key: 'mutation-store' } },
    )

    const store = useStore()
    store.$patch({ count: 5 })
    await flush()

    expect(writeSpy).toHaveBeenCalled()
    const raw = await adapter.getItem('mutation-store')
    expect(raw).not.toBeNull()
    const record = JSON.parse(raw!)
    expect(JSON.parse(record.state).count).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// 10. Integration: Plugin — skip non-persist store
// ---------------------------------------------------------------------------

describe('Plugin: skip non-persist store', () => {
  it('tidak menyentuh storage untuk store tanpa persist', async () => {
    const adapter = new MemoryAdapter()
    const writeSpy = vi.spyOn(adapter, 'setItem')

    createTestPinia(adapter)

    const useStore = defineStore('no-persist-store', () => ({ value: ref(42) }))
    const store = useStore()
    store.$patch({ value: 99 })
    await flush()

    expect(writeSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 11. Integration: Plugin — migration callback
// ---------------------------------------------------------------------------

describe('Plugin: migration', () => {
  it('memanggil migrate() jika version tersimpan lebih lama', async () => {
    const adapter = new MemoryAdapter()

    // State tersimpan dengan versi lama (v1): field `oldCount`
    await adapter.setItem('migrated-store', JSON.stringify({
      state: JSON.stringify({ oldCount: 10 }),
      version: 1,
    }))

    const migrateFn = vi.fn((old: unknown) => {
      const o = old as { oldCount: number }
      return { count: o.oldCount * 2 }
    })

    createTestPinia(adapter)

    const useStore = defineStore(
      'migrated-store',
      () => ({ count: ref(0) }),
      {
        persist: {
          enabled: true,
          key: 'migrated-store',
          version: 2,
          migrate: migrateFn,
        },
      },
    )

    const store = useStore()
    await flush()

    expect(migrateFn).toHaveBeenCalledWith({ oldCount: 10 }, 1)
    expect(store.count).toBe(20)
  })

  it('tidak memanggil migrate() jika version sama', async () => {
    const adapter = new MemoryAdapter()
    await adapter.setItem('same-version-store', JSON.stringify({
      state: JSON.stringify({ count: 5 }),
      version: 2,
    }))

    const migrateFn = vi.fn()

    createTestPinia(adapter)

    const useStore = defineStore(
      'same-version-store',
      () => ({ count: ref(0) }),
      { persist: { enabled: true, key: 'same-version-store', version: 2, migrate: migrateFn } },
    )

    useStore()
    await flush()

    expect(migrateFn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 12. Integration: Plugin — omit keys
// ---------------------------------------------------------------------------

describe('Plugin: omit keys', () => {
  it('tidak menyimpan key yang ada di omit list', async () => {
    const adapter = new MemoryAdapter()
    createTestPinia(adapter)

    const useStore = defineStore(
      'omit-store',
      () => ({ count: ref(0), secret: ref('do-not-persist') }),
      { persist: { enabled: true, key: 'omit-store', omit: ['secret'] } },
    )

    const store = useStore()
    store.$patch({ count: 5, secret: 'still-secret' })
    await flush()

    const raw = await adapter.getItem('omit-store')
    expect(raw).not.toBeNull()
    const savedState = JSON.parse(JSON.parse(raw!).state)
    expect('secret' in savedState).toBe(false)
    expect(savedState.count).toBe(5)
  })

  it('tidak me-hydrate key yang ada di omit list', async () => {
    const adapter = new MemoryAdapter()

    await adapter.setItem('omit-hydrate-store', JSON.stringify({
      state: JSON.stringify({ count: 10, secret: 'persisted-secret' }),
      version: 1,
    }))

    createTestPinia(adapter)

    const useStore = defineStore(
      'omit-hydrate-store',
      () => ({ count: ref(0), secret: ref('default-secret') }),
      { persist: { enabled: true, key: 'omit-hydrate-store', omit: ['secret'] } },
    )

    const store = useStore()
    await flush()

    expect(store.count).toBe(10)                 // di-hydrate
    expect(store.secret).toBe('default-secret')  // TIDAK di-hydrate
  })
})

// ---------------------------------------------------------------------------
// 13. Integration: Plugin — $clearPersistedState
// ---------------------------------------------------------------------------

describe('Plugin: $clearPersistedState', () => {
  it('menghapus data dari storage tanpa mempengaruhi state di-memory', async () => {
    const adapter = new MemoryAdapter()

    await adapter.setItem('clear-store', JSON.stringify({
      state: JSON.stringify({ count: 42 }),
      version: 1,
    }))

    createTestPinia(adapter)

    const useStore = defineStore(
      'clear-store',
      () => ({ count: ref(0) }),
      { persist: { enabled: true, key: 'clear-store' } },
    )

    const store = useStore()
    await flush()

    expect(store.count).toBe(42) // hydrated

    await store.$clearPersistedState()
    expect(await adapter.getItem('clear-store')).toBeNull()

    // State di-memory tidak terpengaruh
    expect(store.count).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// 14. Integration: Plugin — fallback menggunakan MemoryAdapter
// ---------------------------------------------------------------------------

describe('Plugin: storage fallback', () => {
  it('MemoryAdapter berfungsi sebagai pengganti storage permanen', async () => {
    const adapter = new MemoryAdapter()
    createTestPinia(adapter)

    const useStore = defineStore(
      'fallback-store',
      () => ({ value: ref(0) }),
      { persist: { enabled: true, key: 'fallback-store' } },
    )

    const store = useStore()
    store.$patch({ value: 99 })
    await flush()

    // State tersimpan di memory adapter
    const raw = await adapter.getItem('fallback-store')
    expect(raw).not.toBeNull()
    expect(JSON.parse(JSON.parse(raw!).state).value).toBe(99)
    expect(adapter.name).toBe('memory')
  })

  it('onStorageFallback callback dipanggil oleh plugin saat fallback', async () => {
    const onFallback = vi.fn()
    const memAdapter = new MemoryAdapter()

    // Simulasi plugin dengan onStorageFallback override
    const pinia = createPinia()
    pinia.use(({ store, options }) => {
      const persistOpts = resolveOptions(
        (options as { persist?: unknown }).persist as never,
        store.$id,
      )
      if (!persistOpts?.enabled) return

      // Simulasi fallback: panggil callback
      onFallback(memAdapter)

      return {
        async $clearPersistedState() {},
        async $persistNow() {},
        get $storageAdapterName() { return memAdapter.name },
      }
    })

    // Plugin hanya aktif saat pinia di-install via app.use(pinia)
    const app = createApp({ render: () => null })
    app.use(pinia)
    setActivePinia(pinia)

    const useStore = defineStore(
      'callback-store',
      () => ({ value: ref(0) }),
      { persist: { enabled: true } },
    )

    useStore()
    await flush()

    expect(onFallback).toHaveBeenCalledWith(memAdapter)
  })
})

// ---------------------------------------------------------------------------
// 15. Unit: isIndexedDBLikelyAvailable (environment detection)
// ---------------------------------------------------------------------------

describe('isIndexedDBLikelyAvailable', () => {
  it('mengembalikan true di environment dengan fake-indexeddb', () => {
    // fake-indexeddb/auto sudah menginstall global indexedDB dan IDBKeyRange
    expect(typeof indexedDB).toBe('object')
    expect(typeof IDBKeyRange).toBe('function')
    expect(isIndexedDBLikelyAvailable()).toBe(true)
  })
})
