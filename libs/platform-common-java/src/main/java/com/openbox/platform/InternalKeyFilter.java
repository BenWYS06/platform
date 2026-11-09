package com.openbox.platform;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

// Job: let a request reach /internal/** only with exactly one X-Internal-Key header equal to
// INTERNAL_API_KEY, compared in constant time; it then runs as the calling service with role
// INTERNAL. Otherwise 401 { "code": "UNAUTHENTICATED" }. Runs inside the security chain only.
public class InternalKeyFilter extends OncePerRequestFilter {

  public static final String HEADER = "X-Internal-Key";
  public static final String ROLE = "INTERNAL";
  private final byte[] expectedHash;

  public InternalKeyFilter(InternalKey key) {
    this.expectedHash = sha256(key.value());
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI().substring(request.getContextPath().length());
    return !(path.equals("/internal") || path.startsWith("/internal/"));
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    List<String> sent = Collections.list(request.getHeaders(HEADER));
    // Hashing both sides gives equal lengths, so isEqual's time does not depend on the key.
    if (sent.size() == 1 && MessageDigest.isEqual(sha256(sent.get(0)), expectedHash)) {
      var context = SecurityContextHolder.getContextHolderStrategy().createEmptyContext();
      context.setAuthentication(
          UsernamePasswordAuthenticationToken.authenticated(
              "internal-service", null, AuthorityUtils.createAuthorityList("ROLE_" + ROLE)));
      SecurityContextHolder.getContextHolderStrategy().setContext(context);
      chain.doFilter(request, response);
      return;
    }
    ContractErrorHandlers.write(response, ErrorCode.UNAUTHENTICATED);
  }

  private static byte[] sha256(String value) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 not available", e);
    }
  }
}
