# Module 10: The 12-Factor App for Microservices

This module covers the 12-Factor App methodology—a set of best practices for building cloud-native, scalable microservices that are easy to deploy, maintain, and scale.

---

## Lessons in This Module

| Lesson | Topic                                      | Duration |
| ------ | ------------------------------------------ | -------- |
| 10.1   | Introduction to 12-Factor App              | 15 min   |
| 10.2   | Codebase, Dependencies & Config            | 25 min   |
| 10.3   | Backing Services & Build/Release/Run       | 20 min   |
| 10.4   | Processes, Port Binding & Concurrency      | 20 min   |
| 10.5   | Disposability, Dev/Prod Parity & Logs      | 25 min   |
| 10.6   | Admin Processes & Putting It All Together  | 20 min   |

---

## Learning Objectives

By the end of this module, you will be able to:

- Understand the 12-Factor App methodology and its importance for microservices
- Apply each factor to Node.js/NestJS applications
- Configure services for cloud-native deployment
- Implement stateless, horizontally scalable services
- Handle graceful shutdown and fast startup
- Structure logging as event streams
- Manage configuration through environment variables

---

## The 12 Factors at a Glance

| #  | Factor             | Description                                    |
| -- | ------------------ | ---------------------------------------------- |
| I  | Codebase           | One codebase per service, tracked in Git       |
| II | Dependencies       | Explicitly declare and isolate dependencies    |
| III| Config             | Store config in environment variables          |
| IV | Backing Services   | Treat databases, queues as attached resources  |
| V  | Build, Release, Run| Strictly separate build and run stages         |
| VI | Processes          | Execute app as stateless processes             |
| VII| Port Binding       | Export services via port binding               |
| VIII| Concurrency       | Scale out via the process model                |
| IX | Disposability      | Fast startup, graceful shutdown                |
| X  | Dev/Prod Parity    | Keep development and production similar        |
| XI | Logs               | Treat logs as event streams                    |
| XII| Admin Processes    | Run admin tasks as one-off processes           |

---

## Folder Structure

```
10-twelve-factor-app/
├── README.md
├── 01-introduction.md
├── 02-codebase-dependencies-config.md
├── 03-backing-services-build-release-run.md
├── 04-processes-port-binding-concurrency.md
├── 05-disposability-parity-logs.md
├── 06-admin-processes-summary.md
└── examples/
    ├── nestjs-twelve-factor/
    └── docker-compose.yml
```

---

## Prerequisites

- Completed previous modules (especially API Gateway and Event-Driven Architecture)
- Basic Docker and containerization knowledge
- Understanding of environment variables and configuration management

---
