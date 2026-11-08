package com.openbox.chat.platform;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Job: run the production guard at startup and expose the internal key.
@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class PlatformConfig {

  private static final Logger log = LoggerFactory.getLogger(PlatformConfig.class);

  @Bean
  public InternalKey internalKey(AppProperties props) {
    return new InternalKey(ProductionGuard.check(props, log::warn));
  }
}
