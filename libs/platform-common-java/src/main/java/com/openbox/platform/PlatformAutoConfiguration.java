package com.openbox.platform;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;

// Job: give every servlet service the shared platform pieces by adding the dependency:
// production guard, contract errors, /error fallback, request id, internal key filter.
// Runs before ErrorMvcAutoConfiguration so our ErrorController replaces Spring's.
@AutoConfiguration(before = ErrorMvcAutoConfiguration.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableConfigurationProperties(AppProperties.class)
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

  @Bean
  FilterRegistrationBean<InternalKeyFilter> internalKeyFilter(InternalKey key) {
    return new FilterRegistrationBean<>(new InternalKeyFilter(key));
  }
}
