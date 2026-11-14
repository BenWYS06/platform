package com.openbox.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.endpoint.web.WebEndpointsSupplier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// Starts the whole app against real MongoDB and RabbitMQ (same images as
// infra/docker-compose/compose.yml). Health is Actuator, and the only actuator endpoint.
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"app.env=local", "app.internal-api-key=test-internal-key"})
@Testcontainers
class ChatServiceIntegrationTest {

  @Container @ServiceConnection
  static MongoDBContainer mongo = new MongoDBContainer("mongo:8.0.17");

  @Container @ServiceConnection
  static RabbitMQContainer rabbit = new RabbitMQContainer("rabbitmq:4.1.4-management");

  @Autowired TestRestTemplate http;
  @Autowired WebEndpointsSupplier webEndpoints;

  @Test
  void health_is_up_with_real_stores() {
    var response = HealthCalls.get(http);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getHeaders().getContentType()).hasToString("application/json");
    assertThat(response.getBody()).isEqualTo("{\"status\":\"UP\"}");
  }

  @Test
  void the_exposed_web_endpoints_are_exactly_health() {
    List<String> ids =
        webEndpoints.getEndpoints().stream().map(e -> e.getEndpointId().toString()).toList();
    assertThat(ids).containsExactly("health");
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "/api/chat/env",
        "/api/chat/beans",
        "/api/chat/metrics",
        "/api/chat/health/mongo",
        "/api/chat"
      })
  void other_actuator_paths_need_a_token(String path) {
    var response = http.getForEntity(path, String.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(response.getBody()).isEqualTo("{\"code\":\"UNAUTHENTICATED\"}");
  }

  @ParameterizedTest
  @ValueSource(strings = {"/actuator", "/actuator/health", "/actuator/env"})
  void the_default_actuator_paths_do_not_exist(String path) {
    assertThat(http.getForEntity(path, String.class).getStatusCode())
        .isEqualTo(HttpStatus.NOT_FOUND);
  }
}
