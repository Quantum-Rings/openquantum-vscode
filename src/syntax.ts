// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import { tokenSpan, type RawToken } from './spans';

export interface SyntaxDiagnostic {
    /** 0-based line. */
    line: number;
    /** 0-based start column. */
    start: number;
    /** 0-based end column. */
    end: number;
    message: string;
}

const ASSIGNMENT = new Set([
    'EqualsAssmt',
    'Equals',
    'CompoundArithmeticOp',
    'CompoundBinaryOp',
]);

/**
 * Keywords someone is likely to mistype in `bit = measure qubit`.
 * Only a one-edit miss suggests a keyword. Anything else is just unexpected.
 */
const KEYWORDS = [
    'measure',
    'reset',
    'barrier',
    'delay',
    'qubit',
    'bit',
    'include',
    'gate',
    'if',
    'else',
    'for',
    'while',
    'box',
    'let',
    'const',
    'return',
];

/**
 * The parser keeps going when a statement is not valid OpenQASM. Two cases
 * produce no parse error: `b = meaxsure q[1]` (an assignment of a name, then
 * a second name) and a name sitting alone where a statement should be.
 */
export function statementDiagnostics(tokens: RawToken[]): SyntaxDiagnostic[] {
    const diagnostics: SyntaxDiagnostic[] = [];
    let start = 0;
    for (let index = 0; index <= tokens.length; index += 1) {
        const boundary =
            index === tokens.length || tokens[index]?.enumName === 'Semicolon';
        if (!boundary) {
            continue;
        }
        checkStatement(tokens, start, index, diagnostics);
        start = index + 1;
    }
    return diagnostics;
}

function checkStatement(
    tokens: RawToken[],
    start: number,
    end: number,
    diagnostics: SyntaxDiagnostic[],
): void {
    for (let index = start; index < end; index += 1) {
        if (!ASSIGNMENT.has(tokens[index]?.enumName ?? '')) {
            continue;
        }
        const name = index + 1;
        const token = tokens[name];
        if (
            !token ||
            token.enumName !== 'Id' ||
            typeof token.value !== 'string'
        ) {
            continue;
        }
        const after = afterPrimary(tokens, name, end);
        const nextName = tokens[after]?.enumName;
        if (
            nextName !== 'Id' &&
            nextName !== 'HardwareQubit' &&
            nextName !== 'Dollar'
        ) {
            continue;
        }
        diagnostics.push(
            diagnosticFor(tokens, name, unexpectedName(token.value)),
        );
    }

    const dangling = danglingName(tokens, start, end);
    if (dangling !== undefined && typeof tokens[dangling]?.value === 'string') {
        diagnostics.push(
            diagnosticFor(
                tokens,
                dangling,
                `Unexpected '${tokens[dangling].value}'`,
            ),
        );
    }
}

function unexpectedName(word: string): string {
    const meant = suggestKeyword(word);
    if (meant) {
        return `Unknown keyword '${word}'. Did you mean '${meant}'?`;
    }
    return `Unexpected '${word}'`;
}

function danglingName(
    tokens: RawToken[],
    start: number,
    end: number,
): number | undefined {
    if (tokens[start]?.enumName !== 'Id') {
        return undefined;
    }
    let index = start + 1;
    if (tokens[index]?.enumName === 'LParen') {
        return undefined;
    }
    if (tokens[index]?.enumName === 'LSParen') {
        index = skipGroup(tokens, index, end);
    }
    return index === end ? start : undefined;
}

function afterPrimary(tokens: RawToken[], index: number, end: number): number {
    let cursor = index + 1;
    while (
        cursor < end &&
        (tokens[cursor]?.enumName === 'LParen' ||
            tokens[cursor]?.enumName === 'LSParen')
    ) {
        cursor = skipGroup(tokens, cursor, end);
    }
    return cursor;
}

function skipGroup(tokens: RawToken[], index: number, end: number): number {
    const open = tokens[index]?.enumName;
    const close =
        open === 'LParen'
            ? 'RParen'
            : open === 'LSParen'
              ? 'RSParen'
              : undefined;
    if (!close) {
        return index + 1;
    }
    let depth = 0;
    for (let cursor = index; cursor < end; cursor += 1) {
        if (tokens[cursor]?.enumName === open) {
            depth += 1;
        } else if (tokens[cursor]?.enumName === close) {
            depth -= 1;
            if (depth === 0) {
                return cursor + 1;
            }
        }
    }
    return end;
}

function diagnosticFor(
    tokens: RawToken[],
    index: number,
    message: string,
): SyntaxDiagnostic {
    const token = tokens[index];
    const columns = tokenSpan(tokens, index);
    return {
        line: Math.max(0, (token?.line ?? 1) - 1),
        start: columns.startCol,
        end: Math.max(columns.endCol, columns.startCol + 1),
        message,
    };
}

export function suggestKeyword(word: string): string | undefined {
    const lower = word.toLowerCase();
    let best: string | undefined;
    for (const keyword of KEYWORDS) {
        if (editDistance(lower, keyword) !== 1) {
            continue;
        }
        if (best && best.length >= keyword.length) {
            continue;
        }
        best = keyword;
    }
    return best;
}

/** Damerau-Levenshtein distance, capped so a difference above 1 returns 2. */
function editDistance(left: string, right: string): number {
    if (Math.abs(left.length - right.length) > 1) {
        return 2;
    }
    const rows = left.length + 1;
    const cols = right.length + 1;
    const score: number[][] = [];
    for (let row = 0; row < rows; row += 1) {
        score[row] = [];
        for (let col = 0; col < cols; col += 1) {
            score[row][col] = row === 0 ? col : col === 0 ? row : 0;
        }
    }
    for (let row = 1; row < rows; row += 1) {
        for (let col = 1; col < cols; col += 1) {
            const cost = left[row - 1] === right[col - 1] ? 0 : 1;
            let value = Math.min(
                score[row - 1][col] + 1,
                score[row][col - 1] + 1,
                score[row - 1][col - 1] + cost,
            );
            if (
                row > 1 &&
                col > 1 &&
                left[row - 1] === right[col - 2] &&
                left[row - 2] === right[col - 1]
            ) {
                value = Math.min(value, score[row - 2][col - 2] + 1);
            }
            score[row][col] = value;
        }
    }
    return Math.min(2, score[left.length][right.length]);
}
