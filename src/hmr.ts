// Bun's HMR transform rejects indirect access to `import.meta.hot` — it's a
// runtime proxy that throws on any evaluation. The bundler only rewrites the
// direct syntactic forms (`import.meta.hot.data.X`, `.accept(...)`,
// `.dispose(...)`), so those calls must stay lexical in the caller.
//
// For state persistence we side-step `import.meta.hot.data` entirely and
// stash values on `globalThis`. HMR only re-evaluates modules; the realm
// (and globalThis) persists across reloads. Bun's own HMR runtime uses the
// same trick.

const STORE_KEY = Symbol.for("ld59:hmr-store");

function getStore(): Record<string, unknown> {
  const g = globalThis as unknown as Record<symbol, Record<string, unknown>>;
  return (g[STORE_KEY] ??= {});
}

export function persistent<T>(key: string, create: () => T): T {
  const store = getStore();
  if (!(key in store)) store[key] = create();
  return store[key] as T;
}
