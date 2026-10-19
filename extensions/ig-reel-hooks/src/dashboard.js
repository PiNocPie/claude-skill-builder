import { analyzeReel } from './analyze.js';
import { reelRow, profileRow, sendToSheets } from './sheets.js';

const $ = (id) => document.getElementById(id);
const CONCURRENCY = 2;

// `analyses` lives in its own storage key so the background worker (which
// writes `reels`) and this page never overwrite each other's data.
let state = { reels: {}, profiles: {}, analyses: {}, settings: {} };
const selected = new Set();
const expanded = new Set();
const runStatus = {}; // code -> { kind: 'busy'|'ok'|'err', text }
let busy = false;

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—');
const date = (sec) => (sec ? new Date(sec * 1000).toISOString().slice(0, 10) : '—');

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Outlier × = this Reel's views / the creator's median views, computed over
// the Reels captured so far. More scrolling = a more reliable baseline.
function creatorStats() {
  const byUser = {};
  for (const r of Object.values(state.reels)) {
    const u = r.username || '(unknown)';
    (byUser[u] ||= []).push(r);
  }
  const stats = {};
  for (const [u, list] of Object.entries(byUser)) {
    const views = list.map((r) => r.views).filter((v) => typeof v === 'number');
    stats[u] = { count: list.length, median: median(views) };
  }
  return stats;
}

function enrichedReels() {
  const stats = creatorStats();
  return Object.values(state.reels).map((r) => {
    const s = stats[r.username || '(unknown)'];
    const outlier = s && s.median > 0 && typeof r.views === 'number' ? r.views / s.median : null;
    return { ...r, outlier, sample: s ? s.count : 0 };
  });
}

function visibleReels() {
  const user = $('filter-user').value;
  const minOutlier = Number($('filter-outlier').value) || 0;
  const sort = $('sort').value;
  let list = enrichedReels();
  if (user) list = list.filter((r) => (r.username || '(unknown)') === user);
  if (minOutlier > 0) list = list.filter((r) => (r.outlier || 0) >= minOutlier);
  const key = {
    outlier: (r) => r.outlier || 0,
    views: (r) => r.views || 0,
    date: (r) => r.takenAt || 0,
  }[sort];
  return list.sort((a, b) => key(b) - key(a));
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v !== undefined) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

function renderUserFilter() {
  const select = $('filter-user');
  const current = select.value;
  const stats = creatorStats();
  select.replaceChildren(el('option', { value: '' }, `All creators (${Object.keys(state.reels).length})`));
  for (const u of Object.keys(stats).sort()) {
    const p = state.profiles[u];
    const label = `@${u} · ${stats[u].count} reels${p ? ` · ${fmt(p.followers)} followers` : ''}`;
    select.append(el('option', { value: u }, label));
  }
  select.value = stats[current] ? current : '';
}

function hookPreview(a) {
  if (!a) return el('span', { class: 'dim' }, 'not analyzed');
  const text = a.onscreen_hook || a.spoken_hook || a.visual_hook || '';
  return el('span', {}, el('strong', {}, `[${a.hook_type}] `), text);
}

function statusCell(code, a) {
  const s = runStatus[code];
  if (s) return el('span', { class: s.kind === 'err' ? 'err' : s.kind === 'ok' ? 'ok' : 'dim' }, s.text);
  if (a) return el('span', { class: 'ok' }, 'analyzed');
  return el('span', { class: 'dim' }, '—');
}

function detailRow(r, a) {
  const items = [
    ['Caption', r.caption || '—'],
    ['Spoken hook', a?.spoken_hook || '—'],
    ['On-screen hook', a?.onscreen_hook || '—'],
    ['Visual hook', a?.visual_hook || '—'],
    ['Hook template', a?.hook_template || '—'],
    ['Why it works', a?.why_it_works || '—'],
    [
      'Structure',
      a?.structure?.length
        ? a.structure.map((s) => `${s.part}${s.start_sec >= 0 ? ` @${s.start_sec}s` : ''}: ${s.summary}`).join('\n')
        : '—',
    ],
    ['CTA', a?.cta || '—'],
    ['Transcript', a?.transcript || a?.transcriptNote || '—'],
  ];
  const dl = el('dl', { class: 'detail-grid' });
  for (const [k, v] of items) dl.append(el('dt', {}, k), el('dd', {}, v));
  return el('tr', { class: 'detail' }, el('td', { colspan: '10' }, dl));
}

function render() {
  renderUserFilter();
  const list = visibleReels();
  const tbody = $('rows');
  tbody.replaceChildren();
  $('empty').hidden = Object.keys(state.reels).length > 0;

  for (const r of list) {
    const a = state.analyses[r.code];
    const checkbox = el('input', {
      type: 'checkbox',
      'aria-label': `Select ${r.code}`,
      onclick: (e) => e.stopPropagation(),
      onchange: (e) => {
        if (e.target.checked) selected.add(r.code);
        else selected.delete(r.code);
        updateButtons();
      },
    });
    checkbox.checked = selected.has(r.code);
    const outlierText = r.outlier ? `${r.outlier.toFixed(1)}×` : '—';
    const row = el(
      'tr',
      {
        class: 'main',
        onclick: () => {
          if (expanded.has(r.code)) expanded.delete(r.code);
          else expanded.add(r.code);
          render();
        },
      },
      el('td', {}, checkbox),
      el('td', {}, `@${r.username || 'unknown'}`),
      el('td', { class: 'date' }, date(r.takenAt)),
      el('td', { class: 'num' }, fmt(r.views)),
      el('td', { class: 'num' }, fmt(r.likes)),
      el('td', { class: 'num' }, fmt(r.comments)),
      el('td', { class: `num${r.sample < 5 ? ' dim' : ''}`, title: `Based on ${r.sample} captured reels` }, outlierText),
      el('td', { class: 'hook' }, hookPreview(a)),
      el('td', {}, statusCell(r.code, a)),
      el(
        'td',
        {},
        el(
          'a',
          { href: `https://www.instagram.com/reel/${r.code}/`, target: '_blank', rel: 'noopener', onclick: (e) => e.stopPropagation() },
          'open',
        ),
      ),
    );
    tbody.append(row);
    if (expanded.has(r.code)) tbody.append(detailRow(r, a));
  }

  const analyzed = Object.keys(state.analyses).length;
  $('summary').textContent = `${Object.keys(state.reels).length} reels · ${Object.keys(state.profiles).length} profiles · ${analyzed} analyzed`;
  $('select-all').checked = list.length > 0 && list.every((r) => selected.has(r.code));
  updateButtons();
}

function updateButtons() {
  $('analyze').disabled = busy || selected.size === 0;
  $('analyze').textContent = selected.size ? `Analyze selected (${selected.size})` : 'Analyze selected';
  $('send').disabled = busy;
  $('clear').disabled = busy;
}

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = kind || 'muted';
}

async function load() {
  const data = await chrome.storage.local.get(['reels', 'profiles', 'analyses', 'settings']);
  state = {
    reels: data.reels || {},
    profiles: data.profiles || {},
    analyses: data.analyses || {},
    settings: data.settings || {},
  };
  for (const code of [...selected]) if (!state.reels[code]) selected.delete(code);
}

function fillSettingsForm() {
  const form = $('settings');
  for (const [k, v] of Object.entries(state.settings)) {
    if (form.elements[k]) form.elements[k].value = v;
  }
  if (!state.settings.anthropicKey) $('settings-panel').open = true;
}

function buildRows(reels) {
  const stats = creatorStats();
  const reelRows = reels.map((r) => reelRow(r, state.profiles[r.username], state.analyses[r.code]));
  const users = new Set(reels.map((r) => r.username).filter(Boolean));
  const profileRows = [...users]
    .filter((u) => state.profiles[u])
    .map((u) => profileRow(state.profiles[u], stats[u]));
  return { reelRows, profileRows };
}

// Two workers finish at different times; chain the read-modify-write so one
// save can't drop the other's result.
let saveChain = Promise.resolve();
function saveAnalysis(code, analysis) {
  saveChain = saveChain.catch(() => {}).then(async () => {
    const { analyses = {} } = await chrome.storage.local.get('analyses');
    analyses[code] = analysis;
    await chrome.storage.local.set({ analyses });
    state.analyses = analyses;
  });
  return saveChain;
}

async function analyzeSelected() {
  const all = enrichedReels();
  const queue = all.filter((r) => selected.has(r.code));
  if (!queue.length) return;
  busy = true;
  updateButtons();
  const settings = state.settings;
  let done = 0;
  let failed = 0;
  const finished = [];

  for (const r of queue) runStatus[r.code] = { kind: 'busy', text: 'queued' };
  render();

  async function worker() {
    while (queue.length) {
      const r = queue.shift();
      runStatus[r.code] = { kind: 'busy', text: 'analyzing…' };
      render();
      try {
        const analysis = await analyzeReel(r, state.profiles[r.username], settings);
        await saveAnalysis(r.code, analysis);
        runStatus[r.code] = { kind: 'ok', text: 'analyzed' };
        finished.push(r);
      } catch (err) {
        failed++;
        runStatus[r.code] = { kind: 'err', text: err.message };
      }
      done++;
      setStatus(`Analyzed ${done - failed}/${done} so far…`);
      render();
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  let msg = `Done: ${done - failed} analyzed${failed ? `, ${failed} failed (see Status column)` : ''}.`;
  if (finished.length && settings.webhookUrl) {
    try {
      const { reelRows, profileRows } = buildRows(finished);
      await sendToSheets(settings, reelRows, profileRows);
      msg += ` Sent ${reelRows.length} rows to Google Sheets.`;
    } catch (err) {
      msg += ` Sheets upload failed: ${err.message}`;
    }
  }
  busy = false;
  setStatus(msg, failed ? 'err' : 'ok');
  render();
}

async function sendVisible() {
  const list = visibleReels();
  if (!list.length) return setStatus('Nothing to send.');
  busy = true;
  updateButtons();
  setStatus(`Sending ${list.length} reels to Google Sheets…`);
  try {
    const { reelRows, profileRows } = buildRows(list);
    const res = await sendToSheets(state.settings, reelRows, profileRows);
    setStatus(`Sent ${res.sentReels} reels and ${res.sentProfiles} profiles to Google Sheets.`, 'ok');
  } catch (err) {
    setStatus(err.message, 'err');
  }
  busy = false;
  updateButtons();
}

$('settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const settings = Object.fromEntries(new FormData(e.target).entries());
  for (const k of Object.keys(settings)) settings[k] = settings[k].trim();
  await chrome.storage.local.set({ settings });
  state.settings = settings;
  $('settings-status').textContent = 'Saved.';
  setTimeout(() => ($('settings-status').textContent = ''), 2000);
});

$('select-all').addEventListener('change', (e) => {
  for (const r of visibleReels()) {
    if (e.target.checked) selected.add(r.code);
    else selected.delete(r.code);
  }
  render();
});

$('select-visible').addEventListener('click', () => {
  for (const r of visibleReels()) selected.add(r.code);
  render();
});

$('analyze').addEventListener('click', analyzeSelected);
$('send').addEventListener('click', sendVisible);

$('clear').addEventListener('click', async () => {
  if (!confirm('Delete all captured reels, profiles and analyses from this browser? Your settings are kept.')) return;
  await chrome.storage.local.remove(['reels', 'profiles', 'analyses']);
  await chrome.action.setBadgeText({ text: '' });
  selected.clear();
  setStatus('Cleared.');
});

for (const id of ['filter-user', 'filter-outlier', 'sort']) $(id).addEventListener('input', render);

// Re-render as new Reels arrive from an open Instagram tab.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.reels || changes.profiles || changes.analyses) {
    await load();
    render();
  }
});

await load();
fillSettingsForm();
render();
