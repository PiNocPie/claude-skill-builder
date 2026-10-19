// Pulls Reels and profiles out of whatever JSON Instagram sends. Instagram
// changes its response shapes often, so instead of hard-coding endpoints we
// walk the whole tree and pick out anything that looks like a video post or a
// user with follower counts. Handles both the newer "v1" field names
// (play_count, video_versions) and the older GraphQL ones (video_view_count).
(function (root) {
  const first = (...vals) => vals.find((v) => v !== undefined && v !== null);

  function parseBodies(text) {
    if (typeof text !== 'string' || !text) return [];
    const clean = text.replace(/^for \(;;\);/, '');
    try {
      return [JSON.parse(clean)];
    } catch (_) {
      // Streamed GraphQL responses are several JSON documents, one per line.
      const out = [];
      for (const line of clean.split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        try {
          out.push(JSON.parse(t));
        } catch (_) {
          // Not JSON, skip.
        }
      }
      return out;
    }
  }

  function pickVideoUrl(versions) {
    if (!Array.isArray(versions) || !versions.length) return null;
    // Smallest version that's still sharp enough to read on-screen text keeps
    // downloads and transcription uploads small.
    const sorted = versions.filter((v) => v && v.url).sort((a, b) => (a.width || 0) - (b.width || 0));
    const good = sorted.find((v) => (v.width || 0) >= 540);
    return (good || sorted[sorted.length - 1] || {}).url || null;
  }

  function toReel(o) {
    const code = first(o.code, o.shortcode);
    if (typeof code !== 'string') return null;
    const isVideo =
      Array.isArray(o.video_versions) || o.media_type === 2 || o.is_video === true || o.product_type === 'clips';
    if (!isVideo) return null;

    const owner = o.user || o.owner || {};
    const takenAt = first(o.taken_at, o.taken_at_timestamp);
    return {
      code,
      username: first(owner.username) || null,
      caption: first(o.caption && o.caption.text, o.edge_media_to_caption?.edges?.[0]?.node?.text) || '',
      views: first(o.play_count, o.ig_play_count, o.video_play_count, o.view_count, o.video_view_count) ?? null,
      likes: first(o.like_count, o.edge_liked_by?.count, o.edge_media_preview_like?.count) ?? null,
      comments: first(o.comment_count, o.edge_media_to_comment?.count) ?? null,
      takenAt: typeof takenAt === 'number' ? takenAt : null,
      duration: first(o.video_duration) ?? null,
      videoUrl: pickVideoUrl(o.video_versions) || first(o.video_url) || null,
      thumbUrl: first(o.image_versions2?.candidates?.[0]?.url, o.display_url, o.thumbnail_src) || null,
    };
  }

  function toProfile(o) {
    if (typeof o.username !== 'string') return null;
    const followers = first(o.follower_count, o.edge_followed_by?.count);
    if (typeof followers !== 'number') return null;
    return {
      username: o.username,
      fullName: first(o.full_name) || '',
      followers,
      following: first(o.following_count, o.edge_follow?.count) ?? null,
      posts: first(o.media_count, o.edge_owner_to_timeline_media?.count) ?? null,
      bio: first(o.biography) || '',
      category: first(o.category_name, o.category) || '',
      verified: !!o.is_verified,
      externalUrl: first(o.external_url) || '',
    };
  }

  // Later sightings of the same item fill in fields the earlier ones lacked.
  function mergeInto(map, key, item) {
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      return;
    }
    for (const [k, v] of Object.entries(item)) {
      if (v !== null && v !== undefined && v !== '') prev[k] = v;
    }
  }

  function extract(docs) {
    const reels = new Map();
    const profiles = new Map();
    const stack = [...docs];
    let guard = 0;
    while (stack.length && guard++ < 500000) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        for (const child of node) stack.push(child);
        continue;
      }
      const reel = toReel(node);
      if (reel) mergeInto(reels, reel.code, reel);
      const profile = toProfile(node);
      if (profile) mergeInto(profiles, profile.username, profile);
      for (const child of Object.values(node)) {
        if (child && typeof child === 'object') stack.push(child);
      }
    }
    return { reels: [...reels.values()], profiles: [...profiles.values()] };
  }

  // Cheap check so we only parse responses that can contain what we want.
  function mightContainData(text) {
    return typeof text === 'string' && /"(code|shortcode|follower_count|edge_followed_by)"/.test(text);
  }

  const api = { parseBodies, extract, mightContainData, toReel, toProfile };
  root.IGRH = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
