package com.openbox.ai.health;

import com.openbox.platform.ApiException;
import com.openbox.platform.ErrorCode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// Job: GET /api/ai/health, public. 200 { "status": "UP" } when every store answers,
// otherwise 503 { "code": "SERVICE_UNAVAILABLE" } with no detail.
@RestController
public class HealthController {

  record HealthResponse(String status) {}

  private final HealthService health;

  public HealthController(HealthService health) {
    this.health = health;
  }

  @GetMapping("/api/ai/health")
  HealthResponse health() {
    if (!health.allUp()) {
      throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE);
    }
    return new HealthResponse("UP");
  }
}
