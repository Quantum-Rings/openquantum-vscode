// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import * as vscode from 'vscode';
import { jobResultHtml, type JobResultModel } from './jobResult';

const MAX_SAVE_CHARS = 2_000_000;

export interface JobResultPanelHandlers {
    onClose: () => void;
    onShowJobs: () => void;
    onOpenBackend: (backendId: string) => void;
    onDownloadResults: (jobId: string) => void;
    onSaveText: (filename: string, content: string) => void;
}

/** Editor tab for one job, matching the website job details page. */
export class JobResultPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private listener: vscode.Disposable | undefined;
    private jobId: string | null = null;
    private signature = '';
    private generation = 0;
    private readyGeneration = 0;

    constructor(private readonly handlers: JobResultPanelHandlers) {}

    currentJobId(): string | null {
        return this.panel ? this.jobId : null;
    }

    show(model: JobResultModel, reveal: boolean): void {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.Active;
        const signature = jobSignature(model);
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'openquantum.jobResult',
                panelTitle(model),
                column,
                { enableScripts: true },
            );
            this.listener = this.panel.webview.onDidReceiveMessage(
                (message) => {
                    this.onMessage(message);
                },
            );
            this.panel.onDidDispose(() => {
                this.listener?.dispose();
                this.listener = undefined;
                this.panel = undefined;
                this.jobId = null;
                this.signature = '';
                this.generation = 0;
                this.readyGeneration = 0;
                this.handlers.onClose();
            });
        }
        const sameJob = this.jobId === model.id;
        const unchanged = sameJob && this.signature === signature;
        this.jobId = model.id;
        this.panel.title = panelTitle(model);
        if (!unchanged) {
            this.signature = signature;
            const scriptReady =
                sameJob &&
                this.generation > 0 &&
                this.readyGeneration === this.generation;
            if (scriptReady) {
                void this.panel.webview.postMessage({ type: 'job', model });
            } else {
                this.generation += 1;
                this.readyGeneration = 0;
                const nonce = createHash('sha256')
                    .update(
                        `${Date.now()}:${model.id}:${this.generation}:${signature}`,
                    )
                    .digest('hex')
                    .slice(0, 16);
                this.panel.webview.html = jobResultHtml(
                    nonce,
                    model,
                    this.generation,
                );
            }
        }
        if (reveal) {
            this.panel.reveal(this.panel.viewColumn ?? column);
        }
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
        this.jobId = null;
        this.signature = '';
        this.generation = 0;
        this.readyGeneration = 0;
    }

    private onMessage(message: unknown): void {
        if (!message || typeof message !== 'object') {
            return;
        }
        const data = message as Record<string, unknown>;
        switch (data.command) {
            case 'ready':
                if (data.generation === this.generation) {
                    this.readyGeneration = this.generation;
                }
                return;
            case 'showJobs':
                this.handlers.onShowJobs();
                return;
            case 'openBackend':
                this.handlers.onOpenBackend(String(data.backendId ?? ''));
                return;
            case 'downloadResults':
                if (this.jobId) {
                    this.handlers.onDownloadResults(this.jobId);
                }
                return;
            case 'saveText': {
                const filename =
                    typeof data.filename === 'string' ? data.filename : '';
                const content = data.content;
                if (!/^[\w.-]+$/.test(filename) || filename.length > 120) {
                    return;
                }
                if (
                    typeof content !== 'string' ||
                    content.length > MAX_SAVE_CHARS
                ) {
                    return;
                }
                this.handlers.onSaveText(filename, content);
                return;
            }
            default:
                return;
        }
    }
}

function panelTitle(model: JobResultModel): string {
    return model.name || 'Job';
}

function jobSignature(model: JobResultModel): string {
    const counts = model.counts
        ? createHash('sha256').update(stableCounts(model.counts)).digest('hex')
        : '';
    return [
        model.id,
        model.name,
        model.status,
        model.providerName,
        model.backendName,
        model.backendId ?? '',
        model.submittedAt ?? '',
        model.completedAt ?? '',
        model.creditsUsed ?? '',
        model.executionPlanName ?? '',
        model.message ?? '',
        model.resultsKind,
        model.canDownload ? '1' : '0',
        counts,
    ].join('\n');
}

function stableCounts(counts: Record<string, number>): string {
    return JSON.stringify(
        Object.keys(counts)
            .sort()
            .map((key) => [key, counts[key]]),
    );
}
