# nakomis-scrum Architecture Document

**Version:** 1.0  
**Date:** 24 May 2024  
**Status:** Approved  
**Author:** Nakomis Architecture Team  

---

## 1. Overview

### 1.1 Project Purpose
`nakomis-scrum` is a multi-tenant SaaS application designed to facilitate agile scrum ceremonies. Phase 1 of the application focuses on the "Wheel of Names" roulette feature, allowing administrators to manage participant lists and conduct random selection sessions in real-time. Future phases will extend functionality to include Planning Poker and other scrum tools.

### 1.2 Core Capabilities (Phase 1)
*   **Session Management:** Create and manage temporary real-time sessions.
*   **Name Lists:** Define or load participant names for the wheel.
*   **Real-Time Interaction:** Simultaneous viewing of wheel spins across all connected users.
*   **Participant Joining:** Secure access via magic links for non-privileged users.
*   **History Tracking:** Audit trail of session spins.

---

## 2. System Design

### 2.1 High-Level Architecture Diagram

```text
+---------------------+     +-----------------------+     +---------------------+
|      Browser        | <-- | CloudFront (S3 + CF)  | <-- |      S3 Bucket      |
+---------------------+     +-----------------------+     +---------------------+
         ^                        |                         ^
         |                        v                         |
         |            +-----------------------------+        |
         |            |    API Gateway (HTTP API)   |        |
         |            +-----------------------------+        |
         |                        |                         |
         |                        v                         |
         |            +-----------------------------+        |
         |            |    Lambda (Node.js/TS)      |        |
         |            |    (REST API Handler)       |        |
         |            +-----------------------------+        |
         |                        |                         |
         |                        v                         |
         |            +-----------------------------+        |
         |            |      Cognito User Pools     |        |
         |            |   (eu-west-2_Fqgp2dltb)    |        |
         |            +-----------------------------+        |
         |                        |                         |
         |                        v                         |
         |            +-----------------------------+        |
         |            |    DynamoDB Tables          |        |
         |            +-----------------------------+        |
         |                        |                         |
         +------------------------+-------------------------+
                                   ^
                                   |
                              +----+----+
                              |  WebSocket API
                              | (eu-west-2)
                              +----+----+
                                   |
              +---------------------+---------------------+
              |                                           |
       +------v------+                              +-----v-------+
       |  Client A   |                              |  Client B   |
       |  (Admin)    |                              |  (Participant)|
       +-------------+                              +--------------+
```

### 2.2 Technology Stack

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript, Material UI (MUI) | Single Page Application (SPA) |
| **Hosting** | AWS S3 + CloudFront | Static assets served via CDN |
| **Backend API** | AWS API Gateway (HTTP API v2) | Stateless REST endpoints |
| **Backend Logic** | AWS Lambda (Node.js 18/20, TypeScript) | Serverless functions |
| **Real-Time** | AWS API Gateway (WebSocket API) + Lambda | Fan-out for session events |
| **Database** | Amazon DynamoDB | Serverless NoSQL store |
| **Auth** | AWS Cognito User Pool | OIDC Federation enabled |
| **Infrastructure**| AWS CDK (TypeScript) | Infrastructure as Code |
| **CI/CD** | GitHub Actions | Automated pipeline |

---

## 3. Authentication & Security

### 3.1 Cognito Identity
The application utilises a dedicated scrum-specific Cognito User Pool federated from the existing `nakom-admin` pool.

*   **Region:** `eu-west-2`
*   **Pool ID:** `eu-west-2_Fqgp2dltb`
*   **OIDC Issuer:** `https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_Fqgp2dltb`

### 3.2 Authentication Flows

#### 3.2.1 Admin Flow (OIDC Federated)
Administrators authenticate via their existing corporate credentials via the federation flow.
1.  User logs in via AWS Cognito Sign-in provider.
2.  Lambda validates the ID Token against the federation claims.
3.  If authenticated, user is treated as `role: admin`.

#### 3.2.2 Participant Flow (Magic Link)
Participants join via a secure, one-time-use token.
1.  Admin generates a magic link (JWT) containing a `sessionId`.
2.  Participant clicks the link.
3.  Frontend decodes the JWT to extract `sessionId`.
4.  Participant enters a `displayName` in the UI.
5.  Participant connects via WebSocket using the session ID and name.
6.  **TTL:** The magic link expires after 24 hours.

#### 3.2.3 WebSocket Session Management
*   Connections are identified by `sessionId`.
*   `WsConnections` table entries have a TTL of 1 hour (configurable per session).
*   Connections without valid authentication or role are rejected.

---

## 4. Data Model (DynamoDB)

### 4.1 Tables Overview

| Table Name | Purpose | Partition Key | Sort Key | TTL (Optional) |
| :--- | :--- | :--- | :--- | :--- |
| `Sessions` | Active session metadata | `sessionId` | N/A | N/A |
| `WsConnections` | WebSocket connection state | `sessionId` | `connectionId` | 1 hour (default) |
| `Spins` | Audit trail of wheel spins | `spinId` | N/A | N/A |
| `NameLists` | Participant lists for sessions | `listId` | `sessionId` | N/A |

### 4.2 Schema Definitions

#### `Sessions`
Stores active session state.
*   **Partition Key:** `sessionId` (String)
*   **Attributes:**
    *   `status`: String ('active' | 'archived')
    *   `adminId`: String (Subj. to admin)
    *   `createdAt`: Number (Timestamp)
    *   `expiresAt`: Number (Timestamp)
    *   `config`: Object (Settings, e.g., wheel speed, size)

#### `WsConnections`
Tracks who is connected to which session.
*   **Partition Key:** `sessionId` (String)
*   **Sort Key:** `connectionId` (String - UUID v4)
*   **Attributes:**
    *   `displayName`: String
    *   `role`: String ('admin' | 'participant')
    *   `lastPing`: Number (Timestamp)
    *   `joinOrder`: Number (Incremental ID)
    *   **TTL:** 1 hour (to auto-cleanup stale connections)

#### `Spins`
Immutable history of all wheel spins.
*   **Partition Key:** `spinId` (String - UUID v4)
*   **Attributes:**
    *   `sessionId`: String
    *   `timestamp`: Number (Timestamp)
    *   `winner`: String (Winner's display name)
    *   `spinUrl`: String (Image URL)
    *   `event`: String ('spun' | 'stopped')

#### `NameLists`
Stores the names participating in a session.
*   **Partition Key:** `listId` (String)
*   **Sort Key:** `sessionId` (String)
*   **Attributes:**
    *   `names`: List(String)
    *   `maxCount`: Number
    *   `source`: String ('admin' | 'import')

---

## 5. API Gateway Endpoints

### 5.1 REST API Endpoints

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/sessions` | List active sessions | Admin Only |
| **POST** | `/api/v1/sessions` | Create new session | Admin Only |
| **GET** | `/api/v1/sessions/{id}` | Get session details | Admin/Participant |
| **GET** | `/api/v1/spins/{sessionId}` | Retrieve spin history | All Authenticated |
| **POST** | `/api/v1/sessions/{id}/magic` | Generate magic link | Admin Only |
| **POST** | `/api/v1/sessions/{id}/admin/link` | Generate admin link | Admin Only |
| **PUT** | `/api/v1/sessions/{id}/admin/link` | Update admin permissions | Admin Only |
| **POST** | `/api/v1/sessions/{id}/spin` | Trigger wheel spin | Admin Only |
| **POST** | `/api/v1/sessions/{id}/admin/stop` | Stop session | Admin Only |

### 5.2 WebSocket API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| **CONNECT** | `sessions/{sessionId}` | Establish WebSocket connection |
| **SUBSCRIBE** | `sessions/{sessionId}` | Join session events |
| **DISCONNECT**| N/A | Session ends |

---

## 6. Deployment & CI/CD

### 6.1 Environment Configuration

The infrastructure is defined using AWS CDK (TypeScript).

| Environment | Region | Hosting | Deployment Mode |
| :--- | :--- | :--- | :--- |
| **Dev** | Local (localhost:5173) | N/A | Manual / Local |
| **Sandbox** | `eu-west-2` | S3 + API Gateway + Lambda | Auto-Deploy (CI) |
| **Production** | `eu-west-2` | S3 + API Gateway + Lambda | Manual Deploy (Review) |

### 6.2 Deployment Automation
*   **Trigger:** Pull request to `main` branch in GitHub.
*   **Action:**
    1.  CDK synth & deploy to Sandbox account (`975050268859`).
    2.  GitHub Actions workflow runs in `eu-west-2`.
    3.  CloudFormation stacks update infrastructure.
    4.  API Gateway and Lambda functions are updated.
    5.  S3 bucket content is updated (if configured via deployment package).

---

## 7. Future Phases

### 7.1 Planning Poker (Phase 2)
*   **Requirement:** Enable users to submit integer values (1-10) in real-time during estimation sessions.
*   **New Endpoint:** `POST /api/v1/sessions/{id}/cards`.
*   **WebSocket Event:** `cardsSubmitted`.
*   **Visualisation:** Update UI to show hidden cards revealing simultaneously at a specific timestamp.

### 7.2 Data Persistence (Phase 3)
*   Move `Spins` data retention logic (e.g., archive to S3 Glacier).
*   Implement cross-region replication for `eu-west-2` to `eu-west-1`.

### 7.3 Advanced Analytics (Phase 4)
*   Dashboard to view session heatmaps.
*   Export history to CSV/JSON.

---

## 8. Compliance & Security Notes

*   **Data Retention:** `Spins` table data is stored indefinitely (subject to GDPR retention policies). `WsConnections` are purged automatically after 1 hour.
*   **Encryption:** All data in transit is encrypted via TLS 1.2+. All data at rest in DynamoDB and S3 is encrypted using AWS KMS.
*   **Audit Trails:** All API calls to admin endpoints are logged to CloudWatch Logs (Log Retention: 90 days).
*   **Admin Privileges:** Administrators must be authenticated via OIDC federation. Their roles are immutable within the session duration.
*   **Magic Link Security:** Magic links contain a signed JWT. They are single-use and expire after 24 hours of inactivity or issue.

---

**End of Document**
