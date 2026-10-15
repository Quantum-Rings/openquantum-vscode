// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSdkKey, resolveCredentials } from '../src/credentials';

const KEY = JSON.stringify({ client_id: 's_test', client_secret: 'secret' });

test('parseSdkKey reads the Python SDK key file', () => {
    assert.deepEqual(parseSdkKey(KEY), {
        clientId: 's_test',
        clientSecret: 'secret',
    });
});

test('parseSdkKey rejects a file without both fields', () => {
    assert.throws(() => parseSdkKey('{"client_id":"only"}'), /client_secret/);
    assert.throws(() => parseSdkKey('not-json'), /not valid JSON/);
});

test('saved editor key wins over the environment', () => {
    const resolved = resolveCredentials({
        savedJson: KEY,
        envClientId: 'env',
        envClientSecret: 'env-secret',
    });
    assert.equal(resolved?.source, 'saved');
    assert.equal(resolved?.clientId, 's_test');
});

test('an env file wins over env vars', () => {
    const fromFile = resolveCredentials({
        envFile: JSON.stringify({
            client_id: 'from-file',
            client_secret: 'abc',
        }),
        envClientId: 'env',
        envClientSecret: 'env-secret',
    });
    assert.equal(fromFile?.source, 'env-file');
    assert.equal(fromFile?.clientId, 'from-file');
    const fromEnv = resolveCredentials({
        envClientId: ' env-id ',
        envClientSecret: ' env-secret ',
    });
    assert.equal(fromEnv?.source, 'env');
    assert.equal(fromEnv?.clientId, 'env-id');
    assert.equal(resolveCredentials({}), null);
});
