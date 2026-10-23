// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

/** Physical seed edges narrowed by a loaded oq-cal document.
 * Matches packages/portal/src/utils/liveCoupling.ts.
 */
export interface LiveCoupling {
    edges: number[][];
    enabledIndices: number[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function seedIndexByLabel(
    seedLabels: Record<string, string> | null | undefined,
): Map<string, number> {
    const out = new Map<string, number>();
    if (!seedLabels) {
        return out;
    }
    for (const [key, name] of Object.entries(seedLabels)) {
        if (typeof name !== 'string' || !name.trim()) {
            continue;
        }
        const id = Number(key);
        if (!Number.isInteger(id)) {
            continue;
        }
        out.set(name.trim(), id);
    }
    return out;
}

function seedIndex(
    ref: unknown,
    qcalLabels: Record<string, unknown>,
    seedByLabel: Map<string, number>,
): number | null {
    if (typeof ref !== 'string') {
        return null;
    }
    const label = qcalLabels[ref];
    if (typeof label === 'string' && seedByLabel.has(label.trim())) {
        return seedByLabel.get(label.trim()) ?? null;
    }
    if (seedByLabel.size > 0) {
        return null;
    }
    if (!ref.startsWith('$')) {
        return null;
    }
    const idx = Number(ref.slice(1));
    return Number.isInteger(idx) && idx >= 0 ? idx : null;
}

function offeredQubitRefs(document: unknown): unknown[] | null {
    const root = asRecord(document);
    const device = asRecord(root?.device);
    if (device && Array.isArray(device.enabled_qubits)) {
        return device.enabled_qubits;
    }
    const qubits = asRecord(root?.qubits);
    if (!qubits) {
        return null;
    }
    const refs = Object.keys(qubits);
    return refs.length > 0 ? refs : null;
}

/** Live edges are the physical coupling map limited to offered qubits. */
export function liveCouplingFromCalibration(
    couplingMap: number[][],
    seedLabels: Record<string, string> | null | undefined,
    document: unknown,
): LiveCoupling | null {
    const device = asRecord(asRecord(document)?.device);
    const offered = offeredQubitRefs(document);
    if (!offered) {
        return null;
    }

    const qcalLabels = asRecord(device?.qubit_labels) ?? {};
    const byLabel = seedIndexByLabel(seedLabels);
    const enabledIndices: number[] = [];
    const allow = new Set<number>();
    for (const ref of offered) {
        const idx = seedIndex(ref, qcalLabels, byLabel);
        if (idx == null || allow.has(idx)) {
            continue;
        }
        allow.add(idx);
        enabledIndices.push(idx);
    }
    enabledIndices.sort((a, b) => a - b);

    const edges: number[][] = [];
    for (const edge of couplingMap) {
        if (!Array.isArray(edge) || edge.length !== 2) {
            continue;
        }
        const a = Number(edge[0]);
        const b = Number(edge[1]);
        if (!Number.isInteger(a) || !Number.isInteger(b)) {
            continue;
        }
        if (allow.has(a) && allow.has(b)) {
            edges.push([a, b]);
        }
    }
    return { edges, enabledIndices };
}
