// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

export const OPEN_QUANTUM_SITE = 'https://www.openquantum.com';
export const QUANTUM_RINGS_SITE = 'https://www.quantumrings.com';
export const BUY_CREDITS_URL = `${OPEN_QUANTUM_SITE}/buy-credits`;
export const SDK_KEYS_URL = `${OPEN_QUANTUM_SITE}/settings/keys`;

const COMPANY_HOSTS = new Set(['www.openquantum.com', 'www.quantumrings.com']);

/** HTTPS pages on the Open Quantum and Quantum Rings sites. */
export function isCompanySite(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            parsed.protocol === 'https:' && COMPANY_HOSTS.has(parsed.hostname)
        );
    } catch {
        return false;
    }
}
