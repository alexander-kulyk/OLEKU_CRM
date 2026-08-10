import axios from 'axios'
import { toApiError } from './error'

/** Used when `VITE_API_BASE_URL` is not set — see `client/.env.example`. */
const DEFAULT_BASE_URL = 'http://localhost:3000/api'

/**
 * The one axios instance the client uses to reach the API. No Vite proxy
 * exists, so `baseURL` is environment-driven rather than same-origin.
 */
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL,
})

/**
 * Normalises every failure into the client's single internal error shape
 * (see `error.ts`) before it reaches a caller. The server's `message` is
 * never forwarded past this point.
 */
httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
)
