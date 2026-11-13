package com.openbox.chat.health;

import java.util.concurrent.TimeUnit;
import org.springframework.boot.autoconfigure.amqp.ConnectionFactoryCustomizer;
import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Job: bound how long the store drivers wait, so the Actuator health check of a down or
// hanging store fails in about 2 s (D-010c). Driver defaults are 10 to 30 s.
// RabbitMQ TCP connect: spring.rabbitmq.connection-timeout; the AMQP handshake is set here.
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

  @Bean
  ConnectionFactoryCustomizer rabbitHandshakeTimeout() {
    return factory -> factory.setHandshakeTimeout(TIMEOUT_MS);
  }
}
