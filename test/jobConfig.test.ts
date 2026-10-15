// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyConfigInput,
    checkConfiguration,
    configFields,
    initialConfig,
    type JsonSchema,
} from '../src/jobConfig';

const shotsSchema: JsonSchema = {
    type: 'object',
    properties: {
        shots: {
            title: 'Shots',
            type: 'integer',
            minimum: 100,
            maximum: 5000,
            default: 100,
        },
        disable_qubit_rewiring: {
            title: 'Disable qubit rewiring',
            type: 'boolean',
            default: false,
        },
    },
    required: ['shots'],
};

const qbloxSchema: JsonSchema = {
    type: 'object',
    properties: {
        shots: {
            title: 'Shots',
            type: 'integer',
            minimum: 1,
            default: 100,
        },
        input_format: {
            type: 'string',
            enum: ['qasm', 'qblox_sequence', 'qblox_schedule'],
        },
    },
    if: {
        properties: {
            input_format: { enum: ['qasm', 'qblox_schedule'] },
        },
        required: ['input_format'],
    },
    then: { required: ['shots'] },
    else: { not: { required: ['shots'] } },
};

const ringsSchema: JsonSchema = {
    type: 'object',
    required: ['shots', 'performance'],
    properties: {
        shots: { title: 'Shots', type: 'integer', minimum: 2, default: 100 },
        performance: {
            title: 'Performance',
            type: 'string',
            enum: ['HIGHESTEFFICIENCY', 'CUSTOM'],
            default: 'HIGHESTEFFICIENCY',
            oneOf: [
                { const: 'HIGHESTEFFICIENCY', title: 'Highest efficiency' },
                { const: 'CUSTOM', title: 'Custom' },
            ],
        },
        threshold: {
            title: 'Threshold',
            type: 'integer',
            minimum: 1,
            default: 64,
        },
    },
    if: {
        properties: { performance: { const: 'CUSTOM' } },
        required: ['performance'],
    },
    then: { required: ['threshold'] },
    else: { not: { required: ['threshold'] } },
};

const tensorSchema: JsonSchema = {
    type: 'object',
    required: ['engine'],
    properties: {
        engine: {
            title: 'Engine',
            type: 'string',
            enum: ['lightning.qubit', 'lightning.tensor'],
            default: 'lightning.qubit',
        },
        method: { title: 'Tensor method', type: 'string', enum: ['mps', 'tn'] },
    },
    if: {
        properties: { engine: { const: 'lightning.tensor' } },
        required: ['engine'],
    },
    then: {},
    else: {
        allOf: [{ not: { required: ['method'] } }],
    },
};

test('initial values use schema defaults and skip input_format', () => {
    assert.deepEqual(initialConfig(shotsSchema), {
        shots: 100,
        disable_qubit_rewiring: false,
    });
    assert.equal('input_format' in initialConfig(qbloxSchema), false);
});

test('a shots schema rejects values outside its range', () => {
    const low = checkConfiguration(shotsSchema, {
        shots: 10,
        disable_qubit_rewiring: false,
    });
    assert.equal(low.ok, false);
    assert.deepEqual(low.errors, ['Shots must be at least 100']);
    const ok = checkConfiguration(shotsSchema, {
        shots: 100,
        disable_qubit_rewiring: true,
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.shots, 100);
    assert.deepEqual(ok.data, {
        shots: 100,
        disable_qubit_rewiring: true,
    });
});

test('qasm input makes qblox shots required and drops input_format', () => {
    const fields = configFields(qbloxSchema, initialConfig(qbloxSchema));
    assert.deepEqual(
        fields.map((field) => field.key),
        ['shots'],
    );
    assert.equal(fields[0]?.required, true);
    const missing = checkConfiguration(qbloxSchema, {});
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.errors, ['Shots is required']);
    const ready = checkConfiguration(qbloxSchema, { shots: 100 });
    assert.equal(ready.ok, true);
    assert.equal('input_format' in ready.data, false);
});

test('threshold is hidden until performance is custom', () => {
    const hidden = configFields(ringsSchema, initialConfig(ringsSchema));
    assert.equal(
        hidden.some((field) => field.key === 'threshold'),
        false,
    );
    const custom = applyConfigInput(
        ringsSchema,
        initialConfig(ringsSchema),
        'performance',
        'CUSTOM',
    );
    const shown = configFields(ringsSchema, custom);
    assert.equal(
        shown.find((field) => field.key === 'threshold')?.required,
        true,
    );
    const cleared = applyConfigInput(ringsSchema, custom, 'threshold', '');
    const check = checkConfiguration(ringsSchema, cleared);
    assert.equal(check.ok, false);
    assert.ok(check.errors.includes('Threshold is required'));
    const submitted = checkConfiguration(ringsSchema, {
        ...custom,
        threshold: 64,
    });
    assert.equal(submitted.ok, true);
    assert.equal(submitted.data.threshold, 64);
    const standard = checkConfiguration(
        ringsSchema,
        initialConfig(ringsSchema),
    );
    assert.equal(standard.ok, true);
    assert.equal('threshold' in standard.data, false);
});

test('tensor-only fields stay hidden for other engines', () => {
    const cpu = configFields(tensorSchema, initialConfig(tensorSchema));
    assert.equal(
        cpu.some((field) => field.key === 'method'),
        false,
    );
    const tensor = applyConfigInput(
        tensorSchema,
        initialConfig(tensorSchema),
        'engine',
        'lightning.tensor',
    );
    assert.equal(
        configFields(tensorSchema, tensor).some(
            (field) => field.key === 'method',
        ),
        true,
    );
});
