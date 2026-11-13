# Apex Additives | Supplier change pilot

Meridian will discontinue Binder X-17. Its replacement has a different stabilizer package. Before the last shipment, Apex needs to identify which formulations require qualification, whether customers need notice, and who can authorize the next step. Reconciling supplier notices, qualification records and regional obligations by hand leaves a lead chasing signatures while the supply window closes.

## Where the platform fits

Today, Product Change collects a supplier notice, requests product and qualification records, asks Regulatory for the notification matrix, then reconciles email replies. In the pilot, those owners keep their records. The Next.js workspace on Vercel brings the evidence, decision and responsible people into one case. A server function reads an immutable synthetic register over HTTPS from GitHub. A revision mismatch or unavailable register stops the assessment. Production would replace that adapter with a scoped, authenticated reader for Apex's private APIs.

The AI SDK and AI Gateway integration produces a structured assessment when configured. A labeled deterministic assessment keeps the demo available without purchasing inference. Quality and Regulatory each record a human review through Vercel Workflow. The lead then routes the plan. Workflow run IDs identify recorded actions. Browser memory holds the assembled case state in this pilot, so refreshing starts a new walkthrough. Production needs a durable case store, idempotent writes and server-enforced transition checks before any operational approval.

## Pilot decision

Use a preview deployment to rehearse the complete and missing-record cases. First run alongside the current process for ten supplier changes. Capture elapsed time from notice to documented plan, number of evidence requests, and hours spent waiting for review. Proposed pilot gates are a 25% reduction in median decision time, a valid citation on every disposition and zero routed cases with missing mandatory evidence. These are targets to validate against the baseline.

Start with one coatings team. Expand after Quality and Regulatory reconcile the first ten cases against their existing records. If evidence or routing diverges, suspend new reviews, reconcile outstanding workflow IDs and return traffic to the previous deployment. Keep the original records and decision process available during the pilot.

## Live walkthrough

Enter as Dana, open the priority decision file and run the assessment. Inspect the US coating, EMEA coating and unaffected plastic additive. Follow one citation to its source. Switch to Priya and Marcus to sign their respective reviews, then return to Dana to route the plan. Toggle the missing EU record and run again. Regulatory must recover the record before the route can proceed.

Built with Codex. The industrial photographs depict historical Ohio facilities and illustrate the fictional Apex setting. Images courtesy of the Library of Congress, Detroit Publishing Company Collection. [Toledo](https://www.loc.gov/resource/det.4a18921/) and [Cleveland](https://www.loc.gov/resource/det.4a06931/).
