import type { StorageAdapter } from '../types';
/**
 * IndexedDB storage adapter menggunakan library `idb`.
 *
 * Adapter utama dalam fallback chain. Menyimpan state sebagai record
 * `{ state: string, version: number }` dalam sebuah object store.
 *
 * Setiap key (store.$id) memiliki satu record dalam object store yang sama,
 * sehingga semua store Pinia berbagi satu database IndexedDB.
 */
export declare class IndexedDBAdapter implements StorageAdapter {
    private readonly dbName;
    private readonly storeName;
    readonly name = "indexedDB";
    private dbPromise;
    constructor(dbName: string, storeName: string);
    private openDatabase;
    /**
     * Baca raw JSON string dari IndexedDB.
     * Record yang tersimpan berbentuk PersistedRecord, lalu di-serialize ke string.
     */
    getItem(key: string): Promise<string | null>;
    /**
     * Tulis raw JSON string ke IndexedDB.
     * Value yang masuk sudah dalam bentuk serialized PersistedRecord.
     */
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    /**
     * Tutup koneksi database. Berguna saat testing atau cleanup.
     */
    close(): Promise<void>;
    /**
     * Hapus seluruh database. Digunakan untuk recovery dari corrupt database.
     */
    deleteDatabase(): Promise<void>;
}
//# sourceMappingURL=indexeddb.adapter.d.ts.map