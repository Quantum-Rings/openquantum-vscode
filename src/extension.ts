// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';
import { activateDebug } from './debug';
import { activateLanguage } from './language';
import { OpenQuantumViewProvider } from './view';

export function activate(context: vscode.ExtensionContext): void {
    activateLanguage(context);
    activateDebug(context);
    const provider = new OpenQuantumViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            OpenQuantumViewProvider.viewId,
            provider,
        ),
        vscode.commands.registerCommand('openquantum.setSdkKey', () =>
            provider.openPanelPage('keys'),
        ),
        vscode.commands.registerCommand('openquantum.jobs', () =>
            provider.openPanelPage('jobs'),
        ),
        vscode.commands.registerCommand('openquantum.settings', () =>
            provider.openPanelPage('settings'),
        ),
        vscode.commands.registerCommand('openquantum.run', () =>
            provider.runActiveEditor(),
        ),
        vscode.commands.registerCommand('openquantum.newCircuit', () =>
            provider.newCircuit(),
        ),
    );
}

export function deactivate(): void {}
