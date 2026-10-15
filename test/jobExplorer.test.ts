// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyBitOrder,
    buildRows,
    countsFromOutput,
    defaultControls,
    explorerStats,
    notebookJson,
    parseCounts,
    reverseCounts,
} from '../src/jobExplorer';

test('bit order swaps keys and sums a collision', () => {
    assert.deepEqual(reverseCounts({ '01': 2, '10': 3 }), { '10': 2, '01': 3 });
    assert.deepEqual(reverseCounts({ ab: 1, ba: 4 }), { ba: 1, ab: 4 });
    assert.deepEqual(applyBitOrder({ '01': 2 }, 'as-measured'), { '01': 2 });
    assert.deepEqual(applyBitOrder({ '01': 2 }, 'reversed'), { '10': 2 });
});

test('parseCounts accepts a counts object and rejects bad input', () => {
    assert.deepEqual(parseCounts(''), { counts: null, error: null });
    assert.deepEqual(parseCounts('{"00": 512, "11": 500}'), {
        counts: { '00': 512, '11': 500 },
        error: null,
    });
    assert.match(parseCounts('{').error ?? '', /Not valid JSON/);
    assert.match(parseCounts('[]').error ?? '', /JSON object/);
    assert.match(parseCounts('{"00": -1}').error ?? '', /negative/);
    assert.match(parseCounts('{}').error ?? '', /No states found/);
});

test('rows filter, group, sort, and keep probabilities on the full map', () => {
    const counts = { '00': 10, '01': 20, '11': 30 };
    const matched = buildRows(counts, {
        ...defaultControls(),
        pattern: '1_0',
    });
    assert.deepEqual(matched, []);
    const wildcard = buildRows(
        { '100': 1, '110': 2, '101': 4 },
        { ...defaultControls(), pattern: '1_0' },
    );
    assert.deepEqual(
        wildcard.map((row) => row.state),
        ['110', '100'],
    );

    const grouped = buildRows(counts, {
        ...defaultControls(),
        groupMode: 'hamming',
        pattern: '00',
    });
    assert.deepEqual(
        grouped.map((row) => [row.state, row.raw]),
        [
            ['2 ones', 30],
            ['1 ones', 20],
            ['0 ones', 10],
        ],
    );

    const top = buildRows(counts, { ...defaultControls(), topN: '1' });
    assert.deepEqual(top, [{ state: '11', raw: 30, value: 30 }]);

    const probabilities = buildRows(counts, {
        ...defaultControls(),
        valueMode: 'probabilities',
        minCount: '25',
    });
    assert.equal(probabilities.length, 1);
    assert.equal(probabilities[0]?.state, '11');
    assert.ok(Math.abs((probabilities[0]?.value ?? 0) - 0.5) < 1e-9);
});

test('stats use the full counts, including a fair bit of entropy 1', () => {
    const fair = explorerStats({ '0': 1, '1': 1 });
    assert.equal(fair?.shots, 2);
    assert.equal(fair?.unique, 2);
    assert.equal(fair?.entropy, 1);

    const skewed = explorerStats({ '0': 512, '1': 256 });
    assert.equal(skewed?.shots, 768);
    assert.equal(skewed?.topState, '0');
    assert.ok(Math.abs((skewed?.entropy ?? 0) - 0.9182958340544896) < 1e-9);
});

test('bit order is applied before rows, not inside them', () => {
    const ordered = applyBitOrder({ '01': 5, '10': 1 }, 'reversed');
    const rows = buildRows(ordered, defaultControls());
    assert.equal(rows[0]?.state, '10');
    assert.equal(rows[0]?.raw, 5);
});

test('counts come from the website shapes, then pair lists', () => {
    assert.deepEqual(countsFromOutput({ '00': 4, '11': 1 }), {
        '00': 4,
        '11': 1,
    });
    assert.deepEqual(countsFromOutput({ counts: { '00': 4 } }), { '00': 4 });
    assert.deepEqual(countsFromOutput({ data: { counts: { '11': 2 } } }), {
        '11': 2,
    });
    assert.deepEqual(countsFromOutput({ results: [{ counts: { '01': 9 } }] }), {
        '01': 9,
    });
    assert.deepEqual(countsFromOutput({ data: { hello: 3 } }), { hello: 3 });
    assert.deepEqual(
        countsFromOutput([
            { bitstring: '00', count: 4 },
            { bitstring: '00', count: 1 },
        ]),
        { '00': 5 },
    );
    assert.equal(countsFromOutput({ shots: 10, ok: true }), null);
});

test('the notebook loads the adjusted counts', () => {
    const notebook = JSON.parse(notebookJson({ '00': 4, '11': 1 })) as {
        nbformat: number;
        cells: { source: string[] }[];
    };
    assert.equal(notebook.nbformat, 4);
    const source = notebook.cells
        .map((cell) => cell.source.join(''))
        .join('\n');
    assert.match(source, /counts = \{/);
    assert.match(source, /"00": 4/);
    assert.match(source, /plot_histogram/);
    assert.match(source, /matplotlib/);
});
