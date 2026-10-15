// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

export interface CountBar {
    bitstring: string;
    count: number;
}

export interface JobOutput {
    jobId: string;
    status: string;
    counts: CountBar[] | null;
    raw: string;
    calibration: string | null;
}

/** Text for the Open Quantum output channel after a job has results. */
export function formatJobOutput(result: JobOutput): string {
    const lines = [`Results · ${result.status} · ${result.jobId}`];
    if (result.counts && result.counts.length > 0) {
        for (const bar of result.counts) {
            lines.push(`${bar.bitstring}  ${bar.count}`);
        }
    }
    lines.push('Output JSON', result.raw);
    if (result.calibration) {
        lines.push('Calibration JSON', result.calibration);
    }
    return lines.join('\n');
}

const COUNT_KEYS = [
    'counts',
    'measurement_counts',
    'measurements',
    'data',
    'results',
    'result',
    'output',
    'c',
    'meas',
];

/** Pull a bitstring-to-count map out of the JSON a completed job downloads. */
export function extractCounts(value: unknown, depth = 0): CountBar[] | null {
    if (depth > 6 || value == null) {
        return null;
    }
    if (isCountMap(value)) {
        return bars(value);
    }
    if (Array.isArray(value)) {
        const fromPairs = pairCounts(value);
        if (fromPairs) {
            return fromPairs;
        }
        for (const entry of value) {
            const found = extractCounts(entry, depth + 1);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (typeof value !== 'object') {
        return null;
    }
    const record = value as Record<string, unknown>;
    for (const key of COUNT_KEYS) {
        if (key in record) {
            const found = extractCounts(record[key], depth + 1);
            if (found) {
                return found;
            }
        }
    }
    for (const entry of Object.values(record)) {
        const found = extractCounts(entry, depth + 1);
        if (found) {
            return found;
        }
    }
    return null;
}

function isCountMap(value: unknown): value is Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
        return false;
    }
    return entries.every(
        ([key, count]) => /^[01]+$/.test(key) && typeof count === 'number',
    );
}

function bars(map: Record<string, number>): CountBar[] {
    return Object.entries(map)
        .map(([bitstring, count]) => ({ bitstring, count }))
        .sort(
            (a, b) =>
                b.count - a.count || a.bitstring.localeCompare(b.bitstring),
        );
}

function pairCounts(value: unknown[]): CountBar[] | null {
    if (value.length === 0) {
        return null;
    }
    const barsOut: CountBar[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        const record = entry as Record<string, unknown>;
        const bitstring = record.bitstring ?? record.state ?? record.bits;
        const count = record.count ?? record.shots;
        if (
            typeof bitstring !== 'string' ||
            !/^[01]+$/.test(bitstring) ||
            typeof count !== 'number'
        ) {
            return null;
        }
        barsOut.push({ bitstring, count });
    }
    return barsOut.sort(
        (a, b) => b.count - a.count || a.bitstring.localeCompare(b.bitstring),
    );
}
