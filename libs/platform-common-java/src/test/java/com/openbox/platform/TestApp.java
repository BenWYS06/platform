package com.openbox.platform;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// A minimal service that uses the library through its auto-configuration, as a real one does.
@SpringBootApplication
class TestApp {

  @RestController
  static class TestRoutes {

    record Status(String status) {}

    @GetMapping("/internal/ping")
    Status ping() {
      return new Status("OK");
    }

    @GetMapping("/api/test/health")
    Status health() {
      return new Status("UP");
    }

    @GetMapping("/api/test/hello")
    Status hello() {
      return new Status("HELLO");
    }

    @GetMapping("/test/fail")
    String fail() {
      throw new IllegalStateException("secret detail mongodb://user:pass@db");
    }
  }
}
