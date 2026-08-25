/**
 * First-page images for the documents grid.
 *
 * Compiling a résumé costs a Typst run in a WebAssembly compiler, so a
 * thumbnail is produced once and then kept: in memory for the session, and in
 * IndexedDB across sessions. Keys carry the revision of the document, so an
 * edit invalidates its own thumbnail and nothing else.
 */

const DB_NAME = "career-tailor-thumbnails";
const STORE = "pages";
const DB_VERSION = 1;
/** Roughly a few megabytes of WebP at tile size. */
const MAX_ENTRIES = 240;

type Entry = { key: string; dataUrl: string; at: number };

const memory = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("at", "at");
      }
    };
    request.onsuccess = () => resolve(request.result);
    // A blocked or disabled store is not worth reporting; rendering still works.
    request.onerror = () => resolve(null);
  });

  return dbPromise;
}

function transact(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

async function readStored(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = transact(db, "readonly").get(key);
      request.onsuccess = () => {
        const entry = request.result as Entry | undefined;
        resolve(entry?.dataUrl ?? null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeStored(key: string, dataUrl: string) {
  const db = await openDb();
  if (!db) return;
  try {
    const store = transact(db, "readwrite");
    store.put({ key, dataUrl, at: Date.now() } satisfies Entry);
    const count = store.count();
    count.onsuccess = () => {
      if (count.result <= MAX_ENTRIES) return;
      let over = count.result - MAX_ENTRIES;
      const cursor = store.index("at").openCursor();
      cursor.onsuccess = () => {
        const at = cursor.result;
        if (!at || over <= 0) return;
        at.delete();
        over -= 1;
        at.continue();
      };
    };
  } catch {
    // Quota or a closed database: the memory cache still carries the session.
  }
}

/**
 * One render at a time. The compiler is single-threaded behind a mutex anyway,
 * and a queue keeps a scrolled-past tile from holding up the visible ones.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/** Cached first page for `key`, rendering it with `produce` on a miss. */
export function getThumbnail(
  key: string,
  produce: () => Promise<string>,
): Promise<string> {
  const cached = memory.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const work = (async () => {
    const stored = await readStored(key);
    if (stored) {
      memory.set(key, stored);
      return stored;
    }
    const dataUrl = await enqueue(produce);
    memory.set(key, dataUrl);
    void writeStored(key, dataUrl);
    return dataUrl;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, work);
  return work;
}

/** First page of a stored PDF — what an uploaded résumé has instead of source. */
export async function renderPdfFirstPageToDataUrl(
  url: string,
  { width = 620 }: { width?: number } = {},
): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  const PdfWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker.default;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load the PDF.");
  const data = await response.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport } as any)
      .promise;
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    void pdf.destroy();
  }
}
