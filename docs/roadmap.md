# Roadmap

Job: the phases of the project and the issues in each. Ticked when an issue's PR is merged.

## Phase 0: Foundation (Sprint 1)

- [x] 0.1 Repo and harness (3)
- [x] 0.2 Contracts folder (2)
- [x] 0.3 Local infra with Caddy (3)
- [x] 0.4 Service skeletons: auth, chat, ai (5)
- [x] 0.5 platform-common-java library (2)
- [x] 0.6 CI pipeline (3)
- [x] 0.7a Web skeleton (5)
- [ ] 0.7b Android skeleton (5): later, no date (#25)
- [x] Spotless in the Java build and CI (2, #22)
- [x] Use axios in the web api layer (1, #37)

## Phase 1: Identity

- [ ] 1.1 Users, first owner, password login
  - [x] 1.1a First owner (5, #34)
  - [ ] 1.1b Login (3, #35)
- [ ] Health with Spring Actuator (D-010a to D-010c)
- [ ] 1.2 Sessions, access token, rotating refresh token, logout
- [ ] 1.3 Capabilities, roles, workspace settings
- [ ] 1.4 Session check in every service; logout and permission-change events
- [ ] 1.5 Invites, member list, block, audit log
- [ ] 1.6 Clients: login, refresh, accept invite, member management screen

## Phase 2: Chat core

- [ ] 2.1 Conversations, one-to-one and group
- [ ] 2.2 Sending messages, realtime over STOMP
- [ ] 2.3 Notifications, read status, unread counts
- [ ] 2.4 Presence and typing
- [ ] 2.5 Edit, recall, reply, reactions, mentions, pin, mute, archive, search
- [ ] 2.6 Files and images
- [ ] 2.7 FCM push on Android
- [ ] 2.8 Clients: chat list, chat screen, new chat and group
- [ ] 2.9 Smoke script

## Phase 3: AI in chat

- [ ] 3.0 Tracing baseline: OpenTelemetry in all services, Jaeger in dev, trace id in logs (D-010d, D-010e)
- [ ] 3.1 RabbitMQ, dead-letter queue
- [ ] 3.2 chat-service triggers AI, with permission check
- [ ] 3.3 ai-service calls Claude and streams the answer
- [ ] 3.4 AI errors, prompt injection defense, model from env
- [ ] 3.5 Quota, token_usage, persona
- [ ] 3.6 First server deploy, error tracking (D-010f)

## Phase 4: Knowledge

- [ ] 4.1 Departments
- [ ] 4.2 Document upload, processing, storage in Qdrant
- [ ] 4.3 Search, citations
- [ ] 4.4 Long-term memory
- [ ] 4.5 AI context by role

## Phase 5: Agent

- [ ] 5.1 Tool loop with a user confirmation step
- [ ] 5.2 connector-service, Google OAuth, token vault
- [ ] 5.3 Custom MCP, link preview
- [ ] 5.4 Reminders, daily digest

## Phase 6: Extras (any order)

- [ ] MFA
- [ ] SSO
- [ ] Calls and meetings
- [ ] Model router
- [ ] AI eval
- [ ] Metrics (D-010g)
- [ ] Image build and auto-update
- [ ] iOS
