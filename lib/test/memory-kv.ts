// In-memory stand-in for the Upstash Redis client, covering the commands
// lib/ uses. Values round-trip through JSON like they do in Redis, so
// `undefined` fields are dropped on write.
export function createMemoryKv() {
  const store = new Map<string, unknown>();

  const clone = <T>(value: T): T =>
    value === undefined ? value : JSON.parse(JSON.stringify(value));

  function listAt(key: string): unknown[] {
    const existing = store.get(key);
    if (Array.isArray(existing)) return existing;
    const created: unknown[] = [];
    store.set(key, created);
    return created;
  }

  const kv = {
    get: async <T>(key: string): Promise<T | null> =>
      (clone(store.get(key)) as T | undefined) ?? null,
    set: async (key: string, value: unknown, _opts?: { ex?: number }) => {
      store.set(key, clone(value));
      return "OK" as const;
    },
    del: async (key: string) => (store.delete(key) ? 1 : 0),
    incrby: async (key: string, amount: number) => {
      const next = Number(store.get(key) ?? 0) + amount;
      store.set(key, next);
      return next;
    },
    llen: async (key: string) => listAt(key).length,
    lrange: async <T>(key: string, start: number, end: number): Promise<T[]> =>
      clone(listAt(key).slice(start, end === -1 ? undefined : end + 1)) as T[],
    lpush: async (key: string, value: unknown) => {
      listAt(key).unshift(clone(value));
      return listAt(key).length;
    },
    lrem: async (key: string, _count: number, value: unknown) => {
      const before = listAt(key);
      const after = before.filter((entry) => entry !== value);
      store.set(key, after);
      return before.length - after.length;
    },
    ltrim: async () => "OK" as const,
    pipeline: () => {
      const operations: (() => Promise<unknown>)[] = [];
      const pipeline = {
        get: (key: string) => {
          operations.push(() => kv.get(key));
          return pipeline;
        },
        set: (key: string, value: unknown) => {
          operations.push(() => kv.set(key, value));
          return pipeline;
        },
        del: (key: string) => {
          operations.push(() => kv.del(key));
          return pipeline;
        },
        lpush: (key: string, value: unknown) => {
          operations.push(() => kv.lpush(key, value));
          return pipeline;
        },
        lrem: (key: string, count: number, value: unknown) => {
          operations.push(() => kv.lrem(key, count, value));
          return pipeline;
        },
        ltrim: () => {
          operations.push(() => kv.ltrim());
          return pipeline;
        },
        exec: async <T = unknown[]>(): Promise<T> => {
          if (operations.length === 0) throw new Error("Pipeline is empty");
          const results: unknown[] = [];
          for (const operation of operations) {
            results.push(await operation());
          }
          return results as T;
        },
      };
      return pipeline;
    },
  };

  return { kv, store };
}
