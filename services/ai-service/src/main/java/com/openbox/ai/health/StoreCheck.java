package com.openbox.ai.health;

// Job: one store the health route pings. check() returns normally when the store answers.
public interface StoreCheck {

  String name();

  void check() throws Exception;
}
