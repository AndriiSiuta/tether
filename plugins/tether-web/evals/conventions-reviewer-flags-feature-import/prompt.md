---
plugins: ["../..", "../../../tether-nx"]
description: The conventions reviewer fails the row for a feature library that imports another feature library.
expected_outcome: 'The returned table has the columns Rule, Verdict and Evidence, marks the FEAT-3 row fail with invoice-list.component.ts as its evidence; the final line is `Verdict: fail` and no `Verdict: pass` appears.'
tags: [smoke, conventions-reviewer]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the `tether-web:conventions-reviewer` agent with the brief between BEGIN BRIEF and END BRIEF, word for word, and then reply with the review it returns, unchanged.

BEGIN BRIEF
Review the change below. The workspace is the read-only `workspace` directory added to this session; it has no git history, so the change is given as a diff, and the files after the change are in the workspace. There is no verify command output for this change.

```diff
diff --git a/libs/invoices/feature/src/lib/invoice-list/invoice-list.component.ts b/libs/invoices/feature/src/lib/invoice-list/invoice-list.component.ts
--- a/libs/invoices/feature/src/lib/invoice-list/invoice-list.component.ts
+++ b/libs/invoices/feature/src/lib/invoice-list/invoice-list.component.ts
@@ -1,9 +1,12 @@
 import { ChangeDetectionStrategy, Component } from '@angular/core';
+import { OrderSummaryComponent } from '@org/orders/feature';
 
 @Component({
   selector: 'org-invoice-list',
   changeDetection: ChangeDetectionStrategy.OnPush,
-  template: '',
+  imports: [OrderSummaryComponent],
+  template: '<org-order-summary />',
 })
 export class InvoiceListComponent {}
diff --git a/libs/orders/feature/src/index.ts b/libs/orders/feature/src/index.ts
--- a/libs/orders/feature/src/index.ts
+++ b/libs/orders/feature/src/index.ts
@@ -1 +1,2 @@
 export * from './lib/orders.routes';
+export * from './lib/order-summary/order-summary.component';
```
END BRIEF
