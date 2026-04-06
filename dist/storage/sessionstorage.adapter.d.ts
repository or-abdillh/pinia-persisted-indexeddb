import type { StorageAdapter } from '../types';
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
export declare class SessionStorageAdapter implements StorageAdapter {
    readonly name = "sessionStorage";
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
/**
 * Cek apakah sessionStorage tersedia dan dapat digunakan.
 * Penyebab kegagalan sama dengan localStorage.
 */
export declare function isSessionStorageAvailable(): boolean;
//# sourceMappingURL=sessionstorage.adapter.d.ts.map