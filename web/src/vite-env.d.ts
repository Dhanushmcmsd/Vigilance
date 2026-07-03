/// <reference types="vite/client" />

/**
 * Augment `ImportMeta` with the Vite-specific env shape so accessing
 * `import.meta.env.VITE_*` is fully typed (instead of a generic `any`).
 *
 * Add new VITE_ vars here as they're introduced.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
