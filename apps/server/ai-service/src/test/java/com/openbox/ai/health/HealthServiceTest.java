package com.openbox.ai.health;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class HealthServiceTest {

  private final CountDownLatch neverReleased = new CountDownLatch(1);

  @AfterEach
  void release() {
    neverReleased.countDown();
  }

  private static StoreCheck up(String name) {
    return check(name, () -> {});
  }

  private static StoreCheck check(String name, ThrowingRunnable body) {
    return new StoreCheck() {
      public String name() {
        return name;
      }

      public void check() throws Exception {
        body.run();
      }
    };
  }

  interface ThrowingRunnable {
    void run() throws Exception;
  }

  @Test
  void all_stores_up_is_up() {
    var service = new HealthService(List.of(up("mongodb"), up("rabbitmq")), Duration.ofSeconds(1));
    assertThat(service.allUp()).isTrue();
  }

  @Test
  void a_failing_store_is_down() {
    var down =
        check(
            "mongodb",
            () -> {
              throw new IllegalStateException("refused");
            });
    var service = new HealthService(List.of(down, up("rabbitmq")), Duration.ofSeconds(1));
    assertThat(service.allUp()).isFalse();
  }

  @Test
  void a_hanging_store_is_down_within_the_timeout() {
    var hangs = check("rabbitmq", neverReleased::await);
    var service = new HealthService(List.of(up("mongodb"), hangs), Duration.ofMillis(200));

    long start = System.nanoTime();
    assertThat(service.allUp()).isFalse();
    assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(2));
  }
}
