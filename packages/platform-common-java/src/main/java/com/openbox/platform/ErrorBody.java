package com.openbox.platform;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.ResponseEntity;

// Job: the error response shape { code, message? }.
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorBody(String code, String message) {

  public static ResponseEntity<ErrorBody> of(ErrorCode code) {
    return ResponseEntity.status(code.status()).body(new ErrorBody(code.name(), null));
  }
}
