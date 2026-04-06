import type { StateTree } from 'pinia';
import type { PersistOptions, Serializer } from './types';
export declare const defaultSerializer: Serializer;
/**
 * Normalisasi opsi `persist` dari bentuk ringkas ke PersistOptions lengkap.
 *
 * - `persist: true`     → enabled dengan semua nilai default
 * - `persist: false`    → tidak di-persist (should not reach here, filtered upstream)
 * - `persist: { ... }` → gabungkan dengan default
 */
export declare function resolveOptions<S extends StateTree>(raw: PersistOptions<S> | boolean | undefined, storeId: string): PersistOptions<S> | null;
/**
 * Buat salinan state dengan key yang ada di `omit` dihapus.
 * Tidak memodifikasi state asli.
 */
export declare function filterState<S extends StateTree>(state: S, omit: (keyof S & string)[]): Partial<S>;
/**
 * Merge state yang tersimpan ke dalam state store saat ini.
 *
 * Hanya key yang ada di `persistedState` yang di-patch.
 * Key yang ada di `omit` tidak akan di-merge meski tersimpan.
 *
 * Deep merge tidak dilakukan secara rekursif — Pinia's `$patch` sudah
 * menangani shallow merge dengan benar untuk mayoritas use case.
 */
export declare function mergeState<S extends StateTree>(currentState: S, persistedState: Partial<S>, omit: (keyof S & string)[]): Partial<S>;
/**
 * Buat fungsi debounced dari sebuah async function.
 * Panggilan berturut-turut dalam window `delay` ms akan diabaikan —
 * hanya panggilan terakhir yang dieksekusi setelah delay berakhir.
 *
 * Digunakan untuk mengurangi frekuensi write ke storage saat state
 * berubah sangat cepat (contoh: mengetik di input field).
 */
export declare function debounce<T extends unknown[]>(fn: (...args: T) => Promise<void> | void, delay: number): (...args: T) => void;
//# sourceMappingURL=utils.d.ts.map