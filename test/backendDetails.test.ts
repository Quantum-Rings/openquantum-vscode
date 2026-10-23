// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    backendDetailsHtml,
    parseBackendDetails,
    type BackendCatalogFacts,
} from '../src/backendDetails';
import { formatCalibrationStamp } from '../src/calibrationSummary';
import { isDenseCouplingMap, layoutCoupling } from '../src/couplingMap';

const catalog: BackendCatalogFacts = {
    id: 'class-1',
    name: 'Forte 1',
    shortCode: 'ionq:forte-1',
    providerName: 'IonQ',
    type: 'QPU',
    status: 'Online',
    queueDepth: 2,
    acceptingJobs: true,
    description: 'Trapped ion',
    sparkAvailable: true,
};

test('details draw coupling_map and ignore leftover operable maps', () => {
    const model = parseBackendDetails(
        {
            name: 'Forte 1',
            type: 'QPU',
            constraint_data: {
                n_qubits: 4,
                native_ops: [{ name: 'rx', arity: 1, params: ['theta'] }],
                supported_ops: [{ name: 'cx', arity: 2 }],
                features: [
                    'mid_circuit_measure',
                    'explicit_measure',
                    'multiple_registers',
                    'physical_virtual_mix',
                    'relaxed_virtual_qubits',
                    'bare_qubit_indexing',
                    'duration_boxes',
                    'register_concat',
                    'mixed_measurement_result_pragmas',
                    'custom_flag',
                ],
                limits: { max_shots: 1000 },
                topology: {
                    directed_edges: false,
                    physical_coupling_map: [
                        [0, 1],
                        [1, 2],
                        [2, 3],
                    ],
                    operable_coupling_map: [[0, 1]],
                    coupling_map: [
                        [0, 1],
                        [1, 2],
                    ],
                    enabled_indices: [0, 1],
                },
            },
        },
        catalog,
    );
    assert.equal(model.qubits, 4);
    assert.deepEqual(model.nativeOps, ['rx(theta) [1q]']);
    assert.deepEqual(model.supportedOps, ['cx [2q]']);
    assert.equal(model.features[0].label, 'Mid-Circuit Measurement');
    assert.equal(model.features[1].label, 'Explicit Measurement');
    assert.match(model.features[1].description, /must include a measure/);
    assert.deepEqual(
        model.features.slice(2, 9).map((feature) => feature.label),
        [
            'Multiple Registers',
            'Physical and Virtual Mix',
            'Relaxed Virtual Qubits',
            'Bare Qubit Indexing',
            'Duration Boxes',
            'Register Concatenation',
            'Mixed Measurement and Result Pragmas',
        ],
    );
    assert.equal(model.features[9].label, 'custom flag');
    assert.equal(model.features[9].description, 'Backend capability flag.');
    assert.deepEqual(model.limits, [{ label: 'Max Shots', value: '1000' }]);
    assert.ok(model.coupling);
    assert.deepEqual(model.coupling.edges, [
        [0, 1],
        [1, 2],
    ]);
    assert.deepEqual(
        model.coupling.nodes.map((node) => node.id),
        [0, 1, 2],
    );
    assert.equal(
        model.coupling.nodes.every((node) => node.enabled),
        true,
    );
    assert.equal(model.coupling.showEnabled, false);
    assert.equal(model.calibrationAvailable, false);
    assert.doesNotMatch(model.couplingNote ?? '', /Operable/);
    assert.match(
        model.couplingNote ?? '',
        /3 qubits and 2 edges\. Connectivity is dense/,
    );
});

test('details html escapes backend names and includes the capability sections', () => {
    const model = parseBackendDetails(
        {
            constraint_data: {
                n_qubits: 2,
                topology: { coupling_map: [[0, 1]] },
            },
        },
        { ...catalog, name: '<img src=x onerror=alert(1)>' },
    );
    const html = backendDetailsHtml('nonce', model);
    assert.match(html, /nonce-nonce/);
    assert.match(html, /Live Capabilities/);
    assert.match(html, /Submit a job to IonQ /);
    assert.match(html, /data-backend="ionq:forte-1"/);
    assert.doesNotMatch(html, /class="pill /);
    assert.match(html, /#50bc83/);
    assert.match(html, /Physical Qubits/);
    assert.match(html, /Native Operations/);
    assert.match(html, /Supported Ops \(total\)/);
    assert.match(html, /Advertised Features/);
    assert.match(html, /Qubit Topology/);
    assert.doesNotMatch(html, /class="toggle/);
    assert.match(html, /Native operations/);
    assert.match(html, /Device features/);
    assert.match(html, /Hover or tap a qubit to highlight its neighbors/);
    assert.match(html, /data-id=/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /<script nonce="nonce">/);
    assert.doesNotMatch(html, /<img src=x/);
    assert.match(html, /<svg/);
    assert.match(html, /Spark is available/);
    assert.match(html, /M11\.017 2\.814/);
    assert.match(html, /No calibration published for this backend/);
    assert.match(
        html,
        /<h2 class="with-beta">Calibration <span class="beta">Beta<\/span><\/h2>/,
    );
    assert.doesNotMatch(html, /Open calibration/);
});

test('details offer a beta calibration download when a snapshot exists', () => {
    const model = parseBackendDetails(
        {
            constraint_data: { n_qubits: 2 },
            calibration_data_url: 'https://example.test/calibration.json',
        },
        catalog,
    );
    assert.equal(model.calibrationAvailable, true);
    const html = backendDetailsHtml('nonce', model);
    assert.match(html, /Open calibration/);
    assert.match(
        html,
        /<h2 class="with-beta">Calibration <span class="beta">Beta<\/span><\/h2>/,
    );
    assert.doesNotMatch(html, /Open calibration<span class="beta">/);
    assert.match(html, /command: 'downloadCalibration'/);
    assert.doesNotMatch(html, /example\.test/);
    assert.match(html, />Updated</);
    assert.match(html, /—/);
});

test('calibration card shows fidelity, T1, and T2 from the snapshot', () => {
    const updated = '2026-03-01T15:04:00.000Z';
    const model = parseBackendDetails(
        {
            constraint_data: { n_qubits: 2 },
            calibration_data_url: 'https://example.test/calibration.json',
            calibration_updated_at: updated,
        },
        catalog,
        {
            qcal: { name: 'qcal.device_calibration' },
            aggregates: {
                qubits: {
                    t1: { value: 20e-6, unit: 's' },
                    t2: { value: 15e-6, unit: 's' },
                },
                gates_1q: { fidelity: { value: 0.999, unit: 'dimensionless' } },
                gates_2q: { fidelity: { value: 0.991, unit: 'dimensionless' } },
            },
        },
    );
    assert.equal(model.calibration?.fidelity1q?.text, '99.90%');
    assert.equal(model.calibration?.fidelity2q?.text, '99.10%');
    assert.equal(model.calibration?.t1?.text, '20.0 µs');
    assert.equal(model.calibration?.t2?.text, '15.0 µs');
    assert.equal(model.calibrationUpdated, formatCalibrationStamp(updated));
    const html = backendDetailsHtml('nonce', model);
    assert.match(html, /1Q fidelity/);
    assert.match(html, /2Q fidelity/);
    assert.match(html, />T1</);
    assert.match(html, />T2</);
    assert.match(html, /99\.90%/);
    assert.match(html, /99\.10%/);
    assert.match(html, /20\.0 µs/);
    assert.match(html, /15\.0 µs/);
    assert.match(html, /Published device value/);
    assert.match(html, /button id="download-calibration" class="calibration"/);
    assert.match(html, /appearance: none/);
    assert.match(
        html,
        /button\.toggle\.on, body\.vscode-dark button\.toggle\.on/,
    );
    assert.match(html, /height: 420px/);
});

test('live and physical toggles count qubits', () => {
    const model = parseBackendDetails(
        {
            constraint_data: {
                n_qubits: 4,
                topology: {
                    coupling_map: [
                        [0, 1],
                        [1, 2],
                        [2, 3],
                    ],
                    qubit_labels: {
                        '0': 'q0',
                        '1': 'q1',
                        '2': 'q2',
                        '3': 'q3',
                    },
                },
            },
        },
        catalog,
        {
            device: {
                qubit_labels: { $0: 'q0', $1: 'q1', $2: 'q2' },
                enabled_qubits: ['$0', '$1', '$2'],
            },
        },
    );
    assert.equal(model.physicalQubits, 4);
    assert.equal(model.live?.qubits, 3);
    assert.deepEqual(model.coupling?.edges, [
        [0, 1],
        [1, 2],
        [2, 3],
    ]);
    assert.deepEqual(model.live?.coupling?.edges, [
        [0, 1],
        [1, 2],
    ]);
    const html = backendDetailsHtml('nonce', model);
    assert.match(html, /Live \(3\)/);
    assert.match(html, /Physical \(4\)/);
    assert.doesNotMatch(html, /Live \(2\)/);
    assert.match(html, /data-view="physical" hidden/);
});

test('coupling layout follows the website distance embedding', () => {
    // A path of five qubits is sparse (density 0.4). Three qubits already
    // exceed the website's 0.45 density cutoff, so they use the circle.
    const path: [number, number][] = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
    ];
    const line = layoutCoupling(path, path, null, false);
    assert.equal(line.nodes.length, 5);
    assert.equal(line.dense, false);
    const byId = new Map(line.nodes.map((node) => [node.id, node]));
    assert.ok((byId.get(0)?.x ?? 0) < (byId.get(4)?.x ?? 0));
    const seen = new Set(line.nodes.map((node) => `${node.x},${node.y}`));
    assert.equal(seen.size, 5);
    const edges: [number, number][] = [];
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
            const id = row * 3 + col;
            if (col + 1 < 3) {
                edges.push([id, id + 1]);
            }
            if (row + 1 < 3) {
                edges.push([id, id + 3]);
            }
        }
    }
    const grid = layoutCoupling(edges, edges, null, false);
    const placed = new Map(grid.nodes.map((node) => [node.id, node]));
    assert.equal(placed.get(0)?.x, 0);
    assert.equal(placed.get(0)?.y, 0);
    assert.ok((placed.get(1)?.x ?? 0) > (placed.get(0)?.x ?? 0));
    assert.equal(placed.get(1)?.y, placed.get(0)?.y);
    assert.equal(placed.get(3)?.x, placed.get(0)?.x);
    assert.ok((placed.get(3)?.y ?? 0) > (placed.get(0)?.y ?? 0));

    const wide: [number, number][] = [];
    const columns = 12;
    const rows = 9;
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
            const id = row * columns + col;
            if (col + 1 < columns) {
                wide.push([id, id + 1]);
            }
            if (row + 1 < rows) {
                wide.push([id, id + columns]);
            }
        }
    }
    const lattice = layoutCoupling(wide, wide, null, false);
    const chip = new Map(lattice.nodes.map((node) => [node.id, node]));
    assert.equal(chip.get(1)?.y, chip.get(0)?.y);
    assert.ok((chip.get(1)?.x ?? 0) > (chip.get(0)?.x ?? 0));
    assert.equal(chip.get(11)?.y, chip.get(0)?.y);
    assert.equal(chip.get(12)?.x, chip.get(0)?.x);
    assert.ok((chip.get(12)?.y ?? 0) > (chip.get(0)?.y ?? 0));

    const clique: [number, number][] = [];
    for (let a = 0; a < 4; a += 1) {
        for (let b = a + 1; b < 4; b += 1) {
            clique.push([a, b]);
        }
    }
    assert.equal(isDenseCouplingMap(4, clique.length), true);
    const dense = layoutCoupling(clique, clique, null, false);
    assert.equal(dense.dense, true);
    assert.equal(
        new Set(dense.nodes.map((node) => `${node.x},${node.y}`)).size,
        4,
    );
});
