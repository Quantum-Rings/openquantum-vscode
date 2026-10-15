// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launchConfigFor, shouldRunOnDebugCommand } from '../src/debugConfig';

test('an empty launch on a QASM file runs on Open Quantum', () => {
    assert.deepEqual(launchConfigFor({}, 'qasm'), {
        type: 'openquantum',
        name: 'Run on Open Quantum',
        request: 'launch',
        program: '${file}',
        internalConsoleOptions: 'neverOpen',
    });
});

test('an empty launch on the OpenQASM language id runs on Open Quantum', () => {
    assert.equal(launchConfigFor({}, 'openqasm')?.type, 'openquantum');
});

test('an empty launch on another language is left alone', () => {
    assert.equal(launchConfigFor({}, 'python'), undefined);
});

test('an Open Quantum launch keeps the debug console closed', () => {
    const config = {
        type: 'openquantum',
        request: 'launch',
        name: 'Run on Open Quantum',
    };
    assert.equal(
        launchConfigFor(config, 'qasm')?.internalConsoleOptions,
        'neverOpen',
    );
});

test('only the launch request starts a run', () => {
    assert.equal(shouldRunOnDebugCommand('launch'), true);
    assert.equal(shouldRunOnDebugCommand('initialize'), false);
});
