const DB_NAME = "ld59-editor";
const STORE = "handles";
const KEY = "levels";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type Handle = FileSystemFileHandle & {
  queryPermission(opts: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(opts: { mode: "readwrite" }): Promise<PermissionState>;
};

let cachedHandle: Handle | null = null;

export function supported() {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

export function isLinked() {
  return cachedHandle !== null;
}

export async function restoreHandle(): Promise<void> {
  if (!supported()) return;
  try {
    const h = await idbGet<Handle>(KEY);
    if (h) cachedHandle = h;
  } catch {
    // ignore
  }
}

async function ensureWritePermission(handle: Handle): Promise<boolean> {
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

type SaveResult = "ok" | "unsupported" | "cancelled" | "denied" | "error";

export async function save(data: unknown): Promise<SaveResult> {
  if (!supported()) return "unsupported";
  if (!cachedHandle) {
    try {
      cachedHandle = (await (window as any).showSaveFilePicker({
        suggestedName: "levels.json",
        types: [
          {
            description: "Level data",
            accept: { "application/json": [".json"] },
          },
        ],
      })) as Handle;
      await idbSet(KEY, cachedHandle);
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
      console.warn("picker failed", err);
      return "error";
    }
  }
  if (!(await ensureWritePermission(cachedHandle))) return "denied";
  try {
    const writable = await cachedHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return "ok";
  } catch (err) {
    console.warn("write failed", err);
    return "error";
  }
}

export async function unlink(): Promise<void> {
  cachedHandle = null;
  try {
    await idbDelete(KEY);
  } catch {
    // ignore
  }
}
