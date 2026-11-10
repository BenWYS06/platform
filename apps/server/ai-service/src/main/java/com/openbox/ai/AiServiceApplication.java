package com.openbox.ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Job: start ai-service.
@SpringBootApplication
public class AiServiceApplication {

  public static void main(String[] args) {
    try {
      SpringApplication.run(AiServiceApplication.class, args);
    } catch (RuntimeException startupFailed) {
      // Spring has logged the reason. Tomcat's utility threads would keep the JVM alive
      // after a failed start, so exit explicitly with a non-zero code.
      System.exit(1);
    }
  }
}
