package com.openbox.platform;

import org.springframework.http.HttpStatus;

// Job: the contract error codes this service returns, with their fixed HTTP status.
// Must match contracts/error-codes.json (checked by ErrorCodeContractTest).
public enum ErrorCode {
  VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
  UNAUTHENTICATED(HttpStatus.UNAUTHORIZED),
  NOT_FOUND(HttpStatus.NOT_FOUND),
  INTERNAL(HttpStatus.INTERNAL_SERVER_ERROR),
  SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE);

  private final HttpStatus status;

  ErrorCode(HttpStatus status) {
    this.status = status;
  }

  public HttpStatus status() {
    return status;
  }
}
