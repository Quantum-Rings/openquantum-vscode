// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';
import { launchConfigFor, shouldRunOnDebugCommand } from './debugConfig';

const DEBUG_TYPE = 'openquantum';

class RunAdapter implements vscode.DebugAdapter {
    private seq = 1;
    private readonly messages =
        new vscode.EventEmitter<vscode.DebugProtocolMessage>();
    readonly onDidSendMessage = this.messages.event;

    handleMessage(message: vscode.DebugProtocolMessage): void {
        const request = message as vscode.DebugProtocolMessage & {
            type?: string;
            command?: string;
            seq?: number;
        };
        if (request.type !== 'request' || !request.command) {
            return;
        }
        const command = request.command;
        this.messages.fire({
            seq: this.seq++,
            type: 'response',
            request_seq: request.seq ?? 0,
            success: true,
            command,
            body:
                command === 'initialize'
                    ? { supportsConfigurationDoneRequest: false }
                    : {},
        } as vscode.DebugProtocolMessage);
        if (shouldRunOnDebugCommand(command)) {
            this.messages.fire({
                seq: this.seq++,
                type: 'event',
                event: 'terminated',
            } as vscode.DebugProtocolMessage);
            void vscode.commands.executeCommand('openquantum.run');
        }
    }

    dispose(): void {
        this.messages.dispose();
    }
}

export function activateDebug(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPE, {
            resolveDebugConfiguration(_folder, config) {
                const languageId =
                    vscode.window.activeTextEditor?.document.languageId;
                const resolved = launchConfigFor(config, languageId);
                return resolved as vscode.DebugConfiguration | undefined;
            },
        }),
        vscode.debug.registerDebugAdapterDescriptorFactory(DEBUG_TYPE, {
            createDebugAdapterDescriptor() {
                return new vscode.DebugAdapterInlineImplementation(
                    new RunAdapter(),
                );
            },
        }),
    );
}
