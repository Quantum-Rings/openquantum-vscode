// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    appendOrgPage,
    emptyOrgList,
    onlyOrganization,
    refreshOrgPage,
    replaceOrgPage,
} from '../src/orgList';
import type { OrganizationInfo } from '../src/platform';

function org(id: string, name = id): OrganizationInfo {
    return { id, name };
}

test('refresh keeps organizations loaded with Load more', () => {
    const first = replaceOrgPage([org('a'), org('b')], 'cursor-1', '');
    const loaded = appendOrgPage(first, [org('c'), org('b')], 'cursor-2');
    assert.deepEqual(
        loaded.organizations.map((item) => item.id),
        ['a', 'b', 'c'],
    );
    assert.equal(loaded.firstPageCount, 2);
    assert.equal(loaded.cursor, 'cursor-2');

    const refreshed = refreshOrgPage(
        loaded,
        [org('d', 'Dee'), org('a', 'Aye')],
        'cursor-3',
        '',
    );
    assert.deepEqual(
        refreshed.organizations.map((item) => item.id),
        ['d', 'a', 'c'],
    );
    assert.equal(refreshed.organizations[1]?.name, 'Aye');
    assert.equal(refreshed.firstPageCount, 2);
    assert.equal(refreshed.cursor, 'cursor-2');
    assert.equal(refreshed.query, '');
});

test('refresh adopts the new cursor when no extra page is loaded', () => {
    const first = replaceOrgPage([org('a'), org('b')], 'cursor-1', '');
    const refreshed = refreshOrgPage(first, [org('a')], null, '');
    assert.deepEqual(
        refreshed.organizations.map((item) => item.id),
        ['a'],
    );
    assert.equal(refreshed.cursor, null);
    assert.deepEqual(emptyOrgList().organizations, []);
});

test('one organization and no further page is not a list', () => {
    const page = replaceOrgPage([org('lab', 'Lab')], null, '');
    assert.equal(onlyOrganization(page, 'lab', 'Lab')?.name, 'Lab');
    assert.equal(onlyOrganization(page, null, null)?.name, 'Lab');
    assert.equal(onlyOrganization(emptyOrgList(), 'lab', 'Lab')?.name, 'Lab');
    assert.equal(onlyOrganization(page, 'other', 'Other'), null);
    assert.equal(
        onlyOrganization(
            replaceOrgPage([org('lab')], 'cursor-1', ''),
            'lab',
            'Lab',
        ),
        null,
    );
    assert.equal(
        onlyOrganization(
            replaceOrgPage([org('lab')], null, 'lab'),
            'lab',
            'Lab',
        ),
        null,
    );
    assert.equal(
        onlyOrganization(
            replaceOrgPage([org('a'), org('b')], null, ''),
            'a',
            'A',
        ),
        null,
    );
});

test('a new search replaces organizations already loaded', () => {
    const loaded = appendOrgPage(
        replaceOrgPage([org('a'), org('b')], 'cursor-1', ''),
        [org('c')],
        'cursor-2',
    );
    const searched = refreshOrgPage(loaded, [org('c', 'Cee')], 'cursor-9', 'c');
    assert.deepEqual(
        searched.organizations.map((item) => item.id),
        ['c'],
    );
    assert.equal(searched.cursor, 'cursor-9');
    assert.equal(searched.query, 'c');
    assert.equal(searched.firstPageCount, 1);
});
