package com.openbox.ai.platform;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

// Job: turn every exception from a controller into { code } with the contract status.
// Never returns a stack trace or exception message.
@RestControllerAdvice
public class ApiExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(ApiException.class)
  ResponseEntity<ErrorBody> api(ApiException e) {
    return ErrorBody.of(e.code());
  }

  // An unknown path, or a known path with a method it does not have.
  @ExceptionHandler({NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class})
  ResponseEntity<ErrorBody> notFound(Exception e) {
    return ErrorBody.of(ErrorCode.NOT_FOUND);
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    BindException.class,
    MissingServletRequestParameterException.class,
    MissingRequestHeaderException.class,
    MethodArgumentTypeMismatchException.class,
    HttpMediaTypeNotSupportedException.class
  })
  ResponseEntity<ErrorBody> badInput(Exception e) {
    return ErrorBody.of(ErrorCode.VALIDATION_FAILED);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ErrorBody> unexpected(Exception e) {
    log.error("unexpected error", e);
    return ErrorBody.of(ErrorCode.INTERNAL);
  }
}
