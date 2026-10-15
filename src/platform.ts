// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

/** Public execution plan id from openquantum_sdk.enums.ExecutionPlanType.PUBLIC. */
export const PUBLIC_PLAN_ID = '072f7eb6-574b-4bae-aafa-d3399c4abe7a';

const TOKEN_LEEWAY_MS = 30_000;
const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

export interface PlatformEndpoints {
    keycloakBase: string;
    realm: string;
    managementBase: string;
    schedulerBase: string;
}

export interface PlatformCredentials {
    clientId: string;
    clientSecret: string;
}

export interface ProviderInfo {
    id: string;
    name: string;
    description: string;
    shortCode: string | null;
}

export interface BackendClassInfo {
    id: string;
    name: string;
    description: string;
    type: string;
    providerId: string;
    shortCode: string | null;
    queueDepth: number | null;
    acceptingJobs: boolean | null;
    sparkAvailable: boolean;
    status: string | null;
}

export interface OrganizationInfo {
    id: string;
    name: string;
}

export interface CreditBalance {
    sparkCredits: number;
    fullCredits: number;
}

export interface CategoryInfo {
    id: string;
    name: string;
    shortCode: string | null;
}

export interface SubcategoryInfo {
    id: string;
    name: string;
    shortCode: string | null;
    categoryId: string;
    categoryName: string;
    categoryShortCode: string | null;
}

export type BackendLight = 'green' | 'yellow' | 'red';

/** Online is green, maintenance and reserved are yellow, offline is red. */
export function backendLight(
    status: string | null,
    acceptingJobs: boolean | null,
): BackendLight {
    const normalized = (status ?? '').trim().toLowerCase();
    if (normalized === 'online' && acceptingJobs !== false) {
        return 'green';
    }
    if (
        normalized === 'maintenance' ||
        normalized === 'reserved' ||
        normalized === 'online' ||
        normalized.length === 0
    ) {
        return 'yellow';
    }
    return 'red';
}

export interface QueuePriorityInfo {
    name: string;
    description: string;
    priceIncrease: number;
    queuePriorityId: string;
}

export interface QuotePlan {
    name: string;
    price: number;
    description: string;
    executionPlanId: string;
    queuePriorities: QueuePriorityInfo[];
}

export interface ChosenQuote {
    planId: string;
    planName: string;
    planPrice: number;
    priorityId: string;
    priorityName: string;
    priceIncrease: number;
    credits: number;
    citation: boolean;
}

export interface PreparationResult {
    id: string;
    status: string;
    message: string | null;
    quote: QuotePlan[];
    backendClassId: string | null;
}

export interface JobRecord {
    id: string;
    status: string;
    message: string | null;
    outputDataUrl: string | null;
    calibrationDataUrl: string | null;
    submittedAt: string | null;
    completedAt: string | null;
    name: string | null;
    creditsUsed: number | null;
    providerName: string | null;
    backendName: string | null;
    backendClassId: string | null;
    executionPlanName: string | null;
    preparationId: string | null;
}

export interface JobSummary {
    id: string;
    name: string;
    status: string;
    message: string | null;
    providerName: string;
    backendName: string;
    backendClassId: string | null;
    submittedAt: string | null;
    completedAt: string | null;
    creditsUsed: number | null;
    executionPlanName: string | null;
}

export interface JobPage {
    jobs: JobSummary[];
    nextCursor: string | null;
}

export interface PrepareInput {
    organizationId: string;
    backendClassId: string;
    name: string;
    uploadId: string;
    subcategoryId: string;
    configuration: Record<string, unknown>;
}

export class PlatformError extends Error {
    constructor(
        message: string,
        readonly statusCode?: number,
        readonly type?: string,
        readonly errorCode?: string,
    ) {
        super(message);
        this.name = 'PlatformError';
    }
}

export function isNotFound(error: unknown): boolean {
    return (
        error instanceof PlatformError &&
        (error.type === 'NOT_FOUND' ||
            (error.type == null && error.statusCode === 404))
    );
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

interface PollOptions {
    timeoutMs: number;
    intervalMs: number;
    signal?: AbortSignal;
    onStatus?: (status: string) => void;
}

export function chooseCheapest(quote: QuotePlan[]): ChosenQuote {
    let best: ChosenQuote | undefined;
    for (const plan of quote) {
        for (const priority of plan.queuePriorities) {
            const credits = plan.price + priority.priceIncrease;
            const candidate: ChosenQuote = {
                planId: plan.executionPlanId,
                planName: plan.name,
                planPrice: plan.price,
                priorityId: priority.queuePriorityId,
                priorityName: priority.name,
                priceIncrease: priority.priceIncrease,
                credits,
                citation: plan.executionPlanId === PUBLIC_PLAN_ID,
            };
            if (
                !best ||
                credits < best.credits ||
                (credits === best.credits && plan.price < best.planPrice)
            ) {
                best = candidate;
            }
        }
    }
    if (!best) {
        throw new PlatformError('The quote did not include an execution plan.');
    }
    return best;
}

/** Use the chosen plan and queue when they are on the quote, otherwise the cheapest. */
export function selectQuote(
    quote: QuotePlan[],
    planId: string | null,
    priorityId: string | null,
): ChosenQuote {
    const fallback = chooseCheapest(quote);
    const plan = planId
        ? quote.find((item) => item.executionPlanId === planId)
        : undefined;
    if (!plan) {
        return fallback;
    }
    const priority =
        (priorityId
            ? plan.queuePriorities.find(
                  (item) => item.queuePriorityId === priorityId,
              )
            : undefined) ??
        plan.queuePriorities.reduce<QueuePriorityInfo | undefined>(
            (best, item) =>
                !best || item.priceIncrease < best.priceIncrease ? item : best,
            undefined,
        );
    if (!priority) {
        throw new PlatformError('The quote did not include a queue.');
    }
    return {
        planId: plan.executionPlanId,
        planName: plan.name,
        planPrice: plan.price,
        priorityId: priority.queuePriorityId,
        priorityName: priority.name,
        priceIncrease: priority.priceIncrease,
        credits: plan.price + priority.priceIncrease,
        citation: plan.executionPlanId === PUBLIC_PLAN_ID,
    };
}

/** Body for POST /v1/jobs/prepare. Integer shots are also written on the payload, matching the SDK. */
export function preparationPayload(
    input: PrepareInput,
): Record<string, unknown> {
    const configuration: Record<string, unknown> = {
        ...input.configuration,
    };
    const payload: Record<string, unknown> = {
        organization_id: input.organizationId,
        backend_class_id: input.backendClassId,
        name: input.name,
        upload_endpoint_id: input.uploadId,
        job_subcategory_id: input.subcategoryId,
        configuration_data: configuration,
        submitted_with: 'vscode',
        input_format: 'qasm',
    };
    const shots = configuration.shots;
    if (typeof shots === 'number' && Number.isInteger(shots)) {
        payload.shots = shots;
    }
    return payload;
}

export class OpenQuantumClient {
    private token: { value: string; expiresAt: number } | undefined;
    /** One Keycloak fetch shared by every caller that needs a new token. */
    private tokenRefresh: Promise<string> | undefined;

    constructor(
        private readonly endpoints: PlatformEndpoints,
        private readonly credentials: PlatformCredentials,
        private readonly fetchImpl: FetchLike = fetch,
        private readonly sleep: Sleep = delay,
    ) {}

    async listOrganizations(): Promise<OrganizationInfo[]> {
        return this.listPages(
            this.endpoints.managementBase,
            '/v1/users/organizations',
            'organizations',
            (row) => ({
                id: String(row.id),
                name: String(row.name ?? ''),
            }),
        );
    }

    async listProviders(
        organizationId?: string | null,
    ): Promise<ProviderInfo[]> {
        return this.listPages(
            this.endpoints.managementBase,
            '/v1/backends/providers',
            'providers',
            (row) => ({
                id: String(row.id),
                name: String(row.name ?? ''),
                description: String(row.description ?? ''),
                shortCode: optionalString(row.short_code),
            }),
            undefined,
            orgHeaders(organizationId),
        );
    }

    async listBackendClasses(
        organizationId?: string | null,
    ): Promise<BackendClassInfo[]> {
        return this.listPages(
            this.endpoints.managementBase,
            '/v1/backends/classes',
            'backend_classes',
            (row) => ({
                id: String(row.id),
                name: String(row.name ?? ''),
                description: String(row.description ?? ''),
                type: String(row.type ?? ''),
                providerId: String(row.provider_id ?? ''),
                shortCode: optionalString(row.short_code),
                queueDepth: optionalNumber(row.queue_depth),
                acceptingJobs:
                    typeof row.accepting_jobs === 'boolean'
                        ? row.accepting_jobs
                        : null,
                sparkAvailable: row.spark_available === true,
                status: optionalString(row.status),
            }),
            undefined,
            orgHeaders(organizationId),
        );
    }

    async listJobs(
        organizationId: string,
        cursor?: string,
        limit = 25,
    ): Promise<JobPage> {
        const data = await this.request(
            'GET',
            this.endpoints.schedulerBase,
            `/v1/organizations/${encodeURIComponent(organizationId)}/jobs`,
            { limit, cursor },
            undefined,
            true,
            orgHeaders(organizationId),
        );
        const rows = Array.isArray(data.jobs)
            ? (data.jobs as JsonRecord[])
            : [];
        const next =
            data.pagination && typeof data.pagination === 'object'
                ? (data.pagination as JsonRecord).next_cursor
                : undefined;
        return {
            jobs: rows.map(mapJobSummary),
            nextCursor:
                typeof next === 'string' && next.length > 0 ? next : null,
        };
    }

    async getBalance(organizationId: string): Promise<CreditBalance> {
        const data = await this.request(
            'GET',
            this.endpoints.managementBase,
            `/v1/organizations/${encodeURIComponent(organizationId)}/transactions/balance`,
        );
        return {
            sparkCredits: numberOrZero(data.spark_credits),
            fullCredits: numberOrZero(data.full_credits),
        };
    }

    async listJobTaxonomy(): Promise<{
        categories: CategoryInfo[];
        subcategories: SubcategoryInfo[];
    }> {
        const categories = await this.listPages(
            this.endpoints.schedulerBase,
            '/v1/jobs/categories',
            'categories',
            (row) => ({
                id: String(row.id),
                name: String(row.name ?? ''),
                shortCode: optionalString(row.short_code),
            }),
        );
        const subcategories: SubcategoryInfo[] = [];
        for (const category of categories) {
            const categoryKey = category.shortCode || category.id;
            const children = await this.listPages(
                this.endpoints.schedulerBase,
                `/v1/jobs/categories/${encodeURIComponent(categoryKey)}/subcategories`,
                'categories',
                (row) => ({
                    id: String(row.id),
                    name: String(row.name ?? ''),
                    shortCode: optionalString(row.short_code),
                    categoryId: category.id,
                    categoryName: category.name,
                    categoryShortCode: category.shortCode,
                }),
            );
            subcategories.push(...children);
        }
        return { categories, subcategories };
    }

    async uploadInput(bytes: Uint8Array): Promise<string> {
        const created = await this.request(
            'POST',
            this.endpoints.schedulerBase,
            '/v1/jobs/upload',
        );
        const id = optionalString(created.id);
        const url = optionalString(created.url);
        if (!id || !url) {
            throw new PlatformError(
                'Upload response was missing an id or url.',
            );
        }
        const put = await this.fetchImpl(url, {
            method: 'PUT',
            body: bytes,
        });
        if (!put.ok) {
            throw new PlatformError(
                `Uploading the circuit failed (${put.status}).`,
                put.status,
            );
        }
        return id;
    }

    async getBackendClass(
        backendId: string,
        organizationId?: string | null,
    ): Promise<Record<string, unknown>> {
        return this.request(
            'GET',
            this.endpoints.schedulerBase,
            `/v1/backends/classes/${encodeURIComponent(backendId)}`,
            undefined,
            undefined,
            true,
            organizationId
                ? { 'x-organization-id': organizationId }
                : undefined,
        );
    }

    async prepare(input: PrepareInput): Promise<string> {
        const data = await this.request(
            'POST',
            this.endpoints.schedulerBase,
            '/v1/jobs/prepare',
            undefined,
            preparationPayload(input),
        );
        const id = optionalString(data.id);
        if (!id) {
            throw new PlatformError('Prepare response was missing an id.');
        }
        return id;
    }

    async getPreparation(preparationId: string): Promise<PreparationResult> {
        const data = await this.request(
            'GET',
            this.endpoints.schedulerBase,
            `/v1/jobs/prepare/${encodeURIComponent(preparationId)}`,
        );
        return {
            id: preparationId,
            status: String(data.status ?? ''),
            message: optionalString(data.message),
            quote: parseQuote(data.quote),
            backendClassId: optionalString(data.backend_class_id),
        };
    }

    async createJob(
        preparationId: string,
        planId: string,
        priorityId: string,
    ): Promise<JobRecord> {
        const data = await this.request(
            'POST',
            this.endpoints.schedulerBase,
            '/v1/jobs',
            undefined,
            {
                job_preparation_id: preparationId,
                execution_plan_id: planId,
                queue_priority_id: priorityId,
            },
        );
        return mapJob(data);
    }

    async getJob(jobId: string): Promise<JobRecord> {
        const data = await this.request(
            'GET',
            this.endpoints.schedulerBase,
            `/v1/jobs/${encodeURIComponent(jobId)}`,
        );
        return mapJob(data);
    }

    async downloadJson(url: string): Promise<unknown> {
        const response = await this.fetchImpl(url);
        if (!response.ok) {
            throw new PlatformError(
                `Downloading results failed (${response.status}).`,
                response.status,
            );
        }
        return response.json() as Promise<unknown>;
    }

    async waitForPreparation(
        preparationId: string,
        options: PollOptions,
    ): Promise<PreparationResult> {
        return this.poll(
            async () => this.getPreparation(preparationId),
            (result) =>
                result.status === 'Completed' || result.status === 'Failed',
            options,
            true,
        ).then((result) => {
            if (result.status === 'Failed') {
                throw new PlatformError(
                    result.message || 'Job preparation failed.',
                );
            }
            return result;
        });
    }

    async waitForJob(jobId: string, options: PollOptions): Promise<JobRecord> {
        const job = await this.poll(
            async () => this.getJob(jobId),
            (result) =>
                result.status === 'Completed' ||
                result.status === 'Failed' ||
                result.status === 'Canceled' ||
                result.status === 'Cancelled',
            options,
            false,
        );
        if (
            job.status === 'Failed' ||
            job.status === 'Canceled' ||
            job.status === 'Cancelled'
        ) {
            throw new PlatformError(
                job.message || `Job finished with status ${job.status}.`,
            );
        }
        return job;
    }

    private async poll<T extends { status: string }>(
        read: () => Promise<T>,
        done: (value: T) => boolean,
        options: PollOptions,
        retryNotFound: boolean,
    ): Promise<T> {
        const started = Date.now();
        for (;;) {
            throwIfAborted(options.signal);
            try {
                const value = await read();
                options.onStatus?.(value.status);
                if (done(value)) {
                    return value;
                }
            } catch (error) {
                if (!(retryNotFound && isNotFound(error))) {
                    throw error;
                }
                options.onStatus?.('Not found');
            }
            if (Date.now() - started > options.timeoutMs) {
                throw new PlatformError('Timed out waiting for Open Quantum.');
            }
            await this.sleep(options.intervalMs, options.signal);
        }
    }

    private async listPages<T>(
        base: string,
        path: string,
        key: string,
        mapRow: (row: JsonRecord) => T,
        extra?: Record<string, string>,
        headers?: Record<string, string>,
    ): Promise<T[]> {
        const items: T[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < MAX_PAGES; page += 1) {
            const data = await this.request(
                'GET',
                base,
                path,
                {
                    limit: PAGE_LIMIT,
                    cursor,
                    ...extra,
                },
                undefined,
                true,
                headers,
            );
            const rows = Array.isArray(data[key])
                ? (data[key] as JsonRecord[])
                : [];
            for (const row of rows) {
                items.push(mapRow(row));
            }
            const next =
                data.pagination && typeof data.pagination === 'object'
                    ? (data.pagination as JsonRecord).next_cursor
                    : undefined;
            if (typeof next !== 'string' || next.length === 0) {
                break;
            }
            cursor = next;
        }
        return items;
    }

    private async request(
        method: string,
        base: string,
        path: string,
        params?: Record<string, string | number | undefined>,
        jsonBody?: Record<string, unknown>,
        allowRetry = true,
        extraHeaders?: Record<string, string>,
    ): Promise<JsonRecord> {
        const headers = await this.authorizedHeaders();
        const sent = bearerValue(headers.Authorization);
        if (extraHeaders) {
            Object.assign(headers, extraHeaders);
        }
        if (jsonBody) {
            headers['Content-Type'] = 'application/json';
        }
        const response = await this.fetchImpl(joinUrl(base, path, params), {
            method,
            headers,
            body: jsonBody ? JSON.stringify(jsonBody) : undefined,
        });
        if (response.status === 401 && allowRetry && sent) {
            await this.replaceRejectedToken(sent);
            return this.request(
                method,
                base,
                path,
                params,
                jsonBody,
                false,
                extraHeaders,
            );
        }
        if (response.status === 204) {
            return {};
        }
        const payload = await readBody(response);
        if (response.status >= 400) {
            throw errorFromResponse(response.status, payload);
        }
        return payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as JsonRecord)
            : {};
    }

    private async authorizedHeaders(): Promise<Record<string, string>> {
        const token = await this.accessToken();
        return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    }

    private accessToken(): Promise<string> {
        const fresh = this.freshToken();
        if (fresh) {
            return Promise.resolve(fresh);
        }
        return this.refreshToken();
    }

    /**
     * The API rejected this exact token. Wait for a refresh already in
     * flight, or use a newer cached token. Fetch again only when the
     * rejected token is still the one we would send.
     */
    private async replaceRejectedToken(rejected: string): Promise<string> {
        if (this.tokenRefresh) {
            const fresh = await this.tokenRefresh;
            if (fresh !== rejected) {
                return fresh;
            }
        }
        const current = this.freshToken();
        if (current && current !== rejected) {
            return current;
        }
        this.token = undefined;
        return this.refreshToken();
    }

    private freshToken(): string | undefined {
        if (!this.token) {
            return undefined;
        }
        if (Date.now() + TOKEN_LEEWAY_MS < this.token.expiresAt) {
            return this.token.value;
        }
        return undefined;
    }

    private refreshToken(): Promise<string> {
        if (!this.tokenRefresh) {
            const pending = this.fetchToken().finally(() => {
                if (this.tokenRefresh === pending) {
                    this.tokenRefresh = undefined;
                }
            });
            this.tokenRefresh = pending;
        }
        return this.tokenRefresh;
    }

    private async fetchToken(): Promise<string> {
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.credentials.clientId,
            client_secret: this.credentials.clientSecret,
        });
        const response = await this.fetchImpl(this.tokenEndpoint(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const payload = await readBody(response);
        const accessToken =
            payload && typeof payload === 'object'
                ? (payload as JsonRecord).access_token
                : undefined;
        if (
            !response.ok ||
            typeof accessToken !== 'string' ||
            accessToken.length === 0
        ) {
            throw new PlatformError(
                'Keycloak rejected the SDK key. Check the client id and secret.',
                response.status,
            );
        }
        const expiresIn =
            payload &&
            typeof payload === 'object' &&
            typeof (payload as JsonRecord).expires_in === 'number'
                ? ((payload as JsonRecord).expires_in as number)
                : 300;
        this.token = {
            value: accessToken,
            expiresAt: Date.now() + expiresIn * 1000,
        };
        return accessToken;
    }

    private tokenEndpoint(): string {
        const base = this.endpoints.keycloakBase.replace(/\/+$/, '');
        return `${base}/realms/${encodeURIComponent(this.endpoints.realm)}/protocol/openid-connect/token`;
    }
}

type JsonRecord = Record<string, unknown>;

function bearerValue(header: string | undefined): string | null {
    if (!header?.startsWith('Bearer ')) {
        return null;
    }
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
}

function orgHeaders(
    organizationId?: string | null,
): Record<string, string> | undefined {
    if (!organizationId) {
        return undefined;
    }
    return { 'X-Organization-ID': organizationId };
}

function mapJobSummary(data: JsonRecord): JobSummary {
    return {
        id: String(data.id ?? ''),
        name: optionalString(data.name) ?? 'Job',
        status: String(data.status ?? ''),
        message: optionalString(data.message),
        providerName: optionalString(data.provider_name) ?? '',
        backendName: optionalString(data.backend_name) ?? '',
        backendClassId: optionalString(data.backend_class_id),
        submittedAt:
            typeof data.submitted_at === 'string' ? data.submitted_at : null,
        completedAt: optionalString(data.completed_at),
        creditsUsed: optionalNumber(data.credits_used),
        executionPlanName: optionalString(data.execution_plan_name),
    };
}

function mapJob(data: JsonRecord): JobRecord {
    return {
        id: String(data.id ?? ''),
        status: String(data.status ?? ''),
        message: optionalString(data.message),
        outputDataUrl: optionalString(data.output_data_url),
        calibrationDataUrl: optionalString(data.calibration_data_url),
        submittedAt: optionalString(data.submitted_at),
        completedAt: optionalString(data.completed_at),
        name: optionalString(data.name),
        creditsUsed: optionalNumber(data.credits_used),
        providerName: optionalString(data.provider_name),
        backendName: optionalString(data.backend_name),
        backendClassId: optionalString(data.backend_class_id),
        executionPlanName: optionalString(data.execution_plan_name),
        preparationId: optionalString(data.job_preparation_id),
    };
}

function parseQuote(value: unknown): QuotePlan[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const plans: QuotePlan[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') {
            continue;
        }
        const row = item as JsonRecord;
        const priorities: QueuePriorityInfo[] = [];
        if (Array.isArray(row.queue_priorities)) {
            for (const priority of row.queue_priorities) {
                if (!priority || typeof priority !== 'object') {
                    continue;
                }
                const entry = priority as JsonRecord;
                priorities.push({
                    name: String(entry.name ?? 'Unknown'),
                    description: String(entry.description ?? ''),
                    priceIncrease: numberOrZero(entry.price_increase),
                    queuePriorityId: String(entry.queue_priority_id ?? ''),
                });
            }
        }
        plans.push({
            name: String(row.name ?? 'Unknown Plan'),
            price: numberOrZero(row.price),
            description: String(row.description ?? ''),
            executionPlanId: String(row.execution_plan_id ?? ''),
            queuePriorities: priorities,
        });
    }
    return plans;
}

function errorFromResponse(status: number, payload: unknown): PlatformError {
    const record =
        payload && typeof payload === 'object'
            ? (payload as JsonRecord)
            : undefined;
    const type = typeof record?.type === 'string' ? record.type : undefined;
    const errorCode =
        typeof record?.error_code === 'string' ? record.error_code : undefined;
    if (type === 'TERMS_OF_USE_REQUIRED') {
        return new PlatformError(
            'Please visit https://www.openquantum.com to accept the Terms of Use before submitting jobs.',
            status,
            type,
            errorCode,
        );
    }
    if (type === 'EMAIL_VERIFICATION_REQUIRED') {
        return new PlatformError(
            'Please verify your email address at https://www.openquantum.com before submitting jobs.',
            status,
            type,
            errorCode,
        );
    }
    const messageValue = record?.message;
    const message = Array.isArray(messageValue)
        ? messageValue.map((entry) => String(entry)).join('; ')
        : typeof messageValue === 'string'
          ? messageValue
          : `Request failed (${status}).`;
    const typePart = type ? ` [${type}]` : '';
    const requestPart = errorCode ? ` (Request ID: ${errorCode})` : '';
    return new PlatformError(
        `API Error ${status}${typePart}: ${message}${requestPart}`,
        status,
        type,
        errorCode,
    );
}

async function readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return null;
    }
}

function joinUrl(
    base: string,
    path: string,
    params?: Record<string, string | number | undefined>,
): string {
    const url = new URL(
        path.replace(/^\//, ''),
        base.endsWith('/') ? base : `${base}/`,
    );
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== '') {
                url.searchParams.set(key, String(value));
            }
        }
    }
    return url.toString();
}

function optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrZero(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function optionalNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new PlatformError('Cancelled.');
    }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new PlatformError('Cancelled.'));
        };
        if (signal) {
            signal.addEventListener('abort', onAbort, { once: true });
        }
    });
}
