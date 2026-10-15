// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUY_CREDITS_URL, isCompanySite, SDK_KEYS_URL } from '../src/links';

test('company pages on Open Quantum and Quantum Rings can open from the panel', () => {
    assert.equal(isCompanySite('https://www.openquantum.com'), true);
    assert.equal(isCompanySite('https://www.quantumrings.com'), true);
    assert.equal(isCompanySite(BUY_CREDITS_URL), true);
    assert.equal(isCompanySite(SDK_KEYS_URL), true);
    assert.equal(
        isCompanySite('https://www.openquantum.com/citation?from=vscode'),
        true,
    );
    assert.equal(
        isCompanySite('http://www.openquantum.com/buy-credits'),
        false,
    );
    assert.equal(isCompanySite('https://example.com'), false);
    assert.equal(isCompanySite('https://www.openquantum.com.evil.com'), false);
    assert.equal(isCompanySite('javascript:alert(1)'), false);
});

test('credit and key links point at the website', () => {
    assert.equal(BUY_CREDITS_URL, 'https://www.openquantum.com/buy-credits');
    assert.equal(SDK_KEYS_URL, 'https://www.openquantum.com/settings/keys');
});
