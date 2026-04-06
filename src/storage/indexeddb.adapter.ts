import { openDB, deleteDB, type IDBPDatabase } from 'idb'
import type { StorageAdapter } from '../types'
import type { PersistedRecord } from '../types'

const IDB_DB_VERSION = 1

/**
 * IndexedDB storage adapter menggunakan library `idb`.
 *
 * Adapter utama dalam fallback chain. Menyimpan state sebagai record
 * `{ state: string, version: number }` dalam sebuah object store.
 *
 * Setiap key (store.$id) memiliki satu record dalam object store yang sama,
 * sehingga semua store Pinia berbagi satu database IndexedDB.
 */
export class IndexedDBAdapter implements StorageAdapter {
  readonly name = 'indexedDB'

  private dbPromise: Promise<IDBPDatabase>

  constructor(
    private readonly dbName: string,
    private readonly storeName: string,
  ) {
    this.dbPromise = this.openDatabase()
  }

  private openDatabase(): Promise<IDBPDatabase> {
    const storeName = this.storeName
    return openDB(this.dbName, IDB_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName)
        }
      },
    })
  }

  /**
   * Baca raw JSON string dari IndexedDB.
   * Record yang tersimpan berbentuk PersistedRecord, lalu di-serialize ke string.
   */
  async getItem(key: string): Promise<string | null> {
    const db = await this.dbPromise
    const record = await db.get(this.storeName, key) as PersistedRecord | undefined
    if (record == null) return null
    return JSON.stringify(record)
  }

  /**
   * Tulis raw JSON string ke IndexedDB.
   * Value yang masuk sudah dalam bentuk serialized PersistedRecord.
   */
  async setItem(key: string, value: string): Promise<void> {
    const db = await this.dbPromise
    const record = JSON.parse(value) as PersistedRecord
    await db.put(this.storeName, record, key)
  }

  async removeItem(key: string): Promise<void> {
    const db = await this.dbPromise
    await db.delete(this.storeName, key)
  }

  /**
   * Tutup koneksi database. Berguna saat testing atau cleanup.
   */
  async close(): Promise<void> {
    const db = await this.dbPromise
    db.close()
  }

  /**
   * Hapus seluruh database. Digunakan untuk recovery dari corrupt database.
   */
  async deleteDatabase(): Promise<void> {
    const db = await this.dbPromise
    db.close()
    await deleteDB(this.dbName)
    // Re-open untuk sesi berikutnya
    this.dbPromise = this.openDatabase()
  }
}
