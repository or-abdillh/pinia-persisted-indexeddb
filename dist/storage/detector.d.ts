import type { StorageAdapter, GlobalPluginOptions } from '../types';
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
export declare function isIndexedDBLikelyAvailable(): boolean;
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
export declare function resolveAdapter(options: GlobalPluginOptions): Promise<{
    adapter: StorageAdapter;
    fallbackError: Error | null;
}>;
//# sourceMappingURL=detector.d.ts.map