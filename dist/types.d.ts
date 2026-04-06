import type { StateTree } from 'pinia';
/**
 * Interface yang harus diimplementasikan oleh semua storage adapter.
 * Semua operasi bersifat async agar konsisten dengan IndexedDB.
 */
export interface StorageAdapter {
    /** Nama adapter untuk keperluan debug/logging */
    readonly name: string;
    /** Baca nilai berdasarkan key. Mengembalikan null jika tidak ada. */
    getItem(key: string): Promise<string | null>;
    /** Simpan nilai dengan key tertentu */
    setItem(key: string, value: string): Promise<void>;
    /** Hapus item berdasarkan key */
    removeItem(key: string): Promise<void>;
}
export interface Serializer<S = StateTree> {
    serialize(state: Partial<S>): string;
    deserialize(raw: string): Partial<S>;
}
export type FallbackStrategy = 'localStorage' | 'sessionStorage' | 'memory' | 'none';
export interface PersistOptions<S = StateTree> {
    /** Aktifkan persistence untuk store ini. Default: false */
    enabled: boolean;
    /**
     * Kunci yang digunakan untuk menyimpan state.
     * Default: store.$id
     */
    key?: string;
    /**
     * Versi skema state saat ini.
     * Jika versi tersimpan lebih lama, fungsi `migrate` akan dipanggil.
     * Default: 1
     */
    version?: number;
    /**
     * Fungsi migrasi yang dipanggil saat versi tersimpan < versi saat ini.
     * @param persistedState - State yang tersimpan di storage
     * @param fromVersion - Versi state yang tersimpan
     * @returns State baru hasil migrasi
     */
    migrate?: (persistedState: unknown, fromVersion: number) => StateTree;
    /**
     * Serializer custom untuk mengubah state ke/dari string.
     * Default: JSON.stringify / JSON.parse
     */
    serializer?: Serializer<S>;
    /**
     * Daftar key state yang tidak akan di-persist.
     * Default: []
     */
    omit?: (keyof S & string)[];
    /**
     * Override strategi fallback untuk store ini.
     * Jika tidak diset, menggunakan nilai dari global options.
     */
    fallback?: FallbackStrategy;
    /**
     * Callback yang dipanggil setelah state berhasil di-hydrate dari storage.
     */
    afterHydrate?: (storeId: string, adapter: StorageAdapter) => void;
    /**
     * Callback yang dipanggil saat hydration gagal (data tidak ada / corrupt).
     */
    onHydrationFailed?: (storeId: string, error: unknown) => void;
}
export interface GlobalPluginOptions {
    /**
     * Strategi fallback saat IndexedDB tidak tersedia.
     * - 'localStorage'  : fallback ke localStorage
     * - 'sessionStorage': fallback ke sessionStorage (data hilang saat tab ditutup)
     * - 'memory'        : fallback ke in-memory (data hilang saat page reload)
     * - 'none'          : tidak ada fallback, state tidak dipersist jika IDB gagal
     * Default: 'localStorage'
     */
    fallback?: FallbackStrategy;
    /**
     * Nama database IndexedDB.
     * Default: 'pinia-store'
     */
    dbName?: string;
    /**
     * Nama object store dalam database IndexedDB.
     * Default: 'states'
     */
    storeName?: string;
    /**
     * Serializer global. Dapat di-override per store.
     * Default: JSON.stringify / JSON.parse
     */
    serializer?: Serializer;
    /**
     * Callback yang dipanggil saat terjadi fallback dari IndexedDB ke storage lain.
     * Berguna untuk logging/monitoring di production.
     */
    onStorageFallback?: (reason: Error, chosenAdapter: StorageAdapter) => void;
    /**
     * Aktifkan debug logging ke console.
     * Default: false
     */
    debug?: boolean;
}
/** Data yang tersimpan di storage untuk setiap store */
export interface PersistedRecord {
    state: string;
    version: number;
}
declare module 'pinia' {
    interface DefineStoreOptionsBase<S, Store> {
        /**
         * Konfigurasi persistence untuk store ini.
         * - `true`  : aktifkan dengan semua nilai default
         * - `false` : (atau tidak diset) store tidak di-persist
         * - object  : konfigurasi lengkap via PersistOptions
         */
        persist?: PersistOptions<S> | boolean;
    }
    interface PiniaCustomProperties {
        $clearPersistedState: () => Promise<void>;
        $persistNow: () => Promise<void>;
        $storageAdapterName: string;
    }
}
//# sourceMappingURL=types.d.ts.map