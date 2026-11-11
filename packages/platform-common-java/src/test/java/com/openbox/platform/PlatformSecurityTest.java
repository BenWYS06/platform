package com.openbox.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

// The security chain from the library: health public, /internal behind the key, every other
// /api route closed (the JWT stub accepts nothing), refusals as contract JSON.
@SpringBootTest(
    classes = TestApp.class,
    properties = {"app.env=local", "app.internal-api-key=test-internal-key"})
@AutoConfigureMockMvc
class PlatformSecurityTest {

  private static final String UNAUTHENTICATED = "{\"code\":\"UNAUTHENTICATED\"}";

  @Autowired MockMvc mvc;
  @Autowired ApplicationContext context;

  @Test
  void health_is_public_and_ignores_a_garbage_authorization_header() throws Exception {
    mvc.perform(get("/api/test/health").header("Authorization", "Bearer garbage"))
        .andExpect(status().isOk())
        .andExpect(content().json("{\"status\":\"UP\"}", true))
        .andExpect(header().doesNotExist("Set-Cookie"));
  }

  @Test
  void closed_api_route_without_token_is_unauthenticated() throws Exception {
    mvc.perform(get("/api/test/hello"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().string(UNAUTHENTICATED))
        .andExpect(header().doesNotExist("WWW-Authenticate"))
        .andExpect(header().doesNotExist("Set-Cookie"));
  }

  @Test
  void closed_api_route_with_any_bearer_token_is_unauthenticated() throws Exception {
    mvc.perform(get("/api/test/hello").header("Authorization", "Bearer eyJhbGciOiJub25lIn0.e30."))
        .andExpect(status().isUnauthorized())
        .andExpect(content().string(UNAUTHENTICATED))
        .andExpect(header().doesNotExist("WWW-Authenticate"));
  }

  @Test
  void basic_credentials_do_not_open_a_closed_route() throws Exception {
    mvc.perform(get("/api/test/hello").header("Authorization", "Basic dXNlcjpwYXNz"))
        .andExpect(status().isUnauthorized())
        .andExpect(header().doesNotExist("WWW-Authenticate"));
  }

  @Test
  void unknown_api_route_is_unauthenticated_not_not_found() throws Exception {
    mvc.perform(get("/api/test/nope")).andExpect(status().isUnauthorized());
  }

  @Test
  void only_get_health_is_public() throws Exception {
    mvc.perform(post("/api/test/health")).andExpect(status().isUnauthorized());
  }

  @Test
  void post_to_internal_with_the_key_is_not_blocked_by_csrf() throws Exception {
    // CSRF is off: a wrong method reaches MVC (404) instead of a CSRF 403.
    mvc.perform(post("/internal/ping").header("X-Internal-Key", "test-internal-key"))
        .andExpect(status().isNotFound());
  }

  @Test
  void path_with_semicolon_is_rejected_as_validation_failed_json() throws Exception {
    mvc.perform(get("/api/test/health;jsessionid=abc"))
        .andExpect(status().isBadRequest())
        .andExpect(content().string("{\"code\":\"VALIDATION_FAILED\"}"));
  }

  @Test
  void no_default_user_with_a_generated_password_exists() {
    // Spring Boot's default InMemoryUserDetailsManager is what logs a generated password.
    assertThat(context.getBeansOfType(UserDetailsService.class)).isEmpty();
  }
}
