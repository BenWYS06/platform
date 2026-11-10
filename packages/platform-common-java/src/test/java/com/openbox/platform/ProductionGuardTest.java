package com.openbox.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ProductionGuardTest {

  private static final String GOOD_KEY = "k".repeat(32);
  private final List<String> warnings = new ArrayList<>();

  private static Map<String, String> required(String mongo, String rabbit) {
    var map = new LinkedHashMap<String, String>();
    map.put("MONGODB_URI", mongo);
    map.put("RABBITMQ_PASSWORD", rabbit);
    return map;
  }

  private String check(String env, String key) {
    var props = new AppProperties(env, key, required("mongodb://db/?replicaSet=rs0", "pass"));
    return ProductionGuard.check(props, warnings::add);
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
  void names_the_missing_required_variable_in_prod() {
    var noMongo = new AppProperties("prod", GOOD_KEY, required(" ", "pass"));
    assertThatThrownBy(() -> ProductionGuard.check(noMongo, warnings::add))
        .hasMessageContaining("MONGODB_URI");
    var noRabbit = new AppProperties("prod", GOOD_KEY, required("mongodb://db", null));
    assertThatThrownBy(() -> ProductionGuard.check(noRabbit, warnings::add))
        .hasMessageContaining("RABBITMQ_PASSWORD")
        .hasMessageNotContaining("mongodb://db");
  }

  @Test
  void required_variables_are_not_checked_outside_prod() {
    var props = new AppProperties("local", "dev-key", required("", ""));
    assertThat(ProductionGuard.check(props, warnings::add)).isEqualTo("dev-key");
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
  void treats_missing_app_env_and_required_map_as_local_and_empty() {
    assertThat(ProductionGuard.check(new AppProperties(null, "dev-key", null), warnings::add))
        .isEqualTo("dev-key");
  }
}
