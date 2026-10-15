// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    backendDetailsHtml,
    parseBackendDetails,
    type BackendCatalogFacts,
} from '../src/backendDetails';
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

test('details prefer the operable map and keep disabled qubits on the chip', () => {
    const model = parseBackendDetails(
        {
            name: 'Forte 1',
            type: 'QPU',
            constraint_data: {
                n_qubits: 4,
                native_ops: [{ name: 'rx', arity: 1, params: ['theta'] }],
                supported_ops: [{ name: 'cx', arity: 2 }],
                features: ['mid_circuit_measure', 'custom_flag'],
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
    assert.equal(model.features[1].label, 'custom flag');
    assert.deepEqual(model.limits, [{ label: 'Max Shots', value: '1000' }]);
    assert.ok(model.coupling);
    assert.equal(model.coupling.edges.length, 1);
    assert.equal(model.coupling.nodes.length, 4);
    assert.equal(
        model.coupling.nodes.find((node) => node.id === 2)?.enabled,
        false,
    );
    assert.equal(
        model.coupling.nodes.find((node) => node.id === 0)?.enabled,
        true,
    );
    assert.match(model.couplingNote ?? '', /Operable connectivity/);
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
    const xs = new Set(grid.nodes.map((node) => Math.round(node.x / 8)));
    const ys = new Set(grid.nodes.map((node) => Math.round(node.y / 8)));
    assert.ok(xs.size >= 3);
    assert.ok(ys.size >= 3);

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
