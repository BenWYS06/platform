package com.openbox.ai;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

// Job: call GET /api/ai/health the way clients do (Accept: application/json), and time it.
final class HealthCalls {

  record Timed(ResponseEntity<String> response, Duration took) {}

  private HealthCalls() {}

  static ResponseEntity<String> get(TestRestTemplate http) {
    var headers = new HttpHeaders();
    headers.setAccept(List.of(MediaType.APPLICATION_JSON));
    return http.exchange("/api/ai/health", HttpMethod.GET, new HttpEntity<>(headers), String.class);
  }

  static Timed timed(TestRestTemplate http) {
    long start = System.nanoTime();
    var response = get(http);
    return new Timed(response, Duration.ofNanos(System.nanoTime() - start));
  }
}
