# Templates

Replace names; keep the caps.

## Context / container (`flowchart LR`, ≤12 nodes)

```mermaid
flowchart LR
  browser["Browser<br/>Angular SPA"]
  subgraph server["Single process"]
    api["Nest API<br/>/api/*"]
    static["Static build"]
  end
  db[("MongoDB")]
  idp["Google Identity"]
  browser -->|"HTTPS, httpOnly cookie app_session, X-Client-Date"| api
  browser -.->|"first load"| static
  api -->|"Mongoose"| db
  api -->|"verify ID token"| idp
```

Caption: one sentence. `Files: apps/api/src/main.ts, apps/api/src/auth/auth.guard.ts, apps/api/src/app.module.ts`.

## Request flow (`sequenceDiagram`, ≤8 participants, ≤14 messages)

```mermaid
sequenceDiagram
  actor user
  participant dialog as CaptureDialog
  participant store as EntriesStore
  participant api as EntriesController
  participant svc as EntriesService
  participant expenses as expenses collection
  user->>dialog: "-14 taxi #travel"
  dialog->>store: capture(raw)
  store->>api: POST /api/entries {raw}
  api->>svc: create(userId, dto, clientDate)
  svc->>svc: parseCapture(raw, today) → expense
  svc->>expenses: insert {userId, project, amount, date}
  expenses-->>svc: Expense
  svc-->>store: CaptureResponse {kind: expense}
  store-->>dialog: toast "−14 € logged to Travel"
  Note over dialog,store: dashboard card updates on its next GET /api/dashboard
```

Caption: what the flow decides, and what it does not do. `Files: …`.

## Storage (`erDiagram`, one entity per collection)

```mermaid
erDiagram
  users ||--o{ projects : userId
  users ||--o{ entries : userId
  users ||--o{ expenses : userId
  projects ||--o{ expenses : "project = slug"
  users {
    ObjectId _id PK
    string googleId UK
  }
  projects {
    ObjectId _id PK
    ObjectId userId FK
    string slug "unique with userId"
    array blocks "embedded"
  }
  expenses {
    ObjectId _id PK
    ObjectId userId FK
    string project "slug"
    string date "index with userId, project"
  }
```

Caption: the ownership rule and how joins work (by slug string, not by id). `Files: apps/api/src/*/*.schema.ts`.
