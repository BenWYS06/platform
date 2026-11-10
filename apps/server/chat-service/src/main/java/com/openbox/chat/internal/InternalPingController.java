package com.openbox.chat.internal;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// Job: let another service check it can reach this one with the internal key.
// The key itself is checked by InternalKeyFilter for every /internal route.
@RestController
public class InternalPingController {

  record PingResponse(String status) {}

  @GetMapping("/internal/ping")
  PingResponse ping() {
    return new PingResponse("OK");
  }
}
