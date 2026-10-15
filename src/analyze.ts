// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import { createRequire } from 'node:module';
import { parseString } from '@quantum-rings/openquantum-parser';
import { QasmError } from '@quantum-rings/openquantum-parser/dist/errors';
import { tokenSpan, type RawToken } from './spans';
import { statementDiagnostics } from './syntax';

const nodeRequire = createRequire(__filename);

export const TOKEN_TYPES = [
    'keyword',
    'type',
    'function',
    'variable',
    'number',
    'string',
    'operator',
    'macro',
] as const;

export const TOKEN_MODIFIERS = ['readonly'] as const;

export type TokenTypeName = (typeof TOKEN_TYPES)[number];

export interface QasmDiagnostic {
    /** 0-based line. */
    line: number;
    /** 0-based start column. */
    start: number;
    /** 0-based end column. */
    end: number;
    message: string;
}

export interface SemanticSpan {
    line: number;
    start: number;
    length: number;
    tokenType: TokenTypeName;
    modifiers: string[];
}

export interface Analysis {
    version: 2 | 3;
    diagnostics: QasmDiagnostic[];
    spans: SemanticSpan[];
}

const MAX_SOURCE_CHARS = 1_000_000;

const GATES = new Set([
    'id',
    'x',
    'y',
    'z',
    'h',
    's',
    'sdg',
    't',
    'tdg',
    'sx',
    'sxdg',
    'rx',
    'ry',
    'rz',
    'p',
    'phase',
    'u',
    'u1',
    'u2',
    'u3',
    'cx',
    'cy',
    'cz',
    'ch',
    'crx',
    'cry',
    'crz',
    'cp',
    'cu',
    'cu1',
    'cu3',
    'swap',
    'ccx',
    'cswap',
    'ccz',
    'rxx',
    'ryy',
    'rzz',
    'rzx',
    'dcx',
    'ecr',
    'cs',
    'csdg',
]);

const TYPE_ENUM = new Set([
    'Qubit',
    'Bit',
    'Int',
    'UInt',
    'Float',
    'Bool',
    'Angle',
    'Complex',
    'Duration',
    'Stretch',
    'Array',
    'QReg',
    'CReg',
]);

const FUNCTION_ENUM = new Set([
    'Sin',
    'Cos',
    'Tan',
    'Arcsin',
    'Arccos',
    'Arctan',
    'Exp',
    'Ln',
    'Log',
    'Sqrt',
    'Ceiling',
    'Floor',
    'Popcount',
    'Rotl',
    'Rotr',
    'Mod',
    'Pow',
    'DurationOf',
    'SizeOf',
]);

const NUMBER_ENUM = new Set([
    'Real',
    'NNInteger',
    'Integer',
    'ScientificNotation',
    'BinaryLiteral',
    'OctalLiteral',
    'HexLiteral',
    'Pi',
    'Euler',
    'Tau',
]);

const OPERATOR_ENUM = new Set([
    'ArithmeticOp',
    'CompoundArithmeticOp',
    'BinaryOp',
    'UnaryOp',
    'CompoundBinaryOp',
    'Plus',
    'Minus',
    'Times',
    'Divide',
    'Power',
    'Arrow',
    'Equals',
    'EqualsAssmt',
    'Hash',
    'At',
    'Dollar',
]);

const MODIFIER_ENUM = new Set([
    'Ctrl',
    'NegCtrl',
    'Inv',
    'PowM',
    'QuantumModifier',
]);

const SKIP_ENUM = new Set([
    'Illegal',
    'EndOfFile',
    'Semicolon',
    'Comma',
    'Colon',
    'LParen',
    'RParen',
    'LSParen',
    'RSParen',
    'LCParen',
    'RCParen',
]);

interface QasmLexer {
    input: string;
    cursor: number;
    verifyInput: () => [boolean, number | null, string | null];
    nextToken: () => [
        number,
        number | string | undefined,
        number,
        number,
        string,
    ];
}

export function detectVersion(source: string): 2 | 3 {
    const match = source.match(/^\s*OPENQASM\s+(\d+)/m);
    if (match && match[1] === '2') {
        return 2;
    }
    return 3;
}

export function analyze(source: string): Analysis {
    const version = detectVersion(source);
    if (source.length > MAX_SOURCE_CHARS) {
        return {
            version,
            diagnostics: [
                {
                    line: 0,
                    start: 0,
                    end: 1,
                    message: 'This file is too large for the OpenQASM parser.',
                },
            ],
            spans: [],
        };
    }

    const diagnostics: QasmDiagnostic[] = [];
    const seen = new Set<string>();
    const add = (diagnostic: QasmDiagnostic) => {
        const key = `${diagnostic.line}:${diagnostic.start}:${diagnostic.end}:${diagnostic.message}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        diagnostics.push(diagnostic);
    };

    const LexerCtor = loadLexer(version);
    const Token = loadTokenEnum(version);
    const lexer = new LexerCtor(source);
    const verified = lexer.verifyInput();
    const missingSemicolon = !verified[0];
    if (missingSemicolon) {
        const line = Math.max(0, (verified[1] ?? 1) - 1);
        const text = verified[2] ?? sourceLine(source, line);
        const start = text.trimEnd().length;
        add({
            line,
            start,
            end: start + 1,
            message: 'Missing semicolon',
        });
    }

    // lex() aborts on the first missing semicolon and returns no tokens.
    // nextToken still walks the buffer so highlighting survives that error.
    lexer.cursor = 0;
    const tokens: RawToken[] = [];
    let lexError: unknown;
    try {
        while (lexer.cursor < lexer.input.length) {
            const tok = lexer.nextToken();
            const enumName =
                typeof Token[tok[0]] === 'string' ? Token[tok[0]] : undefined;
            if (enumName === 'EndOfFile') {
                break;
            }
            tokens.push({
                type: tok[0],
                enumName,
                value: tok[1],
                line: tok[2],
                column: tok[3],
                lineText: tok[4] ?? '',
            });
            if (enumName === 'Illegal') {
                const span = tokenSpan(tokens, tokens.length - 1);
                add({
                    line: Math.max(0, tok[2] - 1),
                    start: span.startCol,
                    end: Math.max(span.endCol, span.startCol + 1),
                    message: 'Unrecognized token',
                });
            }
        }
    } catch (err) {
        lexError = err;
        add(errorDiagnostic(err, source));
    }

    try {
        parseString(source, version);
    } catch (err) {
        const duplicateSemicolon = missingSemicolon && isMissingSemicolon(err);
        if (!duplicateSemicolon && !sameError(err, lexError)) {
            add(errorDiagnostic(err, source));
        }
    }

    // The parser accepts some broken statements, such as `b = meaxsure q[1]`,
    // by splitting them into an assignment and a gateless call.
    for (const diagnostic of statementDiagnostics(tokens)) {
        add(diagnostic);
    }

    return { version, diagnostics, spans: colorTokens(tokens) };
}

function loadLexer(
    version: 2 | 3,
): new (input: string, cursor?: number) => QasmLexer {
    const id = version === 2 ? 'qasm2' : 'qasm3';
    const loaded = nodeRequire(
        `@quantum-rings/openquantum-parser/dist/${id}/lexer`,
    ) as {
        default?: new (input: string, cursor?: number) => QasmLexer;
    };
    return (
        loaded.default ??
        (loaded as unknown as new (input: string, cursor?: number) => QasmLexer)
    );
}

function loadTokenEnum(version: 2 | 3): Record<number, string> {
    const id = version === 2 ? 'qasm2' : 'qasm3';
    const loaded = nodeRequire(
        `@quantum-rings/openquantum-parser/dist/${id}/token`,
    ) as {
        Token: Record<number, string>;
    };
    return loaded.Token;
}

function colorTokens(tokens: RawToken[]): SemanticSpan[] {
    const spans: SemanticSpan[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        const styled = classify(token);
        if (!styled) {
            continue;
        }
        const columns = tokenSpan(tokens, index);
        const length = columns.endCol - columns.startCol;
        if (token.line < 1 || length <= 0) {
            continue;
        }
        spans.push({
            line: token.line - 1,
            start: columns.startCol,
            length,
            tokenType: styled.tokenType,
            modifiers: styled.modifiers,
        });
    }
    spans.sort((a, b) => a.line - b.line || a.start - b.start);
    const packed: SemanticSpan[] = [];
    for (const span of spans) {
        const previous = packed[packed.length - 1];
        if (
            previous &&
            previous.line === span.line &&
            span.start < previous.start + previous.length
        ) {
            continue;
        }
        packed.push(span);
    }
    return packed;
}

function classify(
    token: RawToken,
): { tokenType: TokenTypeName; modifiers: string[] } | null {
    const name = token.enumName;
    if (!name || SKIP_ENUM.has(name)) {
        return null;
    }
    if (name === 'Id') {
        if (typeof token.value === 'string' && GATES.has(token.value)) {
            return { tokenType: 'function', modifiers: [] };
        }
        return { tokenType: 'variable', modifiers: [] };
    }
    if (name === 'String') {
        return { tokenType: 'string', modifiers: [] };
    }
    if (name === 'HardwareQubit') {
        return { tokenType: 'variable', modifiers: ['readonly'] };
    }
    if (name === 'Pragma') {
        return { tokenType: 'macro', modifiers: [] };
    }
    if (NUMBER_ENUM.has(name)) {
        return { tokenType: 'number', modifiers: [] };
    }
    if (TYPE_ENUM.has(name)) {
        return { tokenType: 'type', modifiers: [] };
    }
    if (FUNCTION_ENUM.has(name)) {
        return { tokenType: 'function', modifiers: [] };
    }
    if (MODIFIER_ENUM.has(name)) {
        return { tokenType: 'macro', modifiers: [] };
    }
    if (OPERATOR_ENUM.has(name)) {
        return { tokenType: 'operator', modifiers: [] };
    }
    if (name === 'BoolLiteral' || /^[A-Za-z]/.test(name)) {
        return { tokenType: 'keyword', modifiers: [] };
    }
    return null;
}

function errorDiagnostic(err: unknown, source: string): QasmDiagnostic {
    const qasm = err instanceof QasmError ? err : null;
    const message =
        err instanceof Error
            ? err.message.split('\n')[0] || err.name
            : String(err);
    const line = Math.max(0, (qasm?.line ?? 1) - 1);
    const text = sourceLine(source, line);
    if (text.length === 0) {
        return { line, start: 0, end: 1, message };
    }
    if (!qasm?.column || qasm.column <= 0) {
        return { line, start: 0, end: text.length, message };
    }
    const start = Math.min(text.length, qasm.column - 1);
    let end = start + 1;
    while (end < text.length && !/[\s;]/.test(text[end] ?? '')) {
        end += 1;
    }
    return { line, start, end, message };
}

function sourceLine(source: string, line: number): string {
    return source.split(/\r?\n/)[line] ?? '';
}

function isMissingSemicolon(err: unknown): boolean {
    return err instanceof Error && /missing semicolon/i.test(err.message);
}

function sameError(left: unknown, right: unknown): boolean {
    if (!(left instanceof Error) || !(right instanceof Error)) {
        return false;
    }
    if (left instanceof QasmError && right instanceof QasmError) {
        return (
            left.line === right.line &&
            left.column === right.column &&
            left.message.split('\n')[0] === right.message.split('\n')[0]
        );
    }
    return left.message === right.message;
}
