// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import type { ConfigField } from './jobConfig';
import { BUY_CREDITS_URL, OPEN_QUANTUM_SITE, SDK_KEYS_URL } from './links';

export interface ViewBackend {
    id: string;
    name: string;
    shortCode: string | null;
    providerId: string;
    providerName: string;
    type: string;
    status: string | null;
    queueDepth: number | null;
    acceptingJobs: boolean | null;
    sparkAvailable: boolean;
    description: string;
    light: 'green' | 'yellow' | 'red';
}

export interface ViewSubcategory {
    id: string;
    label: string;
    value: string;
}

export interface ViewChoice {
    value: string;
    label: string;
}

export interface ViewPlan {
    id: string;
    name: string;
    price: number;
}

export interface ViewQueue {
    id: string;
    name: string;
    priceIncrease: number;
}

export interface ViewQuote {
    planId: string;
    priorityId: string;
    planName: string;
    priorityName: string;
    credits: number;
    citation: boolean;
}

export interface ViewJob {
    id: string;
    name: string;
    status: string;
    backendName: string;
    providerName: string;
    submittedAt: string | null;
    creditsUsed: number | null;
}

export type PanelPage = 'home' | 'create' | 'jobs' | 'keys' | 'settings';

export interface PanelState {
    signedIn: boolean;
    organizations: { id: string; name: string }[];
    organizationId: string | null;
    balance: { sparkCredits: number; fullCredits: number } | null;
    backends: ViewBackend[];
    backendId: string | null;
    categories: ViewChoice[];
    category: string;
    subcategories: ViewSubcategory[];
    subcategory: string | null;
    jobName: string;
    configReady: boolean;
    configFields: ConfigField[];
    configErrors: string[];
    phase: 'idle' | 'working' | 'quote' | 'done' | 'error';
    step: 'setup' | 'quote' | 'job';
    page: PanelPage;
    canGoBack: boolean;
    status: string;
    plans: ViewPlan[];
    queues: ViewQueue[];
    quote: ViewQuote | null;
    error: string | null;
    jobs: ViewJob[];
    jobsCursor: string | null;
    jobsLoading: boolean;
    jobsError: string | null;
    selectedJobId: string | null;
}

const PAGE_LINKS = JSON.stringify({
    site: OPEN_QUANTUM_SITE,
    buyCredits: BUY_CREDITS_URL,
    sdkKeys: SDK_KEYS_URL,
});

export function webviewHtml(
    nonce: string,
    cspSource: string,
    logos: { onLight: string; onDark: string },
): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Open Quantum</title>
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-sideBar-background, transparent); margin: 0; padding: 12px; font-size: 12px; }
  .top { display: flex; align-items: center; }
  .brand { display: flex; align-items: center; min-width: 0; }
  .logo-btn { background: transparent; color: inherit; padding: 0; margin: 0; border-radius: 4px; }
  .logo { height: 26px; width: auto; display: block; }
  .logo.on-dark { display: none; }
  body.vscode-dark .logo.on-light,
  body.vscode-high-contrast:not(.vscode-high-contrast-light) .logo.on-light { display: none; }
  body.vscode-dark .logo.on-dark,
  body.vscode-high-contrast:not(.vscode-high-contrast-light) .logo.on-dark { display: block; }
  button.icon { background: transparent; color: var(--vscode-foreground); width: 28px; height: 28px; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
  button.icon[hidden] { display: none; }
  h2 { font-size: 16px; font-weight: 650; margin: 0 0 12px; line-height: 1.25; }
  .page-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 12px; }
  .page-head h2 { margin: 0; }
  #balance { margin-bottom: 0; }
  #banner:empty { display: none; }
  p, label { line-height: 1.4; }
  p { margin: 4px 0; }
  .muted, .status-line { color: var(--vscode-descriptionForeground); }
  .account-name { font-weight: 650; margin: 0 0 4px; }
  button, select, input { font: inherit; color: inherit; }
  button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; }
  button.primary { background: #50bc83; color: #ffffff; }
  button.primary:hover:not(:disabled) { background: #45a872; }
  button:disabled { opacity: 0.5; cursor: default; }
  button:focus-visible, .picker-closed:focus-visible, .logo-btn:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
  select, input { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px; padding: 4px; margin: 4px 0 8px; }
  input[type="checkbox"] { width: auto; margin: 0 8px 0 0; }
  .panel-section { margin: 10px 0 0; padding: 10px; border-radius: 10px; border: 1px solid color-mix(in srgb, #95ad9f 22%, transparent); background: color-mix(in srgb, #95ad9f 8%, transparent); }
  .panel-section h3 { margin: 0 0 8px; font-size: 12px; font-weight: 650; }
  .panel-section .hint { margin: 0 0 8px; }
  .field { position: relative; margin: 0 0 8px; }
  .field-label { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .field-label label { margin: 0; min-width: 0; }
  .field select, .field input:not([type="checkbox"]) { margin: 4px 0 0; }
  button.info { background: transparent; color: inherit; width: 22px; height: 22px; padding: 0; border-radius: 999px; opacity: 0.7; flex: 0 0 auto; }
  button.info:hover, button.info[aria-expanded="true"] { opacity: 1; color: #50bc83; }
  .tip { position: absolute; z-index: 8; left: 0; right: 0; top: 100%; margin-top: 4px; padding: 8px; border-radius: 8px; background: var(--vscode-editorHoverWidget-background, #1e1e1e); color: var(--vscode-editorHoverWidget-foreground, #fdfcfc); border: 1px solid var(--vscode-editorHoverWidget-border, rgba(149, 173, 159, 0.35)); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28); font-size: 11px; line-height: 1.4; }
  .req { color: #ef4444; font-weight: 700; }
  .balance-row { display: flex; align-items: stretch; gap: 8px; margin: 12px 0 0; }
  .stats { display: flex; gap: 8px; flex: 1; }
  .stat { flex: 1; padding: 7px 8px; border-radius: 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-widget-border, transparent); }
  .stat b { display: block; font-size: 15px; line-height: 1.2; }
  .stat span { color: var(--vscode-descriptionForeground); font-size: 11px; }
  .add { align-self: center; white-space: nowrap; }
  .org-line { margin: 6px 0 0; }
  .org-line button { background: transparent; color: var(--vscode-textLink-foreground); padding: 0; }
  .nav { display: flex; flex-wrap: wrap; justify-content: flex-start; align-content: flex-start; gap: 4px; margin: 12px 0 14px; }
  .nav button { border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
  .nav button.active { background: #50bc83; color: #ffffff; }
  button.icon:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,.25)); }
  .page-head .icon { flex: 0 0 auto; margin-left: auto; }
  a { color: var(--vscode-textLink-foreground); margin-right: 12px; cursor: pointer; }
  .picker { position: relative; margin: 4px 0 10px; }
  .picker-closed { display: flex; align-items: flex-start; gap: 8px; width: 100%; text-align: left; margin: 0; padding: 6px 8px; background: var(--vscode-dropdown-background, var(--vscode-input-background)); color: var(--vscode-dropdown-foreground, var(--vscode-input-foreground)); border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border, transparent)); border-radius: 4px; }
  .picker-menu { position: absolute; z-index: 5; left: 0; right: 0; max-height: 260px; overflow: auto; background: var(--vscode-dropdown-background, var(--vscode-editor-background)); border: 1px solid var(--vscode-dropdown-border, var(--vscode-contrastBorder, transparent)); border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,.28); }
  .group-title, .picker-provider { padding: 8px 2px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--vscode-descriptionForeground); }
  .group-title { position: sticky; top: 0; z-index: 1; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
  button.backend { display: flex; align-items: flex-start; gap: 8px; width: 100%; text-align: left; margin: 0; padding: 6px 8px 6px 16px; background: transparent; color: inherit; border-radius: 0; }
  button.backend.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
  .dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex: 0 0 auto; }
  .dot.green { background: #3fb950; }
  .dot.yellow { background: #d29922; }
  .dot.red { background: #f85149; }
  .name { font-weight: 650; }
  .picker-text { min-width: 0; flex: 1; }
  .caret { margin-left: auto; opacity: 0.8; }
  .card { border: 1px solid color-mix(in srgb, #95ad9f 20%, transparent); border-radius: 12px; padding: 10px; margin: 0 0 8px; background: var(--vscode-editor-background); }
  .card-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .card-title .name { font-size: 13px; font-weight: 650; min-width: 0; }
  .desc { margin: 6px 0 0; color: #4f5456; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  body.vscode-dark .desc { color: #95ad9f; }
  .meta { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .meta-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
  .meta-label { color: #4f5456; }
  body.vscode-dark .meta-label { color: #95ad9f; }
  .status-chip, .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .status-chip.online { background: rgba(80, 188, 131, 0.2); color: #50bc83; }
  .status-chip.maintenance { background: #fef9c3; color: #854d0e; }
  .status-chip.reserved { background: rgba(99, 102, 241, 0.15); color: #4f46e5; }
  .status-chip.offline { background: #fee2e2; color: #991b1b; }
  body.vscode-dark .status-chip.maintenance { background: rgba(113, 63, 18, 0.2); color: #fde047; }
  body.vscode-dark .status-chip.reserved { color: #a5b4fc; }
  body.vscode-dark .status-chip.offline { background: rgba(127, 29, 29, 0.2); color: #fca5a5; }
  .pill.type { background: rgba(149, 173, 159, 0.2); color: #50bc83; }
  .pill.yes { background: #dcfce7; color: #15803d; }
  .pill.no { background: #fee2e2; color: #b91c1c; }
  body.vscode-dark .pill.yes { background: rgba(20, 83, 45, 0.2); color: #86efac; }
  body.vscode-dark .pill.no { background: rgba(127, 29, 29, 0.2); color: #fca5a5; }
  .status-chip.has-spark { position: relative; }
  .spark { width: 12px; height: 12px; flex: 0 0 auto; display: block; }
  .spark-tip { display: none; position: absolute; z-index: 9; top: calc(100% + 6px); right: 0; padding: 4px 8px; border-radius: 6px; background: var(--vscode-editorHoverWidget-background, #1e1e1e); color: var(--vscode-editorHoverWidget-foreground, #fdfcfc); border: 1px solid var(--vscode-editorHoverWidget-border, rgba(149, 173, 159, 0.35)); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28); font-size: 11px; font-weight: 500; line-height: 1.3; white-space: nowrap; pointer-events: none; }
  .status-chip.has-spark:hover .spark-tip { display: block; }
  .card-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid color-mix(in srgb, #95ad9f 20%, transparent); }
  .card-actions .primary { width: 100%; }
  button.specs { background: transparent; color: #50bc83; padding: 2px 0; }
  button.specs:hover { color: #45a872; text-decoration: underline; }
  button.job { display: block; width: 100%; text-align: left; margin: 0 0 8px; padding: 8px; border-radius: 8px; border: 1px solid var(--vscode-widget-border, transparent); background: var(--vscode-editor-background); }
  button.job.selected { border-color: #50bc83; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .status.ok { color: #3fb950; }
  .status.bad { color: var(--vscode-errorForeground); }
  .status.warn { color: #d29922; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .buttons .primary { flex: 1 0 100%; }
  .credits { font-size: 13px; font-weight: 650; margin: 4px 0 8px; }
  .error { color: var(--vscode-errorForeground); white-space: pre-wrap; }
</style>
</head>
<body>
  <div class="top">
    <div class="brand">
      <button id="home" type="button" class="logo-btn" aria-label="Open Quantum" title="openquantum.com">
        <img class="logo on-light" src="${logos.onLight}" alt="Open Quantum" />
        <img class="logo on-dark" src="${logos.onDark}" alt="" />
      </button>
    </div>
  </div>
  <div id="balance"></div>
  <div id="nav" class="nav"></div>
  <div id="banner"></div>
  <div id="main"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const links = ${PAGE_LINKS};
    const balance = document.getElementById('balance');
    const nav = document.getElementById('nav');
    const banner = document.getElementById('banner');
    const main = document.getElementById('main');
    let pickerOpen = false;
    let openTip = null;
    let latest = null;

    const post = (command, extra) => vscode.postMessage(Object.assign({ command }, extra || {}));

    document.getElementById('home').addEventListener('click', () => post('openLink', { url: links.site }));

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (link) {
        event.preventDefault();
        post('openLink', { url: link.getAttribute('href') });
        return;
      }
      let changed = false;
      if (openTip && !target.closest('.tip') && !target.closest('.info')) {
        openTip = null;
        changed = true;
      }
      if (pickerOpen && !target.closest('.picker')) {
        pickerOpen = false;
        changed = true;
      }
      if (changed && latest) render(latest);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || (!pickerOpen && !openTip)) return;
      pickerOpen = false;
      openTip = null;
      if (latest) render(latest);
    });

    function commandButton(label, command, primary) {
      return clickButton(label, () => post(command), primary);
    }

    function clickButton(label, onClick, primary) {
      const node = document.createElement('button');
      node.type = 'button';
      node.textContent = label;
      if (primary) node.className = 'primary';
      node.addEventListener('click', onClick);
      return node;
    }

    function buttonRow(nodes) {
      const row = document.createElement('div');
      row.className = 'buttons';
      for (const node of nodes) row.appendChild(node);
      return row;
    }

    function heading(text) {
      const node = document.createElement('h2');
      node.textContent = text;
      return node;
    }

    function pageHead(title, command) {
      const row = document.createElement('div');
      row.className = 'page-head';
      row.appendChild(heading(title));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon';
      button.setAttribute('aria-label', 'Refresh');
      button.title = 'Refresh';
      button.appendChild(refreshIcon());
      button.addEventListener('click', () => post(command));
      row.appendChild(button);
      return row;
    }

    function refreshIcon() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      for (const d of [
        'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
        'M21 3v5h-5',
        'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
        'M8 16H3v5',
      ]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
      }
      return svg;
    }

    function jobNameField(state) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const row = document.createElement('div');
      row.className = 'field-label';
      row.appendChild(fieldTitle('Job Name', true));
      wrap.appendChild(row);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 255;
      input.value = state.jobName || '';
      input.placeholder = 'Enter a descriptive name for your job';
      input.addEventListener('input', () => post('setJobName', { name: input.value }));
      wrap.appendChild(input);
      return wrap;
    }

    function paragraph(text, className) {
      const node = document.createElement('p');
      if (className) node.className = className;
      node.textContent = text;
      return node;
    }

    function labeledSelect(labelText, items, selected, onChange) {
      const label = document.createElement('label');
      label.textContent = labelText;
      const select = document.createElement('select');
      for (const item of items) {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        option.selected = item.value === selected;
        select.appendChild(option);
      }
      select.addEventListener('change', () => onChange(select.value));
      return [label, select];
    }

    function lockControls(container) {
      const controls = container.querySelectorAll('button, select, input');
      for (const control of controls) control.disabled = true;
    }

    function render(state) {
      const scroller = document.scrollingElement;
      const scroll = scroller ? scroller.scrollTop : 0;
      const active = document.activeElement;
      const typing = !!(active && active.closest && active.closest('#main') && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName));
      const keep = typing && latest && state.page === latest.page && state.step === latest.step && state.phase === latest.phase && state.backendId === latest.backendId && state.configReady === latest.configReady && state.configErrors.join('\\n') === latest.configErrors.join('\\n');
      latest = state;
      renderBalance(state);
      renderNav(state);
      renderBanner(state);
      if (!keep) {
        pickerOpen = state.page === 'create' ? pickerOpen : false;
        if (state.page !== 'create' || state.step !== 'setup') openTip = null;
        main.replaceChildren();
        if (state.page === 'home') renderHome(state);
        else if (state.page === 'jobs') renderJobs(state);
        else if (state.page === 'keys') renderKeys(state);
        else if (state.page === 'settings') renderSettings(state);
        else if (state.step === 'quote') renderQuote(state);
        else renderSetup(state);
      }
      if (scroller) scroller.scrollTop = scroll;
    }

    function renderBalance(state) {
      balance.replaceChildren();
      if (!state.signedIn) {
        balance.appendChild(paragraph('Add an SDK key to see credits and private backends.', 'muted'));
        return;
      }
      const row = document.createElement('div');
      row.className = 'balance-row';
      const stats = document.createElement('div');
      stats.className = 'stats';
      stats.append(
        stat(state.balance ? formatCredits(state.balance.sparkCredits) : '…', 'Spark', 'Spark credits'),
        stat(state.balance ? formatCredits(state.balance.fullCredits) : '…', 'Full', 'Full credits'),
      );
      const add = clickButton('Add credits', () => post('openLink', { url: links.buyCredits }), true);
      add.className = 'primary add';
      row.append(stats, add);
      balance.appendChild(row);
      const org = state.organizations.find((item) => item.id === state.organizationId);
      if (org) {
        const line = document.createElement('p');
        line.className = 'org-line';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = org.name;
        button.addEventListener('click', () => post('navigate', { page: 'settings' }));
        line.appendChild(button);
        balance.appendChild(line);
      }
    }

    function stat(value, label, title) {
      const node = document.createElement('div');
      node.className = 'stat';
      node.title = title;
      const amount = document.createElement('b');
      amount.textContent = value;
      const caption = document.createElement('span');
      caption.textContent = label;
      node.append(amount, caption);
      return node;
    }

    function renderNav(state) {
      nav.replaceChildren();
      const items = [
        ['home', 'Backends'],
        ['create', 'Create Job'],
        ['jobs', 'Jobs'],
        ['keys', 'SDK Keys'],
        ['settings', 'Settings'],
      ];
      for (const item of items) {
        const button = clickButton(item[1], () => post('navigate', { page: item[0] }), false);
        button.className = state.page === item[0] ? 'active' : '';
        if (state.page === item[0]) button.setAttribute('aria-current', 'page');
        nav.appendChild(button);
      }
    }

    function trackedJobStatus(status) {
      return /^Job \S+ · /.test(status);
    }

    function renderBanner(state) {
      banner.replaceChildren();
      if (state.status && !trackedJobStatus(state.status)) banner.appendChild(paragraph(state.status, 'status-line'));
      const duplicate = state.page === 'create' && state.step === 'setup' && state.configErrors.length > 0 && state.error === state.configErrors.join('\\n');
      if (state.error && !duplicate) {
        const err = paragraph(state.error);
        err.className = 'error';
        banner.appendChild(err);
      }
      if (state.jobsError) {
        const err = paragraph(state.jobsError);
        err.className = 'error';
        banner.appendChild(err);
      }
    }

    function signedOut(text) {
      main.appendChild(paragraph(text, 'muted'));
      main.appendChild(buttonRow([clickButton('Open SDK Keys', () => post('navigate', { page: 'keys' }), true)]));
    }

    function renderHome(state) {
      main.appendChild(pageHead('Backends', 'refresh'));
      if (!state.signedIn) {
        signedOut('Add an SDK key to see live status, queue depth, and private backends.');
        return;
      }
      if (state.backends.length === 0) {
        main.appendChild(paragraph(state.status === 'Loading…' ? 'Loading backends…' : 'No backends for this organization.', 'muted'));
        return;
      }
      for (const group of providerGroups(state.backends)) {
        const head = document.createElement('div');
        head.className = 'group-title';
        head.textContent = group.name;
        main.appendChild(head);
        for (const backend of group.items) main.appendChild(backendCard(backend));
      }
    }

    function backendCard(backend) {
      const card = document.createElement('article');
      card.className = 'card';
      const title = document.createElement('div');
      title.className = 'card-title';
      const heading = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = backend.name;
      heading.appendChild(name);
      if (backend.shortCode) heading.appendChild(paragraph(backend.shortCode, 'muted'));
      title.append(heading, statusChip(backend.status, backend.sparkAvailable));
      card.appendChild(title);
      if (backend.description) {
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = backend.description;
        card.appendChild(desc);
      }
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.append(
        metaRow('Type:', pill(backend.type || 'Backend', 'type')),
        metaRow('Accepting Jobs:', pill(backend.acceptingJobs === true ? 'Yes' : 'No', backend.acceptingJobs === true ? 'yes' : 'no')),
        metaRow('Queue:', queueText((backend.queueDepth == null ? 0 : backend.queueDepth) + ' jobs')),
      );
      const actions = document.createElement('div');
      actions.className = 'card-actions';
      const key = backend.shortCode || backend.id;
      const select = clickButton('Select Backend', () => post('useBackend', { backendId: key }), true);
      const specs = clickButton('View live specs', () => post('openBackend', { backendId: key }), false);
      specs.className = 'specs';
      actions.append(select, specs);
      card.append(meta, actions);
      return card;
    }

    function statusChip(status, spark) {
      const node = document.createElement('span');
      node.className = 'status-chip ' + statusKind(status);
      node.textContent = status || 'Offline';
      if (spark) {
        node.classList.add('has-spark');
        node.appendChild(sparkIcon());
        const tip = document.createElement('span');
        tip.className = 'spark-tip';
        tip.setAttribute('role', 'tooltip');
        tip.textContent = 'Spark is available';
        node.appendChild(tip);
      }
      return node;
    }

    function statusKind(status) {
      const name = String(status || 'offline').toLowerCase();
      if (name === 'online' || name === 'maintenance' || name === 'reserved') return name;
      return 'offline';
    }

    function pill(text, kind) {
      const node = document.createElement('span');
      node.className = 'pill ' + kind;
      node.textContent = text;
      return node;
    }

    function metaRow(label, value) {
      const row = document.createElement('div');
      row.className = 'meta-row';
      const caption = document.createElement('span');
      caption.className = 'meta-label';
      caption.textContent = label;
      row.append(caption, value);
      return row;
    }

    function queueText(text) {
      const node = document.createElement('strong');
      node.textContent = text;
      return node;
    }

    function sparkIcon() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'spark');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '12');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Spark is available');
      for (const d of [
        'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z',
        'M20 2v4',
        'M22 4h-4',
      ]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
      }
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', '4');
      dot.setAttribute('cy', '20');
      dot.setAttribute('r', '2');
      svg.appendChild(dot);
      return svg;
    }

    function renderJobs(state) {
      main.appendChild(pageHead('Jobs', 'refreshJobs'));
      if (!state.signedIn) {
        signedOut('Add an SDK key to see jobs for this organization.');
        return;
      }
      if (state.jobsLoading && state.jobs.length === 0) {
        main.appendChild(paragraph('Loading jobs…', 'muted'));
        return;
      }
      if (state.jobs.length === 0) {
        main.appendChild(paragraph('No jobs for this organization.', 'muted'));
      }
      for (const job of state.jobs) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'job' + (job.id === state.selectedJobId ? ' selected' : '');
        const top = document.createElement('div');
        top.className = 'row';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = job.name || 'Job';
        const status = document.createElement('span');
        status.className = 'status ' + statusTone(job.status);
        status.textContent = job.status || 'Unknown';
        top.append(name, status);
        const meta = document.createElement('div');
        meta.className = 'muted';
        const where = [job.providerName, job.backendName].filter(Boolean).join(' · ');
        const when = formatWhen(job.submittedAt);
        const credits = job.creditsUsed == null ? '' : creditLabel(job.creditsUsed);
        meta.textContent = [where, when, credits].filter(Boolean).join(' · ');
        card.append(top, meta);
        card.addEventListener('click', () => post('openJob', { jobId: job.id }));
        main.appendChild(card);
      }
      if (state.jobsCursor) {
        const more = commandButton(state.jobsLoading ? 'Loading…' : 'Load more…', 'moreJobs', false);
        more.disabled = !!state.jobsLoading;
        main.appendChild(buttonRow([more]));
      }
    }

    function renderKeys(state) {
      main.appendChild(heading('SDK Keys'));
      main.appendChild(paragraph('An SDK key is the JSON file from Open Quantum. The extension uses it to list private backends and submit jobs.', 'muted'));
      if (state.signedIn) main.appendChild(paragraph('A key is saved for this editor.'));
      const actions = [commandButton('Set SDK key', 'setKey', !state.signedIn)];
      if (state.signedIn) actions.push(commandButton('Clear key', 'clearKey', false));
      main.appendChild(buttonRow(actions));
      const line = document.createElement('p');
      line.className = 'links';
      const anchor = document.createElement('a');
      anchor.href = links.sdkKeys;
      anchor.textContent = 'Manage keys on the web';
      line.appendChild(anchor);
      main.appendChild(line);
    }

    function renderSettings(state) {
      main.appendChild(heading('Settings'));
      main.appendChild(paragraph('Jobs, credits, and private backends follow the selected organization.', 'muted'));
      if (!state.signedIn) {
        signedOut('Save an SDK key to choose an organization.');
        return;
      }
      if (state.organizations.length === 0) {
        main.appendChild(paragraph('No organization was found for this SDK key.', 'muted'));
        return;
      }
      if (state.organizations.length === 1) {
        const name = paragraph(state.organizations[0].name);
        name.className = 'account-name';
        main.appendChild(name);
        return;
      }
      const fields = document.createElement('div');
      fields.append.apply(fields, labeledSelect('Organization', state.organizations.map((item) => ({ value: item.id, label: item.name })), state.organizationId, (value) => post('selectOrg', { organizationId: value })));
      if (state.phase === 'working') lockControls(fields);
      main.appendChild(fields);
    }

    function renderSetup(state) {
      main.appendChild(heading('Create Job'));
      if (!state.signedIn) {
        signedOut('Add an SDK key to submit a circuit.');
        return;
      }
      const fields = document.createElement('div');
      if (state.backends.length === 0) {
        fields.appendChild(paragraph('No backends.', 'muted'));
      } else {
        const label = document.createElement('label');
        label.textContent = 'Backend';
        fields.append(label, backendPicker(state));
      }
      const settings = sectionBox('Job Settings & Metadata');
      settings.appendChild(jobNameField(state));
      if (state.categories.length > 0) {
        settings.appendChild(selectField('Category', state.categories, state.category, (value) => post('selectCategory', { category: value })));
      }
      if (state.subcategories.length > 0) {
        settings.appendChild(selectField('Subcategory', state.subcategories.map((item) => ({ value: item.value, label: item.label })), state.subcategory, (value) => post('selectSubcategory', { subcategory: value })));
      }
      fields.appendChild(settings);
      if (state.backendId && !state.configReady) {
        const loading = sectionBox('Job Configuration Parameters');
        loading.appendChild(paragraph('Loading configuration…', 'muted'));
        fields.appendChild(loading);
      } else if (state.configFields.length > 0) {
        const parameters = sectionBox('Job Configuration Parameters');
        if (state.configFields.some((field) => field.required)) {
          const hint = paragraph('', 'muted hint');
          hint.appendChild(document.createTextNode('Fields marked with '));
          const star = document.createElement('span');
          star.className = 'req';
          star.textContent = '*';
          hint.appendChild(star);
          hint.appendChild(document.createTextNode(' are required'));
          parameters.appendChild(hint);
        }
        for (const field of state.configFields) parameters.appendChild(configControl(field));
        fields.appendChild(parameters);
      }
      for (const message of state.configErrors) {
        const err = paragraph(message);
        err.className = 'error';
        fields.appendChild(err);
      }
      if (state.phase === 'working') lockControls(fields);
      main.appendChild(fields);
      const submit = commandButton(state.phase === 'working' ? 'Validating…' : 'Validate', 'prepare', true);
      submit.disabled = state.phase === 'working' || !state.configReady || state.configErrors.length > 0 || !state.backendId;
      const actions = [submit];
      if (state.phase === 'working') actions.push(commandButton('Cancel', 'cancel', false));
      main.appendChild(buttonRow(actions));
    }

    function renderQuote(state) {
      main.appendChild(heading('Job Summary'));
      if (!state.quote) {
        main.appendChild(paragraph('Validate again to get a new summary.', 'muted'));
        main.appendChild(buttonRow([commandButton('Back', 'back', false)]));
        return;
      }
      const fields = document.createElement('div');
      if (state.plans.length > 0) {
        fields.append.apply(fields, labeledSelect('Plan', state.plans.map((plan) => ({ value: plan.id, label: plan.name + ' · ' + creditLabel(plan.price) })), state.quote.planId, (value) => post('selectPlan', { planId: value })));
      }
      if (state.queues.length > 0) {
        fields.append.apply(fields, labeledSelect('Queue', state.queues.map((queue) => ({ value: queue.id, label: queueLabel(queue) })), state.quote.priorityId, (value) => post('selectQueue', { priorityId: value })));
      }
      if (state.phase === 'working') lockControls(fields);
      main.appendChild(fields);
      const summary = paragraph(creditLabel(state.quote.credits));
      summary.className = 'credits';
      main.appendChild(summary);
      if (state.quote.citation) {
        main.appendChild(paragraph('Public Plan: publications that use this job need to cite Open Quantum. See www.openquantum.com/citation.', 'muted'));
      }
      const submit = commandButton('Submit', 'submit', true);
      submit.disabled = state.phase === 'working';
      const actions = [submit];
      if (state.phase === 'working') actions.push(commandButton('Cancel', 'cancel', false));
      else actions.push(commandButton('Back', 'back', false));
      main.appendChild(buttonRow(actions));
    }

    function backendPicker(state) {
      const selected = state.backends.find((backend) => isSelected(backend, state.backendId));
      const wrap = document.createElement('div');
      wrap.className = 'picker';
      const closed = document.createElement('button');
      closed.type = 'button';
      closed.className = 'picker-closed';
      closed.setAttribute('aria-expanded', pickerOpen ? 'true' : 'false');
      closed.setAttribute('aria-haspopup', 'listbox');
      fillBackendSummary(closed, selected);
      closed.addEventListener('click', () => {
        pickerOpen = !pickerOpen;
        if (latest) render(latest);
      });
      wrap.appendChild(closed);
      if (pickerOpen) wrap.appendChild(backendMenu(state));
      return wrap;
    }

    function fillBackendSummary(button, backend) {
      if (backend) {
        const dot = document.createElement('span');
        dot.className = 'dot ' + backend.light;
        button.appendChild(dot);
      }
      const text = document.createElement('span');
      text.className = 'picker-text';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = backend ? backend.name + (backend.shortCode ? ' · ' + backend.shortCode : '') : 'Select a backend';
      text.appendChild(name);
      if (backend) {
        const meta = document.createElement('div');
        meta.className = 'muted';
        meta.textContent = backend.providerName + ' · ' + backendStatus(backend);
        text.appendChild(meta);
      }
      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.textContent = '▾';
      button.append(text, caret);
    }

    function backendMenu(state) {
      const menu = document.createElement('div');
      menu.className = 'picker-menu';
      menu.setAttribute('role', 'listbox');
      for (const group of providerGroups(state.backends)) {
        const head = document.createElement('div');
        head.className = 'picker-provider';
        head.textContent = group.name;
        menu.appendChild(head);
        for (const backend of group.items) {
          const row = document.createElement('button');
          row.type = 'button';
          const selected = isSelected(backend, state.backendId);
          row.className = 'backend' + (selected ? ' selected' : '');
          row.setAttribute('role', 'option');
          row.setAttribute('aria-selected', selected ? 'true' : 'false');
          const dot = document.createElement('span');
          dot.className = 'dot ' + backend.light;
          const text = document.createElement('span');
          const name = document.createElement('div');
          name.className = 'name';
          name.textContent = backend.name + (backend.shortCode ? ' · ' + backend.shortCode : '');
          const meta = document.createElement('div');
          meta.className = 'muted';
          meta.textContent = backendStatus(backend);
          text.append(name, meta);
          row.append(dot, text);
          row.addEventListener('click', () => {
            pickerOpen = false;
            post('selectBackend', { backendId: backend.shortCode || backend.id });
          });
          menu.appendChild(row);
        }
      }
      return menu;
    }

    function providerGroups(backends) {
      const groups = [];
      for (const backend of backends) {
        let group = null;
        for (const item of groups) {
          if (item.name === backend.providerName) group = item;
        }
        if (!group) {
          group = { name: backend.providerName, items: [] };
          groups.push(group);
        }
        group.items.push(backend);
      }
      return groups;
    }

    function isSelected(backend, backendId) {
      return backend.id === backendId || backend.shortCode === backendId;
    }

    function sectionBox(title) {
      const box = document.createElement('section');
      box.className = 'panel-section';
      const head = document.createElement('h3');
      head.textContent = title;
      box.appendChild(head);
      return box;
    }

    function selectField(labelText, items, selected, onChange) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const row = document.createElement('div');
      row.className = 'field-label';
      row.appendChild(fieldTitle(labelText, false));
      wrap.appendChild(row);
      wrap.appendChild(selectControl(items, selected, onChange));
      return wrap;
    }

    function selectControl(items, selected, onChange) {
      const select = document.createElement('select');
      for (const item of items) {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        option.selected = item.value === selected;
        select.appendChild(option);
      }
      select.addEventListener('change', () => onChange(select.value));
      return select;
    }

    function fieldTitle(text, required) {
      const label = document.createElement('label');
      label.appendChild(document.createTextNode(text));
      if (required) {
        const star = document.createElement('span');
        star.className = 'req';
        star.textContent = ' *';
        label.appendChild(star);
      }
      return label;
    }

    function infoButton(field) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'info';
      button.setAttribute('aria-label', 'Help for ' + field.label);
      button.setAttribute('aria-expanded', openTip === field.key ? 'true' : 'false');
      button.title = 'About this parameter';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('aria-hidden', 'true');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '9');
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      stem.setAttribute('d', 'M12 11v6');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      dot.setAttribute('d', 'M12 8h.01');
      svg.append(circle, stem, dot);
      button.appendChild(svg);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        openTip = openTip === field.key ? null : field.key;
        if (latest) render(latest);
      });
      return button;
    }

    function configControl(field) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const row = document.createElement('div');
      row.className = 'field-label';
      if (field.kind === 'boolean') {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = field.value === 'true';
        box.addEventListener('change', () => post('setConfig', { key: field.key, value: box.checked ? 'true' : 'false' }));
        label.append(box, document.createTextNode(field.label));
        if (field.required) {
          const star = document.createElement('span');
          star.className = 'req';
          star.textContent = ' *';
          label.appendChild(star);
        }
        row.appendChild(label);
      } else {
        row.appendChild(fieldTitle(field.label, field.required));
      }
      if (field.description) row.appendChild(infoButton(field));
      wrap.appendChild(row);
      if (field.kind === 'enum') {
        wrap.appendChild(selectControl(field.choices, field.value, (value) => post('setConfig', { key: field.key, value: value })));
      } else if (field.kind !== 'boolean') {
        const input = document.createElement('input');
        input.type = field.kind === 'integer' || field.kind === 'number' ? 'number' : 'text';
        if (field.min != null) input.min = String(field.min);
        if (field.max != null) input.max = String(field.max);
        if (field.step != null) input.step = String(field.step);
        input.value = field.value;
        input.addEventListener('change', () => post('setConfig', { key: field.key, value: input.value }));
        wrap.appendChild(input);
      }
      if (openTip === field.key && field.description) {
        const tip = document.createElement('div');
        tip.className = 'tip';
        tip.setAttribute('role', 'tooltip');
        tip.textContent = field.description;
        wrap.appendChild(tip);
      }
      return wrap;
    }

    function backendStatus(backend) {
      const parts = [backend.status || 'Unknown'];
      if (backend.acceptingJobs === false) parts.push('not accepting');
      if (backend.queueDepth != null) parts.push('queue ' + backend.queueDepth);
      if (backend.sparkAvailable) parts.push('Spark');
      return parts.join(' · ');
    }

    function statusTone(status) {
      const name = String(status || '').toLowerCase();
      if (name === 'completed') return 'ok';
      if (name === 'failed' || name === 'canceled' || name === 'cancelled') return 'bad';
      if (name === 'running' || name === 'pending' || name === 'queued' || name === 'preparing' || name === 'created' || name === 'submitted') return 'warn';
      return 'muted';
    }

    function queueLabel(queue) {
      if (!queue.priceIncrease) return queue.name;
      const sign = queue.priceIncrease > 0 ? '+' : '';
      return queue.name + ' · ' + sign + formatCredits(queue.priceIncrease);
    }

    function formatWhen(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString();
    }

    function formatCredits(value) {
      return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
    }

    function creditLabel(value) {
      if (value === 0) return 'free';
      return formatCredits(value) + (value === 1 ? ' credit' : ' credits');
    }

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'state') render(event.data.state);
    });
    post('ready');
  </script>
</body>
</html>`;
}
