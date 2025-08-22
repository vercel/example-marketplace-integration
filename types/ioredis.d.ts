declare module 'ioredis' {
  interface Pipeline {
    get(key: string): Pipeline;
    set(key: string, value: string): Pipeline;
    del(key: string): Pipeline;
    lrem(key: string, count: number, value: string): Pipeline;
    lpush(key: string, value: string): Pipeline;
    ltrim(key: string, start: number, stop: number): Pipeline;
    incrby(key: string, increment: number): Pipeline;
    exec(): Promise<Array<[Error | null, any]>>;
  }

  export default class Redis {
    constructor(connectionString: string);
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<'OK'>;
    del(key: string): Promise<number>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    lpush(key: string, value: string): Promise<number>;
    lrem(key: string, count: number, value: string): Promise<number>;
    ltrim(key: string, start: number, stop: number): Promise<'OK'>;
    incrby(key: string, increment: number): Promise<number>;
    pipeline(): Pipeline;
  }
}