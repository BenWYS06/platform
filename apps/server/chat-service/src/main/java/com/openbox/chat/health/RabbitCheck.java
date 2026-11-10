package com.openbox.chat.health;

import org.springframework.amqp.rabbit.connection.Connection;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.stereotype.Component;

// Job: check that a RabbitMQ connection can be opened.
@Component
class RabbitCheck implements StoreCheck {

  private final ConnectionFactory connections;

  RabbitCheck(ConnectionFactory connections) {
    this.connections = connections;
  }

  @Override
  public String name() {
    return "rabbitmq";
  }

  @Override
  public void check() {
    try (Connection connection = connections.createConnection()) {
      if (!connection.isOpen()) {
        throw new IllegalStateException("connection closed");
      }
    }
  }
}
