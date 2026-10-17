// Common shapes returned by the TMWE backend admin APIs.
// Backend is inconsistent across controllers — these types describe the
// shapes we tolerate and absorb in normalizers.ts.

export interface ApiSuccess<T> {
  success: true;
  data?: T;
  message?: string;
  [key: string]: unknown;
}

export interface ApiFailure {
  success: false;
  error?: string;
  message?: string;
  error_code?: string;
  details?: { fields?: Record<string, string> } | unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginatedRaw<T> {
  total?: number;
  page?: number;
  per_page?: number;
  pages?: number;
  // The list field is named differently per endpoint (users, data, items, …).
  [listKey: string]: unknown | T[] | number | undefined;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, status = 0, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
