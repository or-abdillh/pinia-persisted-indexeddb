import type { StorageAdapter } from '../types';
/**
 * localStorage adapter.
 *
 * Fallback pertama dari IndexedDB. Data persisten lintas sesi browser.
 * Batas kapasitas ~5 MiB per origin.
 *
 * Semua operasi dibungkus Promise agar konsisten dengan interface
 * StorageAdapter yang async-first.
 */
export declare class LocalStorageAdapter implements StorageAdapter {
    readonly name = "localStorage";
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
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
export declare function isLocalStorageAvailable(): boolean;
//# sourceMappingURL=localstorage.adapter.d.ts.map