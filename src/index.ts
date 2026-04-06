import type { PiniaPlugin, PiniaPluginContext, StateTree } from 'pinia'
import type { GlobalPluginOptions, StorageAdapter, PersistOptions } from './types'
import { resolveAdapter } from './storage/detector'
import { readState, writeState, deleteState } from './db'
import { resolveOptions, filterState, mergeState, defaultSerializer, debounce } from './utils'

/** Delay debounce untuk write ke storage (ms) */
const WRITE_DEBOUNCE_MS = 50

// ---------------------------------------------------------------------------
// Plugin Factory
// ---------------------------------------------------------------------------

/**
 * Buat Pinia plugin untuk persisted state dengan IndexedDB + fallback chain.
 *
 * @example
 * ```ts
 * import { createPinia } from 'pinia'
 * import { createIndexedDBPlugin } from '@orabdillh/pinia-persisted-indexeddb'
 *
 * const pinia = createPinia()
 * pinia.use(createIndexedDBPlugin({
 *   fallback: 'localStorage',
 *   debug: true,
 *   onStorageFallback: (err, adapter) => {
 *     console.warn('Fell back to', adapter.name, 'due to:', err.message)
 *   }
 * }))
 * ```
 */
export function createIndexedDBPlugin(globalOptions: GlobalPluginOptions = {}): PiniaPlugin {
  const {
    debug = false,
    serializer: globalSerializer = defaultSerializer,
  } = globalOptions

  // Resolusi adapter dilakukan sekali, shared oleh semua store.
  // Disimpan sebagai Promise agar semua store yang init bersamaan
  // tidak berlomba-lomba melakukan probe IDB.
  const adapterPromise: Promise<StorageAdapter> = resolveAdapter(globalOptions).then(
    ({ adapter, fallbackError }) => {
      if (fallbackError && debug) {
        console.warn('[pinia-idb] Storage fallback triggered:', fallbackError.message)
      }
      return adapter
    },
  )

  // ---------------------------------------------------------------------------
  // Plugin function — dipanggil untuk setiap store yang dibuat
  // ---------------------------------------------------------------------------

  return function piniaIndexedDBPlugin(context: PiniaPluginContext): void | Record<string, unknown> {
    const { store, options } = context
    const storeId = store.$id

    // Baca opsi persist dari definisi store
    const rawPersist = (options as { persist?: PersistOptions | boolean }).persist
    const persistOpts = resolveOptions(rawPersist, storeId)

    // Store ini tidak mengaktifkan persistence — skip sepenuhnya
    if (!persistOpts?.enabled) return

    const {
      key,
      version,
      migrate,
      omit,
      fallback: storeFallback,
      afterHydrate,
      onHydrationFailed,
      serializer: storeSerializer,
    } = persistOpts as Required<PersistOptions>

    const serializer = storeSerializer ?? globalSerializer

    // Tentukan adapter: gunakan adapter per-store jika `fallback` di-override,
    // otherwise gunakan shared adapter dari global options.
    let localAdapterPromise: Promise<StorageAdapter>

    if (storeFallback !== undefined && storeFallback !== globalOptions.fallback) {
      // Store ini memiliki override fallback — resolve adapter sendiri
      localAdapterPromise = resolveAdapter({
        ...globalOptions,
        fallback: storeFallback,
      }).then(({ adapter }) => adapter)
    } else {
      localAdapterPromise = adapterPromise
    }

    // -------------------------------------------------------------------------
    // Hydration: Restore state dari storage saat store pertama kali diinisialisasi
    // -------------------------------------------------------------------------

    const hydrateStore = async (): Promise<void> => {
      try {
        const adapter = await localAdapterPromise
        const record = await readState(adapter, key!, debug)

        if (record == null) {
          // Tidak ada data tersimpan — ini normal (fresh state atau data di-evict)
          if (debug) console.debug(`[pinia-idb] No persisted state found for "${storeId}"`)
          return
        }

        // Deserialisasi state
        let persistedState: Partial<StateTree>
        try {
          persistedState = serializer.deserialize(record.state)
        } catch (parseErr) {
          if (debug) console.warn(`[pinia-idb] Failed to deserialize state for "${storeId}":`, parseErr)
          onHydrationFailed?.(storeId, parseErr)
          return
        }

        // Jalankan migrasi jika versi tersimpan lebih lama
        const storedVersion = record.version
        const currentVersion = version ?? 1
        if (storedVersion < currentVersion && migrate) {
          if (debug) {
            console.debug(
              `[pinia-idb] Migrating "${storeId}" from v${storedVersion} to v${currentVersion}`,
            )
          }
          persistedState = migrate(persistedState, storedVersion)
        }

        // Merge dan patch state
        const mergedState = mergeState(store.$state, persistedState, omit ?? [])
        store.$patch(mergedState)

        if (debug) {
          console.debug(`[pinia-idb] Hydrated "${storeId}" from ${adapter.name}`)
        }

        afterHydrate?.(storeId, adapter)
      } catch (err) {
        if (debug) console.warn(`[pinia-idb] Hydration failed for "${storeId}":`, err)
        onHydrationFailed?.(storeId, err)
      }
    }

    // Jalankan hydration segera (non-blocking untuk render awal Vue)
    hydrateStore()

    // -------------------------------------------------------------------------
    // Persistence: Subscribe perubahan state → tulis ke storage
    // -------------------------------------------------------------------------

    const persistState = async (): Promise<void> => {
      try {
        const adapter = await localAdapterPromise
        const filteredState = filterState(store.$state, omit ?? [])
        await writeState(
          adapter,
          key!,
          filteredState,
          version ?? 1,
          serializer.serialize,
          debug,
        )
      } catch (err) {
        if (debug) console.warn(`[pinia-idb] Failed to persist state for "${storeId}":`, err)
      }
    }

    const debouncedPersist = debounce(persistState, WRITE_DEBOUNCE_MS)

    // $subscribe dipanggil setiap kali ada mutasi pada state
    // detached: true agar subscription tidak ikut terhapus saat component unmount
    store.$subscribe(
      (_mutation, _state) => {
        debouncedPersist()
      },
      { detached: true, flush: 'sync' },
    )

    // -------------------------------------------------------------------------
    // Exposed methods pada store instance
    // -------------------------------------------------------------------------

    return {
      async $clearPersistedState(): Promise<void> {
        const adapter = await localAdapterPromise
        await deleteState(adapter, key!, debug)
        if (debug) console.debug(`[pinia-idb] Cleared persisted state for "${storeId}"`)
      },

      async $persistNow(): Promise<void> {
        await persistState()
        if (debug) console.debug(`[pinia-idb] Force-persisted state for "${storeId}"`)
      },

      get $storageAdapterName(): string {
        // Sinkron — hanya tersedia setelah adapter resolved.
        // Diakses via getter agar selalu up-to-date.
        let resolvedName = 'pending'
        localAdapterPromise.then((a) => {
          resolvedName = a.name
        })
        return resolvedName
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Re-exports untuk kemudahan import dari luar
// ---------------------------------------------------------------------------

export type {
  GlobalPluginOptions,
  PersistOptions,
  StorageAdapter,
  FallbackStrategy,
  Serializer,
  PersistedRecord,
} from './types'
