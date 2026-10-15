// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    DEFAULT_ENDPOINTS,
    EndpointSettingsError,
    endpointsFromJson,
} from '../src/endpoints';

test('a missing settings file is the public service', () => {
    assert.equal(
        DEFAULT_ENDPOINTS.managementBase,
        'https://management.openquantum.com',
    );
    assert.equal(
        DEFAULT_ENDPOINTS.schedulerBase,
        'https://scheduler.openquantum.com',
    );
    assert.equal(DEFAULT_ENDPOINTS.keycloakBase, 'https://id.openquantum.com');
    assert.equal(DEFAULT_ENDPOINTS.realm, 'platform');
});

test('the workspace settings file replaces only the fields it sets', () => {
    const endpoints = endpointsFromJson(
        JSON.stringify({
            managementBase: 'https://management.example.com',
            realm: 'platform',
        }),
    );
    assert.equal(endpoints.managementBase, 'https://management.example.com');
    assert.equal(endpoints.schedulerBase, DEFAULT_ENDPOINTS.schedulerBase);
    assert.equal(endpoints.realm, 'platform');
});

test('a settings file that is not an object is an error', () => {
    assert.throws(
        () => endpointsFromJson('[]'),
        (err: unknown) =>
            err instanceof EndpointSettingsError &&
            /JSON object/.test(err.message),
    );
    assert.throws(() => endpointsFromJson('{'), /not valid JSON/);
    assert.throws(
        () => endpointsFromJson('{"realm": 1}'),
        /realm must be a string/,
    );
});
