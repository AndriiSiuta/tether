# Templates

Replace names; keep the caps.

## Context / container (`flowchart LR`, ≤12 nodes)

```mermaid
flowchart LR
  browser["Browser<br/>Angular SPA"]
  subgraph server["Single process"]
    api["HTTP API<br/>/api/*"]
    static["Static build"]
  end
  db[("Database")]
  idp["Identity provider"]
  browser -->|"HTTPS, httpOnly cookie session, X-Request-Id"| api
  browser -.->|"first load"| static
  api -->|"data-access layer"| db
  api -->|"verify ID token"| idp
```

Caption: one sentence. `Files: apps/api/src/main.ts, apps/api/src/auth/auth.guard.ts, apps/api/src/app.module.ts`.

## Request flow (`sequenceDiagram`, ≤8 participants, ≤14 messages)

```mermaid
sequenceDiagram
  actor user
  participant dialog as CreateOrderDialog
  participant store as OrdersStore
  participant api as OrdersController
  participant svc as OrdersService
  participant orders as orders table
  user->>dialog: submits the order form
  dialog->>store: create(draft)
  store->>api: POST /api/orders {draft}
  api->>svc: create(userId, dto)
  svc->>svc: validate(dto) → order
  svc->>orders: insert {userId, project, total, createdAt}
  orders-->>svc: Order
  svc-->>store: OrderResponse {status: created}
  store-->>dialog: toast "Order created"
  Note over dialog,store: the orders list updates on its next GET /api/orders
```

Caption: what the flow decides, and what it does not do. `Files: …`.

## Storage (`erDiagram`, one entity per collection)

```mermaid
erDiagram
  users ||--o{ projects : userId
  users ||--o{ orders : userId
  orders ||--o{ invoices : orderId
  projects ||--o{ orders : "project = slug"
  users {
    string id PK
    string externalId UK
  }
  projects {
    string id PK
    string userId FK
    string slug "unique with userId"
    array members "embedded"
  }
  orders {
    string id PK
    string userId FK
    string project "slug"
    string createdAt "index with userId, project"
  }
```

Caption: the ownership rule and how joins work (by slug string, not by id). `Files: apps/api/src/*/*.entity.ts`.
