// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import {
    formatCalibrationStamp,
    summarizeCalibration,
    type CalibrationBasics,
    type CalibrationFigure,
} from './calibrationSummary';
import {
    couplingSvg,
    layoutCoupling,
    normalizeCouplingEdges,
    type CouplingLayout,
} from './couplingMap';
import { liveCouplingFromCalibration } from './liveCoupling';

export interface BackendCatalogFacts {
    id: string;
    name: string;
    shortCode: string | null;
    providerName: string;
    type: string;
    status: string | null;
    queueDepth: number | null;
    acceptingJobs: boolean | null;
    description: string;
    sparkAvailable: boolean;
}

export interface NamedValue {
    label: string;
    value: string;
}

export interface FeatureItem {
    key: string;
    label: string;
    description: string;
}

export interface BackendDetailModel {
    id: string;
    name: string;
    shortCode: string | null;
    providerName: string;
    type: string;
    status: string | null;
    queueDepth: number | null;
    acceptingJobs: boolean | null;
    description: string;
    sparkAvailable: boolean;
    qubits: number | null;
    nativeOps: string[];
    supportedOps: string[];
    features: FeatureItem[];
    limits: NamedValue[];
    coupling: CouplingLayout | null;
    couplingNote: string | null;
    /** Chip size from n_qubits. Null when the device does not publish one. */
    physicalQubits: number | null;
    /** Offered qubits from the calibration snapshot. Null when no snapshot applies. */
    live: {
        coupling: CouplingLayout | null;
        qubits: number;
        note: string | null;
    } | null;
    calibrationAvailable: boolean;
    /** 1Q, 2Q, T1, and T2 from the calibration snapshot. Null when it is not calibration. */
    calibration: CalibrationBasics | null;
    /** Website stamp for calibration_updated_at. An em dash when it is missing. */
    calibrationUpdated: string;
}

const FEATURE_INFO: Record<string, { label: string; description: string }> = {
    measure: {
        label: 'Measurement',
        description: 'Basic measurement of qubit state at end of circuit.',
    },
    mid_circuit_measure: {
        label: 'Mid-Circuit Measurement',
        description:
            'Measure qubits in the middle of a circuit (enables dynamic circuits).',
    },
    explicit_measure: {
        label: 'Explicit Measurement',
        description:
            'A program that declares classical bits must include a measure. A program with no classical register is allowed.',
    },
    dynamic_circuits: {
        label: 'Dynamic Circuits',
        description: 'Full dynamic circuit support with classical feedback.',
    },
    reset: {
        label: 'Reset',
        description: 'Mid-circuit qubit reset operations.',
    },
    physical_qubits: {
        label: 'Physical Qubit Addressing',
        description:
            'Supports direct physical qubit syntax ($0, $1, ...) in OpenQASM.',
    },
    verbatim_boxes: {
        label: 'Verbatim Boxes',
        description:
            'Supports #pragma braket verbatim and box for native gate control.',
    },
    result_pragmas: {
        label: 'Result Pragmas',
        description: 'Supports provider-specific result pragmas.',
    },
    barriers: {
        label: 'Barriers',
        description:
            'Barrier statements for controlling gate scheduling and optimization.',
    },
    defcal: {
        label: 'Defcal / Pulse Definitions',
        description: 'OpenPulse-style defcal and frame definitions.',
    },
    openpulse: {
        label: 'OpenPulse',
        description:
            'Full OpenPulse support (frames, waveforms, play/capture).',
    },
    subroutines: {
        label: 'Subroutines',
        description: 'Reusable classical and quantum functions.',
    },
    custom_gates: {
        label: 'Custom Gates',
        description: 'User-defined gate blocks.',
    },
    classical_control: {
        label: 'Classical Control',
        description: 'Classical if, for, and while control flow.',
    },
    classical_variables: {
        label: 'Classical Variables',
        description: 'Non-bit classical types (int, float, angle, and others).',
    },
    arrays: {
        label: 'Classical Arrays',
        description: 'Classical array declarations and slicing.',
    },
    complex_types: {
        label: 'Complex Numbers',
        description: 'Complex numbers and related types.',
    },
    gate_modifiers: {
        label: 'Gate Modifiers',
        description: 'ctrl @, inv @, pow @, and other modifiers.',
    },
    timing: {
        label: 'Timing and Delay',
        description: 'delay, duration literals, and timed constructs.',
    },
    parametric: {
        label: 'Parametric Circuits',
        description: 'Free parameters that are preserved through compilation.',
    },
    noise_pragmas: {
        label: 'Noise Pragmas',
        description: 'Noise injection pragmas for simulation.',
    },
    multiple_registers: {
        label: 'Multiple Registers',
        description: 'More than one qubit register is allowed.',
    },
    physical_virtual_mix: {
        label: 'Physical and Virtual Mix',
        description:
            'Physical qubits ($N) and virtual registers may be used in the same program.',
    },
    relaxed_virtual_qubits: {
        label: 'Relaxed Virtual Qubits',
        description: 'Virtual qubit indices may start above 0 or leave gaps.',
    },
    bare_qubit_indexing: {
        label: 'Bare Qubit Indexing',
        description: 'A bare qubit declaration may be indexed.',
    },
    duration_boxes: {
        label: 'Duration Boxes',
        description: 'A box may include a duration.',
    },
    register_concat: {
        label: 'Register Concatenation',
        description: 'Qubit registers may be concatenated with ++.',
    },
    mixed_measurement_result_pragmas: {
        label: 'Mixed Measurement and Result Pragmas',
        description:
            'A measure may appear in the same program as a result pragma.',
    },
};

type JsonRecord = Record<string, unknown>;

/** Turn a scheduler backend-class payload into the details page model. */
export function parseBackendDetails(
    payload: unknown,
    catalog: BackendCatalogFacts,
    calibration?: unknown,
): BackendDetailModel {
    const root = asRecord(payload) ?? {};
    const constraint = asRecord(root.constraint_data) ?? {};
    const topology = asRecord(constraint.topology) ?? {};
    // coupling_map is the physical chip. A calibration document narrows it
    // to the qubits that snapshot offers.
    const drawnRaw = asEdges(topology.coupling_map);
    const directed = topology.directed_edges === true;
    const drawn = normalizeCouplingEdges(drawnRaw, directed);
    const coupling =
        drawn.length > 0 ? layoutCoupling(drawn, drawn, null, directed) : null;
    const qubits = finiteNumber(constraint.n_qubits);
    const liveRaw = calibration
        ? liveCouplingFromCalibration(
              drawnRaw,
              labelMap(topology.qubit_labels),
              calibration,
          )
        : null;
    const liveEdges = liveRaw
        ? normalizeCouplingEdges(liveRaw.edges, directed)
        : [];
    const liveCoupling =
        liveRaw && liveEdges.length > 0
            ? layoutCoupling(
                  liveEdges,
                  drawn.length > 0 ? drawn : liveEdges,
                  liveRaw.enabledIndices,
                  directed,
              )
            : null;
    const live = liveRaw
        ? {
              coupling: liveCoupling,
              qubits: liveRaw.enabledIndices.length,
              note: couplingNote(liveCoupling, directed),
          }
        : null;
    return {
        id: catalog.id,
        name: text(root.name) || catalog.name,
        shortCode: catalog.shortCode,
        providerName: catalog.providerName,
        type: text(root.type) || catalog.type,
        status: catalog.status,
        queueDepth: catalog.queueDepth,
        acceptingJobs: catalog.acceptingJobs,
        description: catalog.description,
        sparkAvailable: catalog.sparkAvailable,
        qubits,
        nativeOps: asOps(constraint.native_ops, true),
        supportedOps: asOps(constraint.supported_ops, false),
        features: asFeatures(constraint.features),
        limits: asLimits(constraint.limits),
        coupling,
        couplingNote: couplingNote(coupling, directed),
        physicalQubits: qubits != null && qubits > 0 ? qubits : null,
        live,
        calibrationAvailable: text(root.calibration_data_url).length > 0,
        calibration: calibration ? summarizeCalibration(calibration) : null,
        calibrationUpdated: formatCalibrationStamp(
            text(root.calibration_updated_at) || null,
        ),
    };
}

export function backendDetailsHtml(
    nonce: string,
    model: BackendDetailModel,
): string {
    const queue = String(model.queueDepth ?? 0);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(model.name)}</title>
<style nonce="${nonce}">
  body { margin: 0; padding: 28px 32px 48px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); font-size: 13px; line-height: 1.45; }
  button { font: inherit; cursor: pointer; appearance: none; border: 0; background: transparent; color: inherit; }
  main { max-width: 920px; margin: 0 auto; }
  .eyebrow { margin: 0 0 12px; font-size: 22px; font-weight: 700; letter-spacing: 0; text-transform: none; color: var(--vscode-foreground); }
  h1 { margin: 4px 0 6px; font-size: 28px; font-weight: 650; line-height: 1.15; }
  .sub { margin: 0 0 16px; color: #4f5456; }
  body.vscode-dark .sub { color: #95ad9f; }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 20px; }
  .status-chip, .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .status-chip.online { background: rgba(80, 188, 131, 0.2); color: #50bc83; }
  .status-chip.maintenance { background: #fef9c3; color: #854d0e; }
  .status-chip.reserved { background: rgba(99, 102, 241, 0.15); color: #4f46e5; }
  .status-chip.offline { background: #fee2e2; color: #991b1b; }
  body.vscode-dark .status-chip.maintenance { background: rgba(113, 63, 18, 0.2); color: #fde047; }
  body.vscode-dark .status-chip.reserved { color: #a5b4fc; }
  body.vscode-dark .status-chip.offline { background: rgba(127, 29, 29, 0.2); color: #fca5a5; }
  .pill.yes { background: #dcfce7; color: #15803d; }
  .pill.no { background: #fee2e2; color: #b91c1c; }
  body.vscode-dark .pill.yes { background: rgba(20, 83, 45, 0.2); color: #86efac; }
  body.vscode-dark .pill.no { background: rgba(127, 29, 29, 0.2); color: #fca5a5; }
  .status-chip.has-spark { position: relative; }
  .spark { width: 12px; height: 12px; flex: 0 0 auto; display: block; }
  .spark-tip { display: none; position: absolute; z-index: 9; top: calc(100% + 6px); right: 0; padding: 4px 8px; border-radius: 6px; background: var(--vscode-editorHoverWidget-background, #1e1e1e); color: var(--vscode-editorHoverWidget-foreground, #fdfcfc); border: 1px solid var(--vscode-editorHoverWidget-border, rgba(149, 173, 159, 0.35)); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28); font-size: 11px; font-weight: 500; line-height: 1.3; white-space: nowrap; pointer-events: none; }
  .status-chip.has-spark:hover .spark-tip { display: block; }
  .queue { color: #4f5456; }
  body.vscode-dark .queue { color: #95ad9f; }
  .queue strong { color: var(--vscode-foreground); font-weight: 650; }
  button.submit-job { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 8px 16px; border-radius: 8px; background: #50bc83; color: #ffffff; font-weight: 650; }
  button.submit-job:hover { background: #45a872; }
  button.submit-job svg { display: block; flex: 0 0 auto; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 0 0 22px; }
  .card, .section { border: 1px solid color-mix(in srgb, #95ad9f 15%, transparent); border-radius: 10px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
  .card { padding: 14px 16px; }
  .card h2, .section h2 { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #50bc83; }
  h2.with-beta { display: flex; align-items: center; gap: 8px; }
  .topo-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 10px; }
  .topo-head h2 { margin: 0; }
  .toggles { display: inline-flex; border: 1px solid color-mix(in srgb, var(--vscode-foreground) 8%, transparent); border-radius: 8px; padding: 2px; }
  button.toggle { margin: 0; padding: 4px 10px; border-radius: 6px; background: transparent; color: #4f5456; font-size: 12px; font-weight: 500; line-height: 1.4; }
  body.vscode-dark button.toggle { color: #95ad9f; }
  button.toggle.on, body.vscode-dark button.toggle.on { background: rgba(80, 188, 131, 0.15); color: #50bc83; font-weight: 500; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
  .row strong { font-variant-numeric: tabular-nums; font-weight: 500; }
  .row span:first-child { color: #4f5456; }
  body.vscode-dark .row span:first-child { color: #95ad9f; }
  .section { padding: 16px; margin: 0 0 16px; }
  .map-wrap { border: 1px solid color-mix(in srgb, #95ad9f 20%, transparent); border-radius: 12px; overflow: hidden; background: var(--vscode-editor-background); }
  .map-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 8px 12px; border-bottom: 1px solid color-mix(in srgb, #95ad9f 15%, transparent); font-size: 13px; }
  .map-count { font-weight: 650; }
  .map-dense { font-size: 10px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: #50bc83; background: rgba(80, 188, 131, 0.1); border-radius: 999px; padding: 2px 8px; }
  .map-hover { font-size: 11px; color: #4f5456; min-width: 0; }
  body.vscode-dark .map-hover { color: #95ad9f; }
  .map-hover strong { color: var(--vscode-foreground); font-weight: 650; }
  .map-stage { height: 420px; }
  .map { width: 100%; height: 100%; display: block; background: var(--vscode-editor-background); }
  .qubit { cursor: pointer; }
  .qubit .label { pointer-events: none; }
  .map.dimming .qubit { opacity: 0.22; }
  .map.dimming .edge { opacity: 0.06; }
  .map.dimming .qubit.hi { opacity: 1; }
  .map.dimming .qubit.hi .node { stroke: #059669; stroke-width: 2.5; }
  body.vscode-dark .map.dimming .qubit.hi .node { stroke: #34d399; }
  .map.dimming .edge.hi { opacity: 0.95; stroke: #059669; stroke-width: 1.5; }
  body.vscode-dark .map.dimming .edge.hi { stroke: #34d399; }
  .node { fill: var(--node-light); stroke: #94a3b8; stroke-width: 1; }
  .node.on { stroke: #059669; stroke-width: 1.5; }
  body.vscode-dark .node { fill: var(--node-dark); stroke: #475569; }
  body.vscode-dark .node.on { stroke: #6ee7b7; }
  .edge { stroke: rgba(71, 85, 105, 0.45); stroke-width: 1; opacity: 0.48; }
  body.vscode-dark .edge { stroke: rgba(148, 163, 184, 0.5); }
  marker path { fill: rgba(71, 85, 105, 0.7); }
  body.vscode-dark marker path { fill: rgba(148, 163, 184, 0.8); }
  .label { fill: #0f172a; font-family: var(--vscode-editor-font-family); font-weight: 600; }
  body.vscode-dark .label { fill: #f8fafc; }
  .note { margin: 8px 0 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
  .empty { margin: 0; color: var(--vscode-descriptionForeground); }
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
  .feature { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--vscode-widget-border, transparent); }
  .feature strong { display: block; margin-bottom: 2px; }
  .feature p { margin: 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
  .key { display: block; margin-top: 4px; font-family: var(--vscode-editor-font-family); font-size: 10px; opacity: 0.7; }
  .split { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
  ul { margin: 0; padding-left: 18px; }
  li { font-family: var(--vscode-editor-font-family); margin: 2px 0; }
  .ops { display: flex; flex-wrap: wrap; gap: 6px; }
  .op { font-family: var(--vscode-editor-font-family); font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--vscode-textCodeBlock-background); }
  .hint { margin: 8px 0 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
  button.calibration { display: inline-flex; align-items: center; margin-top: 12px; padding: 0; border: 0; background: transparent; color: #50bc83; font-size: 12px; font-weight: 500; }
  button.calibration:hover { text-decoration: underline; }
  .beta { display: inline-flex; align-items: center; border-radius: 999px; background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 10px; font-weight: 650; letter-spacing: 0; line-height: 1.4; text-transform: none; padding: 1px 6px; }
  body.vscode-dark .beta { color: #fbbf24; }
</style>
</head>
<body>
<main>
  <p class="eyebrow">Live Capabilities</p>
  <h1>${escapeHtml(model.name)}</h1>
  <p class="sub">${escapeHtml(model.providerName)}${model.shortCode ? ` · ${escapeHtml(model.shortCode)}` : ''}${model.type ? ` · ${escapeHtml(model.type)}` : ''}</p>
  <div class="chips">
    <span class="status-chip ${statusKind(model.status)}${model.sparkAvailable ? ' has-spark' : ''}">${escapeHtml(model.status || 'Offline')}${model.sparkAvailable ? sparkMark() : ''}</span>
    <span class="queue">Queue: <strong>${escapeHtml(queue)} jobs</strong></span>
  </div>
  ${submitButton(model)}
  ${model.description ? `<p class="sub">${escapeHtml(model.description)}</p>` : ''}
  <div class="grid">
    <section class="card">
      <h2>Overview</h2>
      ${stat('Physical Qubits', model.qubits == null ? '—' : String(model.qubits))}
      ${stat('Native Operations', String(model.nativeOps.length))}
      ${stat('Supported Ops (total)', String(model.supportedOps.length))}
      ${stat('Advertised Features', String(model.features.length))}
    </section>
    <section class="card">
      <h2>Limits</h2>
      ${
          model.limits.length
              ? model.limits
                    .map((limit) => stat(limit.label, limit.value))
                    .join('')
              : '<p class="empty">Limits not published for this backend.</p>'
      }
    </section>
    <section class="card">
      <h2 class="with-beta">Calibration <span class="beta">Beta</span></h2>
      ${calibrationBody(model)}
    </section>
  </div>
  <section class="section">
    ${topologySection(nonce, model)}
  </section>
  <section class="section">
    <h2>Device features</h2>
    ${
        model.features.length
            ? `<div class="features">${model.features
                  .map(
                      (feature) =>
                          `<article class="feature"><strong>${escapeHtml(feature.label)}</strong><p>${escapeHtml(feature.description)}</p><span class="key">${escapeHtml(feature.key)}</span></article>`,
                  )
                  .join('')}</div>`
            : '<p class="empty">No feature flags published.</p>'
    }
  </section>
  <div class="split">
    <section class="section">
      <h2>Native operations (${model.nativeOps.length})</h2>
      ${
          model.nativeOps.length
              ? `<ul>${model.nativeOps.map((op) => `<li>${escapeHtml(op)}</li>`).join('')}</ul>`
              : '<p class="empty">None listed</p>'
      }
      <p class="hint">Hardware-native gates. Other gates are decomposed to these.</p>
    </section>
    <section class="section">
      <h2>Supported operations (${model.supportedOps.length})</h2>
      ${
          model.supportedOps.length
              ? `<div class="ops">${model.supportedOps.map((op) => `<span class="op">${escapeHtml(op)}</span>`).join('')}</div>`
              : '<p class="empty">None listed beyond native</p>'
      }
      <p class="hint">Gates the platform accepts, including native gates and gates it transpiles.</p>
    </section>
  </div>
</main>
${submitScript(nonce)}
</body>
</html>`;
}

function topologySection(nonce: string, model: BackendDetailModel): string {
    const toggles = model.live
        ? `<div class="toggles" role="group" aria-label="Coupling map">${viewButton('live', 'Live', model.live.qubits, true)}${viewButton('physical', 'Physical', model.physicalQubits, false)}</div>`
        : '';
    const head = `<div class="topo-head"><h2>Qubit Topology</h2>${toggles}</div>`;
    const live = model.live
        ? topologyPanel(
              'live',
              false,
              model.live.coupling
                  ? mapFrame(
                        model.live.coupling,
                        model.qubits,
                        couplingSvg(model.live.coupling),
                    )
                  : '<p class="empty">This calibration offers no edges on the physical coupling map.</p>',
              model.live.note,
          )
        : '';
    const physical = model.coupling
        ? topologyPanel(
              'physical',
              model.live != null,
              mapFrame(
                  model.coupling,
                  model.qubits,
                  couplingSvg(model.coupling),
              ),
              model.couplingNote,
          )
        : '';
    if (!live && !physical) {
        return `${head}<p class="empty">No coupling map data available for this device. Topology may be unpublished, or this backend is a fully connected simulator.</p>`;
    }
    const maps = Boolean(model.coupling || model.live?.coupling);
    return `${head}${live}${physical}${maps ? hoverScript(nonce) : ''}${model.live ? toggleScript(nonce) : ''}`;
}

function viewButton(
    view: 'live' | 'physical',
    label: string,
    qubits: number | null,
    selected: boolean,
): string {
    const count = qubits == null ? '' : ` (${qubits})`;
    return `<button type="button" class="toggle${selected ? ' on' : ''}" data-view="${view}">${label}${count}</button>`;
}

function topologyPanel(
    view: 'live' | 'physical',
    hidden: boolean,
    body: string,
    note: string | null,
): string {
    return `<div class="topo" data-view="${view}"${hidden ? ' hidden' : ''}>${body}${note ? `<p class="note">${escapeHtml(note)}</p>` : ''}</div>`;
}

function mapFrame(
    coupling: CouplingLayout,
    chipQubits: number | null,
    svg: string,
): string {
    const onChip =
        chipQubits != null && chipQubits > coupling.nodes.length
            ? ` · ${chipQubits} on chip`
            : '';
    const dense = coupling.dense
        ? '<span class="map-dense">All-to-all</span>'
        : '';
    return `<div class="map-wrap"><div class="map-bar"><span class="map-count">${coupling.nodes.length} qubits · ${coupling.edges.length} edges${onChip}</span>${dense}<span class="map-hover">Hover or tap a qubit to highlight its neighbors</span></div><div class="map-stage">${svg}</div></div>`;
}

function calibrationBody(model: BackendDetailModel): string {
    if (!model.calibrationAvailable) {
        return '<p class="empty">No calibration published for this backend.</p>';
    }
    const summary = model.calibration;
    const figures =
        summary == null
            ? ''
            : summary.fidelity1q ||
                summary.fidelity2q ||
                summary.t1 ||
                summary.t2
              ? [
                    figureRow('1Q fidelity', summary.fidelity1q),
                    figureRow('2Q fidelity', summary.fidelity2q),
                    figureRow('T1', summary.t1),
                    figureRow('T2', summary.t2),
                ].join('')
              : '<p class="empty">No 1Q, 2Q, T1, or T2 figures in this snapshot.</p>';
    return `${figures}${stat('Updated', model.calibrationUpdated)}<button id="download-calibration" class="calibration" type="button" data-backend="${escapeHtml(model.shortCode || model.id)}">Open calibration</button>`;
}

function figureRow(label: string, figure: CalibrationFigure | null): string {
    const detail = figure?.detail
        ? ` title="${escapeHtml(figure.detail)}"`
        : '';
    return `<div class="row"${detail}><span>${escapeHtml(label)}</span><strong>${escapeHtml(figure?.text ?? '—')}</strong></div>`;
}

function hoverScript(nonce: string): string {
    return `<script nonce="${nonce}">
(function () {
  var idle = 'Hover or tap a qubit to highlight its neighbors';
  Array.prototype.slice.call(document.querySelectorAll('.map-wrap')).forEach(function (wrap) {
    var svg = wrap.querySelector('.map');
    var hover = wrap.querySelector('.map-hover');
    if (!svg || !hover) return;
    var track = svg.getAttribute('data-track') === '1';
    var qubits = Array.prototype.slice.call(svg.querySelectorAll('.qubit'));
    var edges = Array.prototype.slice.call(svg.querySelectorAll('.edge'));
    var neighbors = new Map();
    var add = function (from, to) {
      var list = neighbors.get(from) || [];
      if (list.indexOf(to) === -1) list.push(to);
      neighbors.set(from, list);
    };
    edges.forEach(function (edge) {
      var a = Number(edge.getAttribute('data-a'));
      var b = Number(edge.getAttribute('data-b'));
      add(a, b);
      add(b, a);
    });
    neighbors.forEach(function (list, id) {
      neighbors.set(id, list.sort(function (left, right) { return left - right; }));
    });
    var sticky = false;
    var clear = function (force) {
      if (sticky && !force) return;
      sticky = false;
      svg.classList.remove('dimming');
      qubits.forEach(function (node) { node.classList.remove('hi', 'root'); });
      edges.forEach(function (edge) { edge.classList.remove('hi'); });
      hover.textContent = idle;
    };
    var show = function (id) {
      var list = neighbors.get(id) || [];
      var hood = {};
      hood[id] = true;
      list.forEach(function (item) { hood[item] = true; });
      svg.classList.add('dimming');
      qubits.forEach(function (node) {
        var nodeId = Number(node.getAttribute('data-id'));
        node.classList.toggle('hi', hood[nodeId] === true);
        node.classList.toggle('root', nodeId === id);
      });
      edges.forEach(function (edge) {
        var a = Number(edge.getAttribute('data-a'));
        var b = Number(edge.getAttribute('data-b'));
        edge.classList.toggle('hi', hood[a] === true && hood[b] === true);
      });
      var status = '';
      if (track) {
        var current = qubits.filter(function (node) {
          return Number(node.getAttribute('data-id')) === id;
        })[0];
        status = current && current.getAttribute('data-on') === '1' ? ' · enabled' : ' · idle';
      }
      var links = list.length ? ' · ' + list.join(', ') : ' · no neighbors';
      hover.textContent = '';
      var name = document.createElement('strong');
      name.textContent = 'Qubit ' + id;
      hover.appendChild(name);
      hover.appendChild(document.createTextNode(status + ' · deg ' + list.length + links));
    };
    var qubitFrom = function (target) {
      return target && target.closest ? target.closest('.qubit') : null;
    };
    svg.addEventListener('mouseover', function (event) {
      var node = qubitFrom(event.target);
      if (!node) return;
      show(Number(node.getAttribute('data-id')));
    });
    svg.addEventListener('mouseout', function (event) {
      var node = qubitFrom(event.target);
      if (!node) return;
      var next = qubitFrom(event.relatedTarget);
      if (next === node) return;
      clear(false);
    });
    svg.addEventListener('click', function (event) {
      var node = qubitFrom(event.target);
      if (!node) {
        clear(true);
        return;
      }
      sticky = true;
      show(Number(node.getAttribute('data-id')));
    });
  });
})();
</script>`;
}

function toggleScript(nonce: string): string {
    return `<script nonce="${nonce}">
(function () {
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.toggle'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.topo'));
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var view = button.getAttribute('data-view');
      buttons.forEach(function (item) {
        item.classList.toggle('on', item === button);
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-view') !== view;
      });
    });
  });
})();
</script>`;
}

function submitButton(model: BackendDetailModel): string {
    const label = `${model.providerName} ${model.name}`.trim();
    const backendId = model.shortCode || model.id;
    return `<p class="cta"><button id="submit-job" class="submit-job" type="button" data-backend="${escapeHtml(backendId)}">Submit a job to ${escapeHtml(label)}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></button></p>`;
}

function submitScript(nonce: string): string {
    return `<script nonce="${nonce}">
(function () {
  var vscodeApi = acquireVsCodeApi();
  var button = document.getElementById('submit-job');
  if (!button) return;
  button.addEventListener('click', function () {
    vscodeApi.postMessage({
      command: 'submitJob',
      backendId: button.getAttribute('data-backend') || ''
    });
  });
  var calibration = document.getElementById('download-calibration');
  if (calibration) {
    calibration.addEventListener('click', function () {
      vscodeApi.postMessage({
        command: 'downloadCalibration',
        backendId: calibration.getAttribute('data-backend') || ''
      });
    });
  }
})();
</script>`;
}

function stat(label: string, value: string): string {
    return `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function statusKind(status: string | null): string {
    const normalized = (status ?? 'offline').trim().toLowerCase();
    if (
        normalized === 'online' ||
        normalized === 'maintenance' ||
        normalized === 'reserved'
    ) {
        return normalized;
    }
    return 'offline';
}

function sparkMark(): string {
    return '<svg class="spark" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Spark is available"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg><span class="spark-tip" role="tooltip">Spark is available</span>';
}

function couplingNote(
    coupling: CouplingLayout | null,
    directed: boolean,
): string | null {
    if (!coupling || coupling.edges.length === 0) {
        return null;
    }
    const qubits = coupling.nodes.length;
    const edges = coupling.edges.length;
    if (coupling.dense) {
        return `${qubits} qubits and ${edges} edges. Connectivity is dense, so the map is drawn as a circle.`;
    }
    if (directed) {
        return 'Directed edges run from control to target.';
    }
    return 'Undirected connectivity. An edge means a native two-qubit interaction is possible without routing.';
}

function asOps(value: unknown, withParams: boolean): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const ops: string[] = [];
    for (const item of value) {
        const row = asRecord(item);
        if (!row) {
            continue;
        }
        const name = text(row.name);
        if (!name) {
            continue;
        }
        const arity = finiteNumber(row.arity);
        const params = withParams ? asStrings(row.params) : [];
        const paramText = params.length ? `(${params.join(', ')})` : '';
        const arityText = arity == null ? '' : ` [${arity}q]`;
        ops.push(`${name}${paramText}${arityText}`);
    }
    return ops;
}

function asFeatures(value: unknown): FeatureItem[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const features: FeatureItem[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || item.length === 0) {
            continue;
        }
        const known = FEATURE_INFO[item];
        features.push({
            key: item,
            label: known?.label ?? item.replace(/_/g, ' '),
            description: known?.description ?? 'Backend capability flag.',
        });
    }
    return features;
}

function asLimits(value: unknown): NamedValue[] {
    const row = asRecord(value);
    if (!row) {
        return [];
    }
    return Object.keys(row)
        .sort()
        .map((key) => ({
            label: limitLabel(key),
            value: String(row[key]),
        }));
}

/** Same visible capitalization as the website limit rows. */
function limitLabel(key: string): string {
    return key
        .replace(/_/g, ' ')
        .split(' ')
        .map((word) =>
            word.length === 0
                ? word
                : word.charAt(0).toUpperCase() + word.slice(1),
        )
        .join(' ');
}

function labelMap(value: unknown): Record<string, string> | null {
    const row = asRecord(value);
    if (!row) {
        return null;
    }
    const labels: Record<string, string> = {};
    for (const [key, name] of Object.entries(row)) {
        if (typeof name === 'string' && name.trim()) {
            labels[key] = name;
        }
    }
    return Object.keys(labels).length > 0 ? labels : null;
}

function asEdges(value: unknown): number[][] {
    if (!Array.isArray(value)) {
        return [];
    }
    const edges: number[][] = [];
    for (const item of value) {
        if (!Array.isArray(item) || item.length < 2) {
            continue;
        }
        edges.push([Number(item[0]), Number(item[1])]);
    }
    return edges;
}

function asStrings(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
}

function asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as JsonRecord;
}

function text(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function finiteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
