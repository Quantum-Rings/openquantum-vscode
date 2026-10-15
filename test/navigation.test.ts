// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    canGoBack,
    goBackInPanel,
    goHome,
    initialHistory,
    openPage,
} from '../src/navigation';

test('opening a page remembers where you were, and Home clears that stack', () => {
    const home = initialHistory();
    const create = openPage(home, 'create');
    const jobs = openPage(create, 'jobs');
    assert.deepEqual(jobs, { page: 'jobs', stack: ['home', 'create'] });
    assert.equal(openPage(jobs, 'jobs'), jobs);
    assert.deepEqual(goHome(jobs), { page: 'home', stack: [] });
    assert.equal(goHome(home), home);
});

test('Back leaves the quote for the form before it leaves the page', () => {
    const history = openPage(initialHistory(), 'create');
    const quote = goBackInPanel({
        history,
        step: 'quote',
        working: false,
    });
    assert.equal(quote.handled, true);
    assert.equal(quote.pageChanged, false);
    assert.equal(quote.step, 'setup');
    assert.equal(quote.history.page, 'create');

    const home = goBackInPanel({
        history: quote.history,
        step: 'setup',
        working: false,
    });
    assert.equal(home.pageChanged, true);
    assert.equal(home.history.page, 'home');
    assert.equal(home.history.stack.length, 0);
});

test('Back does nothing while a submit is running', () => {
    const history = openPage(initialHistory(), 'create');
    const stayed = goBackInPanel({
        history,
        step: 'quote',
        working: true,
    });
    assert.equal(stayed.handled, false);
    assert.equal(stayed.step, 'quote');
    assert.equal(canGoBack({ history, step: 'quote', working: true }), false);
    assert.equal(canGoBack({ history, step: 'setup', working: false }), true);
});

test('the page stack stays bounded', () => {
    let history = initialHistory();
    for (let index = 0; index < 30; index += 1) {
        history = openPage(history, index % 2 === 0 ? 'create' : 'jobs');
    }
    assert.ok(history.stack.length <= 12);
});
