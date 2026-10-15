// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

/** A lexer token plus the enum name from the OpenQASM 2 or 3 token module. */
export interface RawToken {
    type: number;
    enumName?: string;
    value: number | string | undefined;
    /** 1-based line. */
    line: number;
    /** 1-based column. */
    column: number;
    lineText: string;
}

export interface TokenColumns {
    startCol: number;
    endCol: number;
}

/**
 * Column span for a token. The lexer reports only the start, so the end is
 * the next token on the same line, or the lexeme when the token runs to EOL.
 */
export function tokenSpan(tokens: RawToken[], index: number): TokenColumns {
    const token = tokens[index];
    const line = token.lineText ?? '';
    const start = Math.max(0, Math.min(line.length, token.column - 1));

    if (token.enumName === 'Pragma') {
        return { startCol: start, endCol: trimEnd(line).length };
    }

    const next = tokens[index + 1];
    if (next && next.line === token.line && next.column - 1 > start) {
        let end = next.column - 1;
        while (end > start + 1 && /\s/.test(line[end - 1] ?? '')) {
            end -= 1;
        }
        return { startCol: start, endCol: Math.min(line.length, end) };
    }

    if (
        typeof token.value === 'string' &&
        token.value.length > 0 &&
        line.startsWith(token.value, start)
    ) {
        return {
            startCol: start,
            endCol: Math.min(line.length, start + token.value.length),
        };
    }

    if (typeof token.value === 'number' && line[start] === '$') {
        let end = start + 1;
        while (end < line.length && /\d/.test(line[end] ?? '')) {
            end += 1;
        }
        return { startCol: start, endCol: end };
    }

    if (typeof token.value === 'number') {
        let end = start;
        while (end < line.length && /[0-9.eE_+-]/.test(line[end] ?? '')) {
            end += 1;
        }
        return { startCol: start, endCol: end > start ? end : start + 1 };
    }

    let end = start;
    while (end < line.length && !/\s/.test(line[end] ?? '')) {
        end += 1;
    }
    return {
        startCol: start,
        endCol: end > start ? end : Math.min(line.length, start + 1),
    };
}

function trimEnd(value: string): string {
    return value.replace(/\s+$/, '');
}
