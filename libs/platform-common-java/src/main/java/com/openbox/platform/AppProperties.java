package com.openbox.platform;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

// Job: the raw env values the production guard checks. Blank means "not set".
// requiredInProd maps an env variable name to its value; each service lists its own, e.g.
//   app.required-in-prod."[MONGODB_URI]": ${MONGODB_URI:}
@ConfigurationProperties(prefix = "app")
public record AppProperties(String env, String internalApiKey, Map<String, String> requiredInProd) {

  public AppProperties {
    requiredInProd = requiredInProd == null ? Map.of() : requiredInProd;
  }
}
