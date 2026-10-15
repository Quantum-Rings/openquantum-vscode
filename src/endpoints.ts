// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import type { PlatformEndpoints } from './platform';

/** Public service addresses. A workspace settings file can replace any of them. */
export const DEFAULT_ENDPOINTS: PlatformEndpoints = {
    keycloakBase: 'https://id.openquantum.com',
    realm: 'platform',
    managementBase: 'https://management.openquantum.com',
    schedulerBase: 'https://scheduler.openquantum.com',
};

const ENDPOINT_KEYS = [
    'keycloakBase',
    'realm',
    'managementBase',
    'schedulerBase',
] as const;

export class EndpointSettingsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EndpointSettingsError';
    }
}

/** Read `.vscode/openquantum.json`. Missing fields keep the public addresses. */
export function endpointsFromJson(text: string): PlatformEndpoints {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new EndpointSettingsError(
            'Open Quantum settings file is not valid JSON.',
        );
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new EndpointSettingsError(
            'Open Quantum settings file must be a JSON object.',
        );
    }
    const record = data as Record<string, unknown>;
    const endpoints = { ...DEFAULT_ENDPOINTS };
    for (const key of ENDPOINT_KEYS) {
        if (!(key in record) || record[key] == null || record[key] === '') {
            continue;
        }
        if (typeof record[key] !== 'string') {
            throw new EndpointSettingsError(
                `Open Quantum settings file ${key} must be a string.`,
            );
        }
        const value = record[key].trim();
        if (value) {
            endpoints[key] = value;
        }
    }
    return endpoints;
}
