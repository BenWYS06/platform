// Job: the contract error codes this service returns, with their fixed HTTP status.
// Must match contracts/error-codes.json (checked by test/contract.test.ts).
export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

// The one error type code throws to answer with a contract error.
export class ApiError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}
