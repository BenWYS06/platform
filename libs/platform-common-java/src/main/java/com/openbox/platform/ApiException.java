package com.openbox.platform;

// Job: the one exception type code throws to answer with a contract error.
public class ApiException extends RuntimeException {

  private final ErrorCode code;

  public ApiException(ErrorCode code) {
    super(code.name());
    this.code = code;
  }

  public ErrorCode code() {
    return code;
  }
}
