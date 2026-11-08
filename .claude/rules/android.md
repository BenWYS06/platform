---
paths:
  - "clients/android/**"
---

# Android rules

Job: conventions for the Android client.

- Kotlin, Jetpack Compose, Hilt, Gradle wrapper (`./gradlew`). Build: `./gradlew assembleDevDebug`,
  tests: `./gradlew testDevDebugUnitTest`.
- Flavors `dev` and `prod`. The server address comes only from `ServerConfig`; no URL in code.
- Layers: UI (composables, no logic) -> ViewModel (`StateFlow` of a UI state) -> repository
  -> data source. Composables receive state and callbacks, not ViewModels, below the screen.
- Server errors map from `code` to a string resource; never show a raw server message.
- Every user-visible string in `strings.xml`, in both `values/` (en) and `values-vi/`.
- Coroutines: `viewModelScope` in ViewModels, inject dispatchers, no `GlobalScope`.
- Tokens in EncryptedSharedPreferences or DataStore with encryption; never in plain prefs
  or logs.
- No secrets in `BuildConfig` or resources: the app is public.
- Tests: JUnit + Turbine for ViewModels, Compose UI tests for screens, see `testing.md`.
