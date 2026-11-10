package com.openbox.platform;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

// Every code this service returns exists in contracts/error-codes.json with the same status.
class ErrorCodeContractTest {

  @Test
  void every_error_code_matches_the_contract() throws Exception {
    JsonNode list = new ObjectMapper().readTree(new File("../../contracts/error-codes.json"));
    Map<String, Integer> contract = new HashMap<>();
    list.forEach(e -> contract.put(e.get("code").asText(), e.get("status").asInt()));

    for (ErrorCode code : ErrorCode.values()) {
      assertThat(contract).as(code.name()).containsEntry(code.name(), code.status().value());
    }
  }
}
