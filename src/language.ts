// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';
import {
    analyze,
    TOKEN_MODIFIERS,
    TOKEN_TYPES,
    type Analysis,
} from './analyze';
import { isQasmLanguage } from './debugConfig';

const legend = new vscode.SemanticTokensLegend(
    [...TOKEN_TYPES],
    [...TOKEN_MODIFIERS],
);
let circuitDiagnostics: vscode.DiagnosticCollection | undefined;
let circuitStatus: vscode.StatusBarItem | undefined;
const typeIndex = new Map(TOKEN_TYPES.map((name, index) => [name, index]));
const modifierIndex = new Map(
    TOKEN_MODIFIERS.map((name, index) => [name, index]),
);

/** Publish current circuit diagnostics and return how many there are. */
export function syncCircuitDiagnostics(document: vscode.TextDocument): number {
    if (!circuitDiagnostics || !circuitStatus) {
        return 0;
    }
    if (!isQasmLanguage(document.languageId)) {
        return 0;
    }
    return publish(document, circuitDiagnostics, circuitStatus);
}

export function activateLanguage(context: vscode.ExtensionContext): void {
    const diagnostics = vscode.languages.createDiagnosticCollection('qasm');
    const status = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100,
    );
    circuitDiagnostics = diagnostics;
    circuitStatus = status;
    status.command = 'openquantum.run';
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const refresh = (document: vscode.TextDocument) => {
        if (!isQasmLanguage(document.languageId)) {
            return;
        }
        const key = document.uri.toString();
        const pending = timers.get(key);
        if (pending) {
            clearTimeout(pending);
        }
        timers.set(
            key,
            setTimeout(() => {
                timers.delete(key);
                publish(document, diagnostics, status);
            }, 200),
        );
    };

    context.subscriptions.push(
        diagnostics,
        status,
        vscode.workspace.onDidOpenTextDocument(refresh),
        vscode.workspace.onDidChangeTextDocument((event) =>
            refresh(event.document),
        ),
        vscode.workspace.onDidCloseTextDocument((document) => {
            diagnostics.delete(document.uri);
            const pending = timers.get(document.uri.toString());
            if (pending) {
                clearTimeout(pending);
                timers.delete(document.uri.toString());
            }
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                refresh(editor.document);
            } else {
                status.hide();
            }
        }),
        vscode.languages.registerDocumentSemanticTokensProvider(
            [{ language: 'qasm' }, { language: 'openqasm' }],
            new QasmSemanticTokensProvider(),
            legend,
        ),
    );

    for (const document of vscode.workspace.textDocuments) {
        refresh(document);
    }
}

function publish(
    document: vscode.TextDocument,
    diagnostics: vscode.DiagnosticCollection,
    status: vscode.StatusBarItem,
): number {
    let analysis: Analysis;
    try {
        analysis = analyze(document.getText());
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        diagnostics.set(document.uri, [
            new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                message,
                vscode.DiagnosticSeverity.Error,
            ),
        ]);
        return 1;
    }
    diagnostics.set(
        document.uri,
        analysis.diagnostics.map((item) => {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(item.line, item.start, item.line, item.end),
                item.message,
                vscode.DiagnosticSeverity.Error,
            );
            diagnostic.source = 'OpenQASM';
            return diagnostic;
        }),
    );
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
        return analysis.diagnostics.length;
    }
    const problems = analysis.diagnostics.length;
    status.text =
        problems === 0
            ? `QASM ${analysis.version}`
            : `QASM ${analysis.version} · ${problems} problem${problems === 1 ? '' : 's'}`;
    status.tooltip = 'Open Create job';
    status.show();
    return analysis.diagnostics.length;
}

class QasmSemanticTokensProvider
    implements vscode.DocumentSemanticTokensProvider
{
    provideDocumentSemanticTokens(
        document: vscode.TextDocument,
    ): vscode.SemanticTokens {
        const builder = new vscode.SemanticTokensBuilder(legend);
        let analysis: Analysis;
        try {
            analysis = analyze(document.getText());
        } catch {
            return builder.build();
        }
        for (const span of analysis.spans) {
            const type = typeIndex.get(span.tokenType);
            if (type === undefined) {
                continue;
            }
            let modifiers = 0;
            for (const modifier of span.modifiers) {
                const bit = modifierIndex.get(
                    modifier as (typeof TOKEN_MODIFIERS)[number],
                );
                if (bit !== undefined) {
                    modifiers |= 1 << bit;
                }
            }
            builder.push(span.line, span.start, span.length, type, modifiers);
        }
        return builder.build();
    }
}
