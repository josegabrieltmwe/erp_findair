import type { ApiResponse, Paginated, PaginatedRaw } from './api.types';
import { ApiError } from './api.types';

/**
 * unwrap: collapses the inconsistent backend response shapes into a clean payload.
 *
 * Handles:
 *   - { success: true, data: T }              → returns data
 *   - { success: true, ...rest }              → returns rest (no data wrapper)
 *   - { success: false, error/message }       → throws ApiError
 *   - direct payload (no wrapper)             → returns as-is
 */
export function unwrap<T>(raw: unknown): T {
  if (raw === null || typeof raw !== 'object') {
    return raw as T;
  }
  const r = raw as ApiResponse<T> & Record<string, unknown>;
  if (r.success === false) {
    throw new ApiError(
      (r.error as string) || (r.message as string) || 'Request failed',
      0,
      r.error_code as string | undefined,
      r.details,
    );
  }
  if (r.success === true) {
    if ('data' in r && r.data !== undefined) {
      return r.data as T;
    }
    // Strip success/message keys; return the rest as the payload.
    const { success: _s, message: _m, ...rest } = r;
    return rest as T;
  }
  return raw as T;
}

/**
 * paginated: extracts a typed page of items from a list response.
 *
 * Handles three backend dialects:
 *   - { success: true, data: T[], total, page, ... }
 *   - { users: T[], total, page, per_page, pages }   (no wrapper)
 *   - { items: T[], total, page, perPage, pages }    (already-clean)
 */
export function paginated<T>(raw: unknown, listKey = 'data'): Paginated<T> {
  if (raw === null || typeof raw !== 'object') {
    return emptyPage<T>();
  }
  const r = raw as PaginatedRaw<T> & ApiResponse<T[]> & Record<string, unknown>;

  if (r.success === false) {
    throw new ApiError(
      (r.error as string) || (r.message as string) || 'Request failed',
      0,
      r.error_code as string | undefined,
      r.details,
    );
  }

  // Try direct items key first, then list key, then fall back to common ones.
  const items = pickArray<T>(r, ['items', listKey, 'data', 'rows', 'list']);

  // Some endpoints (Abstract_Crud_Controller::paginated_response) put totals
  // in a nested `pagination` object instead of at the root. Merge it so that
  // pickNumber sees the keys at the top level.
  const pag = (r.pagination && typeof r.pagination === 'object')
    ? (r.pagination as Record<string, unknown>)
    : {};
  const flat: Record<string, unknown> = { ...pag, ...r };
  // ^ root overrides pagination if both present, preserving existing behaviour.
  // But if root lacks the keys, pickNumber falls back to pagination's values.
  const lookup: Record<string, unknown> = { ...r, ...pag };

  const total = pickNumber(lookup, ['total', 'count', 'total_count'], items.length);
  const page = pickNumber(lookup, ['page', 'current_page'], 1);
  const perPage = pickNumber(lookup, ['perPage', 'per_page', 'page_size'], items.length || 20);
  const pages = pickNumber(lookup, ['pages', 'total_pages', 'last_page'], Math.max(1, Math.ceil(total / perPage)));

  void flat; // reserved for future server-side dialects
  return { items, total, page, perPage, pages };
}

function pickArray<T>(obj: Record<string, unknown>, keys: string[]): T[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

function pickNumber(obj: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && !Number.isNaN(Number(v))) return Number(v);
  }
  return fallback;
}

function emptyPage<T>(): Paginated<T> {
  return { items: [], total: 0, page: 1, perPage: 20, pages: 0 };
}
