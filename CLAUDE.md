# CLAUDE.md — nakomis-scrum Project Instructions

This document provides instructions for the Claude AI coding assistant working on the nakomis-scrum project.

## Language & Style

- **British English** throughout — licence not license, colour not color, realise not realize, whilst, amongst, etc.
- Concise, direct code comments only where logic is non-obvious.

## Project Structure

```
docs/      — Architecture documents and design specs
infra/     — AWS CDK v2 (TypeScript)
  lib/     — CDK stack definitions
  lambda/  — Lambda function handlers
web/       — React 19 + Vite + TypeScript + MUI frontend
ignored/   — Local-only notes (git-ignored); see ignored/claude/ for dev-manager notes
```

## Development Workflow

- Always work on a feature branch. **Never commit directly to `main`.**
- When implementation is complete, open a GitHub PR for review.

## Infrastructure (CDK)

```bash
cd infra && npm install

# Deploy to sandbox
AWS_PROFILE=nakom.is-sandbox npx cdk deploy --all

# Deploy to prod
AWS_PROFILE=nakom.is-admin npx cdk deploy --all
```

**Parallel CDK deploys**: always use `--output <unique-dir>` to avoid `cdk.out` conflicts when running multiple CDK processes simultaneously.

## Frontend (Web)

```bash
cd web && npm install && npm run dev
# Opens at http://localhost:5173
```

## Environments

| Environment | URL | AWS Account |
|---|---|---|
| dev | http://localhost:5173 | — |
| sandbox | https://scrum.sandbox.nakomis.com | 975050268859 (eu-west-2) |
| prod | https://scrum.nakomis.com | 637423226886 (eu-west-2) |

AWS profiles: `nakom.is-sandbox` (sandbox), `nakom.is-admin` (prod).

## Key AWS Resources

- **Cognito**: `scrum-users` pool per account; OIDC federation from `eu-west-2_Fqgp2dltb` (nakom-admin pool, prod account)
- **DynamoDB tables**: `Orgs`, `Admins`, `NameLists`, `Sessions`, `WsConnections`, `SpinHistory`
- **REST API**: HTTP API Gateway
- **Real-time**: API Gateway WebSocket API (fan-out pattern via `ApiGatewayManagementApiClient`)

## Origin

This project was bootstrapped by Claude Code acting as development manager, orchestrating a swarm of local Ollama LLM drones to generate all application code. See `ignored/claude/` for process notes, model assignments, and token counts.
