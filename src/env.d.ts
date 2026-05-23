/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

interface ImportMetaEnv {
  readonly TURNSTILE_SECRET_KEY: string;
  readonly IP_HASH_SALT: string;
  readonly EDIT_COOKIE_SECRET: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
        KV: KVNamespace;
        TURNSTILE_SECRET_KEY: string;
        IP_HASH_SALT: string;
        EDIT_COOKIE_SECRET: string;
      };
    };
  }
}
