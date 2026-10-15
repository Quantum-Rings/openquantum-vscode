// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractCounts, formatJobOutput } from '../src/results';

test('extractCounts reads a bitstring map and nested counts', () => {
    assert.deepEqual(extractCounts({ '00': 2, '11': 5 }), [
        { bitstring: '11', count: 5 },
        { bitstring: '00', count: 2 },
    ]);
    assert.deepEqual(
        extractCounts({ results: [{ data: { counts: { '0': 1 } } }] }),
        [{ bitstring: '0', count: 1 }],
    );
    assert.equal(extractCounts({ message: 'no counts' }), null);
});

test('formatJobOutput lists counts, then the JSON', () => {
    assert.equal(
        formatJobOutput({
            jobId: 'job-1',
            status: 'Completed',
            counts: [
                { bitstring: '00', count: 7 },
                { bitstring: '11', count: 3 },
            ],
            raw: '{"00":7}',
            calibration: '{"t1":1}',
        }),
        [
            'Results · Completed · job-1',
            '00  7',
            '11  3',
            'Output JSON',
            '{"00":7}',
            'Calibration JSON',
            '{"t1":1}',
        ].join('\n'),
    );
});

test('extractCounts reads a list of bitstring count pairs', () => {
    assert.deepEqual(extractCounts([{ bitstring: '01', count: 4 }]), [
        { bitstring: '01', count: 4 },
    ]);
});
