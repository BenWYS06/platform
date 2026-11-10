package com.openbox.platform;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

// Job: the place where the user's access token will be verified (issues 1.2 and 1.4).
// Until then it trusts no token: it never sets an authentication, so every closed /api route
// answers 401. Do not make it accept a token without verifying its signature and expiry.
public class JwtStubFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    chain.doFilter(request, response);
  }
}
