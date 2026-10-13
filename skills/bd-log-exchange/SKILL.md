---
name: bd-log-exchange
description: Logs a RISEx BD exchange with a trading lead (DM we sent, their reply, a note, or a status change) as rows in the Notion "Outreach log" and updates the lead's status, Last contact, Next follow-up, Latest summary and Assigned BD in "Outreach leads" | สำหรับทีม BD ของ RISEx (BD 1-4) ที่ DM หา trading leads บน X. Triggers when user says (Thai/EN): 'ส่ง DM แล้ว', 'ส่งแล้ว @...', 'ลง log', 'บันทึกแชท', 'เขาตอบมาแล้ว', 'จดโน้ต lead', 'เปลี่ยนสถานะ lead', 'sent @handle', 'log @handle', 'note @handle', 'status @handle', 'they replied', 'log this reply', 'update the lead'
---

# BD Log Exchange

## ทำอะไรได้ (What it does)
Turns one BD update into Notion records: one "Outreach log" row per message, then an update to the matching "Outreach leads" row (status, dates, summary, owner). It records what happened. It never sends DMs and never logs in to X. BDs send every DM themselves from their own X app.

## เหมาะกับใคร (Who it's for)
RISEx BD reps ("BD 1" to "BD 4") working leads from the BD Outreach page: https://app.notion.com/p/3f83b4619cb08101b3d2c01425097f0d

ใช้ตอน (Use when):
- A BD has just sent a DM, got a reply, wants to add a note, or wants to set a lead's status.
- A BD pastes a DM thread or screenshot and wants it on record.

## บอก Claude ยังไง (How to ask)
```
"sent @alphatrader"                      (uses the lead's DM draft as the message)
"sent @alphatrader: gm! saw your BTC calls..."   (uses the pasted text)
"log @alphatrader: sounds cool, what are the fees?"
"note @alphatrader: prefers Telegram, ping after FOMC. BD 2"
"status @alphatrader Interested, follow up Friday"
"เขาตอบมาแล้ว @alphatrader: <pasted thread>"
```

## ขั้นตอนการทำงาน (Workflow)
Notion targets:
- Outreach leads: `collection://60af36d1-05eb-4618-8f16-d46f6d75d74a`
- Outreach log: `collection://8a64455c-ab9a-44a4-8346-65c26eae6c81`

1. **Parse the request.** For each handle, get:
   - Type: `sent` (We sent), `log` (They replied, or a mixed thread), `note` (Note), or `status`.
   - Message text, kept exactly as given: no rewording, translating, fixing typos or trimming the lead's words. For a screenshot, transcribe the visible text verbatim. If part of it is unreadable, ask.
   - BD (if stated), Channel (X DM unless Telegram/Call is stated), any status, any follow-up date, and any message dates or times.
   - Accept `@Handle`, `handle` or an x.com URL, and normalize to a lowercase handle without "@". Several handles in one request means you handle each lead separately.
2. **Fetch both data sources first** to get exact property names and select options. Don't rely on memory.
3. **Find the lead.** Query Outreach leads with `notion-query-data-sources` and match Handle case-insensitively, ignoring "@".
   - If the database is empty, say "Outreach leads is empty", then stop.
   - Not found: say so, offer close matches if any, then stop. Never create a lead here.
   - More than one match: list them and ask which one.
   - Status **Do not contact**: refuse to log any "We sent" and say why (the lead is marked Do not contact). For an inbound reply or note, warn and log only if the BD confirms. The status stays the same unless the BD explicitly changes it.
4. **Resolve the BD.** Use the BD stated in the request. If none is stated, use the lead's Assigned BD. If neither exists, ask. If the stated BD is not the lead's Assigned BD, warn ("this is BD 3's lead") and ask before writing anything.
5. **Check history.** Query Outreach log rows whose Lead is this lead's page URL.
   - **Duplicate:** a row for the same Direction and the same text (ignoring whitespace) already exists on the same Bangkok date, whether Grok bot or BD Desk logged it. Ask before adding it again.
   - Note the latest existing message (We sent / They replied) and its date. Step 7 needs it.
6. **Create log rows** with `notion-create-pages`, parent = the Outreach log data source. Make one row per message in thread order, one call per row, so you know which ones saved.
   - Entry: `@handle · Oct 13 · we sent` / `they replied` / `note`, using the handle as stored in Notion and the message's Bangkok date.
   - Lead = the lead page URL. BD, Channel, Direction, Message (verbatim), Logged by = `BD Desk`.
   - Status after = the status the lead will have once this message is applied (step 7). Fill Next step and Follow-up on the last row only, and only if known.
   - Thread direction comes from speaker labels (me/you/@handle/BD name). If any message's direction is unclear, ask before creating any row.
   - `status` with no message: create one Note row with Message = `Status set to <status> by BD n` plus the BD's reason if given. Nothing more.
   - `sent` with no pasted text: Message = the lead's DM draft, verbatim. If DM draft is empty, ask for the text.
7. **Update the lead** with `notion-update-page` (`update_properties`). Do this only after **all** log rows saved.
   - **Last contact** = the latest message date across existing and new rows. Notes and status-only changes don't count as contact.
   - **Outreach status:** an explicit status from the BD always wins. Otherwise, if the lead sent last, set Needs reply. If the BD sent last, set Waiting on lead. Notes don't change status.
     - Never infer Interested, Not interested or Trading on RISEx from the lead's wording. You can suggest it ("sounds interested; set Interested?") but don't set it.
   - **Next follow-up:**
     - If the BD gave a date, use it.
     - Otherwise, if the latest message is a "We sent" with no reply, set it to that message's date + 2 days.
     - Clear it (null) for Trading on RISEx, Not interested or Do not contact.
     - Otherwise leave it unchanged and say so.
   - **Latest summary:** one plain factual line on where things stand plus the next step, e.g. `Replied Oct 13 asking about fees; BD 2 to answer.` Use only logged facts.
   - **Assigned BD:** if empty, set it to the logging BD.
   - Date syntax: `date:Last contact:start`, `date:Last contact:is_datetime` (same pattern for Next follow-up). Follow-up dates are date-only.
8. **Confirm in exactly 3 lines** (per lead):
   ```
   @handle → Waiting on lead (last contact Oct 13, BD 2)
   Next follow-up: Oct 15 | cleared | unchanged (Oct 20)
   Log: <row link(s)> · Lead: <lead page link>
   ```
   If needed, add one short caveat line, e.g. "Message = DM draft as stored", "sample lead", or a status suggestion.

## ที่ต้องระวัง (Watch out for)
- **Never invent** message text, dates, times or outcomes. If something required is missing, ask.
- **Dates and timezone:** all dates are Bangkok time (UTC+7). Write datetimes with a `+07:00` offset.
  - Resolve "today", "yesterday", "this morning" or "Monday" to an absolute date in Bangkok time and echo that date in the confirmation. Ask about vague ones like "last week".
  - Use the real timestamp from the thread or screenshot if one is shown (assume it's Bangkok time unless told otherwise).
  - "Just sent" or "just got" means now.
  - With no time at all, use the stated day as date-only (`is_datetime` = 0). Never make up a clock time.
- **Reply to a closed lead** (Trading on RISEx or Not interested): log the reply, but don't auto-reopen. Ask "reopen as Needs reply, or keep <status>?" For Do not contact, follow step 3.
- **Backfilled older messages:** status and Last contact follow the overall latest message, not the last one you happened to log.
- **Sample data:**
  - Never untick "Sample data".
  - Never edit or delete rows Logged by "Sample data" unless asked.
  - Never edit Grok bot rows.
  - Logging on a sample lead is fine; flag it in the caveat line.
- **Empty Outreach log:** that's normal for a first entry, not an error.
- **Write failures:** every write must succeed. If one fails, don't update the lead, and don't say "logged". Report exactly what was saved (with links) and what wasn't, e.g. "Saved: rows 1-2. Not saved: row 3, lead update." Before retrying a create, check whether it already exists so you don't duplicate it.
- **Call channel:** the message is the BD's own note of the call. Log it as Note unless the BD says otherwise.
- **Asked to "send it" or DM someone:** say no. The BD sends from their own X app. Offer to log it once it's sent.
