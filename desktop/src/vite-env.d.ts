/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RDOS_DUMP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
