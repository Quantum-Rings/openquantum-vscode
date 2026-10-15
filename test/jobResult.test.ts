// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { jobResultHtml, type JobResultModel } from '../src/jobResult';

function model(overrides: Partial<JobResultModel> = {}): JobResultModel {
    return {
        id: '4b576795-e443-425d-b560-38f77c7a3b97',
        name: 'bell.qasm',
        status: 'Completed',
        providerName: 'IonQ',
        backendName: 'Forte',
        backendId: 'ionq:forte',
        submittedAt: '2026-01-02T03:04:05.000Z',
        completedAt: '2026-01-02T04:00:00.000Z',
        creditsUsed: 2,
        executionPlanName: 'Spark',
        message: 'Finished',
        resultsKind: 'counts',
        counts: { '00': 512, '11': 256 },
        canDownload: true,
        ...overrides,
    };
}

function pageScript(html: string): string {
    const match = html.match(/<script nonce="nonce">([\s\S]*)<\/script>/);
    assert.ok(match?.[1]);
    return match[1];
}

test('the job window matches the website results explorer', () => {
    const html = jobResultHtml('nonce', model(), 1);
    assert.match(html, /script-src 'nonce-nonce'/);
    assert.match(html, /style-src 'nonce-nonce'/);
    assert.match(html, /<script nonce="nonce">/);
    assert.match(html, /const generation = 1;/);
    assert.match(html, /All jobs/);
    assert.match(html, /Download results/);
    assert.match(html, />Counts</);
    assert.match(html, /Probabilities/);
    assert.match(html, /Hamming weight/);
    assert.match(html, /As measured/);
    assert.match(html, /Reversed/);
    assert.match(html, /State filter \(1_0\)/);
    assert.match(html, />Chart</);
    assert.match(html, />Table</);
    assert.match(html, /\.ipynb/);
    assert.match(html, /Shots/);
    assert.match(html, /Unique states/);
    assert.match(html, /Most likely/);
    assert.match(html, /Entropy/);
    assert.match(html, />Tier</);
    assert.match(html, /Job ID/);
    assert.match(html, /Bit order/);
    assert.match(html, /fill: #2fb380/);
    assert.match(html, /\[hidden\] \{ display: none !important; \}/);
    assert.match(
        html,
        /button\.mode\.on, button\.toggle\.on, body\.vscode-dark button\.mode\.on, body\.vscode-dark button\.toggle\.on \{[^}]*color: #ffffff/,
    );
    assert.match(
        html,
        /button\.ghost, button\.mode \{ display: inline-flex; align-items: center;/,
    );
    assert.match(html, /id="explorer" class="layout" hidden/);
    assert.match(
        html,
        /Flip the endianness of every bitstring\. Use this if your SDK reads qubit 0 from the opposite end\./,
    );
    assert.match(html, /Loading results…/);
    assert.match(html, /Results aren't available for this job yet\./);
    assert.match(html, /We couldn't read the results for this job/);
    assert.match(html, /aren't a measurement-counts histogram/);
    assert.match(html, /No counts to show\./);
    assert.match(html, /No states match the current filters\./);
    assert.match(html, /\[\^\\w\.-]/);
    assert.doesNotMatch(html, /Calibration/);
    new vm.Script(pageScript(html));
});

test('job names are passed as script data, not markup', () => {
    const html = jobResultHtml(
        'nonce',
        model({
            name: '<img src=x onerror=alert(1)>',
            resultsKind: 'none',
            counts: null,
            canDownload: false,
            message: null,
        }),
        2,
    );
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /\\u003cimg/);
    assert.match(html, /const generation = 2;/);
    new vm.Script(pageScript(html));
});
