const DISPLAY_HISTORY_STORAGE_KEY = 'sop_display_recent_cache:v2';
const DISPLAY_HISTORY_LEGACY_STORAGE_KEY = 'sop_display_recent:v1';
const DISPLAY_HISTORY_DB_NAME = 'sop-display-history';
const DISPLAY_HISTORY_STORE_NAME = 'history';
const DISPLAY_HISTORY_RECORD_KEY = 'recent';
const MAX_HISTORY_ITEMS = 20;
const MAX_PAGES_PER_ENTRY = 120;

export type DisplayHistorySource = 'push' | 'browse' | 'history';

export interface DisplayHistoryEntry {
  id: string;
  kind: 'pages' | 'pdf';
  source: DisplayHistorySource;
  jobName: string;
  pdfUrl?: string;
  pdfPath?: string;
  pdfName?: string;
  category?: string;
  machine?: string;
  process?: string;
  previewPath?: string;
  pages: SearchResult[];
  pageCount: number;
  viewedAt: number;
}

export interface DisplayHistorySeed {
  source?: DisplayHistorySource;
  jobName?: string;
  pdfUrl?: string;
  pdfPath?: string;
  pdfName?: string;
  category?: string;
  machine?: string;
  process?: string;
  imagePath?: string;
  imageUrl?: string;
  pageNum?: number;
  pages?: SearchResult[];
}

interface DisplayHistoryStoreRecord {
  key: string;
  entries: DisplayHistoryEntry[];
  updatedAt: number;
}

let memoryHistoryCache: DisplayHistoryEntry[] | null = null;
let databasePromise: Promise<IDBDatabase | null> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function normalizeText(value?: string): string {
  return (value || '').trim();
}

function stripOrigin(value?: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(normalized, base);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return normalized;
  }
}

function normalizeStoredPage(page: SearchResult): SearchResult | null {
  const imageUrl = stripOrigin(page.image_url);
  const imagePath = normalizeText(page.image_path);
  if (!imageUrl && !imagePath) {
    return null;
  }

  return {
    image_url: imageUrl,
    image_path: imagePath,
    page_num: page.page_num || 0,
  };
}

function normalizePages(seed: DisplayHistorySeed): SearchResult[] {
  const rawPages = seed.pages && seed.pages.length > 0
    ? seed.pages
    : ((seed.imageUrl || seed.imagePath)
      ? [{ image_url: seed.imageUrl, image_path: seed.imagePath, page_num: seed.pageNum ?? 0 }]
      : []);

  return rawPages
    .filter(page => page.image_url || page.image_path)
    .slice()
    .sort((a, b) => (a.page_num || 0) - (b.page_num || 0))
    .slice(0, MAX_PAGES_PER_ENTRY)
    .map(normalizeStoredPage)
    .filter((page): page is SearchResult => !!page);
}

function sanitizeEntry(entry: unknown): DisplayHistoryEntry | null {
  if (!entry || typeof entry !== 'object') return null;

  const record = entry as Partial<DisplayHistoryEntry>;
  if (!record.id || typeof record.id !== 'string') return null;
  if (record.kind !== 'pages' && record.kind !== 'pdf') return null;
  if (record.source !== 'push' && record.source !== 'browse' && record.source !== 'history') return null;

  const pages = Array.isArray(record.pages)
    ? record.pages
        .filter(page => page && typeof page === 'object')
        .map(page => normalizeStoredPage(page as SearchResult))
        .filter((page): page is SearchResult => !!page)
    : [];

  return {
    id: record.id,
    kind: pages.length > 0 ? 'pages' : record.kind,
    source: record.source,
    jobName: normalizeText(record.jobName),
    pdfUrl: stripOrigin(record.pdfUrl) || undefined,
    pdfPath: normalizeText(record.pdfPath) || undefined,
    pdfName: normalizeText(record.pdfName) || undefined,
    category: normalizeText(record.category) || undefined,
    machine: normalizeText(record.machine) || undefined,
    process: normalizeText(record.process) || undefined,
    previewPath: stripOrigin(record.previewPath) || undefined,
    pages,
    pageCount: typeof record.pageCount === 'number'
      ? Math.max(record.pageCount, pages.length)
      : pages.length,
    viewedAt: typeof record.viewedAt === 'number' ? record.viewedAt : Date.now(),
  };
}

function normalizeHistoryEntries(entries: unknown[]): DisplayHistoryEntry[] {
  return entries
    .map(sanitizeEntry)
    .filter((entry): entry is DisplayHistoryEntry => !!entry)
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, MAX_HISTORY_ITEMS);
}

function latestViewedAt(entries: DisplayHistoryEntry[]): number {
  return entries[0]?.viewedAt || 0;
}

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalCache(entries: DisplayHistoryEntry[]) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(DISPLAY_HISTORY_STORAGE_KEY, JSON.stringify(entries));
    localStorage.removeItem(DISPLAY_HISTORY_LEGACY_STORAGE_KEY);
  } catch {
    // localStorage 仅作为启动缓存，主持久化落到 IndexedDB。
  }
}

function clearLocalCache() {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(DISPLAY_HISTORY_STORAGE_KEY);
    localStorage.removeItem(DISPLAY_HISTORY_LEGACY_STORAGE_KEY);
  } catch {
    // 忽略浏览器存储异常
  }
}

function readLocalCache(): DisplayHistoryEntry[] {
  const raw = readStorage(DISPLAY_HISTORY_STORAGE_KEY) ?? readStorage(DISPLAY_HISTORY_LEGACY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeHistoryEntries(parsed);
  } catch {
    return [];
  }
}

function canUseIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
  });
}

function openHistoryDatabase(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null);
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve) => {
      const request = window.indexedDB.open(DISPLAY_HISTORY_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DISPLAY_HISTORY_STORE_NAME)) {
          db.createObjectStore(DISPLAY_HISTORY_STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          databasePromise = null;
        };
        resolve(db);
      };

      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  return databasePromise;
}

async function readIndexedDbHistory(): Promise<DisplayHistoryEntry[] | null> {
  const db = await openHistoryDatabase();
  if (!db) {
    return null;
  }

  try {
    const tx = db.transaction(DISPLAY_HISTORY_STORE_NAME, 'readonly');
    const store = tx.objectStore(DISPLAY_HISTORY_STORE_NAME);
    const record = await requestToPromise(store.get(DISPLAY_HISTORY_RECORD_KEY)) as DisplayHistoryStoreRecord | undefined;
    await transactionToPromise(tx);

    if (!record || !Array.isArray(record.entries)) {
      return [];
    }

    return normalizeHistoryEntries(record.entries);
  } catch {
    return null;
  }
}

async function writeIndexedDbHistory(entries: DisplayHistoryEntry[]) {
  const db = await openHistoryDatabase();
  if (!db) {
    return;
  }

  const tx = db.transaction(DISPLAY_HISTORY_STORE_NAME, 'readwrite');
  const store = tx.objectStore(DISPLAY_HISTORY_STORE_NAME);
  store.put({
    key: DISPLAY_HISTORY_RECORD_KEY,
    entries,
    updatedAt: Date.now(),
  } satisfies DisplayHistoryStoreRecord);
  await transactionToPromise(tx);
}

async function clearIndexedDbHistory() {
  const db = await openHistoryDatabase();
  if (!db) {
    return;
  }

  const tx = db.transaction(DISPLAY_HISTORY_STORE_NAME, 'readwrite');
  tx.objectStore(DISPLAY_HISTORY_STORE_NAME).delete(DISPLAY_HISTORY_RECORD_KEY);
  await transactionToPromise(tx);
}

function enqueueWrite(task: () => Promise<void>) {
  writeQueue = writeQueue
    .then(task)
    .catch((err) => {
      console.error('[History] IndexedDB 写入失败:', err);
    });
}

function resolveSource(existing?: DisplayHistorySource, incoming?: DisplayHistorySource): DisplayHistorySource {
  if (existing === 'push' || incoming === 'push') return 'push';
  if (existing === 'browse' || incoming === 'browse') return 'browse';
  return incoming || existing || 'history';
}

function mergeEntries(existing: DisplayHistoryEntry | undefined, incoming: DisplayHistoryEntry): DisplayHistoryEntry {
  if (!existing) {
    return incoming;
  }

  const pages = incoming.pages.length >= existing.pages.length ? incoming.pages : existing.pages;
  const pageCount = Math.max(incoming.pageCount, existing.pageCount, pages.length);

  return {
    ...existing,
    ...incoming,
    kind: pages.length > 0 ? 'pages' : incoming.kind,
    source: resolveSource(existing.source, incoming.source),
    jobName: incoming.jobName || existing.jobName,
    pdfUrl: incoming.pdfUrl || existing.pdfUrl,
    pdfPath: incoming.pdfPath || existing.pdfPath,
    pdfName: incoming.pdfName || existing.pdfName,
    category: incoming.category || existing.category,
    machine: incoming.machine || existing.machine,
    process: incoming.process || existing.process,
    previewPath: incoming.previewPath || existing.previewPath,
    pages,
    pageCount,
    viewedAt: incoming.viewedAt,
  };
}

function commitHistory(entries: DisplayHistoryEntry[]): DisplayHistoryEntry[] {
  const nextHistory = normalizeHistoryEntries(entries);
  memoryHistoryCache = nextHistory;
  writeLocalCache(nextHistory);
  enqueueWrite(() => writeIndexedDbHistory(nextHistory));
  return nextHistory;
}

export function loadDisplayHistory(): DisplayHistoryEntry[] {
  if (memoryHistoryCache) {
    return memoryHistoryCache;
  }

  const cached = readLocalCache();
  memoryHistoryCache = cached;
  return cached;
}

export async function hydrateDisplayHistory(): Promise<DisplayHistoryEntry[]> {
  const cached = loadDisplayHistory();
  const persisted = await readIndexedDbHistory();

  if (persisted === null) {
    return cached;
  }

  if (latestViewedAt(cached) > latestViewedAt(persisted)) {
    memoryHistoryCache = cached;
    enqueueWrite(() => writeIndexedDbHistory(cached));
    return cached;
  }

  if (persisted.length > 0) {
    memoryHistoryCache = persisted;
    writeLocalCache(persisted);
    return persisted;
  }

  if (cached.length > 0) {
    memoryHistoryCache = cached;
    enqueueWrite(() => writeIndexedDbHistory(cached));
    return cached;
  }

  memoryHistoryCache = [];
  return [];
}

export function clearDisplayHistory(): DisplayHistoryEntry[] {
  memoryHistoryCache = [];
  clearLocalCache();
  enqueueWrite(() => clearIndexedDbHistory());
  return [];
}

export function rememberDisplayHistory(seed: DisplayHistorySeed): DisplayHistoryEntry[] {
  const pages = normalizePages(seed);
  const previewPath = stripOrigin(
    pages[0]?.image_url || pages[0]?.image_path || normalizeText(seed.imageUrl) || normalizeText(seed.imagePath)
  );
  const pdfUrl = stripOrigin(seed.pdfUrl);
  const pdfPath = normalizeText(seed.pdfPath);
  const pdfName = normalizeText(seed.pdfName);
  const jobName = normalizeText(seed.jobName) || pdfName;
  const kind: DisplayHistoryEntry['kind'] = pages.length > 0 ? 'pages' : 'pdf';
  const identity = pdfPath || pdfUrl || `${jobName}|${previewPath}`;

  if (!identity || (!previewPath && !pdfUrl)) {
    return loadDisplayHistory();
  }

  const currentHistory = loadDisplayHistory();
  const existingEntry = currentHistory.find(item => item.id === `${kind}:${identity}`);
  const nextEntry = mergeEntries(existingEntry, {
    id: `${kind}:${identity}`,
    kind,
    source: seed.source || 'browse',
    jobName,
    pdfUrl: pdfUrl || undefined,
    pdfPath: pdfPath || undefined,
    pdfName: pdfName || undefined,
    category: normalizeText(seed.category) || undefined,
    machine: normalizeText(seed.machine) || undefined,
    process: normalizeText(seed.process) || undefined,
    previewPath: previewPath || undefined,
    pages,
    pageCount: pages.length,
    viewedAt: Date.now(),
  });

  return commitHistory([nextEntry, ...currentHistory.filter(item => item.id !== nextEntry.id)]);
}
