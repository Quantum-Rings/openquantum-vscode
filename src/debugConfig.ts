// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

const DEBUG_TYPE = 'openquantum';

export function isQasmLanguage(languageId: string | undefined): boolean {
    return languageId === 'qasm' || languageId === 'openqasm';
}

export interface LaunchConfig {
    type?: string;
    request?: string;
    name?: string;
    program?: string;
    internalConsoleOptions?: string;
}

/** Fill an empty Run/Debug launch so F5 runs the circuit instead of searching the Marketplace. */
export function launchConfigFor(
    config: LaunchConfig,
    languageId: string | undefined,
): LaunchConfig | undefined {
    if (!config.type && !config.request && !config.name) {
        if (!isQasmLanguage(languageId)) {
            return undefined;
        }
        return {
            type: DEBUG_TYPE,
            name: 'Run on Open Quantum',
            request: 'launch',
            program: '${file}',
            internalConsoleOptions: 'neverOpen',
        };
    }
    if (config.type === DEBUG_TYPE) {
        config.internalConsoleOptions = 'neverOpen';
    }
    return config;
}

/** True when the debug session should hand off to the Open Quantum panel and then end. */
export function shouldRunOnDebugCommand(command: string): boolean {
    return command === 'launch';
}
