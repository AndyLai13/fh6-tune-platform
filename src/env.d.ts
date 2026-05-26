/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY: string;
}

declare module 'cloudflare:workers' {
  interface Env {
    DB: D1Database;
    KV: KVNamespace;
    TURNSTILE_SECRET_KEY: string;
    IP_HASH_SALT: string;
    EDIT_COOKIE_SECRET: string;
    PLAUSIBLE_DOMAIN?: string;
  }
  export const env: Env;
}
