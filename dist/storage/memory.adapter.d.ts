import type { StorageAdapter } from '../types';
/**
 * In-memory storage adapter.
 *
 * Adapter terakhir dalam fallback chain. Tidak ada data yang dipersist ke disk —
 * semua state hilang saat halaman di-reload atau tab ditutup.
 *
 * Digunakan ketika semua storage backend lain (IndexedDB, localStorage,
 * sessionStorage) tidak tersedia atau gagal diinisialisasi.
 */
export declare class MemoryAdapter implements StorageAdapter {
    readonly name = "memory";
    private readonly store;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
//# sourceMappingURL=memory.adapter.d.ts.map