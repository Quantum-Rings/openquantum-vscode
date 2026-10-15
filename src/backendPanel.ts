// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import * as vscode from 'vscode';
import { backendDetailsHtml, type BackendDetailModel } from './backendDetails';

/** Editor tab with the same capability sheet as the website backend page. */
export class BackendDetailsPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private messages: vscode.Disposable | undefined;

    constructor(private readonly onSubmitJob: (backendId: string) => void) {}

    show(model: BackendDetailModel): void {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.Active;
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'openquantum.backendDetails',
                panelTitle(model),
                column,
                { enableScripts: true },
            );
            this.messages = this.panel.webview.onDidReceiveMessage(
                (message: { command?: string; backendId?: string }) => {
                    if (message?.command === 'submitJob' && message.backendId) {
                        this.onSubmitJob(message.backendId);
                    }
                },
            );
            this.panel.onDidDispose(() => {
                this.messages?.dispose();
                this.messages = undefined;
                this.panel = undefined;
            });
        }
        this.panel.title = panelTitle(model);
        const nonce = createHash('sha256')
            .update(`${Date.now()}:${model.id}`)
            .digest('hex')
            .slice(0, 16);
        this.panel.webview.html = backendDetailsHtml(nonce, model);
        this.panel.reveal(this.panel.viewColumn ?? column);
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }
}

function panelTitle(model: BackendDetailModel): string {
    return model.name || 'Backend';
}
