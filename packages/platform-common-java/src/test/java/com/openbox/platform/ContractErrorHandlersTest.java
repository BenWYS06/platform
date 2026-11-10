package com.openbox.platform;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.web.firewall.RequestRejectedException;

class ContractErrorHandlersTest {

  private final ContractErrorHandlers handlers = new ContractErrorHandlers();
  private final MockHttpServletRequest request = new MockHttpServletRequest();
  private final MockHttpServletResponse response = new MockHttpServletResponse();

  @Test
  void not_authenticated_is_401_unauthenticated_without_www_authenticate() throws Exception {
    handlers.commence(request, response, new InsufficientAuthenticationException("detail"));
    assertThat(response.getStatus()).isEqualTo(401);
    assertThat(response.getContentAsString()).isEqualTo("{\"code\":\"UNAUTHENTICATED\"}");
    assertThat(response.getHeader("WWW-Authenticate")).isNull();
  }

  @Test
  void access_denied_is_403_forbidden_without_detail() throws Exception {
    handlers.handle(request, response, new AccessDeniedException("secret detail"));
    assertThat(response.getStatus()).isEqualTo(403);
    assertThat(response.getContentAsString()).isEqualTo("{\"code\":\"FORBIDDEN\"}");
    assertThat(response.getContentType()).startsWith("application/json");
  }

  @Test
  void firewall_rejection_is_400_validation_failed() throws Exception {
    handlers.handle(request, response, new RequestRejectedException("bad path"));
    assertThat(response.getStatus()).isEqualTo(400);
    assertThat(response.getContentAsString()).isEqualTo("{\"code\":\"VALIDATION_FAILED\"}");
  }
}
