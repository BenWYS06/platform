package com.openbox.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import com.github.dockerjava.api.model.ExposedPort;
import com.github.dockerjava.api.model.PortBinding;
import com.github.dockerjava.api.model.Ports;
import java.io.IOException;
import java.net.ServerSocket;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// MongoDB stops while the service runs: health answers 503 DOWN, and 200 UP again once
// MongoDB is back, without a restart (D-010c). MongoDB gets a fixed host port so the same
// address answers after the container starts again.
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"app.env=local", "app.internal-api-key=test-internal-key"})
@Testcontainers
class HealthRecoveryIntegrationTest {

  private static final int MONGO_PORT = freePort();

  @Container @ServiceConnection
  static MongoDBContainer mongo =
      new MongoDBContainer("mongo:8.0.17")
          .withCreateContainerCmdModifier(
              cmd ->
                  cmd.getHostConfig()
                      .withPortBindings(
                          new PortBinding(
                              Ports.Binding.bindPort(MONGO_PORT), new ExposedPort(27017))));

  @Container @ServiceConnection
  static RabbitMQContainer rabbit = new RabbitMQContainer("rabbitmq:4.1.4-management");

  @Autowired TestRestTemplate http;

  @Test
  void health_is_down_while_mongodb_is_stopped_and_up_again_after() {
    assertThat(HealthCalls.get(http).getStatusCode()).isEqualTo(HttpStatus.OK);

    var docker = mongo.getDockerClient();
    docker.stopContainerCmd(mongo.getContainerId()).exec();
    var down = HealthCalls.get(http);
    assertThat(down.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(down.getHeaders().getContentType()).hasToString("application/json");
    assertThat(down.getBody()).isEqualTo("{\"status\":\"DOWN\"}");

    docker.startContainerCmd(mongo.getContainerId()).exec();
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              var up = HealthCalls.get(http);
              assertThat(up.getStatusCode()).isEqualTo(HttpStatus.OK);
              assertThat(up.getBody()).isEqualTo("{\"status\":\"UP\"}");
            });
  }

  private static int freePort() {
    try (var socket = new ServerSocket(0)) {
      return socket.getLocalPort();
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }
}
