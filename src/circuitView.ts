// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

/** Diagram stored on the preparation. The extension only draws this JSON. */

export interface CircuitGate {
    name: string;
    qubits: number[];
    params?: string;
    gateKind: 'gate' | 'measure';
    /** 1-based line in the program shown beside the diagram. */
    line?: number;
}

export interface DrawableCircuit {
    kind: 'circuit';
    qubits: string[];
    moments: { gates: CircuitGate[] }[];
}

export interface RefusedCircuit {
    kind: 'refused';
    reason: string;
    qubits?: number;
    moments?: number;
    gates?: number;
}

export type CircuitViewModel = DrawableCircuit | RefusedCircuit;

export interface LayoutGate {
    id: string;
    column: number;
    label: string;
    name: string;
    qubits: number[];
    params?: string;
    gateKind: 'gate' | 'measure';
    line?: number;
    /** Horizontal size of this gate's box. Non-boxes stay at DIAGRAM_BOX. */
    boxWidth: number;
}

export interface CircuitLayout {
    wireCount: number;
    wires: string[];
    columnCount: number;
    /** Pixel width of each visual column. Short gates stay at DIAGRAM_COL. */
    columnWidths: number[];
    gates: LayoutGate[];
}

export function parseCircuitView(value: unknown): CircuitViewModel | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value as {
        kind?: unknown;
        reason?: unknown;
        qubits?: unknown;
        moments?: unknown;
    };
    if (record.kind === 'refused' && typeof record.reason === 'string') {
        return value as RefusedCircuit;
    }
    if (
        record.kind === 'circuit' &&
        Array.isArray(record.qubits) &&
        record.qubits.every((qubit) => typeof qubit === 'string') &&
        Array.isArray(record.moments) &&
        record.moments.every(isDrawableMoment)
    ) {
        return value as DrawableCircuit;
    }
    return null;
}

function isDrawableMoment(moment: unknown): boolean {
    if (!moment || typeof moment !== 'object') {
        return false;
    }
    const gates = (moment as { gates?: unknown }).gates;
    if (!Array.isArray(gates)) {
        return false;
    }
    return gates.every((gate) => {
        if (!gate || typeof gate !== 'object') {
            return false;
        }
        const record = gate as { name?: unknown; qubits?: unknown };
        return (
            typeof record.name === 'string' &&
            Array.isArray(record.qubits) &&
            record.qubits.every(
                (qubit) => typeof qubit === 'number' && Number.isFinite(qubit),
            )
        );
    });
}

export function gateLabel(gate: CircuitGate): string {
    if (gate.gateKind === 'measure' || gate.name === 'measure') {
        return 'M';
    }
    const base = gate.name.split(' @ ').pop() || gate.name;
    if (base === 'cx' || base === 'cnot') {
        return 'CNOT';
    }
    if (base === 'sdg') return 'S†';
    if (base === 'tdg') return 'T†';
    if (base === 'sxdg') return 'SX†';
    if (base === 'reset') return '|0>';
    return base.toUpperCase();
}

/** Standard gate box and column. A long label grows past these. */
export const DIAGRAM_BOX = 34;
export const DIAGRAM_COL = 76;

/**
 * Width of the text inside a 12px semibold label.
 * A dagger, a bar, and a space are narrower than a letter.
 */
export function drawnBoxWidth(label: string): number {
    if (!label) return DIAGRAM_BOX;
    let text = 0;
    for (const char of label) {
        text += char === '†' || char === '|' || char === ' ' ? 6 : 9;
    }
    return Math.max(DIAGRAM_BOX, Math.ceil(text + 16));
}

export type ControlStyle = 'filled' | 'open';

export type WireMark = { index: number; style: ControlStyle };

/** How a stored gate is drawn. Names follow the usual circuit symbols. */
export type GateSymbol =
    | { kind: 'meter'; qubits: number[] }
    | { kind: 'target'; marks: WireMark[]; target: number }
    | { kind: 'dots'; marks: WireMark[] }
    | { kind: 'swap'; marks: WireMark[]; swapped: number[] }
    | { kind: 'box'; marks: WireMark[]; qubits: number[]; label: string };

const X_BASES = new Set(['x', 'cx', 'cnot', 'ccx', 'ccnot', 'toffoli']);

const ONE_CONTROL_LABEL: Record<string, string> = {
    cy: 'Y',
    ch: 'H',
    cp: 'P',
    cphase: 'P',
    crx: 'RX',
    cry: 'RY',
    crz: 'RZ',
    cu: 'U',
    cu1: 'U1',
    cu2: 'U2',
    cu3: 'U3',
    cs: 'S',
    ct: 'T',
};

function splitControls(name: string): {
    styles: ControlStyle[];
    base: string;
} {
    const styles: ControlStyle[] = [];
    let rest = name.trim().toLowerCase();
    for (;;) {
        if (rest.startsWith('ctrl @ ')) {
            styles.push('filled');
            rest = rest.slice('ctrl @ '.length);
            continue;
        }
        if (rest.startsWith('negctrl @ ')) {
            styles.push('open');
            rest = rest.slice('negctrl @ '.length);
            continue;
        }
        break;
    }
    return { styles, base: rest };
}

function marksFor(
    qubits: number[],
    styles: ControlStyle[],
    count: number,
): WireMark[] {
    const marks: WireMark[] = [];
    for (let i = 0; i < count && i < qubits.length; i++) {
        marks.push({ index: qubits[i], style: styles[i] ?? 'filled' });
    }
    return marks;
}

export function gateSymbol(gate: CircuitGate): GateSymbol {
    const qubits = gate.qubits.filter((index) => index >= 0);
    const { styles, base } = splitControls(gate.name);
    const label = gateLabel(gate);
    if (gate.gateKind === 'measure' || base === 'measure') {
        return { kind: 'meter', qubits };
    }
    const controlledX =
        X_BASES.has(base) &&
        (base !== 'x' || styles.length > 0 || qubits.length > 1);
    if (controlledX && qubits.length >= 2) {
        return {
            kind: 'target',
            marks: marksFor(qubits, styles, qubits.length - 1),
            target: qubits[qubits.length - 1],
        };
    }
    const symmetricZ =
        (base === 'cz' || (base === 'z' && qubits.length > 1)) &&
        styles.every((style) => style === 'filled');
    if (symmetricZ && qubits.length >= 2) {
        return { kind: 'dots', marks: marksFor(qubits, styles, qubits.length) };
    }
    if (base === 'swap' || base === 'cswap' || base === 'fredkin') {
        const controlCount = styles.length + (base === 'swap' ? 0 : 1);
        if (qubits.length === controlCount + 2) {
            return {
                kind: 'swap',
                marks: marksFor(qubits, styles, controlCount),
                swapped: qubits.slice(controlCount),
            };
        }
    }
    const controlledLabel = ONE_CONTROL_LABEL[base];
    if (controlledLabel && qubits.length >= 2) {
        const controlCount = styles.length + 1;
        if (controlCount < qubits.length) {
            return {
                kind: 'box',
                marks: marksFor(qubits, styles, controlCount),
                qubits: qubits.slice(controlCount),
                label: controlledLabel,
            };
        }
    }
    if (styles.length > 0 && styles.length < qubits.length) {
        return {
            kind: 'box',
            marks: marksFor(qubits, styles, styles.length),
            qubits: qubits.slice(styles.length),
            label,
        };
    }
    return { kind: 'box', marks: [], qubits, label };
}

export function boxWidthForGate(gate: CircuitGate): number {
    const symbol = gateSymbol(gate);
    return symbol.kind === 'box' ? drawnBoxWidth(symbol.label) : DIAGRAM_BOX;
}

export function isControlledNot(gate: CircuitGate): boolean {
    return gateSymbol(gate).kind === 'target' && gateLabel(gate) === 'CNOT';
}

function wireRange(qubits: number[]): [number, number] | null {
    const used = qubits.filter((index) => index >= 0);
    if (used.length === 0) return null;
    return [Math.min(...used), Math.max(...used)];
}

function rangesOverlap(
    left: [number, number],
    right: [number, number],
): boolean {
    return left[0] <= right[1] && right[0] <= left[1];
}

export function layoutCircuit(model: DrawableCircuit): CircuitLayout {
    const gates: LayoutGate[] = [];
    let columnCount = 0;
    model.moments.forEach((moment, momentIndex) => {
        // A connector covers every wire between a gate's top and bottom
        // qubit. Another gate can share the column only when that range
        // misses it, so the strokes do not join or cross a box.
        const lanes: [number, number][][] = [];
        moment.gates.forEach((gate, index) => {
            const range = wireRange(gate.qubits);
            let lane = 0;
            if (range) {
                lane = lanes.findIndex((occupied) =>
                    occupied.every((other) => !rangesOverlap(other, range)),
                );
                if (lane < 0) {
                    lane = lanes.length;
                    lanes.push([range]);
                } else {
                    lanes[lane].push(range);
                }
            }
            const laid: LayoutGate = {
                id: `${momentIndex}-${index}`,
                column: columnCount + lane,
                label: gateLabel(gate),
                name: gate.name,
                qubits: gate.qubits,
                params: gate.params,
                gateKind: gate.gateKind === 'measure' ? 'measure' : 'gate',
                boxWidth: boxWidthForGate(gate),
            };
            if (typeof gate.line === 'number' && gate.line >= 1) {
                laid.line = gate.line;
            }
            gates.push(laid);
        });
        columnCount += Math.max(lanes.length, 1);
    });
    const columnWidths = Array.from(
        { length: Math.max(columnCount, 1) },
        () => DIAGRAM_COL,
    );
    for (const gate of gates) {
        if (gate.column < 0 || gate.column >= columnWidths.length) continue;
        const need = Math.max(
            DIAGRAM_COL,
            gate.boxWidth + (DIAGRAM_COL - DIAGRAM_BOX),
        );
        columnWidths[gate.column] = Math.max(columnWidths[gate.column], need);
    }
    return {
        wireCount: model.qubits.length,
        wires: model.qubits,
        columnCount,
        columnWidths,
        gates,
    };
}

export function describeGate(gate: LayoutGate, wires: string[]): string {
    const targets = gate.qubits
        .map((index) => wires[index] ?? `q${index}`)
        .join(', ');
    const params = gate.params ? `(${gate.params})` : '';
    return `${gate.name}${params} on ${targets}`;
}

export function refusalDetail(model: RefusedCircuit): string | null {
    const parts: string[] = [];
    if (typeof model.qubits === 'number') {
        parts.push(`${model.qubits} qubits`);
    }
    if (typeof model.moments === 'number') {
        parts.push(`${model.moments} moments`);
    }
    if (typeof model.gates === 'number') {
        parts.push(`${model.gates} gates`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
}
