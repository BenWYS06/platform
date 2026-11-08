package com.openbox.chat.platform;

import java.util.Set;
import java.util.function.Consumer;

// Job: refuse unsafe config at startup and return the internal key to use.
// Messages name the variable, never its value. Moves to platform-common-java in issue 0.5.
public final class ProductionGuard {

  public static final String LOCAL_DEFAULT_INTERNAL_KEY = "local-dev-internal-key-not-for-prod";
  static final int MIN_PROD_KEY_LENGTH = 32;
  private static final Set<String> ENVS = Set.of("local", "dev", "prod");

  private ProductionGuard() {}

  /** Returns the internal key to use; throws IllegalStateException when config is unsafe. */
  public static String check(AppProperties props, Consumer<String> warn) {
    String env = isBlank(props.env()) ? "local" : props.env();
    if (!ENVS.contains(env)) {
      throw new IllegalStateException("APP_ENV must be local, dev or prod");
    }
    String key = props.internalApiKey();
    if (!"prod".equals(env)) {
      if (isBlank(key)) {
        warn.accept("INTERNAL_API_KEY is not set; using the local default (not allowed in prod)");
        return LOCAL_DEFAULT_INTERNAL_KEY;
      }
      return key;
    }
    if (isBlank(key)
        || key.length() < MIN_PROD_KEY_LENGTH
        || LOCAL_DEFAULT_INTERNAL_KEY.equals(key)) {
      throw new IllegalStateException(
          "INTERNAL_API_KEY is missing, shorter than 32 characters or the local default"
              + " (APP_ENV=prod)");
    }
    if (isBlank(props.mongodbUri())) {
      throw new IllegalStateException("MONGODB_URI is missing (APP_ENV=prod)");
    }
    if (isBlank(props.rabbitmqPassword())) {
      throw new IllegalStateException("RABBITMQ_PASSWORD is missing (APP_ENV=prod)");
    }
    return key;
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
