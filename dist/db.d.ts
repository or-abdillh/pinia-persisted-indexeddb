import type { StateTree } from 'pinia';
import type { StorageAdapter, PersistedRecord } from './types';
/**
 * Baca PersistedRecord dari storage.
 *
 * @returns Record tersimpan, atau null jika belum ada / gagal dibaca
 */
export declare function readState(adapter: StorageAdapter, key: string, debug?: boolean): Promise<PersistedRecord | null>;
/**
 * Tulis state ke storage dalam bentuk PersistedRecord.
 *
 * @param state   - State yang akan disimpan (sudah difilter omit)
 * @param version - Versi skema state saat ini
 */
export declare function writeState(adapter: StorageAdapter, key: string, state: Partial<StateTree>, version: number, serialize: (s: Partial<StateTree>) => string, debug?: boolean): Promise<void>;
/**
 * Hapus persisted state dari storage.
 */
export declare function deleteState(adapter: StorageAdapter, key: string, debug?: boolean): Promise<void>;
//# sourceMappingURL=db.d.ts.map