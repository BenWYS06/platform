package com.openbox.platform;

// Job: the internal key checked on /internal routes. toString never shows the value.
public record InternalKey(String value) {

  @Override
  public String toString() {
    return "InternalKey[***]";
  }
}
