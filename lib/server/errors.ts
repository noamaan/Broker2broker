import "server-only";

export class BackendError extends Error {
  constructor(message: string, public status = 502, public code = "BACKEND_ERROR") {
    super(message);
    this.name = "BackendError";
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  VALIDATION_ERROR: 400,
  INVALID_TOKEN: 400,
  INVALID_CREDENTIALS: 401,
  INVALID_PASSWORD: 401,
  INVALID_SIGNATURE: 401,
  REPLAYED_REQUEST: 409,
  UNAUTHENTICATED: 401,
  SESSION_INVALID: 401,
  FORBIDDEN: 403,
  MEMBERSHIP_REQUIRED: 403,
  CSRF_BLOCKED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT_NOT_CONFIGURED: 503,
  BACKEND_NOT_CONFIGURED: 503,
  BACKEND_CONFIGURATION_ERROR: 503,
  SESSION_NOT_CONFIGURED: 503,
  EMAIL_NOT_CONFIGURED: 503,
  BACKEND_TIMEOUT: 504
};

export function backendError(code: string, message: string) {
  return new BackendError(message, STATUS_BY_CODE[code] ?? 502, code);
}
