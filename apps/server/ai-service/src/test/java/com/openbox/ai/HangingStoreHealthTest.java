package com.openbox.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// A store that accepts the connection and never answers does not hang health: 503 DOWN in
// under 3 s (D-010c). One store hangs at a time; the other is a real container.
class HangingStoreHealthTest {

  private static final Duration LIMIT = Duration.ofSeconds(3);
  private static final HangingStore hanging = new HangingStore();

  @AfterAll
  static void closeHangingStore() throws Exception {
    hanging.close();
  }

  private static void expectDownInTime(TestRestTemplate http, String store) {
    var call = HealthCalls.timed(http);
    System.out.printf("health with %s hanging: %d ms%n", store, call.took().toMillis());
    assertThat(call.response().getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(call.response().getBody()).isEqualTo("{\"status\":\"DOWN\"}");
    assertThat(call.took()).isLessThan(LIMIT);
  }

  @Nested
  @SpringBootTest(
      webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
      properties = {"app.env=local", "app.internal-api-key=test-internal-key"})
  @Testcontainers
  class MongoHangs {

    @Container static RabbitMQContainer rabbit = new RabbitMQContainer("rabbitmq:4.1.4-management");

    @DynamicPropertySource
    static void stores(DynamicPropertyRegistry registry) {
      registry.add(
          "spring.data.mongodb.uri",
          () -> "mongodb://127.0.0.1:" + hanging.port() + "/?directConnection=true");
      registry.add("spring.rabbitmq.host", rabbit::getHost);
      registry.add("spring.rabbitmq.port", rabbit::getAmqpPort);
      registry.add("spring.rabbitmq.username", rabbit::getAdminUsername);
      registry.add("spring.rabbitmq.password", rabbit::getAdminPassword);
    }

    @Autowired TestRestTemplate http;

    @Test
    void health_is_down_within_3_seconds() {
      expectDownInTime(http, "mongodb");
    }
  }

  @Nested
  @SpringBootTest(
      webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
      properties = {"app.env=local", "app.internal-api-key=test-internal-key"})
  @Testcontainers
  class RabbitHangs {

    @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:8.0.17");

    @DynamicPropertySource
    static void stores(DynamicPropertyRegistry registry) {
      registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
      registry.add("spring.rabbitmq.host", () -> "127.0.0.1");
      registry.add("spring.rabbitmq.port", hanging::port);
    }

    @Autowired TestRestTemplate http;

    @Test
    void health_is_down_within_3_seconds() {
      expectDownInTime(http, "rabbitmq");
    }
  }
}
