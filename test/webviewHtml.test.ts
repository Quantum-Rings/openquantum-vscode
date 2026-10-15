// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { BUY_CREDITS_URL, SDK_KEYS_URL } from '../src/links';
import { webviewHtml } from '../src/webviewHtml';

test('the sidebar script parses and points at the website pages', () => {
    const html = webviewHtml('nonce', 'vscode-resource:', {
        onLight: 'light.png',
        onDark: 'dark.png',
    });
    assert.match(html, /script-src 'nonce-nonce'/);
    assert.match(html, /aria-label="Open Quantum"/);
    assert.match(html, /openLink', \{ url: links\.site \}/);
    assert.doesNotMatch(html, /class="links"/);
    assert.doesNotMatch(html, /quantumrings\.com/);
    assert.doesNotMatch(html, /aria-label="Back"/);
    assert.match(html, /'Validating…' : 'Validate'/);
    assert.match(html, /Select Backend/);
    assert.match(html, /View live specs/);
    assert.match(html, /#50bc83/);
    assert.match(html, /commandButton\('Submit', 'submit'/);
    assert.match(html, /Job Settings & Metadata/);
    assert.match(html, /Job Configuration Parameters/);
    assert.match(html, /Help for /);
    assert.match(html, /Job Name/);
    assert.match(html, /setJobName/);
    assert.match(html, /Enter a descriptive name for your job/);
    assert.match(html, /id="balance"><\/div>\s*<div id="nav" class="nav">/);
    assert.match(html, /Create Job/);
    assert.match(html, /SDK Keys/);
    assert.match(html, /Spark is available/);
    assert.match(html, /M11\.017 2\.814/);
    assert.match(html, /\['home', 'Backends'\]/);
    assert.match(html, /pageHead\('Backends', 'refresh'\)/);
    assert.match(html, /pageHead\('Jobs', 'refreshJobs'\)/);
    assert.match(html, /Load more…/);
    assert.match(html, /function trackedJobStatus/);
    assert.doesNotMatch(html, /This job keeps running/);
    assert.doesNotMatch(html, /heading\('Result'\)/);
    assert.doesNotMatch(html, /Start over/);
    assert.match(html, /M3 12a9 9 0 0 1 9-9/);
    assert.match(html, /\.nav \{[^}]*margin: 12px 0 14px/);
    assert.doesNotMatch(html, /id="refresh"/);
    assert.doesNotMatch(
        html,
        /if \(field\.description\) fields\.appendChild\(paragraph\(field\.description/,
    );
    assert.match(html, new RegExp(BUY_CREDITS_URL.replaceAll('/', '\\/')));
    assert.match(html, new RegExp(SDK_KEYS_URL.replaceAll('/', '\\/')));
    const script = html.match(/<script nonce="nonce">([\s\S]*)<\/script>/);
    assert.ok(script);
    new vm.Script(script[1]);
});
