---
description: The reviewer in conventions mode fails the row for a domain service registered with providedIn root.
expected_outcome: The returned table marks the DI-2 row fail and names order-export.service.ts; the verdict is not a plain approve.
tags: [smoke, reviewer]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the `tether-nx:reviewer` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with the review it returns, unchanged.

BEGIN BRIEF
Mode: conventions
Review the change below. The workspace is the read-only `workspace` directory added to this session; it has no git history, so the change is given as a diff, and the files after the change are in the workspace. There is no verify command output for this change.

```diff
diff --git a/libs/orders/data-access/src/lib/models/order-export.model.ts b/libs/orders/data-access/src/lib/models/order-export.model.ts
new file mode 100644
--- /dev/null
+++ b/libs/orders/data-access/src/lib/models/order-export.model.ts
@@ -0,0 +1,4 @@
+export interface OrderExport {
+  readonly orderId: string;
+  readonly url: string;
+}
diff --git a/libs/orders/data-access/src/lib/services/order-export.service.ts b/libs/orders/data-access/src/lib/services/order-export.service.ts
new file mode 100644
--- /dev/null
+++ b/libs/orders/data-access/src/lib/services/order-export.service.ts
@@ -0,0 +1,13 @@
+import { HttpClient } from '@angular/common/http';
+import { Injectable, inject } from '@angular/core';
+import { firstValueFrom } from 'rxjs';
+import { OrderExport } from '../models/order-export.model';
+
+@Injectable({ providedIn: 'root' })
+export class OrderExportService {
+  private readonly http = inject(HttpClient);
+
+  fetchExport(orderId: string): Promise<OrderExport> {
+    return firstValueFrom(this.http.get<OrderExport>(`/api/orders/${orderId}/export`));
+  }
+}
```
END BRIEF
