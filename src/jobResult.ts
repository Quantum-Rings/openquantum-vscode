// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import { EXPLORER_SOURCE } from './jobExplorer';

export type ResultsKind = 'loading' | 'counts' | 'other' | 'none' | 'error';

/** What the editor tab shows for one job. Counts drive the results explorer. */
export interface JobResultModel {
    id: string;
    name: string;
    status: string;
    providerName: string;
    backendName: string;
    backendId: string | null;
    submittedAt: string | null;
    completedAt: string | null;
    creditsUsed: number | null;
    executionPlanName: string | null;
    message: string | null;
    resultsKind: ResultsKind;
    counts: Record<string, number> | null;
    canDownload: boolean;
}

/** Editor tab matching the website job details page. */
export function jobResultHtml(
    nonce: string,
    model: JobResultModel,
    generation: number,
): string {
    const payload = jsonForScript(model);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Job</title>
<style nonce="${nonce}">
  body { margin: 0; padding: 28px 32px 48px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); font-size: 13px; line-height: 1.45; }
  main { max-width: 1080px; margin: 0 auto; }
  button, textarea, input { font: inherit; color: inherit; }
  [hidden] { display: none !important; }
  button { cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  .back { display: inline-flex; align-items: center; gap: 4px; margin: 0 0 14px; padding: 0; border: none; background: transparent; color: #4f5456; font-size: 13px; font-weight: 650; }
  body.vscode-dark .back { color: #95ad9f; }
  .back:hover { color: #50bc83; }
  .title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 0 0 18px; }
  h1 { margin: 0; font-size: 32px; font-weight: 700; line-height: 1.15; }
  .status { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 650; text-transform: capitalize; }
  .status.ok { background: #dcfce7; color: #15803d; }
  .status.bad { background: #fee2e2; color: #b91c1c; }
  .status.run { background: #dbeafe; color: #1d4ed8; }
  .status.warn { background: #fef3c7; color: #b45309; }
  .status.idle { background: rgba(79, 84, 86, 0.15); color: #4f5456; }
  body.vscode-dark .status.ok { background: rgba(20, 83, 45, 0.2); color: #86efac; }
  body.vscode-dark .status.bad { background: rgba(127, 29, 29, 0.2); color: #fca5a5; }
  body.vscode-dark .status.run { background: rgba(30, 58, 138, 0.2); color: #93c5fd; }
  body.vscode-dark .status.warn { background: rgba(120, 53, 15, 0.2); color: #fcd34d; }
  body.vscode-dark .status.idle { background: rgba(149, 173, 159, 0.15); color: #95ad9f; }
  .card, .panel { border: 1px solid color-mix(in srgb, #95ad9f 20%, transparent); border-radius: 16px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
  .card { padding: 18px 20px; margin: 0 0 22px; }
  .facts { display: flex; flex-wrap: wrap; gap: 18px 32px; }
  .fact[hidden] { display: none; }
  .fact .label { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: #4f5456; }
  body.vscode-dark .fact .label { color: #95ad9f; }
  .fact .value { margin-top: 3px; font-size: 14px; font-weight: 650; }
  .fact .value.mono { font-family: var(--vscode-editor-font-family); font-size: 12px; font-weight: 500; word-break: break-all; }
  button.link { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: none; background: transparent; color: #50bc83; font-weight: 650; }
  button.link:hover { text-decoration: underline; }
  .message { margin: 14px 0 0; color: #4f5456; }
  body.vscode-dark .message { color: #95ad9f; }
  .card-actions { margin-top: 16px; padding-top: 14px; border-top: 1px solid color-mix(in srgb, #95ad9f 15%, transparent); }
  button.ghost, button.toggle, button.mode { border: 1px solid color-mix(in srgb, #95ad9f 28%, transparent); background: transparent; color: #4f5456; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 650; }
  body.vscode-dark button.ghost, body.vscode-dark button.toggle, body.vscode-dark button.mode { color: #95ad9f; }
  button.ghost, button.mode { display: inline-flex; align-items: center; gap: 6px; }
  button.ghost svg, button.mode svg { display: block; flex: none; }
  button.ghost:hover:not(:disabled), button.toggle:hover:not(:disabled), button.mode:hover:not(.on) { background: rgba(80, 188, 131, 0.1); }
  button.mode.on, button.toggle.on, body.vscode-dark button.mode.on, body.vscode-dark button.toggle.on { background: #50bc83; color: #ffffff; border-color: #50bc83; }
  .note { margin: 0; padding: 18px 20px; }
  .layout { display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); gap: 22px; align-items: start; }
  @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
  .stack { display: flex; flex-direction: column; gap: 16px; }
  .panel { padding: 16px 18px; }
  .panel h2 { margin: 0 0 8px; font-size: 14px; font-weight: 650; }
  textarea, input { width: 100%; box-sizing: border-box; border-radius: 8px; border: 1px solid color-mix(in srgb, #95ad9f 28%, transparent); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
  textarea { min-height: 160px; resize: vertical; padding: 10px; font-family: var(--vscode-editor-font-family); font-size: 12px; }
  .parse-error { display: flex; gap: 6px; margin: 8px 0 0; color: var(--vscode-errorForeground); font-size: 12px; }
  .control-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0 0; }
  .control-row span.k { color: #4f5456; font-size: 12px; }
  body.vscode-dark .control-row span.k { color: #95ad9f; }
  .group { display: inline-flex; overflow: hidden; border-radius: 8px; border: 1px solid color-mix(in srgb, #95ad9f 28%, transparent); }
  .group button { border: none; border-radius: 0; }
  .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
  label.field { display: block; }
  label.field span { display: block; margin: 0 0 4px; font-size: 11px; color: #4f5456; }
  body.vscode-dark label.field span { color: #95ad9f; }
  input { padding: 6px 8px; font-family: var(--vscode-editor-font-family); font-size: 12px; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 720px) { .stats { grid-template-columns: 1fr 1fr; } }
  .stat { padding: 12px 14px; }
  .stat .label { font-size: 11px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: #4f5456; }
  body.vscode-dark .stat .label { color: #95ad9f; }
  .stat strong { display: block; margin-top: 2px; font-family: var(--vscode-editor-font-family); font-size: 18px; font-weight: 650; word-break: break-all; }
  .stat em { display: block; margin-top: 2px; font-style: normal; color: #50bc83; font-size: 12px; }
  .viewbar { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; }
  .viewbar .modes, .viewbar .exports { display: flex; gap: 8px; flex-wrap: wrap; }
  .chart-wrap { overflow-x: auto; min-height: 280px; }
  svg.chart { display: block; min-width: 100%; }
  svg.chart .grid { stroke: color-mix(in srgb, #4f5456 22%, transparent); stroke-dasharray: 3 3; }
  svg.chart .bar { fill: #2fb380; }
  svg.chart text { fill: var(--vscode-foreground); font-size: 11px; }
  svg.chart .tick { font-family: var(--vscode-editor-font-family); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 12px; font-weight: 650; color: #4f5456; padding: 6px 12px 6px 0; }
  body.vscode-dark th { color: #95ad9f; }
  td { padding: 6px 12px 6px 0; border-top: 1px solid color-mix(in srgb, #95ad9f 16%, transparent); font-family: var(--vscode-editor-font-family); }
  td.dim { color: #4f5456; }
  body.vscode-dark td.dim { color: #95ad9f; }
  .empty { min-height: 220px; display: flex; align-items: center; justify-content: center; text-align: center; color: #4f5456; padding: 12px; }
  body.vscode-dark .empty { color: #95ad9f; }
  #tip { position: fixed; z-index: 5; pointer-events: none; padding: 4px 8px; border-radius: 6px; background: var(--vscode-editorHoverWidget-background, #1e1e1e); color: var(--vscode-editorHoverWidget-foreground, #fdfcfc); border: 1px solid var(--vscode-editorHoverWidget-border, rgba(149, 173, 159, 0.35)); font-size: 12px; font-family: var(--vscode-editor-font-family); }
</style>
</head>
<body>
<main>
  <button id="all-jobs" class="back" type="button">${iconChevron()}All jobs</button>
  <div class="title-row">
    <h1 id="job-name">Job</h1>
    <span id="job-status" class="status"></span>
  </div>
  <section class="card">
    <div class="facts">
      <div class="fact" data-fact="backend"><div class="label">${iconCpu()}Backend</div><div class="value" id="backend"></div></div>
      <div class="fact" data-fact="provider"><div class="label">Provider</div><div class="value" id="provider"></div></div>
      <div class="fact" data-fact="tier"><div class="label">Tier</div><div class="value" id="tier"></div></div>
      <div class="fact" data-fact="credits"><div class="label">Credits used</div><div class="value" id="credits"></div></div>
      <div class="fact" data-fact="submitted"><div class="label">${iconClock()}Submitted</div><div class="value" id="submitted"></div></div>
      <div class="fact" data-fact="completed"><div class="label">Completed</div><div class="value" id="completed"></div></div>
      <div class="fact" data-fact="id"><div class="label">Job ID</div><div class="value mono" id="job-id"></div></div>
    </div>
    <p id="job-message" class="message" hidden></p>
    <div id="card-actions" class="card-actions" hidden>
      <button id="download-results" class="ghost" type="button">${iconDownload()}Download results</button>
    </div>
  </section>
  <p id="results-note" class="note card" hidden></p>
  <div id="explorer" class="layout" hidden>
    <div class="stack">
      <section class="panel">
        <h2>Counts</h2>
        <textarea id="counts" spellcheck="false"></textarea>
        <p id="parse-error" class="parse-error" hidden></p>
      </section>
      <section class="panel">
        <h2>View</h2>
        <div class="control-row">
          <div class="group" data-key="valueMode">
            <button type="button" class="toggle on" data-value="counts">Counts</button>
            <button type="button" class="toggle" data-value="probabilities">Probabilities</button>
          </div>
        </div>
        <div class="control-row">
          <span class="k">Sort</span>
          <div class="group" data-key="sortKey">
            <button type="button" class="toggle on" data-value="value">By value</button>
            <button type="button" class="toggle" data-value="state">By state</button>
          </div>
          <div class="group" data-key="sortDir">
            <button type="button" class="toggle on" data-value="desc">Desc</button>
            <button type="button" class="toggle" data-value="asc">Asc</button>
          </div>
        </div>
        <div class="control-row">
          <span class="k">Group</span>
          <div class="group" data-key="groupMode">
            <button type="button" class="toggle on" data-value="none">None</button>
            <button type="button" class="toggle" data-value="hamming">Hamming weight</button>
          </div>
        </div>
        <div class="control-row">
          <span class="k" title="Flip the endianness of every bitstring. Use this if your SDK reads qubit 0 from the opposite end.">Bit order</span>
          <div class="group" data-key="bitOrder">
            <button type="button" class="toggle on" data-value="as-measured">As measured</button>
            <button type="button" class="toggle" data-value="reversed">Reversed</button>
          </div>
        </div>
        <div class="filters">
          <label class="field"><span>State filter (1_0)</span><input id="pattern" placeholder="e.g. 1_0" /></label>
          <label class="field"><span>Search</span><input id="search" placeholder="substring" /></label>
          <label class="field"><span>Min count</span><input id="min-count" placeholder="0" /></label>
          <label class="field"><span>Top N</span><input id="top-n" placeholder="all" /></label>
        </div>
      </section>
    </div>
    <div class="stack">
      <div id="stats" class="stats"></div>
      <section class="panel">
        <div class="viewbar">
          <div class="modes">
            <button id="show-chart" class="mode on" type="button">${iconChart()}Chart</button>
            <button id="show-table" class="mode" type="button">${iconTable()}Table</button>
          </div>
          <div class="exports">
            <button id="save-json" class="ghost" type="button">${iconDownload()}JSON</button>
            <button id="save-ipynb" class="ghost" type="button">${iconNotebook()}.ipynb</button>
          </div>
        </div>
        <div id="chart" class="chart-wrap"></div>
        <div id="table-wrap" hidden></div>
      </section>
    </div>
  </div>
</main>
<div id="tip" hidden></div>
<script nonce="${nonce}">
${EXPLORER_SOURCE}
const vscodeApi = acquireVsCodeApi();
const generation = ${String(generation)};
let model = ${payload};
let dirty = false;
let viewMode = 'chart';
const controls = {
  valueMode: 'counts',
  sortKey: 'value',
  sortDir: 'desc',
  groupMode: 'none',
  bitOrder: 'as-measured',
  pattern: '',
  search: '',
  minCount: '',
  topN: '',
};

function statusClass(status) {
  var name = String(status || '').toLowerCase();
  if (name === 'completed') return 'ok';
  if (name === 'failed') return 'bad';
  if (name === 'running') return 'run';
  if (name === 'canceled' || name === 'cancelled') return 'idle';
  return 'warn';
}

function formatWhen(value) {
  if (!value) return '-';
  var date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function setText(id, text) {
  var node = document.getElementById(id);
  if (node) node.textContent = text;
}

function showFact(name, visible) {
  var node = document.querySelector('[data-fact="' + name + '"]');
  if (node) node.hidden = !visible;
}

function renderHeader() {
  document.title = model.name || 'Job';
  setText('job-name', model.name || 'Untitled job');
  var chip = document.getElementById('job-status');
  chip.textContent = model.status || 'Unknown';
  chip.className = 'status ' + statusClass(model.status);
  var backend = document.getElementById('backend');
  backend.replaceChildren();
  if (model.backendId && model.backendName) {
    var link = document.createElement('button');
    link.type = 'button';
    link.className = 'link';
    link.textContent = model.backendName;
    link.appendChild(iconNode());
    link.addEventListener('click', function () {
      vscodeApi.postMessage({ command: 'openBackend', backendId: model.backendId });
    });
    backend.appendChild(link);
  } else {
    backend.textContent = model.backendName || '-';
  }
  setText('provider', model.providerName || '');
  showFact('provider', !!model.providerName);
  setText('tier', model.executionPlanName || '');
  showFact('tier', !!model.executionPlanName);
  setText('credits', model.creditsUsed == null ? '' : String(model.creditsUsed));
  showFact('credits', typeof model.creditsUsed === 'number');
  setText('submitted', formatWhen(model.submittedAt));
  setText('completed', formatWhen(model.completedAt));
  showFact('completed', !!model.completedAt);
  setText('job-id', model.id || '');
  var message = document.getElementById('job-message');
  message.hidden = !model.message;
  message.textContent = model.message || '';
  var download = document.getElementById('download-results');
  download.hidden = !model.canDownload;
  document.getElementById('card-actions').hidden = !model.canDownload;
}

function resultsCopy(kind) {
  if (kind === 'loading') return 'Loading results…';
  if (kind === 'error') return "We couldn't read the results for this job. You can still download the raw file above.";
  if (kind === 'other') return "These results aren't a measurement-counts histogram, so the explorer doesn't apply. Download the raw results above to work with them.";
  if (kind === 'none') return "Results aren't available for this job yet.";
  return '';
}

function readControls() {
  controls.pattern = document.getElementById('pattern').value;
  controls.search = document.getElementById('search').value;
  controls.minCount = document.getElementById('min-count').value;
  controls.topN = document.getElementById('top-n').value;
  document.getElementById('pattern').disabled = controls.groupMode !== 'none';
}

function activeCounts() {
  if (dirty || model.resultsKind !== 'counts') {
    return parseCounts(document.getElementById('counts').value);
  }
  return { counts: model.counts, error: null };
}

function renderExplorer() {
  var note = document.getElementById('results-note');
  var explorer = document.getElementById('explorer');
  var showExplorer = model.resultsKind === 'counts' || dirty;
  note.hidden = showExplorer;
  note.textContent = resultsCopy(model.resultsKind);
  explorer.hidden = !showExplorer;
  if (!showExplorer) return;
  var area = document.getElementById('counts');
  if (!dirty && document.activeElement !== area) {
    area.value = model.counts ? JSON.stringify(model.counts, null, 2) : '';
  }
  readControls();
  var parsed = activeCounts();
  var error = document.getElementById('parse-error');
  error.hidden = !parsed.error;
  error.textContent = parsed.error || '';
  var ordered = parsed.counts ? applyBitOrder(parsed.counts, controls.bitOrder) : null;
  var stats = ordered ? explorerStats(ordered) : null;
  renderStats(stats);
  var rows = ordered ? buildRows(ordered, controls) : [];
  var chart = document.getElementById('chart');
  var table = document.getElementById('table-wrap');
  chart.hidden = viewMode !== 'chart';
  table.hidden = viewMode !== 'table';
  if (viewMode === 'chart') renderChart(chart, rows, ordered);
  else renderTable(table, rows, stats);
  var blocked = !ordered;
  document.getElementById('save-json').disabled = blocked;
  document.getElementById('save-ipynb').disabled = blocked;
  chart.dataset.exportCounts = ordered ? JSON.stringify(ordered) : '';
}

function renderStats(stats) {
  var root = document.getElementById('stats');
  root.replaceChildren();
  if (!stats) return;
  var most = stats.topState || '-';
  var sub = stats.shots ? ((stats.topCount / stats.shots) * 100).toFixed(1) + '%' : '';
  var items = [
    ['Shots', stats.shots.toLocaleString('en-US'), ''],
    ['Unique states', String(stats.unique), ''],
    ['Most likely', most, sub],
    ['Entropy', stats.entropy.toFixed(2) + ' bits', ''],
  ];
  for (var i = 0; i < items.length; i++) {
    var card = document.createElement('div');
    card.className = 'stat panel';
    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = items[i][0];
    var value = document.createElement('strong');
    value.textContent = items[i][1];
    card.append(label, value);
    if (items[i][2]) {
      var extra = document.createElement('em');
      extra.textContent = items[i][2];
      card.appendChild(extra);
    }
    root.appendChild(card);
  }
}

function renderChart(root, rows, ordered) {
  root.replaceChildren();
  if (!ordered) {
    var empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No counts to show.';
    root.appendChild(empty);
    return;
  }
  if (rows.length === 0) {
    var none = document.createElement('div');
    none.className = 'empty';
    none.textContent = 'No states match the current filters.';
    root.appendChild(none);
    return;
  }
  var slot = 46;
  var padL = 48;
  var padR = 12;
  var padT = 12;
  var padB = 96;
  var labelGap = 32;
  var innerH = 200;
  var width = padL + padR + slot * rows.length;
  var height = padT + innerH + padB;
  var max = 0;
  for (var i = 0; i < rows.length; i++) max = Math.max(max, rows[i].value);
  if (!(max > 0)) max = 1;
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Measurement counts');
  for (var g = 0; g < 4; g++) {
    var y = padT + (innerH * g) / 4;
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'grid');
    line.setAttribute('x1', String(padL));
    line.setAttribute('x2', String(width - padR));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    svg.appendChild(line);
    var tick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tick.setAttribute('class', 'tick');
    tick.setAttribute('x', String(padL - 6));
    tick.setAttribute('y', String(y + 4));
    tick.setAttribute('text-anchor', 'end');
    var tickValue = max * (1 - g / 4);
    tick.textContent = controls.valueMode === 'probabilities' ? tickValue.toFixed(2) : Math.round(tickValue).toLocaleString('en-US');
    svg.appendChild(tick);
  }
  for (var b = 0; b < rows.length; b++) {
    var row = rows[b];
    var barH = Math.max(1, (row.value / max) * innerH);
    var x = padL + b * slot + 8;
    var yBar = padT + innerH - barH;
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'bar');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(yBar));
    rect.setAttribute('width', '28');
    rect.setAttribute('height', String(barH));
    rect.setAttribute('rx', '3');
    var tipText = row.state + ' · ' + (controls.valueMode === 'probabilities' ? (row.value * 100).toFixed(2) + '%' : row.raw.toLocaleString('en-US'));
    rect.addEventListener('mouseenter', tipShow(tipText));
    rect.addEventListener('mousemove', tipMove);
    rect.addEventListener('mouseleave', tipHide);
    svg.appendChild(rect);
    var labelY = padT + innerH + labelGap;
    var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'tick');
    label.setAttribute('transform', 'rotate(-60 ' + (x + 14) + ' ' + labelY + ')');
    label.setAttribute('x', String(x + 14));
    label.setAttribute('y', String(labelY));
    label.textContent = row.state;
    svg.appendChild(label);
  }
  root.appendChild(svg);
}

function renderTable(root, rows, stats) {
  root.replaceChildren();
  var table = document.createElement('table');
  var head = document.createElement('thead');
  var hr = document.createElement('tr');
  ['State', 'Count', 'Probability'].forEach(function (name) {
    var th = document.createElement('th');
    th.textContent = name;
    hr.appendChild(th);
  });
  head.appendChild(hr);
  var body = document.createElement('tbody');
  if (rows.length === 0) {
    var empty = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = stats ? 'No states match the current filters.' : 'No counts to show.';
    empty.appendChild(td);
    body.appendChild(empty);
  }
  var shots = stats ? stats.shots : 0;
  for (var i = 0; i < rows.length; i++) {
    var tr = document.createElement('tr');
    var state = document.createElement('td');
    state.textContent = rows[i].state;
    var count = document.createElement('td');
    count.className = 'dim';
    count.textContent = rows[i].raw.toLocaleString('en-US');
    var prob = document.createElement('td');
    prob.className = 'dim';
    prob.textContent = ((rows[i].raw / (shots || 1)) * 100).toFixed(2) + '%';
    tr.append(state, count, prob);
    body.appendChild(tr);
  }
  table.append(head, body);
  root.appendChild(table);
}

function tipShow(text) {
  return function (event) {
    var tip = document.getElementById('tip');
    tip.hidden = false;
    tip.textContent = text;
    tipMove(event);
  };
}
function tipMove(event) {
  var tip = document.getElementById('tip');
  tip.style.left = (event.clientX + 12) + 'px';
  tip.style.top = (event.clientY + 12) + 'px';
}
function tipHide() {
  document.getElementById('tip').hidden = true;
}
function iconNode() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'].forEach(function (d) {
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });
  return svg;
}

function bindToggles() {
  var groups = document.querySelectorAll('.group');
  groups.forEach(function (group) {
    var key = group.getAttribute('data-key');
    group.querySelectorAll('button').forEach(function (button) {
      button.addEventListener('click', function () {
        controls[key] = button.getAttribute('data-value');
        group.querySelectorAll('button').forEach(function (peer) {
          peer.classList.toggle('on', peer === button);
        });
        renderExplorer();
      });
    });
  });
}

function downloadName(suffix) {
  var base = String(model.name || 'results').replace(/[^\\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'results';
  return base + suffix;
}

document.getElementById('all-jobs').addEventListener('click', function () {
  vscodeApi.postMessage({ command: 'showJobs' });
});
document.getElementById('download-results').addEventListener('click', function () {
  vscodeApi.postMessage({ command: 'downloadResults' });
});
document.getElementById('counts').addEventListener('input', function () {
  dirty = true;
  renderExplorer();
});
['pattern', 'search', 'min-count', 'top-n'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', renderExplorer);
});
document.getElementById('show-chart').addEventListener('click', function () {
  viewMode = 'chart';
  document.getElementById('show-chart').classList.add('on');
  document.getElementById('show-table').classList.remove('on');
  renderExplorer();
});
document.getElementById('show-table').addEventListener('click', function () {
  viewMode = 'table';
  document.getElementById('show-table').classList.add('on');
  document.getElementById('show-chart').classList.remove('on');
  renderExplorer();
});
document.getElementById('save-json').addEventListener('click', function () {
  var raw = document.getElementById('chart').dataset.exportCounts;
  if (!raw) return;
  vscodeApi.postMessage({ command: 'saveText', filename: downloadName('-counts.json'), content: JSON.stringify(JSON.parse(raw), null, 2) });
});
document.getElementById('save-ipynb').addEventListener('click', function () {
  var raw = document.getElementById('chart').dataset.exportCounts;
  if (!raw) return;
  vscodeApi.postMessage({ command: 'saveText', filename: downloadName('.ipynb'), content: notebookJson(JSON.parse(raw)) });
});
bindToggles();
window.addEventListener('message', function (event) {
  var data = event.data;
  if (!data || data.type !== 'job' || !data.model) return;
  var next = data.model;
  var sameCounts = JSON.stringify(next.counts) === JSON.stringify(model.counts);
  model = next;
  if (!sameCounts) dirty = false;
  renderHeader();
  renderExplorer();
});
renderHeader();
renderExplorer();
vscodeApi.postMessage({ command: 'ready', generation: generation });
</script>
</body>
</html>`;
}

function jsonForScript(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

function iconChevron(): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`;
}

function iconDownload(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>`;
}

function iconChart(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-3"/></svg>`;
}

function iconTable(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>`;
}

function iconNotebook(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9.5 8h5"/><path d="M9.5 12h5"/></svg>`;
}

function iconCpu(): string {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`;
}

function iconClock(): string {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
}
