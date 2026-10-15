// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import type { JobSummary } from './platform';

/** Jobs already shown, and how many of the leading rows came from the first page. */
export interface JobListSnapshot {
    jobs: JobSummary[];
    firstPageCount: number;
    cursor: string | null;
}

export function emptyJobList(): JobListSnapshot {
    return { jobs: [], firstPageCount: 0, cursor: null };
}

/** Replace the list with one page from the server. */
export function replaceJobPage(
    pageJobs: JobSummary[],
    cursor: string | null,
): JobListSnapshot {
    return {
        jobs: pageJobs,
        firstPageCount: pageJobs.length,
        cursor,
    };
}

/** Keep jobs loaded with Load more, and refresh the first page in place. */
export function refreshJobPage(
    current: JobListSnapshot,
    pageJobs: JobSummary[],
    cursor: string | null,
): JobListSnapshot {
    const freshIds = new Set(pageJobs.map((job) => job.id));
    const remaining = current.jobs
        .slice(current.firstPageCount)
        .filter((job) => !freshIds.has(job.id));
    return {
        jobs: [...pageJobs, ...remaining],
        firstPageCount: pageJobs.length,
        cursor: remaining.length > 0 ? current.cursor : cursor,
    };
}

/** Append the next page. Jobs already on screen are skipped. */
export function appendJobPage(
    current: JobListSnapshot,
    pageJobs: JobSummary[],
    cursor: string | null,
): JobListSnapshot {
    const seen = new Set(current.jobs.map((job) => job.id));
    const extra = pageJobs.filter((job) => !seen.has(job.id));
    return {
        jobs: [...current.jobs, ...extra],
        firstPageCount: current.firstPageCount,
        cursor,
    };
}

/**
 * Keep a job that was just submitted at the top until the server list includes it.
 * The stored first page is unchanged, so a later refresh still replaces only that page.
 */
export function withPinned(
    jobs: JobSummary[],
    pinned: JobSummary | null,
): JobSummary[] {
    if (!pinned || jobs.some((job) => job.id === pinned.id)) {
        return jobs;
    }
    return [pinned, ...jobs];
}

export function isTerminalJobStatus(status: string): boolean {
    const name = status.toLowerCase();
    return (
        name === 'completed' ||
        name === 'failed' ||
        name === 'canceled' ||
        name === 'cancelled'
    );
}
