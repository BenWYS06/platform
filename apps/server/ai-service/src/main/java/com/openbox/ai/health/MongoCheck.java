package com.openbox.ai.health;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

// Job: ping MongoDB.
@Component
class MongoCheck implements StoreCheck {

  private final MongoTemplate mongo;

  MongoCheck(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  @Override
  public String name() {
    return "mongodb";
  }

  @Override
  public void check() {
    mongo.executeCommand("{ ping: 1 }");
  }
}
