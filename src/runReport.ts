// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

export interface LocatedProblem {
    /** Diagnostic text, without the line, column, or caret diagram. */
    message: string;
    /** 1-based line from the server message. */
    line: number;
    /** 1-based column from the server message. */
    column: number;
}

const LOCATED = /^(.*?) at line (\d+), column (\d+)\s*:?\s*$/;

/**
 * A preparation or job failure that names a source location.
 * `QASM precompilation failed: Undefined gate 'cnotx' at line 5, column 1:`
 * becomes a problem on that gate. Other errors stay in the run panel.
 */
export function locatedProblem(text: string): LocatedProblem | null {
    const first = text.split('\n')[0] ?? '';
    const match = LOCATED.exec(first);
    if (!match) {
        return null;
    }
    const line = Number(match[2]);
    const column = Number(match[3]);
    if (
        !Number.isInteger(line) ||
        !Number.isInteger(column) ||
        line < 1 ||
        column < 1
    ) {
        return null;
    }
    const message = match[1].trim();
    if (!message) {
        return null;
    }
    return { message, line, column };
}

/** Underline the name that starts at the reported column. */
export function problemSpan(
    lineText: string,
    column: number,
): { start: number; end: number } {
    const start = Math.min(Math.max(0, column - 1), lineText.length);
    let end = start;
    if (/[A-Za-z_]/.test(lineText[end] ?? '')) {
        while (
            end < lineText.length &&
            /[A-Za-z0-9_]/.test(lineText[end] ?? '')
        ) {
            end += 1;
        }
    } else {
        end = Math.min(lineText.length, start + 1);
    }
    if (end <= start) {
        end = start + 1;
    }
    return { start, end };
}
