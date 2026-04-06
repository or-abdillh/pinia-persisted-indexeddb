# @or-abdillh/pinia-persisted-indexeddb

<p>
  <img src="https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Pinia-2-ffd859?style=flat-square&logo=pinia&logoColor=black" alt="Pinia 2" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

Pinia plugin for persisted state using **IndexedDB** as the primary storage backend, with a complete automatic fallback chain.

- **Primary:** IndexedDB (via [`idb`](https://github.com/jakearchibald/idb))
- **Fallback 1:** `localStorage`
- **Fallback 2:** `sessionStorage`
- **Fallback 3:** In-memory (no persistence, but app stays functional)

Designed to survive hostile environments: private mode, sandboxed iframes, Safari pre-10.1, old Android WebViews, corporate-locked browsers, and SSR/Node.js environments.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
  - [createIndexedDBPlugin(options)](#createindexeddbpluginoptions)
  - [GlobalPluginOptions](#globalpluginoptions)
  - [PersistOptions (per-store)](#persistoptions-per-store)
  - [Store Instance Methods](#store-instance-methods)
  - [StorageAdapter Interface](#storagadapter-interface)
  - [Serializer Interface](#serializer-interface)
- [Usage Examples](#usage-examples)
  - [Basic — opt-in with defaults](#1-basic--opt-in-with-defaults)
  - [Custom key and version](#2-custom-key-and-version)
  - [Omit sensitive fields](#3-omit-sensitive-fields)
  - [Migration — schema evolution](#4-migration--schema-evolution)
  - [Custom serializer (e.g. compression)](#5-custom-serializer-eg-compression)
  - [Per-store fallback override](#6-per-store-fallback-override)
  - [Callbacks — afterHydrate and onHydrationFailed](#7-callbacks--afterhydrate-and-onhydrationfailed)
  - [Force persist and clear](#8-force-persist-and-clear)
- [Case Studies](#case-studies)
  - [Shopping Cart](#case-study-1-shopping-cart)
  - [User Authentication](#case-study-2-user-authentication)
  - [Draft / Auto-save](#case-study-3-draft--auto-save)
  - [App Settings with Migration](#case-study-4-app-settings-with-migration)
  - [Multi-tenant with Namespaced Keys](#case-study-5-multi-tenant-with-namespaced-keys)
- [Architecture](#architecture)
- [Known Limitations](#known-limitations)
- [Testing](#testing)

---

## Installation

```bash
npm install @or-abdillh/pinia-persisted-indexeddb
```

Or via git:

```bash
npm install github:or-abdillh/pinia-persisted-indexeddb
```

Peer dependencies (install if not already in your project):

```bash
npm install vue pinia
```

---

## Quick Start

**1. Register the plugin in `main.ts`:**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createIndexedDBPlugin } from '@or-abdillh/pinia-persisted-indexeddb'

const pinia = createPinia()

pinia.use(
  createIndexedDBPlugin({
    fallback: 'localStorage', // what to use if IndexedDB is unavailable
    debug: import.meta.env.DEV,
  })
)

const app = createApp(App)
app.use(pinia)
app.mount('#app')
```

**2. Opt-in persistence in a store:**

```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore(
  'counter',
  () => {
    const count = ref(0)
    function increment() { count.value++ }
    return { count, increment }
  },
  {
    persist: true, // enable with all defaults
  }
)
```

That's it. `count` will survive page reloads.

---

## How It Works

```
App starts
    │
    ▼
createIndexedDBPlugin() runs resolveAdapter() once
    │
    ├─ isIndexedDBLikelyAvailable() ──► false ──► skip probe
    │                                              │
    │                                              ▼
    │                                        fallback chain
    │
    └─ true ──► probeIndexedDB() (open/close/delete a test DB)
                    │
                    ├─ success ──► use IndexedDBAdapter
                    │
                    └─ failure ──► fallback chain
                                   (localStorage → sessionStorage → memory)

Per-store plugin function:
    │
    ├─ hydrateStore() ──► readState() ──► run migrate() if needed ──► $patch()
    │
    └─ store.$subscribe() ──► debounce(50ms) ──► writeState()
```

**Key design decisions:**

| Decision | Reason |
|---|---|
| One shared adapter per plugin instance | Avoid redundant IDB probes for each store |
| Debounced writes (50ms) | Prevent thundering-herd writes during rapid state changes (e.g. typing) |
| `$subscribe({ detached: true })` | Subscription survives component unmount |
| Double-layer JSON: `PersistedRecord` wraps serialized state | Allows versioning metadata without coupling to the serializer |
| Async-first `StorageAdapter` interface | localStorage/sessionStorage wrapped in Promise for uniform API |

---

## API Reference

### `createIndexedDBPlugin(options)`

Factory function that returns a Pinia plugin. Call it once and pass to `pinia.use()`.

```ts
import { createIndexedDBPlugin } from '@orabdillh/pinia-persisted-indexeddb'

const plugin = createIndexedDBPlugin(options?: GlobalPluginOptions)
pinia.use(plugin)
```

---

### `GlobalPluginOptions`

Options passed to `createIndexedDBPlugin()`. All fields are optional.

| Option | Type | Default | Description |
|---|---|---|---|
| `fallback` | `FallbackStrategy` | `'localStorage'` | Storage to use when IndexedDB is unavailable |
| `dbName` | `string` | `'pinia-store'` | IndexedDB database name |
| `storeName` | `string` | `'states'` | IndexedDB object store name |
| `serializer` | `Serializer` | JSON | Global serializer for all stores |
| `onStorageFallback` | `(reason: Error, adapter: StorageAdapter) => void` | — | Called when the plugin falls back from IDB |
| `debug` | `boolean` | `false` | Enables `console.debug` / `console.warn` logs |

**`FallbackStrategy` values:**

| Value | Behavior |
|---|---|
| `'localStorage'` | Fallback to localStorage, then sessionStorage, then memory |
| `'sessionStorage'` | Fallback to sessionStorage, then memory (skips localStorage) |
| `'memory'` | Fallback to in-memory only |
| `'none'` | No fallback — state will not be persisted if IDB fails. The store still functions; state is held in memory for the session only. |

> **Note on `'none'`:** even with `fallback: 'none'`, a `MemoryAdapter` is used internally so the app stays functional. The distinction is that `onStorageFallback` is still called, signaling "no real persistence".

---

### `PersistOptions` (per-store)

Passed as the `persist` option in `defineStore(id, setup, { persist: ... })`.

```ts
persist?: boolean | PersistOptions<S>
```

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | — | Must be `true` to activate persistence |
| `key` | `string` | `store.$id` | Storage key. Override to share state between stores or namespace it |
| `version` | `number` | `1` | Schema version. Increment when state shape changes |
| `migrate` | `(state: unknown, fromVersion: number) => StateTree` | — | Called when stored version < current version |
| `serializer` | `Serializer` | global serializer | Per-store serializer override |
| `omit` | `(keyof S)[]` | `[]` | Keys excluded from persistence (both write and hydrate) |
| `fallback` | `FallbackStrategy` | global fallback | Per-store fallback override |
| `afterHydrate` | `(storeId: string, adapter: StorageAdapter) => void` | — | Called after successful hydration |
| `onHydrationFailed` | `(storeId: string, error: unknown) => void` | — | Called when hydration fails (parse error, corrupt data) |

**Shorthand:**

```ts
persist: true
// equivalent to:
persist: { enabled: true, key: store.$id, version: 1, omit: [] }
```

---

### Store Instance Methods

The plugin adds three properties to every persisted store instance:

#### `store.$clearPersistedState(): Promise<void>`

Deletes the persisted data from storage. Does **not** reset the in-memory state.

```ts
const store = useCounterStore()
await store.$clearPersistedState()
// Storage is empty, but store.count still has its current value in memory
```

#### `store.$persistNow(): Promise<void>`

Forces an immediate write to storage, bypassing the 50ms debounce. Useful before the app closes or navigates away.

```ts
window.addEventListener('beforeunload', () => {
  store.$persistNow() // fire-and-forget is fine here
})
```

#### `store.$storageAdapterName: string`

Returns the name of the active storage adapter (`'indexedDB'`, `'localStorage'`, `'sessionStorage'`, or `'memory'`).

> **Known limitation:** this getter is synchronous but the adapter is resolved asynchronously. It will return `'pending'` if accessed before the adapter Promise resolves (typically < 10ms after app start). Use `afterHydrate` callback for a reliable signal that the adapter is ready.

```ts
// Safe usage — after hydration:
persist: {
  enabled: true,
  afterHydrate: (storeId, adapter) => {
    console.log('Active storage:', adapter.name)
  }
}
```

---

### `StorageAdapter` Interface

You can implement your own storage backend:

```ts
export interface StorageAdapter {
  readonly name: string
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}
```

---

### `Serializer` Interface

```ts
export interface Serializer<S = StateTree> {
  serialize(state: Partial<S>): string
  deserialize(raw: string): Partial<S>
}
```

The default serializer uses `JSON.stringify` / `JSON.parse`.

---

## Usage Examples

### 1. Basic — opt-in with defaults

```ts
export const useCartStore = defineStore(
  'cart',
  () => {
    const items = ref<CartItem[]>([])
    function addItem(item: CartItem) { items.value.push(item) }
    function clearCart() { items.value = [] }
    return { items, addItem, clearCart }
  },
  { persist: true }
)
```

State is saved to IndexedDB (or localStorage as fallback) automatically after every mutation, with a 50ms debounce.

---

### 2. Custom key and version

```ts
export const useProfileStore = defineStore(
  'profile',
  () => {
    const name = ref('')
    const email = ref('')
    return { name, email }
  },
  {
    persist: {
      enabled: true,
      key: 'user-profile-v2', // explicit storage key
      version: 2,
    }
  }
)
```

---

### 3. Omit sensitive fields

Never persist access tokens, passwords, or session-specific data:

```ts
export const useAuthStore = defineStore(
  'auth',
  () => {
    const userId = ref<string | null>(null)
    const accessToken = ref<string | null>(null)  // in-memory only
    const refreshToken = ref<string | null>(null) // in-memory only
    const rememberMe = ref(false)

    return { userId, accessToken, refreshToken, rememberMe }
  },
  {
    persist: {
      enabled: true,
      key: 'auth',
      omit: ['accessToken', 'refreshToken'], // these stay in memory only
    }
  }
)
```

After a page reload, `userId` and `rememberMe` are restored, but `accessToken` and `refreshToken` start as `null` — forcing a token refresh flow.

---

### 4. Migration — schema evolution

When you change the state shape, increment `version` and provide a `migrate` function:

```ts
// Version 1 state shape: { count: number }
// Version 2 state shape: { counter: { value: number; label: string } }

export const useCounterStore = defineStore(
  'counter',
  () => {
    const counter = ref({ value: 0, label: 'My Counter' })
    return { counter }
  },
  {
    persist: {
      enabled: true,
      version: 2,
      migrate(persistedState: unknown, fromVersion: number) {
        if (fromVersion === 1) {
          const old = persistedState as { count: number }
          return {
            counter: { value: old.count, label: 'My Counter' }
          }
        }
        return persistedState as Record<string, unknown>
      }
    }
  }
)
```

The `migrate` function is only called when the stored version is **older** than the current version. If versions match, migration is skipped entirely.

---

### 5. Custom serializer (e.g. compression)

Replace JSON with a compressed format for large state:

```ts
import { deflate, inflate } from 'pako' // or any compression lib

const compressedSerializer = {
  serialize: (state: unknown) => {
    const json = JSON.stringify(state)
    return btoa(String.fromCharCode(...deflate(json)))
  },
  deserialize: (raw: string) => {
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0))
    return JSON.parse(inflate(bytes, { to: 'string' }))
  }
}

pinia.use(
  createIndexedDBPlugin({
    serializer: compressedSerializer, // applies to all stores
  })
)
```

Or override per store:

```ts
export const useBigDataStore = defineStore(
  'bigdata',
  () => { /* ... */ },
  {
    persist: {
      enabled: true,
      serializer: compressedSerializer, // only this store
    }
  }
)
```

---

### 6. Per-store fallback override

Most stores use IndexedDB. A sensitive, session-only store uses `sessionStorage`:

```ts
// Global plugin: fallback to localStorage
pinia.use(createIndexedDBPlugin({ fallback: 'localStorage' }))

// This store uses sessionStorage regardless of global config
export const useSessionStore = defineStore(
  'session',
  () => {
    const sessionId = ref<string | null>(null)
    return { sessionId }
  },
  {
    persist: {
      enabled: true,
      fallback: 'sessionStorage', // override: data is tab-scoped
    }
  }
)
```

---

### 7. Callbacks — `afterHydrate` and `onHydrationFailed`

```ts
export const useSettingsStore = defineStore(
  'settings',
  () => {
    const theme = ref<'light' | 'dark'>('light')
    const language = ref('en')
    return { theme, language }
  },
  {
    persist: {
      enabled: true,
      afterHydrate(storeId, adapter) {
        // Guaranteed to run after state is restored
        console.log(`[${storeId}] Hydrated from ${adapter.name}`)
        document.documentElement.setAttribute('data-theme', theme.value)
      },
      onHydrationFailed(storeId, error) {
        // Corrupt data or parse error — state stays at defaults
        console.error(`[${storeId}] Hydration failed:`, error)
        // Optionally: report to Sentry, show a toast, etc.
      }
    }
  }
)
```

---

### 8. Force persist and clear

```ts
const store = useFormDraftStore()

// Immediately persist before navigation (bypass debounce)
router.beforeEach(async () => {
  await store.$persistNow()
})

// Clear saved draft when user explicitly discards it
async function discardDraft() {
  await store.$clearPersistedState()
  store.$reset() // reset in-memory state too
}
```

---

## Case Studies

### Case Study 1: Shopping Cart

**Requirements:**
- Cart survives page reloads and browser restarts
- Works even if IndexedDB is blocked (corporate networks)
- Cart should be emptied when user logs out

```ts
// stores/cart.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

export const useCartStore = defineStore(
  'cart',
  () => {
    const items = ref<CartItem[]>([])

    const totalItems = computed(() =>
      items.value.reduce((sum, item) => sum + item.quantity, 0)
    )

    const totalPrice = computed(() =>
      items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
    )

    function addItem(item: Omit<CartItem, 'quantity'>) {
      const existing = items.value.find(i => i.id === item.id)
      if (existing) {
        existing.quantity++
      } else {
        items.value.push({ ...item, quantity: 1 })
      }
    }

    function removeItem(id: string) {
      items.value = items.value.filter(i => i.id !== id)
    }

    function clear() {
      items.value = []
    }

    return { items, totalItems, totalPrice, addItem, removeItem, clear }
  },
  {
    persist: {
      enabled: true,
      key: 'shopping-cart',
      version: 1,
    }
  }
)
```

```ts
// composables/useAuth.ts — clear cart on logout
import { useCartStore } from '@/stores/cart'

export function useAuth() {
  const cartStore = useCartStore()

  async function logout() {
    await cartStore.$clearPersistedState()
    cartStore.clear()
    // ... rest of logout logic
  }

  return { logout }
}
```

---

### Case Study 2: User Authentication

**Requirements:**
- Remember user ID and preferences across sessions
- Never persist access tokens (security)
- Refresh tokens stored in sessionStorage only (tab-scoped)

```ts
// main.ts
pinia.use(createIndexedDBPlugin({
  fallback: 'localStorage',
  onStorageFallback: (err, adapter) => {
    // Alert monitoring if IDB fails in production
    Sentry.captureException(err, {
      extra: { fallbackAdapter: adapter.name }
    })
  }
}))
```

```ts
// stores/auth.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore(
  'auth',
  () => {
    // Persisted — safe to survive reload
    const userId = ref<string | null>(null)
    const rememberMe = ref(false)
    const lastLoginAt = ref<string | null>(null)

    // Never persisted — must be re-obtained after reload
    const accessToken = ref<string | null>(null)
    const userPermissions = ref<string[]>([])

    function setUser(id: string, token: string, permissions: string[]) {
      userId.value = id
      accessToken.value = token
      userPermissions.value = permissions
      lastLoginAt.value = new Date().toISOString()
    }

    function clearSession() {
      accessToken.value = null
      userPermissions.value = []
    }

    return {
      userId, rememberMe, lastLoginAt,
      accessToken, userPermissions,
      setUser, clearSession
    }
  },
  {
    persist: {
      enabled: true,
      key: 'auth',
      omit: ['accessToken', 'userPermissions'], // security: never persisted
    }
  }
)
```

---

### Case Study 3: Draft / Auto-save

**Requirements:**
- Auto-save form drafts while typing (without hammering storage)
- Restore draft when user returns to the page
- Discard draft on explicit submit or cancel

```ts
// stores/draft.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'

export const usePostDraftStore = defineStore(
  'post-draft',
  () => {
    const title = ref('')
    const content = ref('')
    const tags = ref<string[]>([])
    const lastSavedAt = ref<string | null>(null)

    function updateLastSaved() {
      lastSavedAt.value = new Date().toISOString()
    }

    function reset() {
      title.value = ''
      content.value = ''
      tags.value = []
      lastSavedAt.value = null
    }

    return { title, content, tags, lastSavedAt, updateLastSaved, reset }
  },
  {
    persist: {
      enabled: true,
      key: 'post-draft',
    }
  }
)
```

---

### Case Study 4: App Settings with Migration

**Requirements:**
- Persist user preferences (theme, language, notifications)
- Version 2 adds a new `notifications` object that v1 didn't have

```ts
// stores/settings.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'

interface NotificationSettings {
  email: boolean
  push: boolean
  sms: boolean
}

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const theme = ref<'light' | 'dark' | 'system'>('system')
    const language = ref('en')
    const notifications = ref<NotificationSettings>({
      email: true,
      push: true,
      sms: false,
    })

    return { theme, language, notifications }
  },
  {
    persist: {
      enabled: true,
      key: 'app-settings',
      version: 2,
      migrate(persistedState: unknown, fromVersion: number) {
        const state = persistedState as Record<string, unknown>
        if (fromVersion === 1) {
          return {
            ...state,
            notifications: { email: true, push: true, sms: false }
          }
        }
        return state
      },
    }
  }
)
```

---

### Case Study 5: Multi-tenant with Namespaced Keys

**Requirements:**
- Multiple users share the same browser (kiosk, family device)
- Each user's state must be isolated by user ID

```ts
// Factory: creates a store scoped to a specific user ID
export function useUserScopedStore(userId: string) {
  return defineStore(
    `user-prefs-${userId}`,
    () => {
      const favoriteItems = ref<string[]>([])
      const viewHistory = ref<string[]>([])
      const uiPrefs = ref({ compactMode: false, fontSize: 'medium' })

      return { favoriteItems, viewHistory, uiPrefs }
    },
    {
      persist: {
        enabled: true,
        key: `prefs:${userId}`,
        version: 1,
      }
    }
  )()
}
```

---

## Architecture

```
src/
├── index.ts              # createIndexedDBPlugin() factory — entry point
├── types.ts              # All interfaces + Pinia module augmentation
├── db.ts                 # readState(), writeState(), deleteState()
├── utils.ts              # resolveOptions(), filterState(), mergeState(), debounce()
└── storage/
    ├── detector.ts       # isIndexedDBLikelyAvailable(), probeIndexedDB(), resolveAdapter()
    ├── indexeddb.adapter.ts
    ├── localstorage.adapter.ts
    ├── sessionstorage.adapter.ts
    └── memory.adapter.ts
```

### Data format in storage

Every persisted store is stored under a single key as a JSON-serialized `PersistedRecord`:

```json
{
  "state": "{\"count\":42,\"name\":\"Alice\"}",
  "version": 1
}
```

The `state` field is the output of the `serializer.serialize()` function (JSON by default). The outer record is always `JSON.stringify`-ed, regardless of the serializer.

### Write flow

```
store.$patch()
    │
    ▼
$subscribe() fires (flush: 'sync')
    │
    ▼
debounce(50ms)
    │
    ▼
filterState() — remove omitted keys
    │
    ▼
serializer.serialize()
    │
    ▼
JSON.stringify({ state, version }) → PersistedRecord
    │
    ▼
adapter.setItem(key, record)
```

### Hydration flow

```
store created
    │
    ▼
hydrateStore() [async, non-blocking]
    │
    ▼
adapter.getItem(key)
    │
    ├─ null → done (fresh state, no persisted data)
    │
    └─ record found
            │
            ▼
        JSON.parse(raw) → PersistedRecord
            │
            ▼
        validate { state: string, version: number }
            │
            ▼
        serializer.deserialize(record.state)
            │
            ▼
        version check: stored < current?
            ├─ yes → migrate(persistedState, storedVersion)
            └─ no  → use as-is
            │
            ▼
        mergeState() — skip omitted keys
            │
            ▼
        store.$patch(mergedState)
            │
            ▼
        afterHydrate() callback
```

---

## Known Limitations

### `$storageAdapterName` race condition

`$storageAdapterName` is a synchronous getter, but the underlying adapter is resolved asynchronously. If you access it immediately after the store is created, it returns `'pending'`.

**Workaround:** use the `afterHydrate` callback, which receives the resolved `adapter` as a parameter and fires only after the adapter is ready and state is restored.

### No downgrade migration

`migrate()` is only called when `storedVersion < currentVersion`. If a user downgrades your app (e.g. via cache rollback), the stored version may be *higher* than the current version — migration is skipped and data is used as-is.

### IndexedDB schema version is hardcoded

The IndexedDB database schema version (`IDB_DB_VERSION`) is hardcoded to `1` in `indexeddb.adapter.ts`. If you change `storeName` in the global options on an existing installation, the new object store will not be created (since the DB version doesn't change). To change `storeName` safely, also change `dbName` to force a new database creation.

### Shallow merge only

`mergeState()` performs a shallow merge. Nested objects in persisted state will replace their counterpart in current state entirely, not deep-merge.

### sessionStorage is not shared across tabs

`sessionStorage` is scoped per tab by the browser. If you rely on sessionStorage as a fallback, state will not be shared between tabs of the same origin.

---

## Testing

The plugin uses `fake-indexeddb` and `happy-dom` for unit and integration tests.

```bash
npm test
```

**38 tests** covering:
- `resolveOptions` normalization
- `filterState` / `mergeState` logic
- `debounce` behavior
- All four storage adapters
- Plugin hydration, persistence, and mutation flows
- Migration callbacks
- `omit` keys (read and write)
- `$clearPersistedState` method
- Storage fallback scenarios
- `isIndexedDBLikelyAvailable` environment detection
