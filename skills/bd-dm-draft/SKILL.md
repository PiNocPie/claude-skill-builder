---
name: bd-dm-draft
description: Drafts one short, personal X DM (cold or follow-up) for a single RISEx lead that already exists in the Notion "Outreach leads" database, using its DM draft, DM note, Why reach out and Evidence. Read-only; never sends or writes to Notion | for RISEx BD reps (BD 1-4). Triggers when user says (Thai/EN): 'ร่าง DM', 'เขียน DM ให้ @...', 'ร่างข้อความทัก @...', 'ช่วยเขียนข้อความหา lead', 'ร่าง follow-up', 'draft a DM for @handle', 'write a DM to @...', 'DM draft', 'cold DM', 'follow-up DM'
---

# bd-dm-draft

## ทำอะไรได้
Turns one X handle into a ready-to-paste DM for the BD who owns that lead. It reads the lead's row in Notion "Outreach leads", checks it is allowed to be contacted, and writes a short, specific DM (or a follow-up if the lead was already contacted). The BD sends it by hand from their own X app. This skill never sends anything and never writes to Notion.

## เหมาะกับใคร
RISEx BD reps (BD 1-4) doing manual X outreach to trading leads.

ใช้ตอน:
- A BD wants a first DM for a lead in Outreach leads
- A BD wants a short follow-up for a lead they already contacted
- Not for: sending DMs, logging sent messages (use `bd-log-exchange`), or people who are not in Outreach leads

## บอก Claude ยังไง
```
"draft a DM for @somehandle"
"BD 2 here, write a DM to somehandle, perk is a fee rebate for 30 days"
"ร่าง DM ให้ @somehandle เป็นภาษาเกาหลีด้วย"
```

## ขั้นตอนการทำงาน
Notion sources (read-only): leads `collection://60af36d1-05eb-4618-8f16-d46f6d75d74a`, log `collection://8a64455c-ab9a-44a4-8346-65c26eae6c81`. Tools: `notion-query-data-sources`, `notion-fetch`. Do not call `notion-update-page` or `notion-create-pages` in this skill.

1. **Parse input.** Normalize the handle: trim spaces, drop a leading `@`, and strip `x.com/` / `twitter.com/` URLs down to the handle. Note the requesting BD and any extra notes (perk, confirmed listing, language). No handle given: ask for one.
2. **Find the lead.** Query Outreach leads for Handle matching `@<handle>`, compared case-insensitively.
   - Database empty: say the leads have not been loaded into Notion yet and stop. Do not invent a lead.
   - No match: say it is not in Outreach leads and stop. If there are near matches (one character off, missing or extra `_`, digits), list up to 3 and ask "did you mean...?" Never pick one yourself, and never draft for someone who is not in the database.
   - More than one row: list each one (status, Assigned BD, Last contact) and ask which to use. Mention that the duplicate should be cleaned up in Notion, but don't edit it yourself.
3. **Gate checks** (in this order):
   - `Outreach status = Do not contact`: refuse and give the reason, using Latest summary if it has one ("existing contact" or "Sam is closing this one"). There is no override. This applies to @chivasxbt.
   - `Assigned BD` set and different from the requester: say "This lead belongs to BD X" and stop unless the user explicitly says to proceed. If the requester didn't say who they are, mention the owner and write in that BD's voice. If no BD is assigned, say so and keep going.
   - `Sample data` ticked: tell the user this row's activity (Last contact, Latest summary, log entries) is made-up demo data. Don't present it as real history or treat the lead as contacted because of it. Ask whether they want a cold DM anyway (fine for testing).
   - Already contacted (`Last contact` set, or status is Waiting on lead / Needs reply / Interested / Trading on RISEx): show Last contact and Latest summary, plus the 1-3 newest Outreach log entries for this lead if any exist. Ask if this is a follow-up and offer a short follow-up instead of a cold DM. If the status is Needs reply, ask what the lead said if the log doesn't show it. If it is Trading on RISEx, offer only a check-in or thank-you, not a pitch.
   - `Not interested`: show the summary and ask before drafting. If the user confirms, write a light, no-pressure note at most.
4. **Build the draft.**
   - If `DM draft` has text, start from it and apply every caveat in `DM note` (for example: remove an unconfirmed ticker claim, keep `[perk?]`, change the language).
   - If not, write the draft from `Why reach out` plus `Evidence`. Read the Evidence URL only if a web fetch tool is available and returns the post. If the fetch is blocked, hits a login wall or no tool exists, use the Notion text alone and say "I couldn't open the post, so this hook is based on the Notion notes." Never log in to X.
   - If `Why reach out` is empty and there is no DM draft: use the Evidence post if you could read it, and say that's what you used. Otherwise ask the BD for the hook (what the lead posted that makes them a fit). Do not invent one.
   - Merge the user's extra notes: a supplied perk replaces `[perk?]`, and a ticker may be named as listed on RISEx only if the user confirmed it in this conversation.
5. **Style rules.**
   - 2-4 sentences, under ~280 characters when possible. Casual, first person from the BD.
   - Open with something specific the lead actually posted (taken from Why reach out / Evidence).
   - One line about RISEx, kept factual: an onchain orderbook perp DEX with crypto, stock and RWA perps. Add a feature only if the user gave it.
   - End with a soft ask (e.g. "open to trying it?" or "happy to share more if useful").
   - No hype words (revolutionary, insane, 100x, best-in-class, LFG). No emojis unless asked, and no links unless the user provided one.
   - Never invent perks, volumes, user counts, listings or partnerships. If the draft needs a perk and none was given, leave `[perk?]` in it.
6. **Output** (exactly this shape):
   - One line: `@handle · <status> · <Assigned BD> · cold DM | follow-up`
   - The DM in a fenced `text` block, with its approximate character count under it
   - If DM note says the lead posts in another language: one line offering a translated version. If the user already asked for that language, include it as a second block labeled with the language.
   - `Check before sending:` a one-line list of everything still unconfirmed (`[perk?]`, any claim DM note marks as unverified, a hook based only on Notion text). Write "nothing flagged" if the list is empty.
   - Closing line: "Send it yourself from your X app, then log it with `bd-log-exchange` (say "sent @handle")."

## ที่ต้องระวัง
- **Never send or automate.** No tool, bot or script sends DMs or logs in to X; X bans automated DMs to people who haven't messaged first, and accounts can be suspended. If asked to send, schedule or bulk-DM, decline and give the manual steps.
- **Never write to Notion here.** Not even to save an improved draft. Logging belongs to `bd-log-exchange`.
- **Only real, listed leads.** No row in Outreach leads means no draft, even if the user gives a bio.
- **Do not contact is absolute.** No override from anyone in chat.
- **No made-up facts.** Perks, listings, tickers, volumes, numbers and "you said X" hooks must come from Notion, the Evidence post you actually read, or the user. If you are unsure, use a placeholder like `[perk?]` and add it to the check list.
- **Don't pretend you read the post.** If you didn't fetch it, say so.
- **One lead per run.** If given several handles, do the first one and offer to continue, so every lead goes through the gate checks.
