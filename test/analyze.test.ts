// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, type Analysis } from '../src/analyze';

const BELL3 = `OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
bit[2] c;
h q[0];
cx q[0], q[1];
c[0] = measure q[0];
c[1] = measure q[1];
`;

const BELL2 = `OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
h q[0];
cx q[0],q[1];
measure q -> c;
`;

const PRAGMA = `OPENQASM 3.0;
#pragma braket verbatim
qubit[2] q;
`;

const HARDWARE = `OPENQASM 3.0;
include "stdgates.inc";
rx(pi/2) $0;
`;

function problems(analysis: Analysis): string {
    return analysis.diagnostics
        .map((item) => `${item.line + 1}:${item.start} ${item.message}`)
        .join('\n');
}

function spanOn(
    analysis: Analysis,
    line: number,
    lexeme: string,
    source: string,
) {
    const text = source.split('\n')[line] ?? '';
    const start = text.indexOf(lexeme);
    return analysis.spans.find(
        (span) =>
            span.line === line &&
            span.start === start &&
            span.length === lexeme.length,
    );
}

test('OpenQASM 3 Bell circuit has no diagnostics and colors gates and types', () => {
    const analysis = analyze(BELL3);
    assert.deepEqual(analysis.diagnostics, [], problems(analysis));
    assert.equal(analysis.version, 3);
    assert.equal(spanOn(analysis, 2, 'qubit', BELL3)?.tokenType, 'type');
    assert.equal(spanOn(analysis, 4, 'h', BELL3)?.tokenType, 'function');
    assert.equal(spanOn(analysis, 5, 'cx', BELL3)?.tokenType, 'function');
    assert.equal(spanOn(analysis, 6, 'measure', BELL3)?.tokenType, 'keyword');
});

test('OpenQASM 2 Bell circuit has no diagnostics', () => {
    const analysis = analyze(BELL2);
    assert.deepEqual(analysis.diagnostics, [], problems(analysis));
    assert.equal(analysis.version, 2);
    assert.equal(spanOn(analysis, 2, 'qreg', BELL2)?.tokenType, 'type');
    assert.equal(spanOn(analysis, 5, 'cx', BELL2)?.tokenType, 'function');
});

test('a pragma without a semicolon is valid and highlighted', () => {
    const analysis = analyze(PRAGMA);
    assert.deepEqual(analysis.diagnostics, [], problems(analysis));
    const pragma = analysis.spans.find(
        (span) => span.line === 1 && span.tokenType === 'macro',
    );
    assert.ok(pragma, 'expected a macro span on the pragma line');
    assert.ok((pragma?.length ?? 0) > 'pragma'.length);
});

test('hardware qubits are marked readonly', () => {
    const analysis = analyze(HARDWARE);
    assert.deepEqual(analysis.diagnostics, [], problems(analysis));
    const qubit = spanOn(analysis, 2, '$0', HARDWARE);
    assert.equal(qubit?.tokenType, 'variable');
    assert.deepEqual(qubit?.modifiers, ['readonly']);
    assert.equal(spanOn(analysis, 2, 'rx', HARDWARE)?.tokenType, 'function');
    assert.equal(spanOn(analysis, 2, 'pi', HARDWARE)?.tokenType, 'number');
});

test('a missing semicolon is reported and later tokens are still colored', () => {
    const source = `OPENQASM 3.0;
qubit[1] q
h q[0];
`;
    const analysis = analyze(source);
    const diagnostic = analysis.diagnostics.find(
        (item) => item.line === 1 && /semicolon/i.test(item.message),
    );
    assert.ok(diagnostic, problems(analysis));
    assert.equal(diagnostic.start, 'qubit[1] q'.length);
    assert.equal(diagnostic.end, diagnostic.start + 1);
    assert.equal(spanOn(analysis, 2, 'h', source)?.tokenType, 'function');
});

test('a missing semicolon at the end of the file stays on that line', () => {
    const source = `OPENQASM 3.0;
bit[2] b;
qubit[2] q;
h q[0];
cnot q[0], q[1];
b[0] = measure q[0];
b[1] = measure q[1];sd x`;
    const statement = 'b[1] = measure q[1];sd x';
    for (const extra of ['', '\n', '\n\n']) {
        const analysis = analyze(source + extra);
        const diagnostic = analysis.diagnostics.find((item) =>
            /semicolon/i.test(item.message),
        );
        assert.ok(diagnostic, problems(analysis));
        assert.equal(diagnostic.line, 6);
        assert.equal(diagnostic.start, statement.length);
        assert.equal(diagnostic.end, statement.length + 1);
    }
});

test('an unrecognized character is reported', () => {
    const source = `OPENQASM 3.0;
qubit[1] q;
h q[0] §;
`;
    const analysis = analyze(source);
    assert.ok(analysis.diagnostics.length > 0, 'expected a diagnostic');
});

const CIRCUIT = `OPENQASM 3.0;
bit[2] b;
qubit[2] q;
h q[0];
cnot q[0], q[1];
b[0] = measure q[0];
b[1] = measure q[1];
`;

test('a measurement circuit has no diagnostics', () => {
    const analysis = analyze(CIRCUIT);
    assert.deepEqual(analysis.diagnostics, [], problems(analysis));
});

test('a mistyped measure keyword is underlined on that word', () => {
    const source = CIRCUIT.replace(
        'b[1] = measure q[1];',
        'b[1] = meaxsure q[1];',
    );
    const analysis = analyze(source);
    const line = source
        .split('\n')
        .findIndex((item) => item.includes('meaxsure'));
    const diagnostic = analysis.diagnostics.find((item) => item.line === line);
    assert.ok(diagnostic, problems(analysis));
    const text = source.split('\n')[line] ?? '';
    assert.equal(text.slice(diagnostic.start, diagnostic.end), 'meaxsure');
    assert.match(diagnostic.message, /measure/);
});

test('an assignment of a declared bit is not an error', () => {
    const source = `OPENQASM 3.0;
bit b;
bit c;
b = c;
`;
    const analysis = analyze(source);
    assert.deepEqual(analysis.diagnostics, [], problems(analysis));
});

test('a name with no statement around it is reported', () => {
    const source = `OPENQASM 3.0;
qubit[1] q;
q[0];
`;
    const analysis = analyze(source);
    const diagnostic = analysis.diagnostics.find((item) => item.line === 2);
    assert.ok(diagnostic, problems(analysis));
    assert.equal(
        source.split('\n')[2]?.slice(diagnostic.start, diagnostic.end),
        'q',
    );
});
