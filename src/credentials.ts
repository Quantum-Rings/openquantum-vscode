// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

export type CredentialSource = 'saved' | 'env-file' | 'env';

export interface ResolvedCredentials {
    clientId: string;
    clientSecret: string;
    source: CredentialSource;
}

export interface CredentialInputs {
    /** JSON already stored in the editor secret store. */
    savedJson?: string | null;
    /** Contents of OPENQUANTUM_SDK_KEY when that file exists. */
    envFile?: string | null;
    envClientId?: string | null;
    envClientSecret?: string | null;
}

const SOURCE_LABEL: Record<CredentialSource, string> = {
    saved: 'Saved key',
    'env-file': 'OPENQUANTUM_SDK_KEY',
    env: 'Environment',
};

export function credentialSourceLabel(source: CredentialSource): string {
    return SOURCE_LABEL[source];
}

/**
 * Saved key from the SDK Keys page, then OPENQUANTUM_SDK_KEY, then
 * OPENQUANTUM_CLIENT_ID and OPENQUANTUM_CLIENT_SECRET.
 */
export function resolveCredentials(
    inputs: CredentialInputs,
): ResolvedCredentials | null {
    if (inputs.savedJson) {
        return { ...parseSdkKey(inputs.savedJson), source: 'saved' };
    }
    if (inputs.envFile) {
        return { ...parseSdkKey(inputs.envFile), source: 'env-file' };
    }
    const clientId = inputs.envClientId?.trim();
    const clientSecret = inputs.envClientSecret?.trim();
    if (clientId && clientSecret) {
        return { clientId, clientSecret, source: 'env' };
    }
    return null;
}

export function parseSdkKey(json: string): {
    clientId: string;
    clientSecret: string;
} {
    let data: unknown;
    try {
        data = JSON.parse(json);
    } catch {
        throw new Error('SDK key file is not valid JSON.');
    }
    if (!data || typeof data !== 'object') {
        throw new Error('SDK key file must be a JSON object.');
    }
    const record = data as Record<string, unknown>;
    const clientId = record.client_id;
    const clientSecret = record.client_secret;
    if (typeof clientId !== 'string' || clientId.length === 0) {
        throw new Error('SDK key file must contain client_id.');
    }
    if (typeof clientSecret !== 'string' || clientSecret.length === 0) {
        throw new Error('SDK key file must contain client_secret.');
    }
    return { clientId, clientSecret };
}
