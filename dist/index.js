//#region node_modules/idb/build/index.js
var e = (e, t) => t.some((t) => e instanceof t), t, n;
function r() {
	return t ||= [
		IDBDatabase,
		IDBObjectStore,
		IDBIndex,
		IDBCursor,
		IDBTransaction
	];
}
function i() {
	return n ||= [
		IDBCursor.prototype.advance,
		IDBCursor.prototype.continue,
		IDBCursor.prototype.continuePrimaryKey
	];
}
var a = /* @__PURE__ */ new WeakMap(), o = /* @__PURE__ */ new WeakMap(), s = /* @__PURE__ */ new WeakMap();
function c(e) {
	let t = new Promise((t, n) => {
		let r = () => {
			e.removeEventListener("success", i), e.removeEventListener("error", a);
		}, i = () => {
			t(m(e.result)), r();
		}, a = () => {
			n(e.error), r();
		};
		e.addEventListener("success", i), e.addEventListener("error", a);
	});
	return s.set(t, e), t;
}
function l(e) {
	if (a.has(e)) return;
	let t = new Promise((t, n) => {
		let r = () => {
			e.removeEventListener("complete", i), e.removeEventListener("error", a), e.removeEventListener("abort", a);
		}, i = () => {
			t(), r();
		}, a = () => {
			n(e.error || new DOMException("AbortError", "AbortError")), r();
		};
		e.addEventListener("complete", i), e.addEventListener("error", a), e.addEventListener("abort", a);
	});
	a.set(e, t);
}
var u = {
	get(e, t, n) {
		if (e instanceof IDBTransaction) {
			if (t === "done") return a.get(e);
			if (t === "store") return n.objectStoreNames[1] ? void 0 : n.objectStore(n.objectStoreNames[0]);
		}
		return m(e[t]);
	},
	set(e, t, n) {
		return e[t] = n, !0;
	},
	has(e, t) {
		return e instanceof IDBTransaction && (t === "done" || t === "store") ? !0 : t in e;
	}
};
function d(e) {
	u = e(u);
}
function f(e) {
	return i().includes(e) ? function(...t) {
		return e.apply(h(this), t), m(this.request);
	} : function(...t) {
		return m(e.apply(h(this), t));
	};
}
function p(t) {
	return typeof t == "function" ? f(t) : (t instanceof IDBTransaction && l(t), e(t, r()) ? new Proxy(t, u) : t);
}
function m(e) {
	if (e instanceof IDBRequest) return c(e);
	if (o.has(e)) return o.get(e);
	let t = p(e);
	return t !== e && (o.set(e, t), s.set(t, e)), t;
}
var h = (e) => s.get(e);
function g(e, t, { blocked: n, upgrade: r, blocking: i, terminated: a } = {}) {
	let o = indexedDB.open(e, t), s = m(o);
	return r && o.addEventListener("upgradeneeded", (e) => {
		r(m(o.result), e.oldVersion, e.newVersion, m(o.transaction), e);
	}), n && o.addEventListener("blocked", (e) => n(e.oldVersion, e.newVersion, e)), s.then((e) => {
		a && e.addEventListener("close", () => a()), i && e.addEventListener("versionchange", (e) => i(e.oldVersion, e.newVersion, e));
	}).catch(() => {}), s;
}
function _(e, { blocked: t } = {}) {
	let n = indexedDB.deleteDatabase(e);
	return t && n.addEventListener("blocked", (e) => t(e.oldVersion, e)), m(n).then(() => void 0);
}
var v = [
	"get",
	"getKey",
	"getAll",
	"getAllKeys",
	"count"
], y = [
	"put",
	"add",
	"delete",
	"clear"
], b = /* @__PURE__ */ new Map();
function x(e, t) {
	if (!(e instanceof IDBDatabase && !(t in e) && typeof t == "string")) return;
	if (b.get(t)) return b.get(t);
	let n = t.replace(/FromIndex$/, ""), r = t !== n, i = y.includes(n);
	if (!(n in (r ? IDBIndex : IDBObjectStore).prototype) || !(i || v.includes(n))) return;
	let a = async function(e, ...t) {
		let a = this.transaction(e, i ? "readwrite" : "readonly"), o = a.store;
		return r && (o = o.index(t.shift())), (await Promise.all([o[n](...t), i && a.done]))[0];
	};
	return b.set(t, a), a;
}
d((e) => ({
	...e,
	get: (t, n, r) => x(t, n) || e.get(t, n, r),
	has: (t, n) => !!x(t, n) || e.has(t, n)
}));
var S = [
	"continue",
	"continuePrimaryKey",
	"advance"
], C = {}, w = /* @__PURE__ */ new WeakMap(), T = /* @__PURE__ */ new WeakMap(), E = { get(e, t) {
	if (!S.includes(t)) return e[t];
	let n = C[t];
	return n ||= C[t] = function(...e) {
		w.set(this, T.get(this)[t](...e));
	}, n;
} };
async function* D(...e) {
	let t = this;
	if (t instanceof IDBCursor || (t = await t.openCursor(...e)), !t) return;
	t = t;
	let n = new Proxy(t, E);
	for (T.set(n, t), s.set(n, h(t)); t;) yield n, t = await (w.get(n) || t.continue()), w.delete(n);
}
function O(t, n) {
	return n === Symbol.asyncIterator && e(t, [
		IDBIndex,
		IDBObjectStore,
		IDBCursor
	]) || n === "iterate" && e(t, [IDBIndex, IDBObjectStore]);
}
d((e) => ({
	...e,
	get(t, n, r) {
		return O(t, n) ? D : e.get(t, n, r);
	},
	has(t, n) {
		return O(t, n) || e.has(t, n);
	}
}));
//#endregion
//#region src/storage/indexeddb.adapter.ts
var k = 1, A = class {
	constructor(e, t) {
		this.dbName = e, this.storeName = t, this.name = "indexedDB", this.dbPromise = this.openDatabase();
	}
	openDatabase() {
		let e = this.storeName;
		return g(this.dbName, k, { upgrade(t) {
			t.objectStoreNames.contains(e) || t.createObjectStore(e);
		} });
	}
	async getItem(e) {
		let t = await (await this.dbPromise).get(this.storeName, e);
		return t == null ? null : JSON.stringify(t);
	}
	async setItem(e, t) {
		let n = await this.dbPromise, r = JSON.parse(t);
		await n.put(this.storeName, r, e);
	}
	async removeItem(e) {
		await (await this.dbPromise).delete(this.storeName, e);
	}
	async close() {
		(await this.dbPromise).close();
	}
	async deleteDatabase() {
		(await this.dbPromise).close(), await _(this.dbName), this.dbPromise = this.openDatabase();
	}
}, j = class {
	constructor() {
		this.name = "localStorage";
	}
	async getItem(e) {
		try {
			return window.localStorage.getItem(e);
		} catch {
			return null;
		}
	}
	async setItem(e, t) {
		window.localStorage.setItem(e, t);
	}
	async removeItem(e) {
		window.localStorage.removeItem(e);
	}
};
function M() {
	try {
		let e = "__pinia_idb_ls_test__";
		return window.localStorage.setItem(e, "1"), window.localStorage.removeItem(e), !0;
	} catch {
		return !1;
	}
}
//#endregion
//#region src/storage/sessionstorage.adapter.ts
var N = class {
	constructor() {
		this.name = "sessionStorage";
	}
	async getItem(e) {
		try {
			return window.sessionStorage.getItem(e);
		} catch {
			return null;
		}
	}
	async setItem(e, t) {
		window.sessionStorage.setItem(e, t);
	}
	async removeItem(e) {
		window.sessionStorage.removeItem(e);
	}
};
function P() {
	try {
		let e = "__pinia_idb_ss_test__";
		return window.sessionStorage.setItem(e, "1"), window.sessionStorage.removeItem(e), !0;
	} catch {
		return !1;
	}
}
//#endregion
//#region src/storage/memory.adapter.ts
var F = class {
	constructor() {
		this.name = "memory", this.store = /* @__PURE__ */ new Map();
	}
	async getItem(e) {
		return this.store.get(e) ?? null;
	}
	async setItem(e, t) {
		this.store.set(e, t);
	}
	async removeItem(e) {
		this.store.delete(e);
	}
};
//#endregion
//#region src/storage/detector.ts
function I() {
	try {
		return !(typeof indexedDB > "u" || typeof IDBKeyRange > "u" || window.openDatabase !== void 0 && typeof navigator < "u" && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/Chromium/.test(navigator.userAgent) && !(typeof fetch == "function" && fetch.toString().includes("[native code")));
	} catch {
		return !1;
	}
}
async function L() {
	let e = "__pinia_idb_probe__";
	try {
		return (await g(e, 1, { upgrade(e) {
			e.createObjectStore("probe");
		} })).close(), await _(e), !0;
	} catch {
		try {
			await _(e);
		} catch {}
		return !1;
	}
}
async function R(e) {
	let { fallback: t = "localStorage", dbName: n = "pinia-store", storeName: r = "states", onStorageFallback: i, debug: a = !1 } = e, o = I();
	if (o && await L()) return a && console.debug("[pinia-idb] Using IndexedDB adapter"), {
		adapter: new A(n, r),
		fallbackError: null
	};
	let s = /* @__PURE__ */ Error(o ? "IndexedDB runtime probe failed (private mode, security policy, or corruption)" : "IndexedDB is not available in this environment");
	if (a && console.warn(`[pinia-idb] IndexedDB unavailable: ${s.message}`), t === "none") {
		let e = new F();
		return a && console.warn("[pinia-idb] Fallback disabled. State will NOT be persisted."), i?.(s, e), {
			adapter: e,
			fallbackError: s
		};
	}
	if ((t === "localStorage" || t === "sessionStorage" || t === "memory") && M()) {
		let e = new j();
		return a && console.warn("[pinia-idb] Falling back to localStorage"), i?.(s, e), {
			adapter: e,
			fallbackError: s
		};
	}
	if ((t === "sessionStorage" || t === "memory") && P()) {
		let e = new N();
		return a && console.warn("[pinia-idb] Falling back to sessionStorage (data will not persist across sessions)"), i?.(s, e), {
			adapter: e,
			fallbackError: s
		};
	}
	let c = new F();
	return a && console.warn("[pinia-idb] Falling back to in-memory storage (no persistence)"), i?.(s, c), {
		adapter: c,
		fallbackError: s
	};
}
//#endregion
//#region src/db.ts
async function z(e, t, n = !1) {
	try {
		let r = await e.getItem(t);
		if (r == null) return null;
		let i = JSON.parse(r);
		return typeof i.state != "string" || typeof i.version != "number" ? (n && console.warn(`[pinia-idb] Stored record for key "${t}" has invalid shape, ignoring.`), null) : i;
	} catch (e) {
		return n && console.warn(`[pinia-idb] Failed to read state for key "${t}":`, e), null;
	}
}
async function B(e, t, n, r, i, a = !1) {
	try {
		let a = {
			state: i(n),
			version: r
		};
		await e.setItem(t, JSON.stringify(a));
	} catch (e) {
		a && console.warn(`[pinia-idb] Failed to write state for key "${t}":`, e);
	}
}
async function V(e, t, n = !1) {
	try {
		await e.removeItem(t);
	} catch (e) {
		n && console.warn(`[pinia-idb] Failed to delete state for key "${t}":`, e);
	}
}
//#endregion
//#region src/utils.ts
var H = {
	serialize: (e) => JSON.stringify(e),
	deserialize: (e) => JSON.parse(e)
};
function U(e, t) {
	if (!e) return null;
	let n = {
		enabled: !0,
		key: t,
		version: 1,
		omit: []
	};
	return e === !0 ? n : {
		...n,
		...e,
		key: e.key ?? t,
		version: e.version ?? 1,
		omit: e.omit ?? []
	};
}
function W(e, t) {
	if (t.length === 0) return { ...e };
	let n = { ...e };
	for (let e of t) delete n[e];
	return n;
}
function G(e, t, n) {
	let r = new Set(n), i = {};
	for (let e in t) r.has(e) || (i[e] = t[e]);
	for (let t in e) t in i || (i[t] = e[t]);
	return i;
}
function K(e, t) {
	let n = null;
	return (...r) => {
		n !== null && clearTimeout(n), n = setTimeout(() => {
			n = null, e(...r);
		}, t);
	};
}
//#endregion
//#region src/index.ts
var q = 50;
function J(e = {}) {
	let { debug: t = !1, serializer: n = H } = e, r = R(e).then(({ adapter: e, fallbackError: n }) => (n && t && console.warn("[pinia-idb] Storage fallback triggered:", n.message), e));
	return function(i) {
		let { store: a, options: o } = i, s = a.$id, c = o.persist, l = U(c, s);
		if (!l?.enabled) return;
		let { key: u, version: d, migrate: f, omit: p, fallback: m, afterHydrate: h, onHydrationFailed: g, serializer: _ } = l, v = _ ?? n, y;
		y = m !== void 0 && m !== e.fallback ? R({
			...e,
			fallback: m
		}).then(({ adapter: e }) => e) : r, (async () => {
			try {
				let e = await y, n = await z(e, u, t);
				if (n == null) {
					t && console.debug(`[pinia-idb] No persisted state found for "${s}"`);
					return;
				}
				let r;
				try {
					r = v.deserialize(n.state);
				} catch (e) {
					t && console.warn(`[pinia-idb] Failed to deserialize state for "${s}":`, e), g?.(s, e);
					return;
				}
				let i = n.version, o = d ?? 1;
				i < o && f && (t && console.debug(`[pinia-idb] Migrating "${s}" from v${i} to v${o}`), r = f(r, i));
				let c = G(a.$state, r, p ?? []);
				a.$patch(c), t && console.debug(`[pinia-idb] Hydrated "${s}" from ${e.name}`), h?.(s, e);
			} catch (e) {
				t && console.warn(`[pinia-idb] Hydration failed for "${s}":`, e), g?.(s, e);
			}
		})();
		let b = async () => {
			try {
				await B(await y, u, W(a.$state, p ?? []), d ?? 1, v.serialize, t);
			} catch (e) {
				t && console.warn(`[pinia-idb] Failed to persist state for "${s}":`, e);
			}
		}, x = K(b, q);
		return a.$subscribe((e, t) => {
			x();
		}, {
			detached: !0,
			flush: "sync"
		}), {
			async $clearPersistedState() {
				await V(await y, u, t), t && console.debug(`[pinia-idb] Cleared persisted state for "${s}"`);
			},
			async $persistNow() {
				await b(), t && console.debug(`[pinia-idb] Force-persisted state for "${s}"`);
			},
			get $storageAdapterName() {
				let e = "pending";
				return y.then((t) => {
					e = t.name;
				}), e;
			}
		};
	};
}
//#endregion
export { J as createIndexedDBPlugin };

//# sourceMappingURL=index.js.map