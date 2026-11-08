package com.openbox.ai.platform;

import org.springframework.boot.context.properties.ConfigurationProperties;

// Job: the raw env values the production guard checks. Blank means "not set".
// Moves to platform-common-java in issue 0.5.
@ConfigurationProperties(prefix = "app")
public record AppProperties(
    String env, String internalApiKey, String mongodbUri, String rabbitmqPassword) {}
