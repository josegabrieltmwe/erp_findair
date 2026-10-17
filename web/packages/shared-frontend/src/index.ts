/**
 * @tmwe/shared-frontend — barrel index.
 *
 * Apps should prefer named subpath imports (`@tmwe/shared-frontend/http`)
 * for tree-shaking. This file re-exports the most common surface.
 */
export {
  createHttpClient,
  installFetchInterceptor,
  onHttpEvent,
  isAbortLikeError,
  isPageUnloading,
  toUserMessage,
} from './http';
export type { HttpClientOptions, HttpEvent, HttpListener } from './http';
export { ApiError } from './http/ApiError';
export { resolveBasePath, DEFAULT_BASE_PATH } from './http/base_path';
