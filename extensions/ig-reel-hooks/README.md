# IG Reel Hooks (Chrome extension)

Collects Instagram Reels and creator profiles **while you scroll**. It then pulls out each Reel's hook and script and sends them to Google Sheets.

- **Capture:** stats, caption and video link for each Reel. For each profile: followers, following, posts, bio and category.
- **Outlier ×:** a Reel's views ÷ the creator's median views, counted over the Reels you've captured. Find the Reels that beat the creator's normal.
- **Analyze:** for each Reel you select:
  - Groq Whisper transcribes the speech.
  - Claude reads 3 frames from the first ~3 seconds for the on-screen text.
  - Claude returns the spoken, on-screen and visual hooks, the hook type, a reusable hook template, the script structure with timestamps, and the CTA.
- **Google Sheets:** rows go to a `Reels` tab and a `Profiles` tab. Re-sending the same Reel updates its row instead of adding a new one.

## How it collects data (and the risk)

It never sends its own requests to Instagram. A small script copies the Reel and profile data that Instagram's page already loads as you browse, so your traffic looks like normal use. Even so, collecting Instagram data is against Instagram's Terms of Use. Keep the volume human, and use a secondary account if you're worried about your main one.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extensions/ig-reel-hooks` folder.
3. Pin the extension. Click its icon to open the dashboard.

## Setup

### API keys (dashboard → Settings)

| Key | Where to get it | Used for |
|---|---|---|
| Anthropic API key | console.anthropic.com | Hook and structure analysis. Defaults to Sonnet 5.5; you can switch to Opus 5.5. |
| Groq API key | console.groq.com | Transcription (`whisper-large-v3`, handles Thai). Optional: without it, analysis uses frames and caption only. |

Keys are stored in this browser's extension storage (`chrome.storage.local`) and sent only to the API they belong to.

### Google Sheets

1. Create a Google Sheet, then go to **Extensions → Apps Script**.
2. Replace the code with [`apps-script/Code.gs`](apps-script/Code.gs). Change `SECRET` to a long random string.
3. Go to **Deploy → New deployment → Web app**. Set Execute as: **Me** and Who has access: **Anyone**. Authorize it.
4. Paste the `/exec` URL and the same secret into the dashboard's Settings.

"Anyone" means anyone who has the URL. The secret is what stops strangers from writing to your sheet.

## Use

1. Open a creator's **Reels** tab on instagram.com and scroll. The badge counts captured Reels.
2. In the dashboard, pick the creator and set **Min outlier ×** (e.g. 2–3). Click **Select visible**, then **Analyze selected**.
3. Analyzed Reels are sent to Sheets automatically once a webhook is set. **Send visible to Sheets** sends whatever the current filter shows, analyzed or not.

## Limits

- **Video links expire** after a while. If a Reel says "Video link expired", scroll past it on Instagram again, then re-run.
- **Outlier × needs a baseline.** It's dimmed until you've captured at least 5 Reels from that creator.
- **Field names change.** If Instagram renames its data fields, capture can stop picking things up. The extractor in `src/extract.js` matches by field names, not fixed endpoints, so a fix is usually a small edit there.
- **Groq's upload limit is 25 MB.** Bigger videos skip transcription.

## Files

| File | Role |
|---|---|
| `src/inject.js` | Runs in the Instagram page and copies the responses it receives. |
| `src/extract.js` | Finds Reels and profiles in any response shape. |
| `src/content.js` | Bridges the page and the extension, and reads the data embedded on first load. |
| `src/background.js` | Stores captures and opens the dashboard. |
| `src/analyze.js` | Video download → Groq transcript + frames → Claude analysis. |
| `src/sheets.js` | Builds sheet rows and posts them to the web app. |
| `apps-script/Code.gs` | Google Sheets receiver: upserts rows and blocks formula injection. |
