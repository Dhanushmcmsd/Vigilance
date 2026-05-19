# Vigilance App — Bug Fix Report & Completion Plan

---

## Part 1 — Bug Fixes Applied (This Session)

### 🐛 Bug 1 — Audit Shows "0 Reports" After Officer Submits

**File:** `mobile/app/(audit)/index.tsx`

**Root cause:** The audit dashboard's Supabase Realtime subscription listened for
`event: 'INSERT'` on the `inspections` table and only reacted when the inserted row
had `status = 'submitted'`. But the actual submission flow is:

```
claimBranchInspection()  →  INSERT row with status='draft'
Officer fills checklist  →  (no DB change)
handleSubmit()           →  UPDATE row  draft → submitted
```

The INSERT event fires with `status='draft'` (filtered out). The UPDATE event is
never heard. So the audit list **never refreshed** in real time after a submission.

**Fix applied:** Changed the realtime filter to `event: '*'` and added logic to only
react when `payload.new.status === 'submitted'` AND `payload.old.status !== 'submitted'`
(transition into submitted state). Also handles DELETE events for the refill feature.

---

### 🐛 Bug 2 — Completed Branch Didn't Show a Clear "Done" Visual

**File:** `mobile/components/BranchCard.tsx`

**Root cause:** All disabled branch cards showed a grey lock icon `lock-closed-outline`,
regardless of whether the branch was completed or in-progress. There was no visual
distinction for a successfully submitted store.

**Fix applied:**
- Completed branches (`statusTone === 'completed'`) now show a **green checkmark
  circle** icon (`checkmark-circle`) with a **green border** on the card.
- In-progress branches still show the grey `lock-closed-outline`.

---

### 🐛 Bug 3 — Lock Logic Was Correct But Missing Refill Capability

**Files:** `mobile/lib/branchLocks.ts`, `mobile/app/(officer)/select-branch.tsx`

**Root cause:** Once a branch was marked "completed", it was completely locked — even
for the officer who submitted it. There was no way to correct a mistake.

**Fix applied:**
- Added `isOwnCompletedBranch()` helper to detect if the current officer is the
  original submitter.
- Own-completed branches show **"Completed · Tap to refill"** label and remain
  tappable (not grayed out).
- Tapping shows a confirmation alert: *"Permanently delete all data and refill?"*
- On confirm: calls new `deleteAndResetInspection()` RPC, then immediately opens a
  fresh checklist for the same branch.

---

### 🆕 New Feature — Refill (Delete & Resubmit)

**Files added/changed:**
- `supabase/migrations/20260520_refill_inspection.sql` — new DB function
- `mobile/lib/branchLocks.ts` — `deleteAndResetInspection()` client function
- `mobile/app/(officer)/select-branch.tsx` — refill flow in UI

**How it works:**
1. Officer sees their completed store with a green badge "Completed · Tap to refill"
2. Tap → Alert: *"Do you want to permanently delete all submitted data and refill?"*
3. Confirm → `delete_and_reset_inspection(inspectionId)` runs in Supabase:
   - Verifies caller is the original officer (NOT_OWNER error if not)
   - Blocks refill if inspection is already approved/rejected
   - Deletes: `inspection_responses`, `inspection_files`, `general_remarks`, `inspections`
4. Lock clears via realtime → all officers see branch as available again
5. Officer goes through location gate → fresh checklist opens
6. Other officers cannot trigger refill (they still see "Report completed" as locked)

---

## Part 2 — Remaining Known Issues to Fix

### 🔴 Critical

| # | Issue | File | Fix Needed |
|---|-------|------|-----------|
| 1 | `sync_status` column referenced in checklist.tsx but not in schema.sql | `mobile/app/(officer)/checklist.tsx:560` | Add `ADD COLUMN IF NOT EXISTS sync_status text` to inspections migration or remove the field from the update |
| 2 | Offline queue `claimBranchInspection` is called again on sync but the branch may now be COMPLETED by another officer — queue item gets stuck | `mobile/lib/syncQueue.ts` | Check for BRANCH_COMPLETED error in flush loop and surface it to the officer |
| 3 | `Items Answered` on confirm screen shows `answeredCount / answeredCount` (same number twice) | `mobile/app/(officer)/confirm.tsx:117` | Pass `totalItems` separately from `answeredCount` in router params |

### 🟡 Medium

| # | Issue | File | Fix Needed |
|---|-------|------|-----------|
| 4 | Audit `store-reports.tsx` realtime uses `event: '*'` (OK) but DELETE events for refill don't invalidate the branch list on audit side | `mobile/app/(audit)/store-reports.tsx` | Add DELETE event handling to invalidate `audit-branch-list` query |
| 5 | `BranchCard` `accessibilityLabel` says "Unavailable" for own-completed branch which is now tappable | `mobile/components/BranchCard.tsx` | Pass accessibility override prop or compute from statusTone |
| 6 | `handleConfirm` in select-branch uses `setPendingBranch(null)` after routing but doesn't reset the location gate status | `mobile/app/(officer)/select-branch.tsx` | Call `locationGate.reset?.()` if it exists |

---

## Part 3 — App Completion Roadmap for Clients

### Phase 1 — Stability & Polish (1–2 weeks)

These are must-haves before any client delivery:

**A. Fix remaining critical bugs** (listed above in Part 2)

**B. Offline sync reliability**
- Show a persistent banner on the drafts screen when there are queued items
- Add retry-count limit (3 attempts) — after that, alert the officer to reconnect
- Handle BRANCH_COMPLETED gracefully when a queue flushes after another officer
  submitted first

**C. Better error feedback**
- Replace all `showToast()` with the existing `ToastMessage` component for visual
  consistency on iOS (Android Toast is fine)
- Add loading indicator during the refill deletion step (currently the button has no
  feedback between press and navigation)

**D. Confirmation screen fix**
- Show correct `Items Answered: 31 / 31` (both values from separate params)
- Add "View full report" link that opens the submission in the submissions list

---

### Phase 2 — Head & Management Dashboard (1 week)

The web dashboard exists but needs these connections:

**A. Head Review flow**
- Head can click any submitted inspection → approve or reject with a comment
- Rejected inspections should notify the officer with the rejection reason
- After approval, management can see the report in their approved view

**B. Real-time compliance alerts**
- When a RED-risk item is answered, push notification to the head for that region
- Supabase edge function + Expo push notifications (already partially set up)

**C. Daily summary email**
- Cron edge function at midnight: send head a summary of today's inspections
- Show: total stores inspected, average score, any RED-risk flagged items

---

### Phase 3 — Reporting & Exports (1 week)

**A. PDF export per inspection** (partially built in `auditPdf.ts`)
- Make the PDF generation reliable and add photos
- Allow audit officers to share/download directly from the report-detail screen

**B. Monthly summary reports**
- Aggregate compliance scores by branch, region, and type for the month
- Export as PDF or Excel for management meetings

**C. Trend charts**
- Line chart: compliance score over the last 30 days per branch
- Bar chart: pass/fail rate per checklist section across all branches

---

### Phase 4 — Admin & Operations (ongoing)

**A. Admin panel improvements**
- Add/edit/deactivate branches from the web dashboard (already partially in AdminPanel.tsx)
- Bulk-import branches from CSV
- Manage checklist templates: add questions, reorder sections, set risk levels

**B. Officer management**
- Admin can create, reset passwords, and deactivate officer accounts
- Assign officers to specific regions so they only see branches in their area

**C. Audit trail**
- Log who approved/rejected each inspection and when
- Show the full history of an inspection: draft → submitted → approved/rejected

---

## Part 4 — Improvement Ideas

### For Officers (Mobile)
1. **Photo required on RED items** — force at least one photo attachment before
   submitting if any checklist item is answered in a way that triggers RED risk
2. **Section progress bar** — show % complete per section, not just total answered
3. **Auto-save on every answer** — currently saves only when navigating away;
   auto-save after each response to prevent data loss
4. **Voice-to-text remarks** — add a microphone button next to remark text fields
5. **Checklist timer** — show how long the officer has been in the store

### For Audit (Mobile)
6. **Filter by date range** — instead of just browsing by month folder
7. **Comparison view** — see two branches side by side (today's scores)
8. **Flag for follow-up** — audit can mark a report as "needs re-inspection"

### For Head/Management (Web)
9. **Heat map by region** — color-coded map showing compliance hotspots
10. **Score alerts** — email/SMS when any branch drops below a threshold (e.g. 70%)
11. **Benchmarking** — compare a branch's score against the regional average
12. **Recurring action items** — head can assign a corrective action to a branch that
    shows up on the officer's next checklist

### Technical / Infrastructure
13. **Push notifications** — Expo push + Supabase edge function triggers (scaffolding
    exists, needs wiring)
14. **App version enforcement** — force update on old app versions via the
    `build-meta.json` + OTA update system already in place
15. **Automated tests** — add Jest unit tests for `branchLocks.ts`, `checklistScoring.ts`,
    and the Supabase RPC functions using pgTAP

---

## Part 5 — Deployment Checklist Before Client Go-Live

- [ ] Run `20260520_refill_inspection.sql` migration in Supabase production
- [ ] Verify `sync_status` column exists in production `inspections` table
- [ ] Test full officer flow: open → fill → submit → see completed green badge
- [ ] Test refill flow: complete store → tap → confirm → re-submit → audit sees update
- [ ] Test audit realtime: submit on officer device → audit dashboard updates within 5 seconds
- [ ] Test offline: disable wifi → fill → submit (queued) → enable wifi → syncs
- [ ] Test location gate: officer outside geofence gets blocked
- [ ] Load test: 5 officers submitting simultaneously (Supabase RPC uses FOR UPDATE lock)
- [ ] Confirm all Supabase Realtime publications include `inspections` table
- [ ] Set up Supabase project backups (daily)
- [ ] Set up error monitoring (Sentry or similar) in the Expo app
- [ ] Build production APK / IPA with EAS Build
- [ ] Distribute via internal test track before full release
