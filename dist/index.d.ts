import type { PiniaPlugin } from 'pinia';
import type { GlobalPluginOptions } from './types';
/**
 * Buat Pinia plugin untuk persisted state dengan IndexedDB + fallback chain.
 *
 * @example
 * ```ts
 * import { createPinia } from 'pinia'
 * import { createIndexedDBPlugin } from '@or-abdillh/pinia-persisted-indexeddb'
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
export declare function createIndexedDBPlugin(globalOptions?: GlobalPluginOptions): PiniaPlugin;
export type { GlobalPluginOptions, PersistOptions, StorageAdapter, FallbackStrategy, Serializer, PersistedRecord, } from './types';
//# sourceMappingURL=index.d.ts.map