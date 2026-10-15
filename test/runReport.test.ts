// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locatedProblem, problemSpan } from '../src/runReport';

const PRECOMPILE = `QASM precompilation failed: Undefined gate 'cnotx' at line 5, column 1:
   cnotx q[0], q[1];
   ^`;

test('a precompilation failure becomes a problem on the reported gate', () => {
    assert.deepEqual(locatedProblem(PRECOMPILE), {
        message: "QASM precompilation failed: Undefined gate 'cnotx'",
        line: 5,
        column: 1,
    });
    assert.deepEqual(problemSpan('cnotx q[0], q[1];', 1), {
        start: 0,
        end: 5,
    });
});

test('a located message without a caret diagram is still a problem', () => {
    assert.deepEqual(
        locatedProblem("Undefined gate 'asdf' at line 7, column 1"),
        {
            message: "Undefined gate 'asdf'",
            line: 7,
            column: 1,
        },
    );
});

test('an error without a source location stays out of Problems', () => {
    assert.equal(locatedProblem('The circuit changed. Submit again.'), null);
    assert.equal(locatedProblem('API Error 401: unauthorized'), null);
});
