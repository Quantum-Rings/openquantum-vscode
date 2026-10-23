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
        countsLocked: false,
        resultsPreview: null,
        resultsNotice: null,
        canDownload: true,
        canDownloadCalibration: false,
        inputTitle: 'OpenQASM',
        inputLoading: false,
        inputTabs: true,
        inputFiles: {
            original: {
                text: 'OPENQASM 2.0;\n',
                error: null,
                footer: null,
                canDownload: true,
            },
            processed: {
                text: 'OPENQASM 3.0;\nh q[0];\n',
                error: null,
                footer: null,
                canDownload: true,
            },
        },
        circuit: {
            status: 'circuit',
            message: null,
            detail: null,
            wires: ['q0'],
            columnCount: 1,
            columnWidths: [76],
            gates: [
                {
                    id: '0-0',
                    column: 0,
                    label: 'H',
                    name: 'h',
                    qubits: [0],
                    gateKind: 'gate',
                    line: 2,
                    boxWidth: 34,
                },
            ],
        },
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
    assert.match(html, /Open result/);
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
    assert.match(html, /middleEllipsis/);
    assert.match(html, /\.stat \.state \{/);
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
    assert.match(html, /Qblox acquisitions/);
    assert.match(html, /Open original/);
    assert.match(html, /Open processed/);
    assert.match(
        html,
        /The diagram follows the processed program, not this file\./,
    );
    assert.match(
        html,
        /svg\.circuit \.gate-plate \{ fill: var\(--vscode-sideBar-background, var\(--vscode-editor-background\)\);/,
    );
    assert.match(html, /plate\.setAttribute\('class', 'gate-plate'\)/);
    assert.match(html, /svg\.circuit\.labels \{ position: sticky; left: 0;/);
    assert.match(
        html,
        /background: color-mix\(in srgb, var\(--vscode-foreground\) 4%, var\(--vscode-sideBar-background, var\(--vscode-editor-background\)\)\)/,
    );
    assert.match(html, /\.source \.line \{ box-sizing: border-box;/);
    assert.match(
        html,
        /#input-tabs, #fullscreen-tabs \{ align-self: flex-start; width: fit-content; \}/,
    );
    assert.match(html, /#input-tabs \{ margin: 0 0 12px; \}/);
    assert.match(html, /\.source \.ln \{[^}]*width: 1\.5rem;/);
    assert.match(html, /aria-label="Expand input"/);
    assert.match(html, /aria-label="Expand diagram"/);
    assert.match(html, /aria-label="Close"/);
    assert.match(html, /id="fullscreen" class="fullscreen" hidden/);
    assert.match(html, /Showing the 64 highest counts\./);
    assert.match(html, /function axisTicks\(max, integer\)/);
    assert.match(html, /function chartLabels\(plotWidth, count, longest\)/);
    assert.match(html, /\.chart-wrap \{ overflow: hidden;/);
    assert.match(html, /text-anchor', 'end'/);
    assert.match(html, /rotate\(-60 /);
    assert.match(html, /middleEllipsis\(row\.state, labels\.limit\)/);
    assert.match(html, /root\.clientWidth/);
    assert.match(html, /These counts are too large to edit here\./);
    assert.match(html, /No counts to show\./);
    assert.match(html, /No states match the current filters\./);
    assert.match(html, /\[\^\\w\.-]/);
    assert.match(html, /Open calibration/);
    assert.match(html, /<span class="beta">Beta<\/span>/);
    assert.match(html, /canDownloadCalibration/);
    assert.match(html, /command: 'downloadCalibration'/);
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
