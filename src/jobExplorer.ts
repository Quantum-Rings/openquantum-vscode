// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import { extractCounts, type CountBar } from './results';

export type ValueMode = 'counts' | 'probabilities';
export type SortKey = 'state' | 'value';
export type SortDir = 'asc' | 'desc';
export type GroupMode = 'none' | 'hamming';
export type BitOrder = 'as-measured' | 'reversed';

export interface ExplorerControls {
    valueMode: ValueMode;
    sortKey: SortKey;
    sortDir: SortDir;
    groupMode: GroupMode;
    pattern: string;
    search: string;
    minCount: string;
    topN: string;
}

export interface ExplorerRow {
    state: string;
    raw: number;
    value: number;
}

export interface ExplorerStats {
    shots: number;
    unique: number;
    topState: string;
    topCount: number;
    entropy: number;
}

type Counts = Record<string, number>;

/**
 * The website job page's results explorer. One copy runs in the editor
 * webview and here, so filters, bit order, and the notebook stay aligned.
 */
export const EXPLORER_SOURCE = `
function reverseCounts(counts) {
  var out = {};
  var states = Object.keys(counts);
  for (var i = 0; i < states.length; i++) {
    var state = states[i];
    var flipped = state.split('').reverse().join('');
    out[flipped] = (out[flipped] || 0) + counts[state];
  }
  return out;
}

function applyBitOrder(counts, bitOrder) {
  if (bitOrder === 'reversed') return reverseCounts(counts);
  return counts;
}

function parseCounts(raw) {
  var trimmed = String(raw || '').trim();
  if (!trimmed) return { counts: null, error: null };
  var parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { counts: null, error: 'Not valid JSON. Expected an object like {"00": 512, "11": 500}.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { counts: null, error: 'Expected a JSON object mapping states to counts.' };
  }
  var out = {};
  var states = Object.keys(parsed);
  for (var i = 0; i < states.length; i++) {
    var state = states[i];
    var value = parsed[state];
    if (typeof value !== 'number' || value !== value || value < 0) {
      return { counts: null, error: 'State "' + state + '" has a non-numeric or negative count.' };
    }
    out[state] = value;
  }
  if (states.length === 0) return { counts: null, error: 'No states found.' };
  return { counts: out, error: null };
}

function matchesPattern(state, pattern) {
  if (!pattern) return true;
  if (pattern.length !== state.length) return false;
  for (var i = 0; i < pattern.length; i++) {
    var token = pattern.charAt(i);
    if (token !== '_' && token !== '*' && token !== state.charAt(i)) return false;
  }
  return true;
}

function hammingWeight(state) {
  var weight = 0;
  for (var i = 0; i < state.length; i++) if (state.charAt(i) === '1') weight++;
  return weight;
}

function shannonEntropy(counts) {
  var states = Object.keys(counts);
  var total = 0;
  for (var i = 0; i < states.length; i++) total += counts[states[i]];
  if (total === 0) return 0;
  var entropy = 0;
  for (var j = 0; j < states.length; j++) {
    var value = counts[states[j]];
    if (value <= 0) continue;
    var p = value / total;
    entropy -= p * Math.log(p) / Math.LN2;
  }
  return entropy;
}

function buildRows(counts, controls) {
  var working = counts;
  if (controls.groupMode === 'hamming') {
    working = {};
    var states = Object.keys(counts);
    for (var i = 0; i < states.length; i++) {
      var key = String(hammingWeight(states[i]));
      working[key] = (working[key] || 0) + counts[states[i]];
    }
  }
  var min = controls.minCount.trim() === '' ? null : Number(controls.minCount);
  var pattern = controls.pattern.trim();
  var search = controls.search.trim();
  var entries = Object.keys(working).filter(function (state) {
    var n = working[state];
    if (controls.groupMode === 'none' && !matchesPattern(state, pattern)) return false;
    if (search && state.indexOf(search) === -1) return false;
    if (min !== null && !isNaN(min) && n < min) return false;
    return true;
  }).map(function (state) { return [state, working[state]]; });
  entries.sort(function (a, b) {
    var cmp = controls.sortKey === 'state' ? String(a[0]).localeCompare(String(b[0])) : a[1] - b[1];
    return controls.sortDir === 'asc' ? cmp : -cmp;
  });
  var limit = controls.topN.trim() === '' ? null : Number(controls.topN);
  if (limit !== null && !isNaN(limit) && limit > 0) entries = entries.slice(0, limit);
  var total = 0;
  var keys = Object.keys(working);
  for (var t = 0; t < keys.length; t++) total += working[keys[t]];
  if (!total) total = 1;
  return entries.map(function (entry) {
    return {
      state: controls.groupMode === 'hamming' ? entry[0] + ' ones' : entry[0],
      raw: entry[1],
      value: controls.valueMode === 'probabilities' ? entry[1] / total : entry[1],
    };
  });
}

function explorerStats(counts) {
  var entries = Object.keys(counts).map(function (state) { return [state, counts[state]]; });
  if (entries.length === 0) return null;
  var shots = 0;
  for (var i = 0; i < entries.length; i++) shots += entries[i][1];
  var sorted = entries.slice().sort(function (a, b) { return b[1] - a[1]; });
  return {
    shots: shots,
    unique: entries.length,
    topState: sorted[0][0],
    topCount: sorted[0][1],
    entropy: shannonEntropy(counts),
  };
}

function notebookJson(counts) {
  var countsLiteral = JSON.stringify(counts || {}, null, 4);
  return JSON.stringify({
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: [
          '# Results Explorer export\\n',
          '\\n',
          'Your measurement counts are loaded into the \`counts\` variable below. ',
          'Run the cells to explore them.',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: ['counts = ' + countsLiteral + '\\n', 'counts'],
      },
      { cell_type: 'markdown', metadata: {}, source: ['## A few ways to use it'] },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          'total = sum(counts.values())\\n',
          'probs = {state: n / total for state, n in counts.items()}\\n',
          'top = max(counts, key=counts.get)\\n',
          'print("shots:", total)\\n',
          'print("most likely:", top, counts[top])\\n',
          'probs',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '# If qiskit is available, the standard histogram:\\n',
          '# from qiskit.visualization import plot_histogram\\n',
          '# plot_histogram(counts)\\n',
          '\\n',
          '# Otherwise a plain bar chart:\\n',
          'import matplotlib.pyplot as plt\\n',
          'states = sorted(counts)\\n',
          'plt.bar(states, [counts[s] for s in states])\\n',
          'plt.xlabel("state"); plt.ylabel("counts"); plt.xticks(rotation=90)\\n',
          'plt.show()',
        ],
      },
    ],
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python' },
    },
    nbformat: 4,
    nbformat_minor: 5,
  }, null, 1);
}

function isCountsObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  var keys = Object.keys(value);
  if (keys.length === 0) return false;
  for (var i = 0; i < keys.length; i++) {
    if (typeof value[keys[i]] !== 'number') return false;
  }
  return true;
}

function extractResultCounts(data) {
  if (isCountsObject(data)) return data;
  if (data && typeof data === 'object') {
    if (isCountsObject(data.counts)) return data.counts;
    if (data.data && typeof data.data === 'object') {
      if (isCountsObject(data.data.counts)) return data.data.counts;
      if (isCountsObject(data.data)) return data.data;
    }
    if (Array.isArray(data.results) && data.results[0] && isCountsObject(data.results[0].counts)) {
      return data.results[0].counts;
    }
  }
  return null;
}
`;

interface ExplorerFns {
    reverseCounts: (counts: Counts) => Counts;
    applyBitOrder: (counts: Counts, bitOrder: BitOrder) => Counts;
    parseCounts: (raw: string) => {
        counts: Counts | null;
        error: string | null;
    };
    buildRows: (counts: Counts, controls: ExplorerControls) => ExplorerRow[];
    explorerStats: (counts: Counts) => ExplorerStats | null;
    notebookJson: (counts: Counts | null) => string;
    extractResultCounts: (data: unknown) => Counts | null;
}

const loadExplorer = new Function(
    `${EXPLORER_SOURCE}\nreturn { reverseCounts, applyBitOrder, parseCounts, buildRows, explorerStats, notebookJson, extractResultCounts };`,
) as () => ExplorerFns;

const explorer = loadExplorer();

export const reverseCounts = explorer.reverseCounts;
export const applyBitOrder = explorer.applyBitOrder;
export const parseCounts = explorer.parseCounts;
export const buildRows = explorer.buildRows;
export const explorerStats = explorer.explorerStats;
export const notebookJson = explorer.notebookJson;

const DEFAULT_CONTROLS: ExplorerControls = {
    valueMode: 'counts',
    sortKey: 'value',
    sortDir: 'desc',
    groupMode: 'none',
    pattern: '',
    search: '',
    minCount: '',
    topN: '',
};

/** Counts the website explorer can chart, including pair-list results. */
export function countsFromOutput(data: unknown): Counts | null {
    const extracted = explorer.extractResultCounts(data);
    if (extracted) {
        return extracted;
    }
    const bars = extractCounts(data);
    if (!bars || bars.length === 0) {
        return null;
    }
    const out: Counts = {};
    for (const bar of bars) {
        out[bar.bitstring] = (out[bar.bitstring] ?? 0) + bar.count;
    }
    return out;
}

export function countsToBars(counts: Counts): CountBar[] {
    return Object.entries(counts)
        .map(([bitstring, count]) => ({ bitstring, count }))
        .sort(
            (a, b) =>
                b.count - a.count || a.bitstring.localeCompare(b.bitstring),
        );
}

export function defaultControls(): ExplorerControls {
    return { ...DEFAULT_CONTROLS };
}
