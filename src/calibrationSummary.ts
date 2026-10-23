// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

/** One number on the calibration card, plus a hover explanation. */
export interface CalibrationFigure {
    text: string;
    detail: string;
}

/** Device-level 1Q/2Q fidelity and coherence from an oq-cal snapshot. */
export interface CalibrationBasics {
    fidelity1q: CalibrationFigure | null;
    fidelity2q: CalibrationFigure | null;
    t1: CalibrationFigure | null;
    t2: CalibrationFigure | null;
}

const ONE_Q_PROTOCOLS = [
    'simultaneous_rb',
    'rb',
    'simultaneous_interleaved_rb',
    'interleaved_rb',
];

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as JsonRecord;
}

function asList(value: unknown): JsonRecord[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(
        (item): item is JsonRecord =>
            !!item && typeof item === 'object' && !Array.isArray(item),
    );
}

interface Reading {
    value: number;
    status: string | null;
}

/** A measured oq-cal datum. Unmeasured and bad rows are dropped. */
function reading(raw: unknown): Reading | null {
    const datum = asRecord(raw);
    if (!datum) {
        return null;
    }
    const value = datum.value;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    const status = typeof datum.status === 'string' ? datum.status : null;
    if (status === 'unmeasured' || status === 'bad') {
        return null;
    }
    return { value, status };
}

function fidelityOf(entry: JsonRecord): number | null {
    const fidelity = reading(entry.fidelity);
    if (fidelity && fidelity.value >= 0 && fidelity.value <= 1) {
        return fidelity.value;
    }
    const error = reading(entry.error);
    const unit = asRecord(entry.error)?.unit;
    if (
        error &&
        (unit == null || unit === 'dimensionless') &&
        error.value >= 0 &&
        error.value <= 1
    ) {
        return 1 - error.value;
    }
    return null;
}

function secondsOf(raw: unknown): number | null {
    const datum = asRecord(raw);
    const time = reading(raw);
    if (!datum || !time || time.value < 0) {
        return null;
    }
    const unit = datum.unit;
    if (unit != null && unit !== 's') {
        return null;
    }
    return time.value;
}

function median(values: number[]): number | null {
    if (values.length === 0) {
        return null;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatSeconds(seconds: number): string {
    const abs = Math.abs(seconds);
    const scaled =
        abs >= 1
            ? { amount: seconds, unit: 's' }
            : abs >= 1e-3
              ? { amount: seconds * 1e3, unit: 'ms' }
              : abs >= 1e-6
                ? { amount: seconds * 1e6, unit: 'µs' }
                : { amount: seconds * 1e9, unit: 'ns' };
    const magnitude = Math.abs(scaled.amount);
    const digits = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
    return `${scaled.amount.toFixed(digits)} ${scaled.unit}`;
}

function formatFidelity(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

function published(
    value: number,
    format: (value: number) => string,
): CalibrationFigure {
    return { text: format(value), detail: 'Published device value' };
}

function across(
    values: number[],
    format: (value: number) => string,
    noun: string,
): CalibrationFigure | null {
    const value = median(values);
    if (value == null) {
        return null;
    }
    const count = values.length;
    const label = count === 1 ? noun : `${noun}s`;
    return {
        text: format(value),
        detail: `Median of ${count} ${label}`,
    };
}

function oneQubitFidelity(qubits: JsonRecord): number[] {
    const values: number[] = [];
    for (const row of Object.values(qubits)) {
        const qubit = asRecord(row);
        if (!qubit) {
            continue;
        }
        const benchmarks = asList(qubit.benchmarks);
        let chosen: number | null = null;
        let rank = ONE_Q_PROTOCOLS.length;
        for (const benchmark of benchmarks) {
            const protocol =
                typeof benchmark.protocol === 'string'
                    ? benchmark.protocol
                    : '';
            const place = ONE_Q_PROTOCOLS.indexOf(protocol);
            if (place < 0 || place >= rank) {
                continue;
            }
            const fidelity = fidelityOf(benchmark);
            if (fidelity == null) {
                continue;
            }
            chosen = fidelity;
            rank = place;
        }
        if (chosen != null) {
            values.push(chosen);
        }
    }
    return values;
}

function gateFidelities(gates: JsonRecord[], width: number): number[] {
    const matching = gates.filter((gate) => {
        if (gate.name === 'benchmark' || gate.name === 'measure') {
            return false;
        }
        return Array.isArray(gate.qubits) && gate.qubits.length === width;
    });
    const pool =
        width === 2 &&
        matching.some((gate) => gate.name === 'cz' || gate.name === 'cx')
            ? matching.filter(
                  (gate) => gate.name === 'cz' || gate.name === 'cx',
              )
            : matching;
    return pool
        .map((gate) => fidelityOf(gate))
        .filter((value): value is number => value != null);
}

/**
 * Read 1Q fidelity, 2Q fidelity, T1, and T2 from an oq-cal document.
 * A published device aggregate wins. Otherwise the figure is the median
 * across measured qubits or two-qubit gates. Returns null when the payload
 * is not calibration.
 */
export function summarizeCalibration(
    payload: unknown,
): CalibrationBasics | null {
    const doc = asRecord(payload);
    if (!doc) {
        return null;
    }
    const header = asRecord(doc.qcal);
    const device = asRecord(doc.device);
    const qubits = asRecord(doc.qubits) ?? {};
    const gates = asList(doc.gates);
    const aggregates = asRecord(doc.aggregates);
    const looksLike =
        header?.name === 'qcal.device_calibration' ||
        device != null ||
        Object.keys(qubits).length > 0 ||
        gates.length > 0 ||
        aggregates != null;
    if (!looksLike) {
        return null;
    }

    const aggQubits = asRecord(aggregates?.qubits);
    const agg1q = asRecord(asRecord(aggregates?.gates_1q)?.fidelity);
    const agg2q = asRecord(asRecord(aggregates?.gates_2q)?.fidelity);
    const published1q = secondsLikeFidelity(agg1q);
    const published2q = secondsLikeFidelity(agg2q);
    const publishedT1 = secondsOf(aggQubits?.t1);
    const publishedT2 = secondsOf(aggQubits?.t2);

    const t1Values = Object.values(qubits)
        .map((row) => secondsOf(asRecord(row)?.t1))
        .filter((value): value is number => value != null);
    const t2Values = Object.values(qubits)
        .map((row) => secondsOf(asRecord(row)?.t2))
        .filter((value): value is number => value != null);

    return {
        fidelity1q:
            published1q != null
                ? published(published1q, formatFidelity)
                : (across(oneQubitFidelity(qubits), formatFidelity, 'qubit') ??
                  across(gateFidelities(gates, 1), formatFidelity, 'gate')),
        fidelity2q:
            published2q != null
                ? published(published2q, formatFidelity)
                : across(gateFidelities(gates, 2), formatFidelity, 'gate'),
        t1:
            publishedT1 != null
                ? published(publishedT1, formatSeconds)
                : across(t1Values, formatSeconds, 'qubit'),
        t2:
            publishedT2 != null
                ? published(publishedT2, formatSeconds)
                : across(t2Values, formatSeconds, 'qubit'),
    };
}

function secondsLikeFidelity(datum: JsonRecord | null): number | null {
    if (!datum) {
        return null;
    }
    const value = reading(datum);
    if (!value || value.value < 0 || value.value > 1) {
        return null;
    }
    return value.value;
}

/** Same stamp the website shows on the calibration card. */
export function formatCalibrationStamp(iso: string | null | undefined): string {
    if (!iso) {
        return '—';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    return date.toLocaleString(undefined, {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
    });
}
