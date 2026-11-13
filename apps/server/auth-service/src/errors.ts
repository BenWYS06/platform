// Job: the contract error codes this service returns, with their fixed HTTP status.
// Must match contracts/error-codes.json (checked by test/contract.test.ts).
export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  INVITATION_INVALID: 404,
  INVITATION_ALREADY_ACCEPTED: 409,
  MEMBER_ALREADY_EXISTS: 409,
  INVITATION_EXPIRED: 410,
  INVITATION_REVOKED: 410,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

// Values a client may show; contracts/schemas/error-body.schema.json allows no nesting.
export type ErrorParams = Record<string, string | number | string[]>;

// The one error type code throws to answer with a contract error.
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params?: ErrorParams,
  ) {
    super(code);
  }
}
