package com.openbox.ai.health;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.openbox.platform.PlatformAutoConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HealthController.class)
@ImportAutoConfiguration(PlatformAutoConfiguration.class)
@TestPropertySource(properties = {"app.env=local", "app.internal-api-key=test-internal-key"})
class HealthControllerTest {

  @Autowired MockMvc mvc;
  @MockitoBean HealthService health;

  @Test
  void stores_up_returns_up() throws Exception {
    when(health.allUp()).thenReturn(true);
    mvc.perform(get("/api/ai/health"))
        .andExpect(status().isOk())
        .andExpect(content().json("{\"status\":\"UP\"}", true));
  }

  @Test
  void a_store_down_returns_service_unavailable_without_detail() throws Exception {
    when(health.allUp()).thenReturn(false);
    mvc.perform(get("/api/ai/health"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(content().string("{\"code\":\"SERVICE_UNAVAILABLE\"}"));
  }
}
