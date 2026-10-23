// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import type { OrganizationInfo } from './platform';

/** Organizations already shown, and how many leading rows came from the first page. */
export interface OrgListSnapshot {
    organizations: OrganizationInfo[];
    firstPageCount: number;
    cursor: string | null;
    query: string;
}

export function emptyOrgList(): OrgListSnapshot {
    return { organizations: [], firstPageCount: 0, cursor: null, query: '' };
}

/** Replace the list with one page from the server. */
export function replaceOrgPage(
    organizations: OrganizationInfo[],
    cursor: string | null,
    query: string,
): OrgListSnapshot {
    return {
        organizations,
        firstPageCount: organizations.length,
        cursor,
        query,
    };
}

/**
 * Keep organizations loaded with Load more, and refresh the first page in place.
 * A different search replaces the list instead of merging two result sets.
 */
export function refreshOrgPage(
    current: OrgListSnapshot,
    organizations: OrganizationInfo[],
    cursor: string | null,
    query: string,
): OrgListSnapshot {
    if (current.query !== query) {
        return replaceOrgPage(organizations, cursor, query);
    }
    const freshIds = new Set(organizations.map((org) => org.id));
    const remaining = current.organizations
        .slice(current.firstPageCount)
        .filter((org) => !freshIds.has(org.id));
    return {
        organizations: [...organizations, ...remaining],
        firstPageCount: organizations.length,
        cursor: remaining.length > 0 ? current.cursor : cursor,
        query,
    };
}

/**
 * The only organization, when there is no search and no further page.
 * A saved organization that is not on the page still counts.
 */
export function onlyOrganization(
    list: OrgListSnapshot,
    selectedId: string | null,
    selectedName: string | null,
): OrganizationInfo | null {
    if (list.query || list.cursor) {
        return null;
    }
    const byId = new Map(
        list.organizations.map((org) => [org.id, org] as const),
    );
    if (selectedId && !byId.has(selectedId)) {
        byId.set(selectedId, { id: selectedId, name: selectedName ?? '' });
    }
    if (byId.size !== 1) {
        return null;
    }
    return [...byId.values()][0] ?? null;
}

/** Append the next page. Organizations already on screen are skipped. */
export function appendOrgPage(
    current: OrgListSnapshot,
    organizations: OrganizationInfo[],
    cursor: string | null,
): OrgListSnapshot {
    const seen = new Set(current.organizations.map((org) => org.id));
    const extra = organizations.filter((org) => !seen.has(org.id));
    return {
        organizations: [...current.organizations, ...extra],
        firstPageCount: current.firstPageCount,
        cursor,
        query: current.query,
    };
}
