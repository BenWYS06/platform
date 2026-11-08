package com.openbox.ai.health;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

// Job: ping every store in parallel and say whether all answered within the timeout.
// A store that hangs cannot hold the answer past the timeout.
@Service
public class HealthService {

  static final Duration DEFAULT_TIMEOUT = Duration.ofMillis(2500);
  private static final Logger log = LoggerFactory.getLogger(HealthService.class);
  // Daemon threads: a hung store call keeps its thread until the driver timeout, but never
  // holds the caller or blocks shutdown.
  private static final ExecutorService POOL =
      Executors.newCachedThreadPool(Thread.ofPlatform().daemon().name("health-", 0).factory());

  private final List<StoreCheck> checks;
  private final Duration timeout;

  @Autowired
  public HealthService(List<StoreCheck> checks) {
    this(checks, DEFAULT_TIMEOUT);
  }

  HealthService(List<StoreCheck> checks, Duration timeout) {
    this.checks = List.copyOf(checks);
    this.timeout = timeout;
  }

  public boolean allUp() {
    List<CompletableFuture<Boolean>> results =
        checks.stream().map(c -> CompletableFuture.supplyAsync(() -> run(c), POOL)).toList();
    try {
      CompletableFuture.allOf(results.toArray(CompletableFuture[]::new))
          .get(timeout.toMillis(), TimeUnit.MILLISECONDS);
      return results.stream().allMatch(CompletableFuture::join);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    } catch (Exception timeoutOrFailure) {
      for (int i = 0; i < checks.size(); i++) {
        if (!results.get(i).isDone()) {
          log.atWarn()
              .addKeyValue("store", checks.get(i).name())
              .addKeyValue("timeoutMs", timeout.toMillis())
              .log("store check timed out");
        }
      }
      return false;
    }
  }

  private static boolean run(StoreCheck check) {
    try {
      check.check();
      return true;
    } catch (Exception e) {
      // Store name and error type only: driver messages can carry hosts or URIs.
      log.atWarn()
          .addKeyValue("store", check.name())
          .addKeyValue("error", e.getClass().getSimpleName())
          .log("store check failed");
      return false;
    }
  }
}
