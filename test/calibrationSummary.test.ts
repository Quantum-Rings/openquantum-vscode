// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    formatCalibrationStamp,
    summarizeCalibration,
} from '../src/calibrationSummary';

test('calibration summary uses the median 1Q fidelity, CZ fidelity, T1, and T2', () => {
    const summary = summarizeCalibration({
        qcal: { name: 'qcal.device_calibration', version: '0.1' },
        qubits: {
            $0: {
                t1: { value: 2e-5, unit: 's' },
                t2: { value: 4e-6, unit: 's' },
                benchmarks: [
                    {
                        protocol: 'simultaneous_rb',
                        fidelity: { value: 0.998, unit: 'dimensionless' },
                    },
                ],
            },
            $1: {
                t1: { value: 4e-5, unit: 's' },
                t2: { value: 8e-6, unit: 's' },
                benchmarks: [
                    {
                        protocol: 'rb',
                        fidelity: { value: 0.99, unit: 'dimensionless' },
                    },
                    {
                        protocol: 'simultaneous_rb',
                        fidelity: { value: 0.996, unit: 'dimensionless' },
                    },
                ],
            },
            $2: {
                t1: { value: 0.5, unit: 's', status: 'unmeasured' },
                benchmarks: [
                    {
                        protocol: 'simultaneous_rb',
                        fidelity: {
                            value: 0.5,
                            unit: 'dimensionless',
                            status: 'unmeasured',
                        },
                    },
                ],
            },
        },
        gates: [
            {
                name: 'cz',
                qubits: ['$0', '$1'],
                fidelity: { value: 0.99, unit: 'dimensionless' },
            },
            {
                name: 'cz',
                qubits: ['$1', '$0'],
                error: { value: 0.02, unit: 'dimensionless' },
            },
            {
                name: 'swap',
                qubits: ['$0', '$1'],
                fidelity: { value: 0.5, unit: 'dimensionless' },
            },
        ],
    });

    assert.deepEqual(summary, {
        fidelity1q: {
            text: '99.70%',
            detail: 'Median of 2 qubits',
        },
        fidelity2q: {
            text: '98.50%',
            detail: 'Median of 2 gates',
        },
        t1: { text: '30.0 µs', detail: 'Median of 2 qubits' },
        t2: { text: '6.00 µs', detail: 'Median of 2 qubits' },
    });
});

test('a published device aggregate wins over per-qubit rows', () => {
    const summary = summarizeCalibration({
        qcal: { name: 'qcal.device_calibration', version: '0.1' },
        aggregates: {
            qubits: {
                t1: { value: 100, unit: 's' },
                t2: { value: 1, unit: 's' },
            },
            gates_1q: {
                fidelity: { value: 0.9998, unit: 'dimensionless' },
            },
            gates_2q: {
                fidelity: { value: 0.9946, unit: 'dimensionless' },
            },
        },
        qubits: {
            $0: { t1: { value: 1e-5, unit: 's' } },
        },
    });

    assert.deepEqual(summary?.fidelity1q, {
        text: '99.98%',
        detail: 'Published device value',
    });
    assert.equal(summary?.fidelity2q?.text, '99.46%');
    assert.equal(summary?.t1?.text, '100 s');
    assert.equal(summary?.t2?.text, '1.00 s');
});

test('a one-qubit gate error becomes a fidelity when no benchmark exists', () => {
    const summary = summarizeCalibration({
        gates: [
            {
                name: 'x',
                qubits: ['$0'],
                error: { value: 0.004, unit: 'dimensionless' },
            },
        ],
    });

    assert.deepEqual(summary?.fidelity1q, {
        text: '99.60%',
        detail: 'Median of 1 gate',
    });
    assert.equal(summary?.t1, null);
});

test('a payload that is not calibration has no summary', () => {
    assert.equal(summarizeCalibration({ counts: { '00': 1 } }), null);
    assert.equal(summarizeCalibration(null), null);
    assert.equal(formatCalibrationStamp(null), '—');
    assert.equal(formatCalibrationStamp('not-a-date'), 'not-a-date');
});
