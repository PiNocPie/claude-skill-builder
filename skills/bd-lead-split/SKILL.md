---
name: bd-lead-split
description: Assign, unassign, move, or auto-split RISEx outreach leads across BD reps in the Notion "Outreach leads" database (cap-aware, priority-ordered round-robin, always preview before applying) | สำหรับทีม BD ของ RISEx. Triggers when user says (Thai/EN): 'แบ่ง lead', 'แจก lead ให้ BD', 'กระจาย lead', 'ย้าย lead ไป BD', 'ยกเลิก assign', 'split leads', 'split the unassigned leads', 'assign @handle to BD 3', 'unassign', 'move leads to BD', 'distribute leads'
---

# BD Lead Split

## ทำอะไรได้ (What it does)
Gives each BD rep a fair share of trading leads in Notion. Two modes:
- **Manual**: assign named handles to a BD, unassign them, or move a BD's not-contacted leads to another BD.
- **Auto-split**: deal unassigned, not-contacted leads across BDs in priority order, without letting anyone go over the backlog cap.
Nothing is written until the user has seen a preview and confirmed it.

## เหมาะกับใคร (Who it's for)
The RISEx BD lead and BD reps who DM trading leads on X.

ใช้ตอน (Use when):
- New leads came in and need owners
- A BD is off, overloaded, or leaving and their leads need to move
- Someone needs a single lead assigned or unassigned

## บอก Claude ยังไง (How to ask)
```
"split the unassigned leads"
"split only Keepers, only Hyperliquid, cap 10, BD 4 is off today"
"assign @alice @bob to BD 3"      "unassign @carol"
"move all of BD 2's not-contacted leads to BD 4"
"แบ่ง lead ที่ยังไม่มีเจ้าของให้ BD หน่อย"
```

## ขั้นตอนการทำงาน (Steps)
**Source**: Notion data source `collection://60af36d1-05eb-4618-8f16-d46f6d75d74a` ("Outreach leads").

1. **Load the schema.** Fetch the data source first. Use the exact property names and option values from the schema, not the ones in this file. Read the valid BD names from the `Assigned BD` options, because they may be renamed later. Also read the `DEX` options so DEX filters match.
2. **Load the leads.** Use `notion-query-data-sources` and follow pagination until every row is loaded. Then compute:
   - **Backlog per BD**: the number of leads with `Assigned BD` = that BD and `Outreach status` = Not contacted.
   - **Room per BD**: cap − backlog, never below 0. The default cap is 15. "cap N" applies to this run only.
3. **Parse the request.** If anything is unclear, ask before going further:
   - Unknown BD name: list the valid options and ask. Don't map it to the closest name.
   - Handle not found: match without `@`, case-insensitive, and accept `x.com/<handle>` URLs. If there's still no match, list the handle as "not found" and suggest close matches. Never apply a suggested match without confirmation.
   - A filter value that's not in the schema (e.g. a DEX that doesn't exist): show the real options and ask.
4. **Build the change set.**
   - *Auto-split* pool: `Outreach status` = Not contacted, `Assigned BD` empty, and the user's filters (Tier, DEX). Skip leads ticked `Sample data` and report how many were skipped. Include them only if the user says so.
   - *Sort the pool* by: Top 10 ascending (1 first, empty last), then a non-empty `DM draft`, then Tier (Keeper > Close call > Not tiered or empty), then Followers high to low (empty = 0), then Handle A→Z as a tiebreak.
   - *Deal the leads*: put the eligible BDs (minus any the user excluded for today) in order of smallest backlog first, with ties going to the lower BD number. Give one lead to each BD in turn, skipping BDs with no room left. Stop when the pool is empty or every BD is at cap.
   - *Manual*: build the change set from the named handles or the "move all of BD X's not-contacted leads" set. Naming a lead explicitly allows reassigning it from another BD. Show "from BD X" in the preview. Unassigning means setting `Assigned BD` to null.
5. **Show the preview (always).**
   ```
   Preview: split 23 leads (filters: Keepers only; Sample data skipped: 2)
   BD 1  backlog 4 → 12  (+8)  @top1, @top5, @draftA, @keeperX, ...
   BD 3  backlog 6 → 14  (+8)  @top2, @top6, ...
   BD 2  backlog 9 → 15  (+6)  ...  [at cap]
   Excluded today: BD 4
   Left unassigned: 7 (all BDs at cap 15)
   Reply "yes" / "apply" to write, or change the parameters.
   ```
   For each BD, show "+N" and the first 3–5 handles in the order they were dealt. Say how many leads stay unassigned and why. For manual changes, list each one as `@handle: BD 1 → BD 3` and mark any that put a BD over the cap.
6. **Apply only after an explicit "yes" or "apply".** If the user changes any parameter, rebuild the preview and ask again. Right before writing, re-query the leads in the change set. If a lead was assigned by someone else in the meantime, don't overwrite it; report it as skipped.
7. **Write** with `notion-update-page`, one lead per call (`update_properties`, e.g. `{"Assigned BD": "BD 2"}` or `{"Assigned BD": null}`).
8. **Report**: "Assigned X/Y". List every failure by handle with its reason, and list skipped leads. Then show each BD's new backlog. Never say "all done" unless every write succeeded.

## Edge cases
- **No unassigned leads** (or none that match the filters): say which case it is, show the current backlogs, and stop.
- **Fewer leads than BDs**: the BDs with the smallest backlogs get them. Name the BDs who get nothing this round.
- **Every BD at cap**: assign nothing. Show the backlogs and say the user can raise the cap explicitly.
- **Going over the cap**: allow it only if the user says so explicitly (e.g. "cap 20" or "assign anyway, over cap is fine"). The preview must show the new backlogs with "(over cap)". For a manual move that won't fit, offer two options: move only as many as fit (in priority order), or move all of them over the cap.
- **Excluded BD** ("BD 4 is off today"): leave that BD out of the deal for this run only. Their existing leads stay with them unless the user asks to move them.
- **Named lead is Do not contact**: never assign it. Report it and continue with the rest.
- **Named lead isn't Not contacted** (e.g. Waiting on lead): it's allowed because the user named it. Show its status in the preview so the reassignment is deliberate.

## ที่ต้องระวัง (Watch out for)
- Never reassign a lead that already has a BD unless the user named it, or named that BD's set.
- Never assign a Do not contact lead, in any mode.
- Never write before the user confirms. A preview is not permission.
- Don't change any property except `Assigned BD`. Don't invent handles, BDs, or filter values.
- Report partial failures honestly, listed by handle.
