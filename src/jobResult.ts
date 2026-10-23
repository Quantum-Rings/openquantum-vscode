// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import { EXPLORER_SOURCE } from './jobExplorer';
import type { CircuitPanelModel, InputFileModel } from './jobFiles';

export type ResultsKind =
    | 'loading'
    | 'counts'
    | 'acquisitions'
    | 'text'
    | 'binary'
    | 'empty'
    | 'none'
    | 'error';

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
    /** The counts document is too large to put in the editor. */
    countsLocked: boolean;
    resultsPreview: string | null;
    resultsNotice: string | null;
    canDownload: boolean;
    /** A calibration snapshot was tagged on this job. */
    canDownloadCalibration: boolean;
    inputTitle: string;
    inputLoading: boolean;
    inputTabs: boolean;
    inputFiles: {
        original: InputFileModel | null;
        processed: InputFileModel | null;
    };
    circuit: CircuitPanelModel;
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
  .card-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid color-mix(in srgb, #95ad9f 15%, transparent); }
  .beta { display: inline-flex; align-items: center; border-radius: 999px; background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 10px; font-weight: 650; line-height: 1.4; padding: 1px 6px; }
  body.vscode-dark .beta { color: #fbbf24; }
  button.ghost, button.toggle, button.mode { border: 1px solid color-mix(in srgb, #95ad9f 28%, transparent); background: transparent; color: #4f5456; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 650; }
  body.vscode-dark button.ghost, body.vscode-dark button.toggle, body.vscode-dark button.mode { color: #95ad9f; }
  button.ghost, button.mode { display: inline-flex; align-items: center; gap: 6px; }
  button.ghost svg, button.mode svg { display: block; flex: none; }
  button.ghost:hover:not(:disabled), button.toggle:hover:not(:disabled), button.mode:hover:not(.on) { background: rgba(80, 188, 131, 0.1); }
  button.mode.on, button.toggle.on, body.vscode-dark button.mode.on, body.vscode-dark button.toggle.on { background: #50bc83; color: #ffffff; border-color: #50bc83; }
  .note { margin: 0; padding: 18px 20px; }
  .pair { display: flex; flex-wrap: wrap; gap: 16px; align-items: stretch; margin: 0 0 22px; }
  .source-card { flex: 1 1 280px; min-width: 0; max-height: 32rem; display: flex; flex-direction: column; overflow: hidden; margin: 0; }
  .card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px; }
  .card-head h2, .source-card > h2 { margin: 0; }
  .head-tools { display: flex; align-items: center; gap: 8px; flex: none; }
  button.icon-btn { display: inline-flex; align-items: center; justify-content: center; padding: 6px; border-radius: 8px; border: 1px solid color-mix(in srgb, #95ad9f 20%, transparent); background: transparent; color: #4f5456; }
  body.vscode-dark button.icon-btn { color: #95ad9f; }
  button.icon-btn:hover { background: rgba(80, 188, 131, 0.1); }
  button.icon-btn svg { display: block; flex: none; }
  .source { min-height: 0; flex: 1 1 auto; overflow: auto; border-radius: 8px; background: color-mix(in srgb, var(--vscode-foreground) 4%, transparent); font-family: var(--vscode-editor-font-family); font-size: 12px; line-height: 20px; }
  .source.code { padding-top: 8px; padding-bottom: 8px; }
  .source .line { box-sizing: border-box; width: max-content; min-width: 100%; padding: 0 12px; border-left: 2px solid transparent; white-space: pre; }
  .source .line.on { background: rgba(80, 188, 131, 0.3); border-left-color: #50bc83; }
  .source .ln { display: inline-block; width: 1.5rem; margin-right: 12px; text-align: right; color: color-mix(in srgb, #4f5456 50%, transparent); user-select: none; }
  body.vscode-dark .source .ln { color: color-mix(in srgb, #95ad9f 50%, transparent); }
  .hint { margin: 8px 0 0; color: #4f5456; font-size: 12px; }
  body.vscode-dark .hint { color: #95ad9f; }
  .preview { max-height: 20rem; overflow: auto; margin: 8px 0 0; white-space: pre-wrap; font-family: var(--vscode-editor-font-family); font-size: 12px; line-height: 20px; }
  .cap { margin: 8px 0 0; font-size: 12px; color: #4f5456; }
  body.vscode-dark .cap { color: #95ad9f; }
  .circuit-frame { display: flex; width: max-content; min-width: 100%; }
  svg.circuit { display: block; flex: none; }
  svg.circuit.labels { position: sticky; left: 0; z-index: 1; background: color-mix(in srgb, var(--vscode-foreground) 4%, var(--vscode-sideBar-background, var(--vscode-editor-background))); border-right: 1px solid color-mix(in srgb, #95ad9f 15%, transparent); }
  .fullscreen { position: fixed; inset: 0; z-index: 30; display: flex; padding: 32px; background: rgba(0, 0, 0, 0.7); }
  .fullscreen-panel { position: relative; display: flex; flex: 1; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; border: 1px solid color-mix(in srgb, #95ad9f 20%, transparent); border-radius: 16px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
  .fullscreen-body { display: flex; flex: 1; min-height: 0; flex-direction: column; padding: 20px; }
  .fullscreen-head { padding-right: 36px; }
  .fullscreen-close { position: absolute; top: 12px; right: 12px; z-index: 2; display: inline-flex; align-items: center; justify-content: center; padding: 6px; border: none; border-radius: 8px; background: transparent; color: #4f5456; }
  body.vscode-dark .fullscreen-close { color: #95ad9f; }
  .fullscreen-close:hover { background: color-mix(in srgb, var(--vscode-foreground) 6%, transparent); }
  .fullscreen-close svg { display: block; }
  .fullscreen-stage { flex: 1 1 auto; min-height: 0; }
  .circuit-fill { display: flex; width: max-content; min-width: 100%; min-height: 100%; }
  .circuit-fill .circuit-frame { margin: auto; }
  #fullscreen-tabs { margin: 0 0 12px; }
  svg.circuit .wire { stroke: rgba(79, 84, 86, 0.45); stroke-width: 1.5; }
  body.vscode-dark svg.circuit .wire { stroke: rgba(149, 173, 159, 0.45); }
  svg.circuit .qubit { fill: #4f5456; font-size: 12px; }
  body.vscode-dark svg.circuit .qubit { fill: #95ad9f; }
  svg.circuit .hit { cursor: pointer; }
  svg.circuit .gate-plate { fill: var(--vscode-sideBar-background, var(--vscode-editor-background)); stroke: none; }
  svg.circuit .gate { fill: rgba(80, 188, 131, 0.15); stroke: #50bc83; stroke-width: 1.5; }
  svg.circuit .gate-label { fill: var(--vscode-foreground); font-size: 12px; font-weight: 650; pointer-events: none; }
  svg.circuit .outline { fill: none; stroke: var(--vscode-foreground); stroke-width: 2; }
  svg.circuit .link, svg.circuit .plus { stroke: #50bc83; }
  svg.circuit .link { stroke-width: 1.5; }
  svg.circuit .plus { stroke-width: 2; }
  svg.circuit .cnot { fill: #50bc83; }
  svg.circuit .open { fill: var(--vscode-sideBar-background, var(--vscode-editor-background)); stroke: #50bc83; stroke-width: 1.5; }
  svg.circuit .target { fill: var(--vscode-sideBar-background, var(--vscode-editor-background)); stroke: #50bc83; stroke-width: 1.5; }
  svg.circuit .meter { fill: none; stroke: var(--vscode-foreground); stroke-width: 1.06; }
  svg.circuit .meter-arc { stroke-linecap: round; }
  svg.circuit .meter-arrow { fill: var(--vscode-foreground); stroke: none; }
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
  #input-tabs, #fullscreen-tabs { align-self: flex-start; width: fit-content; }
  #input-tabs { margin: 0 0 12px; }
  #input-tabs button, #fullscreen-tabs button { padding: 4px 10px; line-height: 1.4; }
  .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
  label.field { display: block; }
  label.field span { display: block; margin: 0 0 4px; font-size: 11px; color: #4f5456; }
  body.vscode-dark label.field span { color: #95ad9f; }
  input { padding: 6px 8px; font-family: var(--vscode-editor-font-family); font-size: 12px; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 720px) { .stats { grid-template-columns: 1fr 1fr; } }
  .stat { min-width: 0; padding: 12px 14px; }
  .stat .label { font-size: 11px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: #4f5456; }
  body.vscode-dark .stat .label { color: #95ad9f; }
  .stat strong { display: block; margin-top: 2px; font-family: var(--vscode-editor-font-family); font-size: 18px; font-weight: 650; }
  .stat .state { display: block; margin-top: 2px; font-family: var(--vscode-editor-font-family); font-size: 12px; font-weight: 500; word-break: break-all; }
  .stat em { display: block; margin-top: 2px; font-style: normal; color: #50bc83; font-size: 12px; }
  .viewbar { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; }
  .viewbar .modes, .viewbar .exports { display: flex; gap: 8px; flex-wrap: wrap; }
  .chart-wrap { overflow: hidden; min-height: 240px; }
  svg.chart { display: block; width: 100%; height: auto; }
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
      <button id="download-results" class="ghost" type="button">${iconDownload()}Open result</button>
      <button id="download-calibration" class="ghost" type="button" hidden>${iconDownload()}Open calibration<span class="beta">Beta</span></button>
    </div>
  </section>
  <div class="pair">
    <section class="panel source-card">
      <div class="card-head">
        <h2 id="input-title">Input</h2>
        <div class="head-tools">
          <button id="expand-input" class="icon-btn" type="button" aria-label="Expand input" title="Expand input">${iconExpand()}</button>
          <button id="download-input" class="ghost" type="button" hidden>${iconDownload()}<span id="download-input-label">Open</span></button>
        </div>
      </div>
      <div id="input-tabs" class="group" role="tablist" hidden>
        <button type="button" class="toggle" data-input="original" role="tab">Original</button>
        <button type="button" class="toggle on" data-input="processed" role="tab">Processed</button>
      </div>
      <p id="input-note" class="hint" hidden>The diagram follows the processed program, not this file.</p>
      <p id="input-status" class="hint" hidden></p>
      <div id="input-text" class="source code" hidden></div>
      <p id="input-footer" class="hint" hidden></p>
    </section>
    <section class="panel source-card">
      <div class="card-head">
        <h2>Diagram</h2>
        <button id="expand-diagram" class="icon-btn" type="button" aria-label="Expand diagram" title="Expand diagram" hidden>${iconExpand()}</button>
      </div>
      <p id="diagram-status" class="hint" hidden></p>
      <div id="diagram" class="source" hidden></div>
      <p id="diagram-detail" class="hint" hidden></p>
      <p id="diagram-caption" class="hint" hidden>Select a gate to see its name, qubits, and parameters.</p>
    </section>
  </div>
  <p id="results-note" class="note card" hidden></p>
  <section id="results-preview" class="panel" hidden>
    <h2 id="results-title">Results</h2>
    <p id="results-preview-note" class="hint" hidden></p>
    <pre id="results-preview-body" class="preview" hidden></pre>
  </section>
  <div id="explorer" class="layout" hidden>
    <div class="stack">
      <section class="panel">
        <h2>Counts</h2>
        <p id="counts-locked" class="hint" hidden>These counts are too large to edit here. The chart uses the stored file. Open the results for the full document.</p>
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
        <p id="chart-cap" class="cap" hidden></p>
        <div id="table-wrap" hidden></div>
        <p id="table-cap" class="cap" hidden></p>
      </section>
    </div>
  </div>
</main>
<div id="tip" hidden></div>
<div id="fullscreen" class="fullscreen" hidden>
  <div id="fullscreen-panel" class="fullscreen-panel" role="dialog" aria-modal="true" aria-labelledby="fullscreen-title">
    <button id="fullscreen-close" class="fullscreen-close" type="button" aria-label="Close">${iconClose()}</button>
    <div class="fullscreen-body">
      <div class="card-head fullscreen-head">
        <h2 id="fullscreen-title"></h2>
        <div id="fullscreen-tools" class="head-tools"></div>
      </div>
      <div id="fullscreen-tabs" class="group" role="tablist" hidden>
        <button type="button" class="toggle" data-input="original" role="tab">Original</button>
        <button type="button" class="toggle on" data-input="processed" role="tab">Processed</button>
      </div>
      <p id="fullscreen-note" class="hint" hidden>The diagram follows the processed program, not this file.</p>
      <div id="fullscreen-stage" class="source fullscreen-stage"></div>
      <p id="fullscreen-footer" class="hint" hidden></p>
      <p id="fullscreen-caption" class="hint" hidden></p>
    </div>
  </div>
</div>
<script nonce="${nonce}">
${EXPLORER_SOURCE}
const vscodeApi = acquireVsCodeApi();
const generation = ${String(generation)};
let model = ${payload};
let dirty = false;
let viewMode = 'chart';
let inputTab = 'processed';
let highlightLines = [];
let shownInputKey = '';
let selectedGate = null;
let fullscreenKind = null;
let fullscreenReturn = null;
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
  var calibration = document.getElementById('download-calibration');
  calibration.hidden = !model.canDownloadCalibration;
  document.getElementById('card-actions').hidden = !model.canDownload && !model.canDownloadCalibration;
}

function resultsCopy(kind) {
  if (kind === 'loading') return 'Loading results…';
  if (kind === 'error') return "We couldn't read the results for this job. You can still open the raw file above.";
  if (kind === 'binary') return 'This results file is not text. Open it above to inspect it.';
  if (kind === 'empty') return 'The results file is empty.';
  if (kind === 'none') return "Results aren't available for this job yet.";
  return '';
}

function resultsHidden() {
  var name = String(model.status || '').toLowerCase();
  return name === 'failed' || name === 'canceled' || name === 'cancelled';
}

function activeInputId() {
  if (model.inputTabs) return inputTab === 'original' ? 'original' : 'processed';
  return model.inputFiles && model.inputFiles.processed ? 'processed' : 'original';
}

function diagramFollows() {
  return !model.inputTabs || activeInputId() === 'processed';
}

function renderInput() {
  var title = document.getElementById('input-title');
  var inputName = model.inputTitle || 'Input';
  title.textContent = inputName;
  var expand = document.getElementById('expand-input');
  var expandLabel = 'Expand ' + inputName;
  expand.setAttribute('aria-label', expandLabel);
  expand.title = expandLabel;
  var tabs = document.getElementById('input-tabs');
  tabs.hidden = !model.inputTabs;
  tabs.querySelectorAll('button').forEach(function (button) {
    button.classList.toggle('on', button.getAttribute('data-input') === activeInputId());
  });
  var id = activeInputId();
  var file = model.inputFiles ? model.inputFiles[id] : null;
  var note = document.getElementById('input-note');
  var status = document.getElementById('input-status');
  var body = document.getElementById('input-text');
  var footer = document.getElementById('input-footer');
  var download = document.getElementById('download-input');
  var label = document.getElementById('download-input-label');
  note.hidden = !(model.inputTabs && id === 'original');
  if (model.inputLoading) {
    status.hidden = false;
    status.textContent = 'Loading ' + (model.inputTitle || 'input') + '…';
    body.hidden = true;
    footer.hidden = true;
    download.hidden = true;
    renderFullscreen();
    return;
  }
  var key = id + '\\n' + (file && file.text ? String(file.text.length) + ':' + file.text.slice(0, 40) : (file && file.error) || '');
  if (key !== shownInputKey) {
    highlightLines = [];
    shownInputKey = key;
  }
  label.textContent = model.inputTabs ? (id === 'original' ? 'Open original' : 'Open processed') : 'Open';
  download.hidden = !(file && file.canDownload);
  if (!file || file.error) {
    status.hidden = false;
    status.textContent = file && file.error ? file.error : 'No input file is stored for this job.';
    body.hidden = true;
    footer.hidden = true;
    renderFullscreen();
    return;
  }
  status.hidden = true;
  body.hidden = false;
  footer.hidden = !file.footer;
  footer.textContent = file.footer || '';
  renderLines(body, file.text, diagramFollows() ? highlightLines : []);
  renderFullscreen();
}

function renderLines(root, text, lines) {
  root.replaceChildren();
  var parts = String(text || '').split(/\\r?\\n/);
  var highlighted = {};
  var i;
  for (i = 0; i < lines.length; i++) highlighted[lines[i]] = true;
  var last = 0;
  for (var n = 0; n < parts.length; n++) {
    var number = n + 1;
    var row = document.createElement('div');
    row.className = highlighted[number] ? 'line on' : 'line';
    row.setAttribute('data-line', String(number));
    var ln = document.createElement('span');
    ln.className = 'ln';
    ln.textContent = String(number);
    var code = document.createElement('span');
    code.textContent = parts[n] || ' ';
    row.append(ln, code);
    root.appendChild(row);
    if (highlighted[number]) last = number;
  }
  if (!last) return;
  var target = root.querySelector('[data-line="' + last + '"]');
  if (!target) return;
  // Center the selected line in the scroller so it is not clipped.
  var top = target.getBoundingClientRect().top - root.getBoundingClientRect().top;
  var mid = top - (root.clientHeight - target.offsetHeight) / 2;
  root.scrollTop = Math.max(0, root.scrollTop + mid);
}

function renderDiagram() {
  var status = document.getElementById('diagram-status');
  var root = document.getElementById('diagram');
  var detail = document.getElementById('diagram-detail');
  var caption = document.getElementById('diagram-caption');
  var circuit = model.circuit || { status: 'loading' };
  document.getElementById('expand-diagram').hidden = circuit.status !== 'circuit';
  if (circuit.status === 'loading') {
    status.hidden = false;
    status.textContent = 'Loading diagram…';
    root.hidden = true;
    detail.hidden = true;
    caption.hidden = true;
    renderFullscreen();
    return;
  }
  if (circuit.status !== 'circuit') {
    status.hidden = false;
    status.textContent = circuit.message || 'A circuit diagram was not stored for this job.';
    detail.hidden = !circuit.detail;
    detail.textContent = circuit.detail || '';
    root.hidden = true;
    caption.hidden = true;
    renderFullscreen();
    return;
  }
  status.hidden = true;
  detail.hidden = true;
  root.hidden = false;
  caption.hidden = false;
  drawCircuit(root, circuit);
  var selected = null;
  var gates = circuit.gates || [];
  for (var g = 0; g < gates.length; g++) {
    if (gates[g].id === selectedGate) selected = gates[g];
  }
  if (!selected) selectedGate = null;
  caption.textContent = selected ? describeGate(selected, circuit.wires || []) : 'Select a gate to see its name, qubits, and parameters.';
  renderFullscreen();
}

function renderFullscreen() {
  var dialog = document.getElementById('fullscreen');
  if (!fullscreenKind) {
    dialog.hidden = true;
    document.body.style.overflow = '';
    return;
  }
  dialog.hidden = false;
  document.body.style.overflow = 'hidden';
  var title = document.getElementById('fullscreen-title');
  var tools = document.getElementById('fullscreen-tools');
  var tabs = document.getElementById('fullscreen-tabs');
  var note = document.getElementById('fullscreen-note');
  var stage = document.getElementById('fullscreen-stage');
  var footer = document.getElementById('fullscreen-footer');
  var caption = document.getElementById('fullscreen-caption');
  tools.replaceChildren();
  if (fullscreenKind === 'input') {
    var id = activeInputId();
    var file = model.inputFiles ? model.inputFiles[id] : null;
    var name = model.inputTitle || 'Input';
    var viewing = model.inputTabs ? (id === 'original' ? 'Original' : 'Processed') : '';
    title.textContent = viewing ? name + ' · ' + viewing : name;
    tabs.hidden = !model.inputTabs;
    tabs.querySelectorAll('button').forEach(function (button) {
      button.classList.toggle('on', button.getAttribute('data-input') === id);
    });
    note.hidden = !(model.inputTabs && id === 'original');
    caption.hidden = true;
    footer.hidden = !(file && file.footer && !model.inputLoading);
    footer.textContent = file && file.footer ? file.footer : '';
    if (file && file.canDownload && !model.inputLoading) {
      var download = document.createElement('button');
      download.className = 'ghost';
      download.type = 'button';
      download.append(iconDownloadNode(), document.createTextNode(model.inputTabs ? (id === 'original' ? 'Open original' : 'Open processed') : 'Open'));
      download.addEventListener('click', function () {
        vscodeApi.postMessage({ command: 'downloadInput', which: activeInputId() });
      });
      tools.appendChild(download);
    }
    if (model.inputLoading) {
      setStageMessage(stage, 'Loading ' + name + '…');
      return;
    }
    if (!file || file.error) {
      setStageMessage(stage, file && file.error ? file.error : 'No input file is stored for this job.');
      return;
    }
    stage.hidden = false;
    stage.className = 'source code fullscreen-stage';
    renderLines(stage, file.text, diagramFollows() ? highlightLines : []);
    return;
  }
  title.textContent = 'Diagram';
  tabs.hidden = true;
  note.hidden = true;
  footer.hidden = true;
  var circuit = model.circuit || { status: 'loading' };
  if (circuit.status === 'loading') {
    caption.hidden = true;
    setStageMessage(stage, 'Loading diagram…');
    return;
  }
  if (circuit.status !== 'circuit') {
    caption.hidden = true;
    setStageMessage(stage, circuit.message || 'A circuit diagram was not stored for this job.');
    return;
  }
  stage.hidden = false;
  stage.className = 'source fullscreen-stage';
  stage.replaceChildren();
  var wrap = document.createElement('div');
  wrap.className = 'circuit-fill';
  stage.appendChild(wrap);
  drawCircuit(wrap, circuit);
  var selected = null;
  var gates = circuit.gates || [];
  for (var g = 0; g < gates.length; g++) {
    if (gates[g].id === selectedGate) selected = gates[g];
  }
  caption.hidden = false;
  caption.textContent = selected ? describeGate(selected, circuit.wires || []) : 'Select a gate to see its name, qubits, and parameters.';
}

function setStageMessage(stage, text) {
  stage.hidden = false;
  stage.className = 'fullscreen-stage';
  stage.replaceChildren();
  var message = document.createElement('p');
  message.className = 'hint';
  message.textContent = text;
  stage.appendChild(message);
}

function openFullscreen(kind) {
  fullscreenReturn = document.activeElement;
  fullscreenKind = kind;
  renderFullscreen();
  document.getElementById('fullscreen-close').focus();
}

function closeFullscreen() {
  fullscreenKind = null;
  renderFullscreen();
  if (fullscreenReturn && fullscreenReturn.focus) fullscreenReturn.focus();
  fullscreenReturn = null;
}

function describeGate(gate, wires) {
  var names = [];
  var qubits = gate.qubits || [];
  for (var i = 0; i < qubits.length; i++) names.push(wires[qubits[i]] || ('q' + qubits[i]));
  return gate.name + (gate.params ? '(' + gate.params + ')' : '') + ' on ' + names.join(', ');
}

function drawCircuit(root, circuit) {
  root.replaceChildren();
  var wires = circuit.wires || [];
  var gates = circuit.gates || [];
  var labelW = 72;
  var colW = 76;
  var rowH = 48;
  var padY = 16;
  var box = 34;
  var widths = circuit.columnWidths;
  var useWidths = widths && widths.length;
  var span = 0;
  if (useWidths) {
    for (var c = 0; c < widths.length; c++) span += Number(widths[c]) || colW;
  } else {
    span = Math.max(circuit.columnCount || 1, 1) * colW;
  }
  var circuitWidth = span + 16;
  var height = padY * 2 + Math.max(wires.length, 1) * rowH;
  function wireY(index) { return padY + index * rowH + rowH / 2; }
  function columnX(column) {
    if (!useWidths) return column * colW + colW / 2;
    var cursor = 0;
    var index;
    for (index = 0; index < column && index < widths.length; index++) {
      cursor += Number(widths[index]) || colW;
    }
    var width = index < widths.length ? (Number(widths[index]) || colW) : colW;
    return cursor + width / 2;
  }
  function svgEl(name) { return document.createElementNS('http://www.w3.org/2000/svg', name); }
  var frame = document.createElement('div');
  frame.className = 'circuit-frame';
  var labels = svgEl('svg');
  labels.setAttribute('class', 'circuit labels');
  labels.setAttribute('width', String(labelW));
  labels.setAttribute('height', String(height));
  labels.setAttribute('aria-hidden', 'true');
  var svg = svgEl('svg');
  svg.setAttribute('class', 'circuit');
  svg.setAttribute('width', String(circuitWidth));
  svg.setAttribute('height', String(height));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Quantum circuit');
  for (var w = 0; w < wires.length; w++) {
    var y = wireY(w);
    var text = svgEl('text');
    text.setAttribute('class', 'qubit');
    text.setAttribute('x', '8');
    text.setAttribute('y', String(y + 4));
    text.textContent = wires[w];
    labels.appendChild(text);
    var wire = svgEl('line');
    wire.setAttribute('class', 'wire');
    wire.setAttribute('x1', '8');
    wire.setAttribute('y1', String(y));
    wire.setAttribute('x2', String(circuitWidth - 12));
    wire.setAttribute('y2', String(y));
    svg.appendChild(wire);
  }
  var drawn = [];
  for (var i = 0; i < gates.length; i++) drawn.push(drawGate(gates[i], wireY, columnX, box, svgEl));
  for (i = 0; i < drawn.length; i++) if (drawn[i].link) svg.appendChild(drawn[i].link);
  for (i = 0; i < drawn.length; i++) svg.appendChild(drawn[i].group);
  frame.append(labels, svg);
  root.appendChild(frame);
}

function symbolOf(gate) {
  var qubits = (gate.qubits || []).filter(function (index) { return index >= 0; });
  var styles = [];
  var rest = String(gate.name || '').trim().toLowerCase();
  while (rest.indexOf('ctrl @ ') === 0 || rest.indexOf('negctrl @ ') === 0) {
    if (rest.indexOf('negctrl @ ') === 0) {
      styles.push('open');
      rest = rest.slice('negctrl @ '.length);
    } else {
      styles.push('filled');
      rest = rest.slice('ctrl @ '.length);
    }
  }
  function marks(count) {
    var out = [];
    for (var i = 0; i < count && i < qubits.length; i++) out.push({ index: qubits[i], style: styles[i] || 'filled' });
    return out;
  }
  if (gate.gateKind === 'measure' || rest === 'measure') return { kind: 'meter', qubits: qubits };
  var xFamily = { x: 1, cx: 1, cnot: 1, ccx: 1, ccnot: 1, toffoli: 1 };
  if (xFamily[rest] && (rest !== 'x' || styles.length > 0 || qubits.length > 1) && qubits.length >= 2) {
    return { kind: 'target', marks: marks(qubits.length - 1), target: qubits[qubits.length - 1] };
  }
  var filledOnly = styles.every(function (style) { return style === 'filled'; });
  if ((rest === 'cz' || (rest === 'z' && qubits.length > 1)) && filledOnly && qubits.length >= 2) {
    return { kind: 'dots', marks: marks(qubits.length) };
  }
  if (rest === 'swap' || rest === 'cswap' || rest === 'fredkin') {
    var controlCount = styles.length + (rest === 'swap' ? 0 : 1);
    if (qubits.length === controlCount + 2) {
      return { kind: 'swap', marks: marks(controlCount), swapped: qubits.slice(controlCount) };
    }
  }
  var controlled = { cy: 'Y', ch: 'H', cp: 'P', cphase: 'P', crx: 'RX', cry: 'RY', crz: 'RZ', cu: 'U', cu1: 'U1', cu2: 'U2', cu3: 'U3', cs: 'S', ct: 'T' };
  if (controlled[rest] && qubits.length >= 2 && styles.length + 1 < qubits.length) {
    return { kind: 'box', marks: marks(styles.length + 1), qubits: qubits.slice(styles.length + 1), label: controlled[rest] };
  }
  if (styles.length > 0 && styles.length < qubits.length) {
    return { kind: 'box', marks: marks(styles.length), qubits: qubits.slice(styles.length), label: gate.label || gate.name };
  }
  return { kind: 'box', marks: [], qubits: qubits, label: gate.label || gate.name };
}

function drawGate(gate, wireY, columnX, box, svgEl) {
  var symbol = symbolOf(gate);
  var involved = symbolQubits(symbol);
  var group = svgEl('g');
  group.setAttribute('class', 'hit');
  if (involved.length === 0) return { link: svgEl('g'), group: group };
  var x = columnX(gate.column);
  var boxW = symbol.kind === 'box' ? (gate.boxWidth || box) : box;
  var active = gate.id === selectedGate;
  group.addEventListener('click', function () { chooseGate(gate); });
  var ys = involved.map(wireY);
  if (active) {
    var pad = symbol.kind === 'box' || symbol.kind === 'meter' ? 5 : 12;
    var reach = symbol.kind === 'target' ? 9 : box / 2;
    var top = Math.min.apply(null, ys) - reach;
    var bottom = Math.max.apply(null, ys) + reach;
    var halo = svgEl('rect');
    halo.setAttribute('class', 'outline');
    halo.setAttribute('x', String(x - boxW / 2 - pad));
    halo.setAttribute('y', String(top - pad));
    halo.setAttribute('width', String(boxW + pad * 2));
    halo.setAttribute('height', String(bottom - top + pad * 2));
    halo.setAttribute('rx', '10');
    group.appendChild(halo);
  }
  var link = svgEl('g');
  drawConnector(link, x, symbol, wireY, box, svgEl);
  drawSymbol(group, x, symbol, wireY, boxW, svgEl);
  return { link: link, group: group };
}

function symbolQubits(symbol) {
  if (symbol.kind === 'meter') return symbol.qubits;
  if (symbol.kind === 'target') return symbol.marks.map(function (mark) { return mark.index; }).concat([symbol.target]);
  if (symbol.kind === 'dots') return symbol.marks.map(function (mark) { return mark.index; });
  if (symbol.kind === 'swap') return symbol.marks.map(function (mark) { return mark.index; }).concat(symbol.swapped);
  return symbol.marks.map(function (mark) { return mark.index; }).concat(symbol.qubits);
}

function drawSymbol(group, x, symbol, wireY, box, svgEl) {
  if (symbol.kind === 'target') {
    symbol.marks.forEach(function (mark) { group.appendChild(controlDot(x, wireY(mark.index), mark.style, svgEl)); });
    group.appendChild(targetPlus(x, wireY(symbol.target), svgEl));
    return;
  }
  if (symbol.kind === 'dots') {
    symbol.marks.forEach(function (mark) { group.appendChild(controlDot(x, wireY(mark.index), mark.style, svgEl)); });
    return;
  }
  if (symbol.kind === 'swap') {
    symbol.marks.forEach(function (mark) { group.appendChild(controlDot(x, wireY(mark.index), mark.style, svgEl)); });
    symbol.swapped.forEach(function (qubit) { swapCross(group, x, wireY(qubit), svgEl); });
    return;
  }
  if (symbol.kind === 'meter') {
    symbol.qubits.forEach(function (qubit) { meter(group, x, wireY(qubit), box, svgEl); });
    return;
  }
  var span = spanQubits(symbol.qubits);
  if (span.length) gateBox(group, x, span.map(wireY), symbol.label, box, svgEl);
  symbol.marks.forEach(function (mark) { group.appendChild(controlDot(x, wireY(mark.index), mark.style, svgEl)); });
}

function spanQubits(qubits) {
  var sorted = qubits.filter(function (index) { return index >= 0; }).slice().sort(function (a, b) { return a - b; });
  if (!sorted.length) return [];
  return [sorted[0], sorted[sorted.length - 1]];
}

function symbolExtents(symbol, wireY, box) {
  function point(index, radius) {
    var y = wireY(index);
    return { top: y - radius, bottom: y + radius };
  }
  if (symbol.kind === 'meter') return symbol.qubits.map(function (index) { return point(index, box / 2); });
  if (symbol.kind === 'target') {
    return symbol.marks.map(function (mark) { return point(mark.index, 7); }).concat([point(symbol.target, 11)]);
  }
  if (symbol.kind === 'dots') return symbol.marks.map(function (mark) { return point(mark.index, 7); });
  if (symbol.kind === 'swap') {
    return symbol.marks.map(function (mark) { return point(mark.index, 7); }).concat(symbol.swapped.map(function (index) { return point(index, 9); }));
  }
  var span = spanQubits(symbol.qubits);
  var boxes = span.length ? [{ top: wireY(span[0]) - box / 2 - 1, bottom: wireY(span[span.length - 1]) + box / 2 + 1 }] : [];
  return symbol.marks.map(function (mark) { return point(mark.index, 7); }).concat(boxes);
}

function drawConnector(group, x, symbol, wireY, box, svgEl) {
  var extents = symbolExtents(symbol, wireY, box).sort(function (a, b) { return a.top - b.top; });
  var i;
  for (i = 1; i < extents.length; i++) {
    var from = extents[i - 1].bottom;
    var to = extents[i].top;
    if (to <= from) continue;
    var link = svgEl('line');
    link.setAttribute('class', 'link');
    link.setAttribute('x1', String(x));
    link.setAttribute('y1', String(from));
    link.setAttribute('x2', String(x));
    link.setAttribute('y2', String(to));
    group.appendChild(link);
  }
}

function controlDot(x, y, style, svgEl) {
  var dot = svgEl('circle');
  dot.setAttribute('class', style === 'open' ? 'open' : 'cnot');
  dot.setAttribute('cx', String(x));
  dot.setAttribute('cy', String(y));
  dot.setAttribute('r', '5');
  return dot;
}

function targetPlus(x, y, svgEl) {
  var wrap = svgEl('g');
  var ring = svgEl('circle');
  ring.setAttribute('class', 'target');
  ring.setAttribute('cx', String(x));
  ring.setAttribute('cy', String(y));
  ring.setAttribute('r', '9');
  wrap.appendChild(ring);
  [[x - 5, y, x + 5, y], [x, y - 5, x, y + 5]].forEach(function (spec) {
    var plus = svgEl('line');
    plus.setAttribute('class', 'plus');
    plus.setAttribute('x1', String(spec[0]));
    plus.setAttribute('y1', String(spec[1]));
    plus.setAttribute('x2', String(spec[2]));
    plus.setAttribute('y2', String(spec[3]));
    wrap.appendChild(plus);
  });
  return wrap;
}

function swapCross(group, x, y, svgEl) {
  [[x - 6, y - 6, x + 6, y + 6], [x - 6, y + 6, x + 6, y - 6]].forEach(function (spec) {
    var arm = svgEl('line');
    arm.setAttribute('class', 'plus');
    arm.setAttribute('x1', String(spec[0]));
    arm.setAttribute('y1', String(spec[1]));
    arm.setAttribute('x2', String(spec[2]));
    arm.setAttribute('y2', String(spec[3]));
    group.appendChild(arm);
  });
}

function meter(group, x, y, box, svgEl) {
  gateBox(group, x, [y], '', box, svgEl);
  var arc = svgEl('path');
  arc.setAttribute('class', 'meter meter-arc');
  arc.setAttribute('d', 'M ' + (x - 10.2) + ' ' + (y + 8.5) + ' A 11.9 11.9 0 0 1 ' + (x + 10.2) + ' ' + (y + 8.5));
  var needle = svgEl('line');
  needle.setAttribute('class', 'meter');
  needle.setAttribute('x1', String(x - 3.4));
  needle.setAttribute('y1', String(y + 11.05));
  needle.setAttribute('x2', String(x + 5.1));
  needle.setAttribute('y2', String(y - 4.68));
  var head = svgEl('polygon');
  head.setAttribute('class', 'meter-arrow');
  head.setAttribute('points', (x + 7.46) + ',' + (y - 9.04) + ' ' + (x + 3.14) + ',' + (y - 4.74) + ' ' + (x + 6.23) + ',' + (y - 3.07));
  group.append(arc, needle, head);
}

function gateBox(group, x, ys, label, boxW, svgEl) {
  if (!ys.length) return;
  var boxH = 34;
  var top = Math.min.apply(null, ys);
  var bottom = Math.max.apply(null, ys);
  var mid = (top + bottom) / 2;
  var boxTop = top - boxH / 2;
  var height = bottom - top + boxH;
  var plate = svgEl('rect');
  plate.setAttribute('class', 'gate-plate');
  plate.setAttribute('x', String(x - boxW / 2));
  plate.setAttribute('y', String(boxTop));
  plate.setAttribute('width', String(boxW));
  plate.setAttribute('height', String(height));
  plate.setAttribute('rx', '6');
  var rect = svgEl('rect');
  rect.setAttribute('class', 'gate');
  rect.setAttribute('x', String(x - boxW / 2));
  rect.setAttribute('y', String(boxTop));
  rect.setAttribute('width', String(boxW));
  rect.setAttribute('height', String(height));
  rect.setAttribute('rx', '6');
  group.append(plate, rect);
  if (!label) return;
  var text = svgEl('text');
  text.setAttribute('class', 'gate-label');
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(mid + 4));
  text.setAttribute('text-anchor', 'middle');
  text.textContent = label;
  group.appendChild(text);
}

function chooseGate(gate) {
  selectedGate = selectedGate === gate.id ? null : gate.id;
  if (diagramFollows() && selectedGate && gate.line) highlightLines = [gate.line];
  else highlightLines = [];
  renderDiagram();
  renderInput();
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

function capRows(rows, cap) {
  if (rows.length <= cap) return { shown: rows, hidden: 0 };
  return { shown: rows.slice(0, cap), hidden: rows.length - cap };
}

function renderExplorer() {
  var note = document.getElementById('results-note');
  var preview = document.getElementById('results-preview');
  var explorer = document.getElementById('explorer');
  if (resultsHidden()) {
    note.hidden = true;
    preview.hidden = true;
    explorer.hidden = true;
    return;
  }
  var kind = model.resultsKind;
  var showExplorer = kind === 'counts' || dirty;
  var showPreview = !showExplorer && (kind === 'acquisitions' || kind === 'text');
  note.hidden = showExplorer || showPreview;
  note.textContent = resultsCopy(kind);
  preview.hidden = !showPreview;
  if (showPreview) {
    document.getElementById('results-title').textContent = kind === 'acquisitions' ? 'Qblox acquisitions' : 'Results';
    var extra = document.getElementById('results-preview-note');
    var body = document.getElementById('results-preview-body');
    extra.hidden = !model.resultsNotice;
    extra.textContent = model.resultsNotice || '';
    body.hidden = !model.resultsPreview;
    body.textContent = model.resultsPreview || '';
  }
  explorer.hidden = !showExplorer;
  if (!showExplorer) return;
  var locked = kind === 'counts' && model.countsLocked && !dirty;
  var area = document.getElementById('counts');
  area.hidden = locked;
  document.getElementById('counts-locked').hidden = !locked;
  if (!locked && !dirty && document.activeElement !== area) {
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
  var chartRows = capRows(rows.slice().sort(function (a, b) { return b.raw - a.raw; }), 64);
  var tableRows = capRows(rows, 200);
  var chartCap = document.getElementById('chart-cap');
  var tableCap = document.getElementById('table-cap');
  chartCap.hidden = viewMode !== 'chart' || chartRows.hidden === 0;
  tableCap.hidden = viewMode !== 'table' || tableRows.hidden === 0;
  chartCap.textContent = 'Showing the 64 highest counts. ' + chartRows.hidden + ' more match the current filters.';
  tableCap.textContent = 'Showing the first 200 of ' + rows.length + ' rows.';
  if (viewMode === 'chart') renderChart(chart, chartRows.shown, ordered);
  else renderTable(table, tableRows.shown, stats);
  var blocked = !ordered;
  document.getElementById('save-json').disabled = blocked;
  document.getElementById('save-ipynb').disabled = blocked;
  chart.dataset.exportCounts = ordered ? JSON.stringify(ordered) : '';
}

function renderStats(stats) {
  var root = document.getElementById('stats');
  root.replaceChildren();
  if (!stats) return;
  var share = ((stats.topCount / (stats.shots || 1)) * 100).toFixed(1) + '%';
  var state = stats.topState || '';
  var shown = state ? middleEllipsis(state, MOST_LIKELY_STATE_LIMIT) : '';
  var items = [
    ['Shots', stats.shots.toLocaleString('en-US'), ''],
    ['Unique states', String(stats.unique), ''],
    ['Most likely', share, shown],
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
      var detail = document.createElement('div');
      detail.className = 'state';
      detail.textContent = items[i][2];
      if (state.length > MOST_LIKELY_STATE_LIMIT) detail.title = state;
      card.appendChild(detail);
    }
    root.appendChild(card);
  }
}

var chartHostWidth = 0;

function renderChart(root, rows, ordered) {
  root.replaceChildren();
  var hostW = root.clientWidth;
  if (!(hostW > 32)) hostW = 640;
  chartHostWidth = hostW;
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
  var integer = controls.valueMode !== 'probabilities';
  var dataMax = 0;
  var longest = 1;
  for (var i = 0; i < rows.length; i++) {
    dataMax = Math.max(dataMax, rows[i].value);
    longest = Math.max(longest, rows[i].state.length);
  }
  var scale = axisTicks(dataMax, integer);
  var padT = 12;
  var padR = 8;
  var innerH = 200;
  var labelGap = 16;
  var padL = chartPadLeft(scale.ticks, integer);
  var plotW = Math.max(80, hostW - padL - padR);
  var labels = chartLabels(plotW, rows.length, longest);
  var padB = labelGap + labels.drop;
  var width = hostW;
  var height = padT + innerH + padB;
  var slot = plotW / rows.length;
  var barW = Math.max(2, Math.min(28, slot * 0.7));
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Measurement counts');
  var axisY = padT + innerH;
  var defs = document.createElementNS(svgNS, 'defs');
  var clip = document.createElementNS(svgNS, 'clipPath');
  clip.setAttribute('id', 'chart-labels');
  var clipRect = document.createElementNS(svgNS, 'rect');
  clipRect.setAttribute('x', '0');
  clipRect.setAttribute('y', String(axisY - 2));
  clipRect.setAttribute('width', String(width));
  clipRect.setAttribute('height', String(height - axisY + 4));
  clip.appendChild(clipRect);
  defs.appendChild(clip);
  svg.appendChild(defs);
  for (var g = 0; g < scale.ticks.length; g++) {
    var tickValue = scale.ticks[g];
    var y = padT + innerH * (1 - tickValue / scale.axisMax);
    var line = document.createElementNS(svgNS, 'line');
    line.setAttribute('class', 'grid');
    line.setAttribute('x1', String(padL));
    line.setAttribute('x2', String(width - padR));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    svg.appendChild(line);
    var tick = document.createElementNS(svgNS, 'text');
    tick.setAttribute('class', 'tick');
    tick.setAttribute('x', String(padL - 8));
    tick.setAttribute('y', String(y + 4));
    tick.setAttribute('text-anchor', 'end');
    tick.textContent = formatTick(tickValue, integer);
    svg.appendChild(tick);
  }
  var labelLayer = document.createElementNS(svgNS, 'g');
  labelLayer.setAttribute('clip-path', 'url(#chart-labels)');
  for (var b = 0; b < rows.length; b++) {
    var row = rows[b];
    var barH = Math.max(row.value > 0 ? 1 : 0, (row.value / scale.axisMax) * innerH);
    var x = padL + b * slot + (slot - barW) / 2;
    var yBar = padT + innerH - barH;
    var rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('class', 'bar');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(yBar));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(barH));
    rect.setAttribute('rx', '3');
    svg.appendChild(rect);
    var tipText = row.state + ' · ' + (integer ? row.raw.toLocaleString('en-US') : (row.value * 100).toFixed(2) + '%');
    var hit = document.createElementNS(svgNS, 'rect');
    hit.setAttribute('x', String(padL + b * slot));
    hit.setAttribute('y', String(padT));
    hit.setAttribute('width', String(slot));
    hit.setAttribute('height', String(innerH + labelGap));
    hit.setAttribute('fill', 'transparent');
    hit.addEventListener('mouseenter', tipShow(tipText));
    hit.addEventListener('mousemove', tipMove);
    hit.addEventListener('mouseleave', tipHide);
    svg.appendChild(hit);
    if (b % labels.stride !== 0) continue;
    var anchorX = x + barW / 2;
    var anchorY = axisY + labelGap;
    var label = document.createElementNS(svgNS, 'text');
    label.setAttribute('class', 'tick');
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('transform', 'rotate(-60 ' + anchorX + ' ' + anchorY + ')');
    label.setAttribute('x', String(anchorX));
    label.setAttribute('y', String(anchorY));
    label.textContent = middleEllipsis(row.state, labels.limit);
    if (row.state.length > labels.limit) {
      var title = document.createElementNS(svgNS, 'title');
      title.textContent = row.state;
      label.appendChild(title);
    }
    labelLayer.appendChild(label);
  }
  svg.appendChild(labelLayer);
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
function iconDownloadNode() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'].forEach(function (d) {
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });
  return svg;
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
    if (!key) return;
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
document.getElementById('download-calibration').addEventListener('click', function () {
  vscodeApi.postMessage({ command: 'downloadCalibration' });
});
document.getElementById('download-input').addEventListener('click', function () {
  vscodeApi.postMessage({ command: 'downloadInput', which: activeInputId() });
});
document.getElementById('expand-input').addEventListener('click', function () {
  openFullscreen('input');
});
document.getElementById('expand-diagram').addEventListener('click', function () {
  openFullscreen('diagram');
});
document.getElementById('fullscreen-close').addEventListener('click', closeFullscreen);
document.getElementById('fullscreen').addEventListener('click', function (event) {
  if (event.target === event.currentTarget) closeFullscreen();
});
document.getElementById('fullscreen-tabs').addEventListener('click', function (event) {
  var button = event.target.closest('button');
  if (!button) return;
  var id = button.getAttribute('data-input');
  if (id !== 'original' && id !== 'processed') return;
  if (id !== 'processed') highlightLines = [];
  inputTab = id;
  renderInput();
});
document.addEventListener('keydown', function (event) {
  if (document.getElementById('fullscreen').hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeFullscreen();
    return;
  }
  if (event.key !== 'Tab') return;
  var panel = document.getElementById('fullscreen-panel');
  var nodes = panel.querySelectorAll('button, textarea, input, select, a[href]');
  var focusable = [];
  var i;
  for (i = 0; i < nodes.length; i++) {
    if (nodes[i].disabled || nodes[i].closest('[hidden]')) continue;
    focusable.push(nodes[i]);
  }
  if (!focusable.length) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  var active = document.activeElement;
  if (!panel.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
});
document.getElementById('input-tabs').addEventListener('click', function (event) {
  var button = event.target.closest('button');
  if (!button) return;
  var id = button.getAttribute('data-input');
  if (id !== 'original' && id !== 'processed') return;
  if (id !== 'processed') highlightLines = [];
  inputTab = id;
  renderInput();
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
  var sameCircuit = JSON.stringify(next.circuit) === JSON.stringify(model.circuit);
  model = next;
  if (!sameCounts) dirty = false;
  if (!sameCircuit) selectedGate = null;
  renderHeader();
  renderInput();
  renderDiagram();
  renderExplorer();
});
if (typeof ResizeObserver === 'function') {
  var chartBox = document.getElementById('chart');
  new ResizeObserver(function () {
    if (viewMode !== 'chart' || chartBox.hidden) return;
    var next = chartBox.clientWidth;
    if (!(next > 32) || Math.abs(next - chartHostWidth) < 2) return;
    renderExplorer();
  }).observe(chartBox);
}
renderHeader();
renderInput();
renderDiagram();
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

function iconExpand(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>`;
}

function iconClose(): string {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
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
