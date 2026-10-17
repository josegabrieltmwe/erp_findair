/**
 * Domain-specific error thrown by the shared http client.
 * Carries status, optional error_code and raw payload so callers can
 * branch on programmatic codes without inspecting the response twice.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly errorCode?: string;
  public readonly payload?: unknown;

  constructor(message: string, status: number, errorCode?: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.payload = payload;
  }
}
