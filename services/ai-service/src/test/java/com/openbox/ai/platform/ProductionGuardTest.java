package com.openbox.ai.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductionGuardTest {

  private static final String GOOD_KEY = "k".repeat(32);
  private static final String URI = "mongodb://db:27017/?replicaSet=rs0";
  private final List<String> warnings = new ArrayList<>();

  private String check(String env, String key) {
    return ProductionGuard.check(new AppProperties(env, key, URI, "rabbit-pass"), warnings::add);
  }

  @Test
  void rejects_unknown_app_env() {
    assertThatThrownBy(() -> check("production", GOOD_KEY))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("APP_ENV");
  }

  @Test
  void rejects_prod_without_internal_key() {
    assertThatThrownBy(() -> check("prod", ""))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("INTERNAL_API_KEY");
  }

  @Test
  void rejects_prod_with_short_key_without_showing_it() {
    assertThatThrownBy(() -> check("prod", "short-secret"))
        .hasMessageContaining("INTERNAL_API_KEY")
        .hasMessageNotContaining("short-secret");
  }

  @Test
  void rejects_prod_with_local_default_key() {
    assertThatThrownBy(() -> check("prod", ProductionGuard.LOCAL_DEFAULT_INTERNAL_KEY))
        .hasMessageContaining("INTERNAL_API_KEY");
  }

  @Test
  void rejects_prod_without_mongodb_uri() {
    var props = new AppProperties("prod", GOOD_KEY, " ", "rabbit-pass");
    assertThatThrownBy(() -> ProductionGuard.check(props, warnings::add))
        .hasMessageContaining("MONGODB_URI");
  }

  @Test
  void rejects_prod_without_rabbitmq_password() {
    var props = new AppProperties("prod", GOOD_KEY, URI, null);
    assertThatThrownBy(() -> ProductionGuard.check(props, warnings::add))
        .hasMessageContaining("RABBITMQ_PASSWORD");
  }

  @Test
  void accepts_prod_with_safe_values() {
    assertThat(check("prod", GOOD_KEY)).isEqualTo(GOOD_KEY);
    assertThat(warnings).isEmpty();
  }

  @Test
  void uses_local_default_key_with_warning_outside_prod() {
    assertThat(check("local", null)).isEqualTo(ProductionGuard.LOCAL_DEFAULT_INTERNAL_KEY);
    assertThat(warnings).singleElement().asString().contains("INTERNAL_API_KEY");
  }

  @Test
  void treats_missing_app_env_as_local() {
    assertThat(check(null, "dev-key")).isEqualTo("dev-key");
  }
}
