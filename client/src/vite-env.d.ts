/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for the axios instance in `shared/api`. Defaults to
   * `http://localhost:3000/api` when unset — see `client/.env.example`.
   */
  readonly VITE_API_BASE_URL?: string
}
