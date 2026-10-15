// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    appendJobPage,
    emptyJobList,
    isTerminalJobStatus,
    refreshJobPage,
    replaceJobPage,
    withPinned,
} from '../src/jobList';
import type { JobSummary } from '../src/platform';

function job(id: string, status = 'Queued'): JobSummary {
    return {
        id,
        name: id,
        status,
        message: null,
        providerName: 'IonQ',
        backendName: 'Forte',
        backendClassId: null,
        submittedAt: null,
        completedAt: null,
        creditsUsed: null,
        executionPlanName: null,
    };
}

test('refresh keeps jobs loaded with Load more', () => {
    const first = replaceJobPage([job('a'), job('b')], 'cursor-1');
    const loaded = appendJobPage(first, [job('c'), job('b')], 'cursor-2');
    assert.deepEqual(
        loaded.jobs.map((item) => item.id),
        ['a', 'b', 'c'],
    );
    assert.equal(loaded.firstPageCount, 2);
    assert.equal(loaded.cursor, 'cursor-2');

    const refreshed = refreshJobPage(
        loaded,
        [job('d', 'Running'), job('a', 'Completed')],
        'cursor-3',
    );
    assert.deepEqual(
        refreshed.jobs.map((item) => item.id),
        ['d', 'a', 'c'],
    );
    assert.equal(refreshed.jobs[1]?.status, 'Completed');
    assert.equal(refreshed.firstPageCount, 2);
    assert.equal(refreshed.cursor, 'cursor-2');
});

test('refresh adopts the new cursor when no extra page is loaded', () => {
    const first = replaceJobPage([job('a'), job('b')], 'cursor-1');
    const refreshed = refreshJobPage(first, [job('a')], null);
    assert.deepEqual(
        refreshed.jobs.map((item) => item.id),
        ['a'],
    );
    assert.equal(refreshed.cursor, null);
    assert.deepEqual(emptyJobList().jobs, []);
});

test('a submitted job stays visible until the server list includes it', () => {
    const listed = replaceJobPage([job('older')], 'cursor-1');
    const pinned = job('new');
    assert.deepEqual(
        withPinned(listed.jobs, pinned).map((item) => item.id),
        ['new', 'older'],
    );
    const arrived = replaceJobPage([job('new'), job('older')], 'cursor-2');
    assert.deepEqual(
        withPinned(arrived.jobs, pinned).map((item) => item.id),
        ['new', 'older'],
    );
});

test('terminal job statuses stop the result watch', () => {
    assert.equal(isTerminalJobStatus('Completed'), true);
    assert.equal(isTerminalJobStatus('cancelled'), true);
    assert.equal(isTerminalJobStatus('Queued'), false);
    assert.equal(isTerminalJobStatus('Running'), false);
});
