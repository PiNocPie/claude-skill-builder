// Sends rows to the Apps Script web app in apps-script/Code.gs, which
// upserts them into "Reels" and "Profiles" tabs of your Google Sheet.

const BATCH = 200;

const iso = (unixSec) => (unixSec ? new Date(unixSec * 1000).toISOString() : '');

export function reelRow(reel, profile, analysis) {
  const a = analysis || {};
  return {
    shortcode: reel.code,
    url: `https://www.instagram.com/reel/${reel.code}/`,
    username: reel.username || '',
    posted_at: iso(reel.takenAt),
    views: reel.views ?? '',
    likes: reel.likes ?? '',
    comments: reel.comments ?? '',
    outlier_x: reel.outlier ? Number(reel.outlier.toFixed(2)) : '',
    views_per_follower: profile && profile.followers && reel.views ? Number((reel.views / profile.followers).toFixed(3)) : '',
    duration_sec: reel.duration ? Number(reel.duration.toFixed(1)) : '',
    caption: reel.caption || '',
    spoken_hook: a.spoken_hook || '',
    onscreen_hook: a.onscreen_hook || '',
    visual_hook: a.visual_hook || '',
    hook_type: a.hook_type || '',
    hook_template: a.hook_template || '',
    why_it_works: a.why_it_works || '',
    structure: (a.structure || [])
      .map((s) => `${s.part}${s.start_sec >= 0 ? ` @${s.start_sec}s` : ''}: ${s.summary}`)
      .join('\n'),
    cta: a.cta || '',
    topic: a.topic || '',
    language: a.language || '',
    transcript: a.transcript || '',
    analyzed_at: a.analyzedAt || '',
    captured_at: reel.capturedAt || '',
  };
}

export function profileRow(profile, stats) {
  return {
    username: profile.username,
    url: `https://www.instagram.com/${profile.username}/`,
    full_name: profile.fullName || '',
    followers: profile.followers ?? '',
    following: profile.following ?? '',
    posts: profile.posts ?? '',
    verified: profile.verified ? 'yes' : 'no',
    category: profile.category || '',
    bio: profile.bio || '',
    external_url: profile.externalUrl || '',
    reels_captured: stats ? stats.count : '',
    median_views: stats && stats.median ? Math.round(stats.median) : '',
    updated_at: profile.updatedAt || '',
  };
}

async function postBatch(webhookUrl, secret, body) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    // text/plain is what Apps Script web apps accept without extra setup.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, ...body }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(
      'Google Sheets webhook did not return JSON. Check that the web app is deployed with access "Anyone" and that you pasted the /exec URL.',
    );
  }
  if (!data.ok) throw new Error(`Google Sheets: ${data.error || 'unknown error'}`);
  return data;
}

export async function sendToSheets({ webhookUrl, secret }, reels, profiles) {
  if (!webhookUrl) throw new Error('Add your Google Sheets web app URL in Settings first.');
  let sentReels = 0;
  let sentProfiles = 0;
  if (profiles.length) {
    await postBatch(webhookUrl, secret, { profiles });
    sentProfiles = profiles.length;
  }
  for (let i = 0; i < reels.length; i += BATCH) {
    await postBatch(webhookUrl, secret, { reels: reels.slice(i, i + BATCH) });
    sentReels += Math.min(BATCH, reels.length - i);
  }
  return { sentReels, sentProfiles };
}
