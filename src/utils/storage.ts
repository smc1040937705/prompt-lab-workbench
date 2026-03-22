export interface DraftEnvelope<T> {
  version: string;
  updatedAt: number;
  expireAt: number;
  value: T;
}

export interface DraftManagerOptions {
  namespace: string;
  version?: string;
  ttlMs?: number;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
}

export interface DraftManager<T> {
  save: (id: string, value: T, ttlMs?: number) => void;
  load: (id: string) => T | null;
  remove: (id: string) => void;
  clearNamespace: () => void;
  listIds: () => string[];
}

const DEFAULT_VERSION = "v1";
const DEFAULT_TTL = 1000 * 60 * 60 * 24;

function buildKey(namespace: string, id: string): string {
  return `${namespace}:${id}`;
}

function safeParse<T>(input: string | null): T | null {
  if (!input) {
    return null;
  }
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export function createDraftManager<T>(options: DraftManagerOptions): DraftManager<T> {
  const namespace = options.namespace;
  const version = options.version ?? DEFAULT_VERSION;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL;
  const storage = options.storage ?? localStorage;

  function save(id: string, value: T, ttl = ttlMs): void {
    const now = Date.now();
    const payload: DraftEnvelope<T> = {
      version,
      updatedAt: now,
      expireAt: now + ttl,
      value
    };
    storage.setItem(buildKey(namespace, id), JSON.stringify(payload));
  }

  function load(id: string): T | null {
    const raw = storage.getItem(buildKey(namespace, id));
    const parsed = safeParse<DraftEnvelope<T>>(raw);
    if (!parsed) {
      return null;
    }
    if (parsed.version !== version) {
      return null;
    }
    if (parsed.expireAt < Date.now()) {
      storage.removeItem(buildKey(namespace, id));
      return null;
    }
    return parsed.value;
  }

  function remove(id: string): void {
    storage.removeItem(buildKey(namespace, id));
  }

  function listIds(): string[] {
    const output: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !key.startsWith(`${namespace}:`)) {
        continue;
      }
      output.push(key.slice(namespace.length + 1));
    }
    return output.sort();
  }

  function clearNamespace(): void {
    listIds().forEach((id) => remove(id));
  }

  return {
    save,
    load,
    remove,
    clearNamespace,
    listIds
  };
}
