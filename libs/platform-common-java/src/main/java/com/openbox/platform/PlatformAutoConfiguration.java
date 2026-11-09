package com.openbox.platform;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;

// Job: give every servlet service the shared platform pieces by adding the dependency:
// production guard, contract errors, /error fallback, request id, and the security chain
// (internal key, JWT stub, deny by default). Runs before Spring Boot's error and security
// auto-configuration so our ErrorController, filter chain and AuthenticationManager win.
@AutoConfiguration(
    before = {
      ErrorMvcAutoConfiguration.class,
      SecurityAutoConfiguration.class,
      UserDetailsServiceAutoConfiguration.class
    })
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableConfigurationProperties(AppProperties.class)
@Import(PlatformSecurityConfiguration.class)
public class PlatformAutoConfiguration {

  private static final Logger log = LoggerFactory.getLogger(PlatformAutoConfiguration.class);

  @Bean
  InternalKey internalKey(AppProperties props) {
    return new InternalKey(ProductionGuard.check(props, log::warn));
  }

  @Bean
  ApiExceptionHandler apiExceptionHandler() {
    return new ApiExceptionHandler();
  }

  @Bean
  ErrorFallbackController errorFallbackController() {
    return new ErrorFallbackController();
  }

  @Bean
  FilterRegistrationBean<RequestIdFilter> requestIdFilter() {
    var registration = new FilterRegistrationBean<>(new RequestIdFilter());
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
    return registration;
  }
}
