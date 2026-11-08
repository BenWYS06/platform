package com.openbox.ai.platform;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Job: answer errors raised outside controllers (filters, the container) as { code },
// replacing Spring's default error JSON.
@RestController
public class ErrorFallbackController implements ErrorController {

  @RequestMapping("${server.error.path:/error}")
  ResponseEntity<ErrorBody> error(HttpServletRequest request) {
    Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
    int code = status instanceof Integer i ? i : 500;
    return ErrorBody.of(
        switch (code) {
          case 400 -> ErrorCode.VALIDATION_FAILED;
          case 401 -> ErrorCode.UNAUTHENTICATED;
          case 404, 405 -> ErrorCode.NOT_FOUND;
          case 503 -> ErrorCode.SERVICE_UNAVAILABLE;
          default -> ErrorCode.INTERNAL;
        });
  }
}
