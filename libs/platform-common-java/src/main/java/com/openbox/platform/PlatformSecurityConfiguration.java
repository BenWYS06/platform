package com.openbox.platform;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderNotFoundException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;

// Job: one stateless security chain for every Java service, closed by default.
//   GET /api/*/health, /error  -> public
//   /internal/**               -> right X-Internal-Key (role INTERNAL)
//   other /api/**              -> authenticated; the JWT stub accepts nothing yet, so 401
//   anything else              -> open, so unknown paths still answer 404
// No session, cookie, CSRF, form login, basic auth or logout.
@Configuration(proxyBeanMethods = false)
class PlatformSecurityConfiguration {

  @Bean
  ContractErrorHandlers contractErrorHandlers() {
    return new ContractErrorHandlers();
  }

  // Its presence stops Spring Boot from creating a default user with a generated password.
  @Bean
  AuthenticationManager noLoginAuthenticationManager() {
    return authentication -> {
      throw new ProviderNotFoundException("no login in this service");
    };
  }

  @Bean
  SecurityFilterChain platformSecurityFilterChain(
      HttpSecurity http, InternalKey internalKey, ContractErrorHandlers errors) throws Exception {
    return http.csrf(c -> c.disable())
        .formLogin(f -> f.disable())
        .httpBasic(b -> b.disable())
        .logout(l -> l.disable())
        .requestCache(r -> r.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .addFilterBefore(new InternalKeyFilter(internalKey), AnonymousAuthenticationFilter.class)
        .addFilterBefore(new JwtStubFilter(), AnonymousAuthenticationFilter.class)
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(HttpMethod.GET, "/api/*/health")
                    .permitAll()
                    .requestMatchers("/error")
                    .permitAll()
                    .requestMatchers("/internal/**")
                    .hasRole(InternalKeyFilter.ROLE)
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .permitAll())
        .exceptionHandling(e -> e.authenticationEntryPoint(errors).accessDeniedHandler(errors))
        .build();
  }
}
