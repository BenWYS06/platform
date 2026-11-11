package com.openbox.chat.health;

import java.util.concurrent.TimeUnit;
import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Job: bound how long the MongoDB driver waits for a server, so a down or hanging store
// fails fast (RabbitMQ: spring.rabbitmq.connection-timeout). Driver defaults are 10 to 30 s.
@Configuration
class StoreTimeoutConfig {

  static final int TIMEOUT_MS = 2000;

  @Bean
  MongoClientSettingsBuilderCustomizer mongoTimeouts() {
    return builder ->
        builder
            .applyToClusterSettings(
                c -> c.serverSelectionTimeout(TIMEOUT_MS, TimeUnit.MILLISECONDS))
            .applyToSocketSettings(s -> s.connectTimeout(TIMEOUT_MS, TimeUnit.MILLISECONDS));
  }
}
