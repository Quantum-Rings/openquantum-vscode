// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    gateLabel,
    gateSymbol,
    layoutCircuit,
    parseCircuitView,
} from '../src/circuitView';
import {
    classifyResultsText,
    inputPanelFromStored,
    presignedObjectKey,
    selectInputFiles,
} from '../src/jobFiles';

test('tabs appear only when the upload and processed objects differ', () => {
    assert.deepEqual(
        selectInputFiles({
            input_data_url:
                'http://localhost:9000/jobs/uploads/abc?X-Amz-Signature=1',
            processed_data_url:
                'http://localhost:9000/jobs/processed/def?X-Amz-Signature=2',
        }),
        {
            kind: 'tabs',
            originalUrl:
                'http://localhost:9000/jobs/uploads/abc?X-Amz-Signature=1',
            processedUrl:
                'http://localhost:9000/jobs/processed/def?X-Amz-Signature=2',
        },
    );
    assert.deepEqual(
        selectInputFiles({
            input_data_url: 'http://localhost:9000/jobs/uploads/abc',
            processed_data_url: '   ',
        }),
        {
            kind: 'single',
            id: 'original',
            url: 'http://localhost:9000/jobs/uploads/abc',
        },
    );
    assert.equal(
        presignedObjectKey(
            'http://localhost:9000/jobs/uploads/abc?X-Amz-Signature=1',
        ),
        presignedObjectKey(
            'http://localhost:9000/jobs/uploads/abc?X-Amz-Signature=9',
        ),
    );
    assert.equal(
        selectInputFiles({
            input_data_url:
                'http://localhost:9000/jobs/uploads/abc?X-Amz-Signature=1',
            processed_data_url:
                'http://localhost:9000/jobs/uploads/abc?X-Amz-Signature=9',
        })?.kind,
        'single',
    );
    assert.equal(selectInputFiles(null), null);
});

test('counts stay counts and acquisitions are not counts', () => {
    assert.deepEqual(classifyResultsText('{"00":49,"11":47}'), {
        kind: 'counts',
        counts: { '00': 49, '11': 47 },
    });
    assert.equal(
        classifyResultsText(
            JSON.stringify({
                measure_q0: {
                    index: 0,
                    acquisition: { bins: { avg_cnt: [1] } },
                },
            }),
        ).kind,
        'acquisitions',
    );
    assert.equal(classifyResultsText('{"00":-1}').kind, 'text');
    assert.deepEqual(classifyResultsText('  \n'), { kind: 'empty' });
    assert.deepEqual(classifyResultsText('{"00":1}\0'), { kind: 'binary' });
});

test('a rewritten OpenQASM job shows both files and the diagram lines', () => {
    const panel = inputPanelFromStored({
        prepLoaded: true,
        format: 'qasm',
        inputUrl: 'http://localhost:9000/jobs/uploads/abc',
        processedUrl: 'http://localhost:9000/jobs/processed/def',
        circuitRaw: {
            kind: 'circuit',
            qubits: ['q0'],
            moments: [
                {
                    gates: [
                        {
                            name: 'h',
                            qubits: [0],
                            gateKind: 'gate',
                            line: 4,
                        },
                    ],
                },
            ],
        },
        bodies: {
            'http://localhost:9000/jobs/uploads/abc': {
                text: 'OPENQASM 2.0;\n',
                error: null,
            },
            'http://localhost:9000/jobs/processed/def': {
                text: 'OPENQASM 3.0;\nh q[0];\n',
                error: null,
            },
        },
    });
    assert.equal(panel.inputTitle, 'OpenQASM');
    assert.equal(panel.inputTabs, true);
    assert.equal(panel.inputFiles.original?.text, 'OPENQASM 2.0;\n');
    assert.equal(panel.inputFiles.processed?.text, 'OPENQASM 3.0;\nh q[0];\n');
    assert.equal(panel.circuit.status, 'circuit');
    assert.equal(panel.circuit.gates[0]?.line, 4);
});

test('a sequence job is labeled and has no diagram', () => {
    const panel = inputPanelFromStored({
        prepLoaded: true,
        format: 'qblox_sequence',
        inputUrl: 'http://localhost:9000/jobs/uploads/seq',
        processedUrl: null,
        circuitRaw: null,
        bodies: {
            'http://localhost:9000/jobs/uploads/seq': {
                text: '{"program":"start:"}',
                error: null,
            },
        },
    });
    assert.equal(panel.inputTitle, 'Qblox sequence');
    assert.equal(panel.inputTabs, false);
    assert.match(panel.inputFiles.original?.text ?? '', /"program"/);
    assert.equal(panel.circuit.status, 'empty');
    assert.match(panel.circuit.message ?? '', /OpenQASM/);
});

test('a broken diagram is dropped and a stored line is kept', () => {
    assert.equal(
        parseCircuitView({
            kind: 'circuit',
            qubits: ['q0'],
            moments: [{ gates: null }],
        }),
        null,
    );
    const layout = layoutCircuit({
        kind: 'circuit',
        qubits: ['q0', 'q1'],
        moments: [
            {
                gates: [
                    {
                        name: 'cx',
                        qubits: [0, 1],
                        gateKind: 'gate',
                        line: 6,
                    },
                ],
            },
        ],
    });
    assert.equal(layout.gates[0]?.label, 'CNOT');
    assert.equal(layout.gates[0]?.line, 6);
    const packed = layoutCircuit({
        kind: 'circuit',
        qubits: ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'],
        moments: [
            {
                gates: [
                    { name: 'cy', qubits: [0, 2], gateKind: 'gate' },
                    { name: 'crz', qubits: [1, 4], gateKind: 'gate' },
                    { name: 'ch', qubits: [3, 5], gateKind: 'gate' },
                ],
            },
        ],
    });
    assert.deepEqual(
        packed.gates.map((gate) => gate.column),
        [0, 1, 0],
    );
    assert.equal(packed.columnCount, 2);
    assert.deepEqual(packed.columnWidths, [76, 76]);
    assert.equal(
        gateLabel({ name: 'phase_oracle', qubits: [0], gateKind: 'gate' }),
        'PHASE_ORACLE',
    );
    assert.equal(
        gateLabel({ name: 'oracle', qubits: [0], gateKind: 'gate' }),
        'ORACLE',
    );
    const wide = layoutCircuit({
        kind: 'circuit',
        qubits: ['q0', 'q1', 'q2'],
        moments: [
            {
                gates: [
                    { name: 'h', qubits: [0], gateKind: 'gate' },
                    { name: 'phase_oracle', qubits: [2], gateKind: 'gate' },
                ],
            },
            {
                gates: [{ name: 'cy', qubits: [0, 2], gateKind: 'gate' }],
            },
        ],
    });
    assert.equal(wide.gates[0]?.boxWidth, 34);
    assert.equal(wide.gates[1]?.label, 'PHASE_ORACLE');
    assert.equal(wide.gates[1]?.boxWidth, 124);
    assert.equal(wide.gates[2]?.label, 'CY');
    assert.equal(wide.gates[2]?.boxWidth, 34);
    assert.deepEqual(
        gateSymbol({ name: 'cy', qubits: [0, 2], gateKind: 'gate' }),
        {
            kind: 'box',
            marks: [{ index: 0, style: 'filled' }],
            qubits: [2],
            label: 'Y',
        },
    );
    assert.deepEqual(wide.columnWidths, [166, 76]);
    assert.equal(wide.gates[0]?.column, wide.gates[1]?.column);
    assert.equal(
        gateSymbol({ name: 'cz', qubits: [0, 1], gateKind: 'gate' }).kind,
        'dots',
    );
    assert.equal(
        gateSymbol({ name: 'swap', qubits: [0, 1], gateKind: 'gate' }).kind,
        'swap',
    );
    assert.equal(
        gateSymbol({ name: 'ccx', qubits: [0, 1, 2], gateKind: 'gate' }).kind,
        'target',
    );
});
