/**
 * Shared http client for platform-level services (chat, files, …).
 *
 * Uses {@link resolveBasePath} so a single instance works across every app
 * regardless of which `window.__TMWE_*__` global the host page injected. Apps
 * keep their own `@/services/http` (app-specific basePath) for app services;
 * platform services that were byte-identical across apps now share this one.
 */
import { createHttpClient, resolveBasePath } from '@tmwe/shared-frontend/http';

export const http = createHttpClient({ basePath: resolveBasePath, loginUrl: '/erp/' });
