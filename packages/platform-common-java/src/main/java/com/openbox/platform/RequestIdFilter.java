package com.openbox.platform;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

// Job: give every request an id (a safe client X-Request-Id or a new UUID), put it in the
// log context and the response, and log one line per request (no headers, no query, no body).
// Registered first in the servlet filter chain by PlatformAutoConfiguration.
public class RequestIdFilter extends OncePerRequestFilter {

  public static final String HEADER = "X-Request-Id";
  public static final String MDC_KEY = "requestId";
  private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._-]{1,64}");
  private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String sent = request.getHeader(HEADER);
    String id =
        sent != null && SAFE_ID.matcher(sent).matches() ? sent : UUID.randomUUID().toString();
    long start = System.nanoTime();
    MDC.put(MDC_KEY, id);
    response.setHeader(HEADER, id);
    try {
      chain.doFilter(request, response);
    } finally {
      log.atInfo()
          .addKeyValue("method", request.getMethod())
          .addKeyValue("path", request.getRequestURI())
          .addKeyValue("status", response.getStatus())
          .addKeyValue("durationMs", (System.nanoTime() - start) / 1_000_000)
          .log("request");
      MDC.remove(MDC_KEY);
    }
  }
}
