import type { StateTree } from 'pinia'
import type { PersistOptions, Serializer } from './types'

// ---------------------------------------------------------------------------
// Default Serializer
// ---------------------------------------------------------------------------

export const defaultSerializer: Serializer = {
  serialize: (state) => JSON.stringify(state),
  deserialize: (raw) => JSON.parse(raw) as Record<string, unknown>,
}

// ---------------------------------------------------------------------------
// Options Normalization
// ---------------------------------------------------------------------------

/**
 * Normalisasi opsi `persist` dari bentuk ringkas ke PersistOptions lengkap.
 *
 * - `persist: true`     → enabled dengan semua nilai default
 * - `persist: false`    → tidak di-persist (should not reach here, filtered upstream)
 * - `persist: { ... }` → gabungkan dengan default
 */
export function resolveOptions<S extends StateTree>(
  raw: PersistOptions<S> | boolean | undefined,
  storeId: string,
): PersistOptions<S> | null {
  if (!raw) return null

  const base: PersistOptions<S> = {
    enabled: true,
    key: storeId,
    version: 1,
    omit: [],
  }

  if (raw === true) return base

  return {
    ...base,
    ...raw,
    key: raw.key ?? storeId,
    version: raw.version ?? 1,
    omit: raw.omit ?? [],
  }
}

// ---------------------------------------------------------------------------
// State Filtering (omit keys)
// ---------------------------------------------------------------------------

/**
 * Buat salinan state dengan key yang ada di `omit` dihapus.
 * Tidak memodifikasi state asli.
 */
export function filterState<S extends StateTree>(
  state: S,
  omit: (keyof S & string)[],
): Partial<S> {
  if (omit.length === 0) return { ...state }

  const result = { ...state }
  for (const key of omit) {
    delete result[key]
  }
  return result
}

// ---------------------------------------------------------------------------
// State Merging (hydration)
// ---------------------------------------------------------------------------

/**
 * Merge state yang tersimpan ke dalam state store saat ini.
 *
 * Hanya key yang ada di `persistedState` yang di-patch.
 * Key yang ada di `omit` tidak akan di-merge meski tersimpan.
 *
 * Deep merge tidak dilakukan secara rekursif — Pinia's `$patch` sudah
 * menangani shallow merge dengan benar untuk mayoritas use case.
 */
export function mergeState<S extends StateTree>(
  currentState: S,
  persistedState: Partial<S>,
  omit: (keyof S & string)[],
): Partial<S> {
  const omitSet = new Set(omit)
  const merged: Partial<S> = {}

  for (const key in persistedState) {
    if (!omitSet.has(key)) {
      merged[key as keyof S] = persistedState[key as keyof S]
    }
  }

  // Pastikan key yang tidak tersimpan tetap menggunakan nilai state saat ini
  for (const key in currentState) {
    if (!(key in merged)) {
      merged[key as keyof S] = currentState[key as keyof S]
    }
  }

  return merged
}

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------

/**
 * Buat fungsi debounced dari sebuah async function.
 * Panggilan berturut-turut dalam window `delay` ms akan diabaikan —
 * hanya panggilan terakhir yang dieksekusi setelah delay berakhir.
 *
 * Digunakan untuk mengurangi frekuensi write ke storage saat state
 * berubah sangat cepat (contoh: mengetik di input field).
 */
export function debounce<T extends unknown[]>(
  fn: (...args: T) => Promise<void> | void,
  delay: number,
): (...args: T) => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return (...args: T): void => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }
}
