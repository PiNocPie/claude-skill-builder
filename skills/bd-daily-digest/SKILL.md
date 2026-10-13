---
name: bd-daily-digest
description: Builds a read-only daily outreach digest from the RISEx Notion "Outreach leads" + "Outreach log" databases, either one BD's queue (needs reply, due follow-ups, best not-contacted leads, 7-day counts) or a whole-team report (per-BD activity and queue, unassigned, wins, top 3 urgent) | For RISEx BD reps and the BD lead. Triggers when user says (Thai/EN) 'สรุปงานวันนี้', 'คิวของฉัน', 'สรุปของ BD 2', 'สรุปทีม', 'รายงาน outreach', 'วันนี้ต้องตอบใคร', 'my queue', 'daily digest', 'digest for BD 2', 'team digest', 'outreach report', 'who do I need to reply to'
---

# BD Daily Digest

## ทำอะไรได้ (What it does)
Reads the Notion outreach CRM (never writes) and returns a short, paste-ready digest in one of two modes:
- **Mode A, one BD:** what that BD must do today, in priority order.
- **Mode B, whole team:** activity, queue health, wins and the 3 most urgent items across BD 1–4.

## เหมาะกับใคร (Who it's for)
RISEx BD reps who DM trading leads on X, and whoever runs the BD team.

ใช้ตอน (Use when):
- Starting the day: "what's in my queue?"
- Daily/weekly stand-up or a status post in Slack/Telegram.

## บอก Claude ยังไง (How to ask)
```
"My queue, I'm BD 2"            -> Mode A
"Digest for BD 3"               -> Mode A
"Team digest" / "Outreach report" -> Mode B
"Team digest, include sample data" -> Mode B, sample rows shown and labelled
```

## ขั้นตอนการทำงาน (Steps)
1. **Pick the mode and the BD.** "my queue" with no BD named and none known from this conversation: ask one question, "Which BD are you?" Don't guess. Use the BD option names from the schema (step 2), not a hardcoded list, since names will change from "BD 1–4".
2. **Read the schema.** Fetch both data sources to get exact column names (dates appear as `date:<Prop>:start`, plus `:is_datetime`):
   - Leads: `collection://60af36d1-05eb-4618-8f16-d46f6d75d74a`
   - Log: `collection://8a64455c-ab9a-44a4-8346-65c26eae6c81`
3. **Query with `notion-query-data-sources`.** Prefer `rows` mode with filters, or simple SQL. If SQL is refused (plan quota), switch to rows mode with filters and carry on without comment. Page through until you have all rows. If you can't get everything, say "counts may be partial" next to the affected numbers.
   - Leads: everything except `Outreach status = Do not contact`.
   - Log: `Date` within the last 7 days (today and the 6 days before it, Bangkok time).
   - Join log to leads via the `Lead` relation (page URL/ID) to get the @handle.
4. **Set "today" in Bangkok time (UTC+7).** Convert datetimes to UTC+7 before comparing. A date-only value counts as that calendar day in Bangkok.
5. **Handle sample data.** Leads with `Sample data` ticked and log rows with `Logged by = Sample data` are excluded by default. Report it in one line: "Excluded 6 sample leads, 14 sample log entries." If the user asks to include them, keep them and tag each item `(sample)`. If every row is sample, say so and offer to show them, labelled.
6. **Build the digest** (sections below), then **end with one line: "Next action: ..."** naming the single most important thing to do (usually the longest-waiting reply).

### Mode A: one BD
1. **Needs reply.** `Outreach status = Needs reply`, `Assigned BD` = this BD, oldest waiting first. Waiting time comes from the latest log entry with `Direction = They replied` for that lead. If there isn't one, use `Last contact`. Show "5h" or "2d 3h", and flag anything over 4 hours with ⚠. If you only have a date with no time, show "since Oct 12" and flag it when that date is before today.
2. **Follow-ups due.** `Next follow-up` ≤ today, oldest first. Mark overdue items with "(overdue Nd)". Skip leads already listed under Needs reply.
3. **Not contacted, best first.** `Outreach status = Not contacted`, assigned to this BD. Sort by: has `Top 10`, lowest number first; then has `DM draft`; then `Tier = Keeper`, then Close call, then Not tiered; then `Followers` from high to low. Show the top 10 with "+N more". Give one short reason per lead from `Why reach out`, if it has one.
4. **Last 7 days, one line:** `Sent X · Replies X · Interested X · Trading X`. Sent counts log rows with `Direction = We sent`, and Replies counts rows with `They replied`. Both are filtered by the log's `BD` field. Interested and Trading count distinct leads whose `Status after` became that status.

### Mode B: whole team
Split the per-BD data into two narrow tables so it pastes cleanly:
- **Activity (7d):** `BD | Sent | Replies | Reply rate`. Reply rate = replies ÷ sent in the same window. It can go above 100% when people reply to older DMs, so show the real value.
- **Queue now:** `BD | Needs reply | Overdue f/u | Backlog`. Backlog = Not contacted leads shown against the cap, e.g. `12/15`. Add ⚠ when the backlog is over 15 or when a BD has 0 not-contacted leads left.
- **Unassigned:** count of leads with an empty `Assigned BD`, excluding Not interested.
- **Wins this week (last 7 days):** `@handle → Interested` or `→ Trading on RISEx`, with the BD. Take these from log `Status after`. Fall back to the lead's current status plus a `Last contact` inside the window.
- **Top 3 urgent, across the team:** ranked by (1) Needs reply waiting over 4h, longest first; (2) overdue follow-ups on Interested leads; (3) other overdue follow-ups, oldest first. Each one shows: @handle, BD, why.
- If log rows have an empty `BD`, count them in a separate "No BD" row. Don't assign them to anyone yourself.

### Output format
```
*BD 2 digest · Tue 13 Oct (BKK)*
*Needs reply (2)*
• @handle, waiting 6h ⚠, "asked about fees"
*Follow-ups due (1)*
• @handle, overdue 2d, Interested
*Not contacted, best first (3 of 9)*
• @handle, Top 10 #3 · draft ready · Keeper · 48k
*Last 7d:* Sent 18 · Replies 5 · Interested 1 · Trading 0
_Excluded 4 sample leads._
Next action: reply to @handle (waiting 6h).
```
- Short headings, bullets or compact tables, every handle written as @handle (add the @ if it's missing). Keep tables to 6 columns at most.
- Slack and Telegram don't render markdown tables. When the user says the digest is for one of them, put tables in a code block with aligned columns.
- If a section is empty, write one line ("Nothing waiting on you"). Don't drop the heading.

## ที่ต้องระวัง (Watch out for)
- **Never invent numbers.** A metric with no data shows `–` with the reason, e.g. "Reply rate –: no DMs sent in 7d" or "Sent –: no log entries in the last 7 days."
- **Leads database empty** (or only Do not contact rows): reply "The leads haven't been loaded into Notion yet". No digest.
- **Do not contact** leads never appear in any queue, count or urgent list.
- **Read-only.** If asked to update a status or log a reply, say this skill only reads and point to the Notion row. Don't write anything.
- **Missing fields:** if there's no `Next follow-up`, the lead isn't due. If there's no `Followers`, rank it last within its tier. If a lead's handle is blank, show the Notion page title, or "(no handle)" when there isn't one.
- **Unknown BD name** (e.g. "BD 5"): list the valid options from the schema and ask which one.
- **Don't paste whole messages.** Quote at most about 8 words from `Latest summary` or `Message`.
