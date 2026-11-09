package com.openbox.platform;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.firewall.RequestRejectedException;
import org.springframework.security.web.firewall.RequestRejectedHandler;

// Job: answer Spring Security's refusals as contract JSON, with no WWW-Authenticate header and
// no detail: not authenticated -> 401 UNAUTHENTICATED, not allowed -> 403 FORBIDDEN,
// rejected by the firewall (";", encoded "/", "//") -> 400 VALIDATION_FAILED.
public class ContractErrorHandlers
    implements AuthenticationEntryPoint, AccessDeniedHandler, RequestRejectedHandler {

  /** Writes {"code": "..."} with the code's status. Codes are UPPER_SNAKE, so no escaping. */
  public static void write(HttpServletResponse response, ErrorCode code) throws IOException {
    response.setStatus(code.status().value());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.getWriter().write("{\"code\":\"" + code.name() + "\"}");
  }

  @Override
  public void commence(
      HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
      throws IOException {
    write(response, ErrorCode.UNAUTHENTICATED);
  }

  @Override
  public void handle(
      HttpServletRequest request, HttpServletResponse response, AccessDeniedException e)
      throws IOException {
    write(response, ErrorCode.FORBIDDEN);
  }

  @Override
  public void handle(
      HttpServletRequest request, HttpServletResponse response, RequestRejectedException e)
      throws IOException {
    write(response, ErrorCode.VALIDATION_FAILED);
  }
}
