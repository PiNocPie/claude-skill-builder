// Google Apps Script web app that receives rows from the IG Reel Hooks
// extension and upserts them into the "Reels" and "Profiles" tabs.
//
// Setup: open your Google Sheet -> Extensions -> Apps Script, paste this file,
// change SECRET, then Deploy -> New deployment -> Web app
// (Execute as: Me, Who has access: Anyone). Paste the /exec URL and the same
// SECRET into the extension's Settings.

const SECRET = 'change-me';

const REEL_HEADERS = [
  'shortcode', 'url', 'username', 'posted_at', 'views', 'likes', 'comments',
  'outlier_x', 'views_per_follower', 'duration_sec', 'caption',
  'spoken_hook', 'onscreen_hook', 'visual_hook', 'hook_type', 'hook_template',
  'why_it_works', 'structure', 'cta', 'topic', 'language', 'transcript',
  'analyzed_at', 'captured_at',
];

const PROFILE_HEADERS = [
  'username', 'url', 'full_name', 'followers', 'following', 'posts', 'verified',
  'category', 'bio', 'external_url', 'reels_captured', 'median_views', 'updated_at',
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json_({ ok: false, error: 'Wrong secret.' });

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const reels = upsert_(ss, 'Reels', REEL_HEADERS, 'shortcode', body.reels || []);
      const profiles = upsert_(ss, 'Profiles', PROFILE_HEADERS, 'username', body.profiles || []);
      return json_({ ok: true, reels: reels, profiles: profiles });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function upsert_(ss, name, headers, key, rows) {
  if (!rows.length) return 0;
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }

  const keyCol = headers.indexOf(key) + 1;
  const lastRow = sheet.getLastRow();
  const existing = lastRow > 1 ? sheet.getRange(2, keyCol, lastRow - 1, 1).getValues() : [];
  const rowByKey = {};
  existing.forEach(function (r, i) { rowByKey[String(r[0])] = i + 2; });

  const toAppend = [];
  rows.forEach(function (row) {
    const values = headers.map(function (h) { return safe_(row[h]); });
    const at = rowByKey[String(row[key])];
    if (at) {
      sheet.getRange(at, 1, 1, headers.length).setValues([values]);
    } else {
      toAppend.push(values);
    }
  });
  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
  }
  return rows.length;
}

// Captions starting with = + - @ would otherwise be run as formulas.
function safe_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
