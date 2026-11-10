package com.openbox.platform;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

// The library's auto-configuration in a running app: errors, internal key, request id.
@SpringBootTest(
    classes = TestApp.class,
    properties = {"app.env=local", "app.internal-api-key=test-internal-key"})
@AutoConfigureMockMvc
class PlatformWebTest {

  @Autowired MockMvc mvc;

  @Test
  void unknown_route_returns_not_found_code() throws Exception {
    mvc.perform(get("/nope"))
        .andExpect(status().isNotFound())
        .andExpect(content().json("{\"code\":\"NOT_FOUND\"}", true));
  }

  @Test
  void wrong_method_returns_not_found_code() throws Exception {
    mvc.perform(post("/test/fail"))
        .andExpect(status().isNotFound())
        .andExpect(content().json("{\"code\":\"NOT_FOUND\"}", true));
  }

  @Test
  void unexpected_error_returns_internal_without_detail() throws Exception {
    mvc.perform(get("/test/fail"))
        .andExpect(status().isInternalServerError())
        .andExpect(content().string("{\"code\":\"INTERNAL\"}"));
  }

  @Test
  void internal_ping_without_key_is_unauthenticated() throws Exception {
    mvc.perform(get("/internal/ping"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().string("{\"code\":\"UNAUTHENTICATED\"}"));
  }

  @Test
  void internal_ping_with_wrong_or_wrong_length_key_is_unauthenticated() throws Exception {
    for (String key : new String[] {"test-internal-kez", "x", ""}) {
      mvc.perform(get("/internal/ping").header("X-Internal-Key", key))
          .andExpect(status().isUnauthorized());
    }
  }

  @Test
  void internal_ping_with_key_sent_twice_is_unauthenticated() throws Exception {
    mvc.perform(
            get("/internal/ping")
                .header("X-Internal-Key", "test-internal-key")
                .header("X-Internal-Key", "test-internal-key"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void internal_ping_with_right_key_is_ok() throws Exception {
    mvc.perform(get("/internal/ping").header("X-Internal-Key", "test-internal-key"))
        .andExpect(status().isOk())
        .andExpect(content().json("{\"status\":\"OK\"}", true));
  }

  @Test
  void keeps_a_safe_request_id_and_replaces_an_unsafe_one() throws Exception {
    mvc.perform(get("/nope").header("X-Request-Id", "abc-123"))
        .andExpect(header().string("X-Request-Id", "abc-123"));
    mvc.perform(get("/nope").header("X-Request-Id", "bad id\r\nx"))
        .andExpect(header().string("X-Request-Id", matchesPattern("[0-9a-f-]{36}")));
  }
}
