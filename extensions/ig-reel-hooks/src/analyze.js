// Per-Reel analysis: download video -> Groq Whisper transcript + opening
// frames -> Claude hook/script breakdown. Runs in the dashboard page, which
// has a DOM for decoding video frames.

const FRAME_TIMES = [0.3, 1.2, 2.5];
const GROQ_MAX_BYTES = 25 * 1024 * 1024;

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'spoken_hook',
    'onscreen_hook',
    'visual_hook',
    'hook_type',
    'hook_template',
    'why_it_works',
    'structure',
    'cta',
    'topic',
    'language',
  ],
  properties: {
    spoken_hook: {
      type: 'string',
      description: 'Words spoken in roughly the first 3 seconds, copied exactly from the transcript. Empty string if nothing is spoken.',
    },
    onscreen_hook: {
      type: 'string',
      description: 'Text overlay visible in the opening frames, copied exactly. Empty string if there is none.',
    },
    visual_hook: { type: 'string', description: 'One sentence on what the opening shot shows or does.' },
    hook_type: {
      type: 'string',
      enum: [
        'question',
        'bold_claim',
        'contrarian',
        'negative_warning',
        'result_first',
        'curiosity_gap',
        'listicle',
        'story_open',
        'pain_point',
        'how_to',
        'social_proof',
        'other',
      ],
    },
    hook_template: {
      type: 'string',
      description: 'Reusable fill-in-the-blank version of the hook, e.g. "Stop doing [X] if you want [Y]".',
    },
    why_it_works: { type: 'string', description: 'One or two sentences.' },
    structure: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['part', 'start_sec', 'summary'],
        properties: {
          part: { type: 'string', enum: ['hook', 'setup', 'value', 'proof', 'payoff', 'cta', 'other'] },
          start_sec: { type: 'number', description: 'Start time in seconds from the transcript; -1 if unknown.' },
          summary: { type: 'string' },
        },
      },
    },
    cta: { type: 'string', description: 'The call to action, or empty string if there is none.' },
    topic: { type: 'string', description: 'A few words on what the Reel is about.' },
    language: { type: 'string', description: 'Main spoken/written language of the Reel.' },
  },
};

function systemPrompt(outputLang) {
  return [
    'You analyze short-form videos (Instagram Reels) to explain their hooks and script structure.',
    'Use only what is given: the transcript, the opening frames, the caption and the stats.',
    'Quote hooks exactly as spoken or shown, in their original language. Never invent words that are not in the transcript or visible in the frames; leave a field empty when the input does not contain it.',
    'If there is no transcript, base the analysis on the frames and caption and leave spoken_hook empty.',
    'If there are no frames, leave onscreen_hook empty and describe visual_hook as unknown.',
    `Write explanations (visual_hook, hook_template, why_it_works, structure summaries, topic) in ${outputLang}.`,
  ].join('\n');
}

async function fetchVideo(url) {
  if (!url) throw new Error('No video URL captured for this Reel.');
  const res = await fetch(url);
  if (res.status === 403 || res.status === 410) {
    throw new Error('Video link expired. Scroll past this Reel on Instagram again to refresh it.');
  }
  if (!res.ok) throw new Error(`Video download failed (HTTP ${res.status}).`);
  return res.blob();
}

async function transcribe(blob, groqKey) {
  if (!groqKey) return { text: '', segments: [], note: 'No Groq key set; skipped transcription.' };
  if (blob.size > GROQ_MAX_BYTES) return { text: '', segments: [], note: 'Video over 25 MB; skipped transcription.' };

  const form = new FormData();
  form.append('file', blob, 'reel.mp4');
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'verbose_json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // e.g. a Reel with no audio track: carry on with frames only rather than
    // failing the whole Reel.
    return { text: '', segments: [], note: `Transcription failed (HTTP ${res.status}) ${detail.slice(0, 200)}` };
  }
  const data = await res.json();
  return {
    text: (data.text || '').trim(),
    segments: (data.segments || []).map((s) => ({ start: s.start, end: s.end, text: (s.text || '').trim() })),
    note: '',
  };
}

function waitFor(el, event, ms = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for video ${event}.`)), ms);
    el.addEventListener(
      event,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    el.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new Error('Could not decode the video.'));
      },
      { once: true },
    );
  });
}

async function grabFrames(blob, times = FRAME_TIMES) {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await waitFor(video, 'loadeddata');
    const scale = Math.min(1, 720 / (video.videoWidth || 720));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((video.videoWidth || 720) * scale);
    canvas.height = Math.round((video.videoHeight || 1280) * scale);
    const ctx = canvas.getContext('2d');
    const frames = [];
    for (const t of times) {
      const target = Math.min(t, Math.max(0, (video.duration || t) - 0.05));
      const seeked = waitFor(video, 'seeked');
      video.currentTime = target;
      await seeked;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ time: Math.round(target * 10) / 10, data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1] });
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function formatTranscript(t) {
  if (!t.segments.length) return t.text || '(no transcript)';
  return t.segments.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}s] ${s.text}`).join('\n');
}

async function analyzeWithClaude({ reel, profile, transcript, frames }, settings) {
  const content = [];
  for (const f of frames) {
    content.push({ type: 'text', text: `Frame at ${f.time}s:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } });
  }
  const stats = [
    `Creator: @${reel.username || 'unknown'}${profile ? ` (${profile.followers} followers)` : ''}`,
    `Views: ${reel.views ?? 'unknown'}, likes: ${reel.likes ?? 'unknown'}, comments: ${reel.comments ?? 'unknown'}`,
    reel.outlier ? `Views vs this creator's median: ${reel.outlier.toFixed(1)}x` : '',
    `Duration: ${reel.duration ? `${reel.duration.toFixed(1)}s` : 'unknown'}`,
  ]
    .filter(Boolean)
    .join('\n');
  content.push({
    type: 'text',
    text: `${stats}\n\nCaption:\n${reel.caption || '(none)'}\n\nTranscript with timestamps:\n${formatTranscript(transcript)}`,
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model || 'claude-sonnet-5-5',
      max_tokens: 16000,
      // Re-runs on Anthropic's recommended model if a safety classifier declines.
      fallbacks: 'default',
      system: systemPrompt(settings.outputLang || 'English'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ANALYSIS_SCHEMA } },
      messages: [{ role: 'user', content }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || `HTTP ${res.status}`;
    throw new Error(`Claude API error: ${msg}`);
  }
  if (data.stop_reason === 'refusal') throw new Error('Claude declined to analyze this Reel.');
  if (data.stop_reason === 'max_tokens') throw new Error('Claude response was cut off (max_tokens).');
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude returned no text.');
  return JSON.parse(textBlock.text);
}

export async function analyzeReel(reel, profile, settings) {
  if (!settings.anthropicKey) throw new Error('Add your Anthropic API key in Settings first.');
  const blob = await fetchVideo(reel.videoUrl);
  let framesNote = '';
  const [transcript, frames] = await Promise.all([
    transcribe(blob, settings.groqKey),
    grabFrames(blob).catch((err) => {
      // Still worth analyzing from the transcript and caption alone.
      framesNote = `No frames: ${err.message}`;
      return [];
    }),
  ]);
  const analysis = await analyzeWithClaude({ reel, profile, transcript, frames }, settings);
  return {
    ...analysis,
    transcript: transcript.text,
    transcriptNote: [transcript.note, framesNote].filter(Boolean).join(' '),
    analyzedAt: new Date().toISOString(),
  };
}
