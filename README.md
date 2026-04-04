# nakomis-scrum — Spin Your Way to Better Standups

**A free and open-source scrum tool for teams, built for real-time collaboration.**

## Features

- **Multi-Org, Multi-Admin Tenancy:** Seamlessly manage multiple organisations and delegate admin access.
- **Cognito Auth (Admins):** Secure admin access via Amazon Cognito, with federated login from `admin.nakom.is`.
- **Anonymous Magic-Link Join:** Team participants can quickly join sessions without an account — just open the link and enter your name.
- **Real-Time Wheel of Names:** WebSocket-based spin for selecting team members — perfect for standups ("who's taking us through the board today?").
- **Reusable Name Lists:** Define and manage shared name lists per organisation; load or edit them on the fly during a session.
- **Live Updates:** The spin is visible to all participants simultaneously.

## Architecture

nakomis-scrum is a serverless AWS application deployed with CDK. The React + Vite frontend communicates with an HTTP API Gateway for CRUD operations and an API Gateway WebSocket API for real-time spin events. State is stored in DynamoDB, with Cognito handling authentication for admin users and signed JWTs for anonymous participant magic links.

## Project Structure

```
nakomis-scrum/
├── docs/     — Architecture documents and plans
├── infra/    — AWS CDK infrastructure (TypeScript)
└── web/      — React + Vite frontend (TypeScript)
```

## Environments

| Environment | URL | AWS Account |
|---|---|---|
| Dev | http://localhost:5173 | — |
| Sandbox | https://scrum.sandbox.nakomis.com | 975050268859 |
| Prod | https://scrum.nakomis.com | 637423226886 |

## Quick Start (Local Dev)

```bash
cd web
npm install
npm run dev
```

See `docs/architecture.md` for the full architecture, and `infra/README.md` for CDK deployment instructions.

## Licence

[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) — public domain. Do whatever you like with it.
