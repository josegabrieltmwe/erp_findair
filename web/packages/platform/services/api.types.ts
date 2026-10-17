/**
 * Standard error wrapper used across services.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** Common envelope of AJAX endpoints (ajax_*). */
export interface AjaxEnvelope<T = unknown> {
  success: boolean;
  error?: string;
  /** Concrete payload fields are flattened on top of the envelope. */
  [key: string]: T | unknown;
}

/** Common envelope of API endpoints (api_*). */
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}
