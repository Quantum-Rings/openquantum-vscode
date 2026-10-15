// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    backendLight,
    chooseCheapest,
    OpenQuantumClient,
    PlatformError,
    preparationPayload,
    PUBLIC_PLAN_ID,
    selectQuote,
    type PlatformEndpoints,
    type QuotePlan,
} from '../src/platform';

const endpoints: PlatformEndpoints = {
    keycloakBase: 'https://id.openquantum.com',
    realm: 'platform',
    managementBase: 'https://management.openquantum.com',
    schedulerBase: 'https://scheduler.openquantum.com',
};

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

const quotePlans: QuotePlan[] = [
    {
        name: 'Private',
        price: 10,
        description: '',
        executionPlanId: 'private-id',
        queuePriorities: [
            {
                name: 'Standard',
                description: '',
                priceIncrease: 0,
                queuePriorityId: 'std',
            },
        ],
    },
    {
        name: 'Public',
        price: 1,
        description: '',
        executionPlanId: PUBLIC_PLAN_ID,
        queuePriorities: [
            {
                name: 'Instant',
                description: '',
                priceIncrease: 5,
                queuePriorityId: 'instant',
            },
            {
                name: 'Standard',
                description: '',
                priceIncrease: 0,
                queuePriorityId: 'std',
            },
        ],
    },
];

test('chooseCheapest picks the lowest total and flags the public plan', () => {
    const chosen = chooseCheapest(quotePlans);
    assert.equal(chosen.planName, 'Public');
    assert.equal(chosen.priorityName, 'Standard');
    assert.equal(chosen.credits, 1);
    assert.equal(chosen.citation, true);
});

test('selectQuote with no choice matches the cheapest plan and queue', () => {
    assert.deepEqual(
        selectQuote(quotePlans, null, null),
        chooseCheapest(quotePlans),
    );
});

test('selectQuote uses the chosen plan and its cheapest queue', () => {
    const chosen = selectQuote(quotePlans, 'private-id', null);
    assert.equal(chosen.planName, 'Private');
    assert.equal(chosen.priorityName, 'Standard');
    assert.equal(chosen.credits, 10);
    assert.equal(chosen.citation, false);
});

test('selectQuote uses the chosen queue', () => {
    const chosen = selectQuote(quotePlans, PUBLIC_PLAN_ID, 'instant');
    assert.equal(chosen.priorityName, 'Instant');
    assert.equal(chosen.credits, 6);
    assert.equal(chosen.citation, true);
});

test('backend lights follow status and whether jobs are accepted', () => {
    assert.equal(backendLight('Online', true), 'green');
    assert.equal(backendLight('online', null), 'green');
    assert.equal(backendLight('Maintenance', true), 'yellow');
    assert.equal(backendLight('Reserved', true), 'yellow');
    assert.equal(backendLight('Online', false), 'yellow');
    assert.equal(backendLight(null, null), 'yellow');
    assert.equal(backendLight('', true), 'yellow');
    assert.equal(backendLight('Offline', true), 'red');
    assert.equal(backendLight('offline', false), 'red');
});

test('preparation payload sends configuration_data and dual-writes integer shots', () => {
    const payload = preparationPayload({
        organizationId: 'org',
        backendClassId: 'ionq:forte-1',
        name: 'bell.qasm',
        uploadId: 'upload',
        subcategoryId: 'oth:oth',
        configuration: { shots: 100, disable_qubit_rewiring: false },
    });
    assert.equal(payload.submitted_with, 'vscode');
    assert.equal(payload.input_format, 'qasm');
    assert.equal(payload.shots, 100);
    assert.deepEqual(payload.configuration_data, {
        shots: 100,
        disable_qubit_rewiring: false,
    });
    const omitted = preparationPayload({
        organizationId: 'org',
        backendClassId: 'ionq:forte-1',
        name: 'bell.qasm',
        uploadId: 'upload',
        subcategoryId: 'oth:oth',
        configuration: {},
    });
    assert.equal('shots' in omitted, false);
    assert.deepEqual(omitted.configuration_data, {});
});

test('listProviders follows the cursor and sends the bearer token', async () => {
    const calls: string[] = [];
    const client = new OpenQuantumClient(
        endpoints,
        { clientId: 's_test', clientSecret: 'secret' },
        async (url, init) => {
            calls.push(`${init?.method ?? 'GET'} ${url}`);
            if (String(url).endsWith('/token')) {
                return jsonResponse(200, {
                    access_token: 'token-1',
                    expires_in: 300,
                });
            }
            assert.equal(
                new Headers(init?.headers).get('authorization'),
                'Bearer token-1',
            );
            if (!String(url).includes('cursor=')) {
                return jsonResponse(200, {
                    providers: [
                        {
                            id: 'p1',
                            name: 'IonQ',
                            description: 'trapped ion',
                            short_code: 'ionq',
                        },
                    ],
                    pagination: { next_cursor: 'page-2' },
                });
            }
            assert.ok(String(url).includes('cursor=page-2'));
            return jsonResponse(200, {
                providers: [
                    {
                        id: 'p2',
                        name: 'IQM',
                        description: '',
                        short_code: 'iqm',
                    },
                ],
                pagination: {},
            });
        },
        async () => undefined,
    );
    const providers = await client.listProviders();
    assert.deepEqual(
        providers.map((provider) => provider.shortCode),
        ['ionq', 'iqm'],
    );
    assert.equal(calls.length, 3);
});

test('overlapping calls share one token fetch', async () => {
    let tokenCalls = 0;
    let release: (response: Response) => void = () => undefined;
    const gate = new Promise<Response>((resolve) => {
        release = resolve;
    });
    const client = new OpenQuantumClient(
        endpoints,
        { clientId: 's_test', clientSecret: 'secret' },
        async (url) => {
            if (String(url).endsWith('/token')) {
                tokenCalls += 1;
                return gate;
            }
            return jsonResponse(200, {
                organizations: [{ id: 'org-1', name: 'Lab' }],
                pagination: {},
            });
        },
        async () => undefined,
    );
    const first = client.listOrganizations();
    const second = client.listOrganizations();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(tokenCalls, 1);
    release(jsonResponse(200, { access_token: 'token-1', expires_in: 300 }));
    const [left, right] = await Promise.all([first, second]);
    assert.equal(left[0]?.name, 'Lab');
    assert.equal(right[0]?.name, 'Lab');
    assert.equal(tokenCalls, 1);
});

test('a rejected token is refreshed once for overlapping calls', async () => {
    let tokenCalls = 0;
    const authorizations: string[] = [];
    const client = new OpenQuantumClient(
        endpoints,
        { clientId: 's_test', clientSecret: 'secret' },
        async (url, init) => {
            if (String(url).endsWith('/token')) {
                tokenCalls += 1;
                return jsonResponse(200, {
                    access_token: `token-${tokenCalls}`,
                    expires_in: 300,
                });
            }
            const authorization =
                new Headers(init?.headers).get('authorization') ?? '';
            authorizations.push(authorization);
            if (authorization === 'Bearer token-1') {
                return jsonResponse(401, {
                    status_code: 401,
                    message: 'Unauthorized',
                    type: 'UNAUTHORIZED',
                    error_code: 'req-1',
                });
            }
            return jsonResponse(200, {
                organizations: [{ id: 'org-1', name: 'Lab' }],
                pagination: {},
            });
        },
        async () => undefined,
    );
    const orgs = await Promise.all([
        client.listOrganizations(),
        client.listOrganizations(),
    ]);
    assert.equal(orgs[0][0]?.name, 'Lab');
    assert.equal(orgs[1][0]?.name, 'Lab');
    assert.equal(tokenCalls, 2);
    assert.ok(authorizations.includes('Bearer token-2'));
    assert.equal(
        authorizations.filter((value) => value === 'Bearer token-1').length,
        2,
    );
});

test('backend and job lists send the organization so private systems are included', async () => {
    const client = new OpenQuantumClient(
        endpoints,
        { clientId: 's_test', clientSecret: 'secret' },
        async (url, init) => {
            const href = String(url);
            if (href.endsWith('/token')) {
                return jsonResponse(200, {
                    access_token: 'token-1',
                    expires_in: 300,
                });
            }
            assert.equal(
                new Headers(init?.headers).get('x-organization-id'),
                'org-1',
            );
            if (href.includes('/v1/backends/classes')) {
                return jsonResponse(200, {
                    backend_classes: [
                        {
                            id: 'class-1',
                            name: 'Private QPU',
                            description: 'lab',
                            type: 'QPU',
                            provider_id: 'p1',
                            short_code: 'lab:qpu',
                            queue_depth: 4,
                            accepting_jobs: true,
                            spark_available: true,
                            status: 'Online',
                        },
                    ],
                    pagination: {},
                });
            }
            if (href.includes('/v1/organizations/org-1/jobs')) {
                assert.ok(href.includes('cursor=next-1'));
                return jsonResponse(200, {
                    jobs: [
                        {
                            id: 'job-9',
                            name: 'bell.qasm',
                            status: 'Completed',
                            provider_name: 'IonQ',
                            backend_name: 'Forte',
                            backend_class_id: 'class-1',
                            submitted_at: '2026-01-02T03:04:05.000Z',
                            completed_at: '2026-01-02T04:00:00.000Z',
                            credits_used: 3,
                            execution_plan_name: 'Spark',
                        },
                    ],
                    pagination: { next_cursor: null },
                });
            }
            throw new Error(`unexpected ${href}`);
        },
        async () => undefined,
    );
    const backends = await client.listBackendClasses('org-1');
    assert.equal(backends[0].queueDepth, 4);
    assert.equal(backends[0].sparkAvailable, true);
    assert.equal(backends[0].status, 'Online');
    const jobs = await client.listJobs('org-1', 'next-1');
    assert.equal(jobs.nextCursor, null);
    assert.equal(jobs.jobs[0].name, 'bell.qasm');
    assert.equal(jobs.jobs[0].creditsUsed, 3);
    assert.equal(jobs.jobs[0].backendName, 'Forte');
    assert.equal(jobs.jobs[0].completedAt, '2026-01-02T04:00:00.000Z');
    assert.equal(jobs.jobs[0].executionPlanName, 'Spark');
});

test('a terms-of-use response uses the SDK message', async () => {
    const client = new OpenQuantumClient(
        endpoints,
        { clientId: 's_test', clientSecret: 'secret' },
        async (url) => {
            if (String(url).endsWith('/token')) {
                return jsonResponse(200, {
                    access_token: 'token-1',
                    expires_in: 300,
                });
            }
            return jsonResponse(403, {
                status_code: 403,
                message: ['blocked'],
                type: 'TERMS_OF_USE_REQUIRED',
                error_code: 'req-1',
            });
        },
        async () => undefined,
    );
    await assert.rejects(client.listOrganizations(), (error: unknown) => {
        assert.ok(error instanceof PlatformError);
        assert.match(error.message, /Terms of Use/);
        assert.equal(error.type, 'TERMS_OF_USE_REQUIRED');
        return true;
    });
});

test('prepare uploads, polls, and submits the cheapest plan', async () => {
    const bodies: unknown[] = [];
    let preparations = 0;
    const client = new OpenQuantumClient(
        endpoints,
        { clientId: 's_test', clientSecret: 'secret' },
        async (url, init) => {
            const href = String(url);
            if (href.endsWith('/token')) {
                return jsonResponse(200, {
                    access_token: 'token-1',
                    expires_in: 300,
                });
            }
            if (init?.body && typeof init.body === 'string') {
                bodies.push(JSON.parse(init.body) as unknown);
            }
            if (href.endsWith('/v1/jobs/upload')) {
                return jsonResponse(200, {
                    id: 'upload-1',
                    url: 'https://uploads.example/circuit',
                });
            }
            if (href === 'https://uploads.example/circuit') {
                assert.equal(init?.method, 'PUT');
                return new Response(null, { status: 200 });
            }
            if (href.endsWith('/v1/jobs/prepare') && init?.method === 'POST') {
                return jsonResponse(200, { id: 'prep-1' });
            }
            if (href.endsWith('/v1/jobs/prepare/prep-1')) {
                preparations += 1;
                if (preparations === 1) {
                    return jsonResponse(404, {
                        status_code: 404,
                        message: ['missing'],
                        type: 'NOT_FOUND',
                    });
                }
                return jsonResponse(200, {
                    status: 'Completed',
                    message: null,
                    backend_class_id: 'ionq:forte-1',
                    quote: [
                        {
                            name: 'Public',
                            price: 2,
                            description: '',
                            execution_plan_id: PUBLIC_PLAN_ID,
                            queue_priorities: [
                                {
                                    name: 'Standard',
                                    description: '',
                                    price_increase: 0,
                                    queue_priority_id: 'std',
                                },
                            ],
                        },
                    ],
                });
            }
            if (href.endsWith('/v1/jobs') && init?.method === 'POST') {
                return jsonResponse(200, { id: 'job-1', status: 'Queued' });
            }
            if (href.endsWith('/v1/jobs/job-1')) {
                return jsonResponse(200, {
                    id: 'job-1',
                    name: 'bell.qasm',
                    status: 'Completed',
                    message: 'done',
                    output_data_url: 'https://results.example/out.json',
                    completed_at: '2026-01-02T04:00:00.000Z',
                    credits_used: 2,
                    provider_name: 'IonQ',
                    backend_name: 'Forte',
                    backend_class_id: 'ionq:forte-1',
                    execution_plan_name: 'Full',
                    job_preparation_id: 'prep-1',
                });
            }
            if (href === 'https://results.example/out.json') {
                return jsonResponse(200, { counts: { '00': 40, '11': 60 } });
            }
            throw new Error(`unexpected ${init?.method ?? 'GET'} ${href}`);
        },
        async () => undefined,
    );

    const uploadId = await client.uploadInput(Buffer.from('OPENQASM 3.0;\n'));
    assert.equal(uploadId, 'upload-1');
    const preparationId = await client.prepare({
        organizationId: 'org-1',
        backendClassId: 'ionq:forte-1',
        name: 'bell.qasm',
        uploadId,
        subcategoryId: 'oth:oth',
        configuration: { shots: 100 },
    });
    const preparation = await client.waitForPreparation(preparationId, {
        timeoutMs: 10_000,
        intervalMs: 0,
    });
    const chosen = chooseCheapest(preparation.quote);
    const job = await client.createJob(
        preparationId,
        chosen.planId,
        chosen.priorityId,
    );
    const finished = await client.waitForJob(job.id, {
        timeoutMs: 10_000,
        intervalMs: 0,
    });
    const output = await client.downloadJson(finished.outputDataUrl as string);
    assert.equal(preparations, 2);
    assert.deepEqual(bodies[0], {
        organization_id: 'org-1',
        backend_class_id: 'ionq:forte-1',
        name: 'bell.qasm',
        upload_endpoint_id: 'upload-1',
        job_subcategory_id: 'oth:oth',
        configuration_data: { shots: 100 },
        submitted_with: 'vscode',
        input_format: 'qasm',
        shots: 100,
    });
    assert.deepEqual(bodies[1], {
        job_preparation_id: 'prep-1',
        execution_plan_id: PUBLIC_PLAN_ID,
        queue_priority_id: 'std',
    });
    assert.equal(preparation.backendClassId, 'ionq:forte-1');
    assert.equal(job.status, 'Queued');
    assert.equal(job.name, null);
    assert.equal(job.completedAt, null);
    assert.equal(job.creditsUsed, null);
    assert.equal(job.preparationId, null);
    assert.equal(finished.status, 'Completed');
    assert.equal(finished.name, 'bell.qasm');
    assert.equal(finished.message, 'done');
    assert.equal(finished.completedAt, '2026-01-02T04:00:00.000Z');
    assert.equal(finished.creditsUsed, 2);
    assert.equal(finished.providerName, 'IonQ');
    assert.equal(finished.backendName, 'Forte');
    assert.equal(finished.backendClassId, 'ionq:forte-1');
    assert.equal(finished.executionPlanName, 'Full');
    assert.equal(finished.preparationId, 'prep-1');
    assert.deepEqual(output, { counts: { '00': 40, '11': 60 } });
});
