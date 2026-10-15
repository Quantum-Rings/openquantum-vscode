// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import * as vscode from 'vscode';
import {
    resolveCredentials,
    parseSdkKey,
    type ResolvedCredentials,
} from './credentials';
import { isQasmLanguage } from './debugConfig';
import { syncCircuitDiagnostics } from './language';
import {
    applyConfigInput,
    asSchema,
    checkConfiguration,
    configFields,
    mergeConfig,
    type ConfigData,
    type JsonSchema,
} from './jobConfig';
import {
    backendLight,
    OpenQuantumClient,
    PlatformError,
    selectQuote,
    type BackendClassInfo,
    type CategoryInfo,
    type ChosenQuote,
    type JobRecord,
    type JobSummary,
    type OrganizationInfo,
    type PlatformEndpoints,
    type ProviderInfo,
    type QuotePlan,
    type SubcategoryInfo,
} from './platform';
import { BackendDetailsPanel } from './backendPanel';
import { parseBackendDetails } from './backendDetails';
import { countsFromOutput, countsToBars } from './jobExplorer';
import { JobResultPanel } from './jobPanel';
import type { JobResultModel, ResultsKind } from './jobResult';
import {
    appendJobPage,
    emptyJobList,
    isTerminalJobStatus,
    refreshJobPage,
    withPinned,
    type JobListSnapshot,
} from './jobList';
import {
    DEFAULT_ENDPOINTS,
    EndpointSettingsError,
    endpointsFromJson,
} from './endpoints';
import { isCompanySite } from './links';
import {
    canGoBack,
    goBackInPanel,
    goHome,
    initialHistory,
    isPanelPage,
    openPage,
    type PageHistory,
    type PanelPage,
} from './navigation';
import { formatJobOutput, type CountBar } from './results';
import { locatedProblem, problemSpan, type LocatedProblem } from './runReport';
import { webviewHtml, type PanelState, type ViewJob } from './webviewHtml';

const SECRET_KEY = 'openquantum.sdkCredentials';
const PREPARE_TIMEOUT_MS = 5 * 60 * 1000;
const PREPARE_INTERVAL_MS = 2000;
const JOB_INTERVAL_MS = 5000;
const JOBS_REFRESH_MS = 30_000;
const RAW_LIMIT = 100_000;
const LIVE_INTERVAL_MS = 20_000;
const DEFAULT_SUBCATEGORY = 'oth:oth';

const NEW_CIRCUIT = `OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
bit[2] c;
h q[0];
cx q[0], q[1];
c[0] = measure q[0];
c[1] = measure q[1];
`;

export class OpenQuantumViewProvider implements vscode.WebviewViewProvider {
    static readonly viewId = 'openquantum.run';

    private view: vscode.WebviewView | undefined;
    private clientCache: { key: string; client: OpenQuantumClient } | undefined;
    private organizations: OrganizationInfo[] = [];
    private providers: ProviderInfo[] = [];
    private backends: BackendClassInfo[] = [];
    private categories: CategoryInfo[] = [];
    private subcategories: SubcategoryInfo[] = [];
    private balance: { sparkCredits: number; fullCredits: number } | null =
        null;
    private credentials: ResolvedCredentials | null = null;
    private phase: PanelState['phase'] = 'idle';
    private step: PanelState['step'] = 'setup';
    private status = '';
    private error: string | null = null;
    private quotePlans: QuotePlan[] = [];
    private preparationId: string | undefined;
    private preparedHash: string | undefined;
    private runController: AbortController | undefined;
    private configSchema: JsonSchema | null = null;
    private configBackendId: string | null = null;
    private configLoad = 0;
    private readonly output: vscode.OutputChannel;
    private readonly runDiagnostics: vscode.DiagnosticCollection;
    private readonly details = new BackendDetailsPanel((backendId) => {
        void this.submitFromDetails(backendId);
    });
    private readonly jobResults = new JobResultPanel({
        onClose: () => {
            this.stopJobWatch();
        },
        onShowJobs: () => {
            this.showPage('jobs');
            void vscode.commands.executeCommand(
                `${OpenQuantumViewProvider.viewId}.focus`,
            );
        },
        onOpenBackend: (backendId) => {
            void this.openBackend(backendId);
        },
        onDownloadResults: (jobId) => {
            void this.downloadOpenJob(jobId);
        },
        onSaveText: (filename, content) => {
            void this.saveExplorerFile(filename, content);
        },
    });
    private history: PageHistory = initialHistory();
    private jobName = '';
    private jobNameEdited = false;
    private jobList: JobListSnapshot = emptyJobList();
    private pinnedJob: JobSummary | null = null;
    private jobsOrganizationId: string | null = null;
    private jobsLoading = false;
    private jobsError: string | null = null;
    private selectedJobId: string | null = null;
    private jobsRequest = 0;
    private jobsTimer: ReturnType<typeof setInterval> | undefined;
    private jobWatchTimer: ReturnType<typeof setInterval> | undefined;
    private jobWatchTicket = 0;
    private jobWatchBusy = false;
    private readonly loggedResults = new Set<string>();
    private readonly outputCache = new Map<string, CachedJobOutput>();
    private catalogBusy = false;
    private refreshChain: Promise<void> = Promise.resolve();
    private liveQueued = false;
    private liveTimer: ReturnType<typeof setInterval> | undefined;
    /** True only after this attempt has opened the run log. */
    private runLogged = false;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.output = vscode.window.createOutputChannel('Open Quantum');
        this.runDiagnostics =
            vscode.languages.createDiagnosticCollection('Open Quantum');
        this.jobName =
            context.workspaceState.get<string>('openquantum.jobName') ?? '';
        this.jobNameEdited =
            context.workspaceState.get<boolean>('openquantum.jobNameEdited') ===
            true;
        context.subscriptions.push(
            this.output,
            this.runDiagnostics,
            this.details,
            this.jobResults,
            {
                dispose: () => {
                    this.stopLive();
                    this.stopJobsRefresh();
                    this.stopJobWatch();
                },
            },
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.runDiagnostics.delete(event.document.uri);
            }),
            vscode.window.onDidChangeActiveTextEditor(() => {
                if (this.syncJobName()) {
                    this.post();
                }
            }),
        );
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [media],
        };
        const nonce = createHash('sha256')
            .update(String(Date.now()))
            .digest('hex')
            .slice(0, 16);
        const logo = (name: string) =>
            webviewView.webview
                .asWebviewUri(vscode.Uri.joinPath(media, name))
                .toString();
        webviewView.webview.html = webviewHtml(
            nonce,
            webviewView.webview.cspSource,
            {
                onLight: logo('logo-on-light.png'),
                onDark: logo('logo-on-dark.png'),
            },
        );
        webviewView.webview.onDidReceiveMessage(
            (message: { command?: string; [key: string]: unknown }) => {
                void this.onMessage(message).catch((err: unknown) =>
                    this.fail(err),
                );
            },
        );
        webviewView.onDidChangeVisibility(() => {
            if (!webviewView.visible) {
                this.stopLive();
                this.syncJobsTimer();
                return;
            }
            this.startLive();
            this.syncJobsTimer();
            this.post();
            void this.refreshLive();
        });
        webviewView.onDidDispose(() => {
            this.stopLive();
            this.syncJobsTimer();
        });
        this.startLive();
        void this.refreshCredentials().then(() => this.post());
    }

    async setSdkKey(): Promise<void> {
        const picked = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: { 'SDK key': ['json'] },
            title: 'Open Quantum SDK key',
        });
        const file = picked?.[0];
        if (!file) {
            return;
        }
        try {
            const parsed = parseSdkKey(readFileSync(file.fsPath, 'utf8'));
            await this.context.secrets.store(
                SECRET_KEY,
                JSON.stringify({
                    client_id: parsed.clientId,
                    client_secret: parsed.clientSecret,
                }),
            );
            this.clientCache = undefined;
            await this.refresh();
            if (this.credentials) {
                this.history = goHome(this.history);
                this.post();
            }
        } catch (err) {
            this.fail(err);
        }
    }

    async clearSdkKey(): Promise<void> {
        const running = this.phase === 'working';
        this.stopRun();
        if (running) {
            this.output.appendLine('Cancelled.');
        }
        this.clearQuote();
        this.error = null;
        this.status = '';
        this.phase = 'idle';
        this.step = 'setup';
        this.history = goHome(this.history);
        this.clearJobs();
        this.jobsOrganizationId = null;
        this.syncJobsTimer();
        await this.context.secrets.delete(SECRET_KEY);
        this.clientCache = undefined;
        await this.refresh();
    }

    async refresh(): Promise<void> {
        const run = this.refreshChain.then(() => this.performRefresh());
        this.refreshChain = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    }

    private async performRefresh(): Promise<void> {
        this.catalogBusy = true;
        this.error = null;
        try {
            await this.refreshCredentials();
            if (!this.credentials) {
                this.organizations = [];
                this.providers = [];
                this.backends = [];
                this.categories = [];
                this.subcategories = [];
                this.balance = null;
                this.clearJobs();
                this.jobsOrganizationId = null;
                this.syncJobsTimer();
                this.status = '';
                this.phase = 'idle';
                this.step = 'setup';
                this.post();
                return;
            }
            this.status = 'Loading…';
            this.post();
            const client = await this.client();
            const organizations = await client.listOrganizations();
            this.organizations = organizations;
            if (
                organizations.length > 0 &&
                !organizations.some((org) => org.id === this.organizationId())
            ) {
                await this.context.workspaceState.update(
                    'openquantum.organizationId',
                    organizations[0].id,
                );
            }
            const organizationId = this.organizationId();
            const [providers, backends, taxonomy, balance] = await Promise.all([
                client.listProviders(organizationId),
                client.listBackendClasses(organizationId),
                client.listJobTaxonomy(),
                organizationId
                    ? client.getBalance(organizationId)
                    : Promise.resolve(null),
            ]);
            this.providers = providers;
            this.backends = backends;
            this.categories = taxonomy.categories;
            this.subcategories = taxonomy.subcategories;
            this.balance = balance;
            this.status = '';
            this.phase = this.phase === 'working' ? 'working' : 'idle';
            const backendId = this.backendId();
            if (backendId) {
                await this.loadConfiguration(backendId);
            }
            if (
                this.jobsOrganizationId &&
                organizationId &&
                this.jobsOrganizationId !== organizationId
            ) {
                this.clearJobs();
            }
            if (organizationId) {
                this.jobsOrganizationId = organizationId;
            }
            if (this.history.page === 'jobs' && organizationId) {
                await this.loadJobs('refresh');
            }
        } catch (err) {
            this.fail(err);
            return;
        } finally {
            this.catalogBusy = false;
        }
        this.post();
    }

    /** Status and queue for the signed-in organization, including private backends. */
    private refreshLive(): void {
        if (
            this.liveQueued ||
            this.catalogBusy ||
            !this.credentials ||
            !this.view?.visible
        ) {
            return;
        }
        this.liveQueued = true;
        const run = this.refreshChain.then(() => this.pollCatalog());
        this.refreshChain = run.then(
            () => undefined,
            () => undefined,
        );
    }

    private async pollCatalog(): Promise<void> {
        this.liveQueued = false;
        if (this.catalogBusy || !this.credentials || !this.view?.visible) {
            return;
        }
        this.catalogBusy = true;
        try {
            const client = await this.client();
            const organizationId = this.organizationId();
            const [providers, backends, balance] = await Promise.all([
                client.listProviders(organizationId),
                client.listBackendClasses(organizationId),
                organizationId
                    ? client.getBalance(organizationId)
                    : Promise.resolve(null),
            ]);
            this.providers = providers;
            this.backends = backends;
            if (balance) {
                this.balance = balance;
            }
            this.post();
        } catch {
            // A failed poll keeps the last status and queue.
        } finally {
            this.catalogBusy = false;
        }
    }

    private startLive(): void {
        this.stopLive();
        this.liveTimer = setInterval(() => {
            void this.refreshLive();
        }, LIVE_INTERVAL_MS);
    }

    private stopLive(): void {
        if (this.liveTimer) {
            clearInterval(this.liveTimer);
            this.liveTimer = undefined;
        }
    }

    /** Open Create job so a backend can be chosen. Does not validate. */
    async runActiveEditor(): Promise<void> {
        this.history = openPage(this.history, 'create');
        if (this.phase !== 'working') {
            this.clearQuote();
            this.step = 'setup';
            this.error = null;
            this.status = '';
        }
        this.post();
        const editor = vscode.window.activeTextEditor;
        await vscode.commands.executeCommand(
            `${OpenQuantumViewProvider.viewId}.focus`,
        );
        if (!editor || !isQasmLanguage(editor.document.languageId)) {
            void vscode.window.showInformationMessage('Open a .qasm file.');
        }
    }

    private async validateActiveEditor(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        this.history = openPage(this.history, 'create');
        this.post();
        await vscode.commands.executeCommand(
            `${OpenQuantumViewProvider.viewId}.focus`,
        );
        if (!editor || !isQasmLanguage(editor.document.languageId)) {
            void vscode.window.showInformationMessage('Open a .qasm file.');
            return;
        }
        await this.prepareDocument(editor.document);
    }

    async newCircuit(): Promise<void> {
        const document = await vscode.workspace.openTextDocument({
            language: 'qasm',
            content: NEW_CIRCUIT,
        });
        await vscode.window.showTextDocument(document);
    }

    private async onMessage(message: {
        command?: string;
        [key: string]: unknown;
    }): Promise<void> {
        switch (message.command) {
            case 'ready':
                await this.refreshCredentials();
                if (this.credentials) {
                    await this.refresh();
                } else {
                    this.post();
                }
                return;
            case 'refresh':
                await this.refresh();
                return;
            case 'refreshJobs':
                await this.loadJobs('refresh');
                return;
            case 'setJobName':
                if (this.phase === 'working') {
                    return;
                }
                this.rememberJobName(String(message.name ?? ''));
                if (this.preparationId) {
                    this.clearQuote();
                }
                this.error = null;
                this.post();
                return;
            case 'navigate': {
                const page = String(message.page ?? '');
                if (isPanelPage(page)) {
                    this.showPage(page);
                }
                return;
            }
            case 'home':
                this.history = goHome(this.history);
                this.error = null;
                this.post();
                return;
            case 'openBackend':
                await this.openBackend(String(message.backendId ?? ''));
                return;
            case 'useBackend':
                if (this.phase !== 'working') {
                    await this.selectBackend(String(message.backendId ?? ''));
                }
                this.showPage('create');
                return;
            case 'openJob':
                await this.openJob(String(message.jobId ?? ''));
                return;
            case 'moreJobs':
                await this.loadJobs('append');
                return;
            case 'setKey':
                await this.setSdkKey();
                return;
            case 'clearKey':
                await this.clearSdkKey();
                return;
            case 'selectOrg':
                await this.context.workspaceState.update(
                    'openquantum.organizationId',
                    String(message.organizationId ?? ''),
                );
                this.balance = null;
                this.clearQuote();
                await this.refresh();
                return;
            case 'selectBackend':
                await this.selectBackend(String(message.backendId ?? ''));
                return;
            case 'selectCategory':
                await this.context.workspaceState.update(
                    'openquantum.category',
                    String(message.category ?? ''),
                );
                await this.context.workspaceState.update(
                    'openquantum.subcategory',
                    '',
                );
                this.post();
                return;
            case 'selectSubcategory':
                await this.context.workspaceState.update(
                    'openquantum.subcategory',
                    String(message.subcategory ?? ''),
                );
                this.post();
                return;
            case 'selectPlan':
                await this.context.workspaceState.update(
                    'openquantum.planId',
                    String(message.planId ?? ''),
                );
                await this.context.workspaceState.update(
                    'openquantum.priorityId',
                    '',
                );
                this.post();
                return;
            case 'selectQueue':
                await this.context.workspaceState.update(
                    'openquantum.priorityId',
                    String(message.priorityId ?? ''),
                );
                this.post();
                return;
            case 'setConfig': {
                const backendId = this.backendId();
                const schema = this.configSchema;
                if (
                    !backendId ||
                    !schema ||
                    this.configBackendId !== backendId
                ) {
                    return;
                }
                const next = applyConfigInput(
                    schema,
                    this.currentConfig(),
                    String(message.key ?? ''),
                    String(message.value ?? ''),
                );
                await this.rememberConfig(backendId, next);
                this.clearQuote();
                this.error = null;
                this.post();
                return;
            }
            case 'prepare':
                await this.validateActiveEditor();
                return;
            case 'submit':
                await this.submit();
                return;
            case 'cancel':
                this.cancelRun();
                return;
            case 'back':
                this.applyBack();
                return;
            case 'openLink': {
                const url = String(message.url ?? '');
                if (isCompanySite(url)) {
                    await vscode.env.openExternal(vscode.Uri.parse(url));
                }
                return;
            }
            default:
                return;
        }
    }

    private async prepareDocument(
        document: vscode.TextDocument,
    ): Promise<void> {
        this.stopRun();
        const controller = new AbortController();
        this.runController = controller;
        const text = document.getText();
        const hash = createHash('sha256').update(text).digest('hex');
        this.quotePlans = [];
        this.preparationId = undefined;
        this.preparedHash = undefined;
        this.error = null;
        this.step = 'setup';
        this.runLogged = false;
        if (this.circuitHasProblems(document)) {
            this.showCircuitProblems();
            return;
        }
        try {
            const client = await this.client();
            if (!this.organizationId() || this.backends.length === 0) {
                await this.refresh();
            }
            if (!this.credentials) {
                return;
            }
            if (!this.organizationId()) {
                if (!this.error) {
                    this.fail(
                        new PlatformError(
                            'No organization was found for this SDK key.',
                        ),
                    );
                }
                return;
            }
            const organizationId = this.requireOrganization();
            const backendClassId = this.requireBackend();
            const subcategoryId = this.subcategory();
            if (this.configBackendId !== backendClassId || !this.configSchema) {
                await this.loadConfiguration(backendClassId);
            }
            if (!this.configSchema || this.configBackendId !== backendClassId) {
                throw new PlatformError(
                    'The backend configuration did not load.',
                );
            }
            const configuration = checkConfiguration(
                this.configSchema,
                this.currentConfig(),
            );
            if (!configuration.ok) {
                this.phase = 'error';
                this.error = configuration.errors.join('\n');
                this.status = '';
                this.post();
                return;
            }
            this.syncJobName();
            const jobName = this.jobName.trim();
            if (!jobName) {
                this.phase = 'error';
                this.error = 'Enter a job name.';
                this.status = '';
                this.post();
                return;
            }
            this.beginRun(document);
            this.phase = 'working';
            this.say('Validating…');
            const uploadId = await client.uploadInput(
                Buffer.from(text, 'utf8'),
            );
            throwIfAborted(controller);
            const preparationId = await client.prepare({
                organizationId,
                backendClassId,
                name: jobName,
                uploadId,
                subcategoryId,
                configuration: configuration.data,
            });
            const preparation = await client.waitForPreparation(preparationId, {
                timeoutMs: PREPARE_TIMEOUT_MS,
                intervalMs: PREPARE_INTERVAL_MS,
                signal: controller.signal,
                onStatus: (status) => {
                    const normalized = (status ?? '').trim();
                    if (
                        !normalized ||
                        normalized.toLowerCase() === 'preparing'
                    ) {
                        this.say('Validating…');
                        return;
                    }
                    this.say(`Validating · ${normalized}`);
                },
            });
            throwIfAborted(controller);
            this.quotePlans = preparation.quote;
            const chosen = selectQuote(preparation.quote, null, null);
            await this.context.workspaceState.update(
                'openquantum.planId',
                chosen.planId,
            );
            await this.context.workspaceState.update(
                'openquantum.priorityId',
                chosen.priorityId,
            );
            this.preparationId = preparationId;
            this.preparedHash = hash;
            this.phase = 'quote';
            this.step = 'quote';
            this.output.appendLine('Quote ready.');
            this.status = '';
            this.runLogged = false;
        } catch (err) {
            if (!controller.signal.aborted) {
                this.fail(err, document);
            }
            return;
        }
        this.post();
    }

    private async submit(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        const current =
            editor && isQasmLanguage(editor.document.languageId)
                ? createHash('sha256')
                      .update(editor.document.getText())
                      .digest('hex')
                : undefined;
        const quote = this.currentQuote();
        if (
            editor &&
            isQasmLanguage(editor.document.languageId) &&
            this.circuitHasProblems(editor.document)
        ) {
            this.clearQuote();
            this.showCircuitProblems();
            return;
        }
        if (
            !this.preparationId ||
            !quote ||
            !this.preparedHash ||
            current !== this.preparedHash
        ) {
            this.clearQuote();
            this.step = 'setup';
            this.phase = 'idle';
            this.status = '';
            this.error = 'The circuit changed. Validate again.';
            this.post();
            return;
        }
        const controller = new AbortController();
        this.runController = controller;
        const preparationId = this.preparationId;
        try {
            const client = await this.client();
            this.runLogged = true;
            this.phase = 'working';
            this.error = null;
            this.say('Submitting job…');
            const created = await client.createJob(
                preparationId,
                quote.planId,
                quote.priorityId,
            );
            throwIfAborted(controller);
            this.presentSubmittedJob(created);
        } catch (err) {
            if (!controller.signal.aborted) {
                this.fail(
                    err,
                    editor && isQasmLanguage(editor.document.languageId)
                        ? editor.document
                        : undefined,
                );
            }
            return;
        }
        this.post();
    }

    /** Leave the quote and open the new job on the Jobs page. */
    private presentSubmittedJob(created: JobRecord): void {
        const backendKey = this.backendId();
        const backend = this.backends.find(
            (item) => item.id === backendKey || item.shortCode === backendKey,
        );
        const providerName = backend
            ? this.providers.find(
                  (provider) => provider.id === backend.providerId,
              )?.name || ''
            : '';
        this.pinnedJob = {
            id: created.id,
            name: created.name || this.jobName.trim() || 'Job',
            status: created.status || 'Queued',
            message: created.message,
            providerName: created.providerName || providerName,
            backendName: created.backendName || backend?.name || '',
            backendClassId: created.backendClassId || backend?.id || null,
            submittedAt: created.submittedAt,
            completedAt: created.completedAt,
            creditsUsed: created.creditsUsed,
            executionPlanName: created.executionPlanName,
        };
        this.clearQuote();
        this.phase = 'idle';
        this.status = '';
        this.error = null;
        this.runLogged = false;
        this.runController = undefined;
        this.selectedJobId = created.id;
        this.output.appendLine(`Submitted ${created.id}`);
        this.showPage('jobs');
        void this.openJob(created.id);
    }

    private cancelRun(): void {
        const running = this.phase === 'working';
        this.stopRun();
        if (running) {
            this.phase = 'idle';
            this.say('Cancelled.');
        }
    }

    /** Back steps out of the quote or result, then out of the current page. */
    private applyBack(): void {
        const result = goBackInPanel({
            history: this.history,
            step: this.step,
            working: this.phase === 'working',
        });
        if (!result.handled) {
            return;
        }
        this.history = result.history;
        this.step = result.step;
        this.error = null;
        if (
            !result.pageChanged &&
            (this.phase === 'quote' ||
                this.phase === 'error' ||
                this.phase === 'done')
        ) {
            this.phase = 'idle';
        }
        this.syncJobsTimer();
        this.post();
        if (this.history.page === 'jobs') {
            void this.ensureJobs();
        }
    }

    async openPanelPage(page: PanelPage): Promise<void> {
        this.showPage(page);
        await vscode.commands.executeCommand(
            `${OpenQuantumViewProvider.viewId}.focus`,
        );
    }

    private showPage(page: PanelPage): void {
        const next = openPage(this.history, page);
        if (next !== this.history) {
            this.error = null;
        }
        this.history = next;
        this.syncJobsTimer();
        this.post();
        if (page === 'jobs') {
            void this.ensureJobs();
        }
    }

    private async ensureJobs(): Promise<void> {
        if (!this.credentials) {
            return;
        }
        if (!this.organizationId()) {
            await this.refresh();
            return;
        }
        if (this.history.page !== 'jobs') {
            return;
        }
        await this.loadJobs('refresh');
    }

    private async selectBackend(backendId: string): Promise<void> {
        if (this.phase === 'working' || !backendId) {
            return;
        }
        await this.context.workspaceState.update(
            'openquantum.backendId',
            backendId,
        );
        this.configSchema = null;
        this.configBackendId = null;
        this.clearQuote();
        this.step = 'setup';
        this.phase = 'idle';
        this.error = null;
        this.post();
        const selected = this.backendId();
        if (selected) {
            await this.loadConfiguration(selected);
        }
    }

    private async submitFromDetails(backendId: string): Promise<void> {
        if (this.phase !== 'working') {
            await this.selectBackend(backendId);
        }
        this.showPage('create');
        await vscode.commands.executeCommand(
            `${OpenQuantumViewProvider.viewId}.focus`,
        );
    }

    private async openBackend(backendKey: string): Promise<void> {
        if (!this.credentials) {
            this.showPage('keys');
            return;
        }
        const backend = this.backends.find(
            (item) => item.id === backendKey || item.shortCode === backendKey,
        );
        if (!backend) {
            return;
        }
        try {
            const client = await this.client();
            const details = await client.getBackendClass(
                backend.shortCode || backend.id,
                this.organizationId(),
            );
            const providerName =
                this.providers.find(
                    (provider) => provider.id === backend.providerId,
                )?.name || 'Provider';
            this.details.show(
                parseBackendDetails(details, {
                    id: backend.id,
                    name: backend.name,
                    shortCode: backend.shortCode,
                    providerName,
                    type: backend.type,
                    status: backend.status,
                    queueDepth: backend.queueDepth,
                    acceptingJobs: backend.acceptingJobs,
                    description: backend.description,
                    sparkAvailable: backend.sparkAvailable,
                }),
            );
        } catch (err) {
            if (this.phase === 'working') {
                this.error = err instanceof Error ? err.message : String(err);
                this.post();
                return;
            }
            this.fail(err);
        }
    }

    private async loadJobs(mode: 'refresh' | 'append'): Promise<void> {
        const organizationId = this.organizationId();
        if (!this.credentials || !organizationId) {
            return;
        }
        if (mode === 'append' && !this.jobList.cursor) {
            return;
        }
        if (mode === 'refresh' && this.jobsLoading) {
            return;
        }
        const ticket = ++this.jobsRequest;
        const cursor =
            mode === 'append' ? (this.jobList.cursor ?? undefined) : undefined;
        const showSpinner = mode === 'append' || this.jobList.jobs.length === 0;
        this.jobsError = null;
        if (showSpinner) {
            this.jobsLoading = true;
            this.post();
        }
        try {
            const client = await this.client();
            const page = await client.listJobs(organizationId, cursor);
            if (ticket !== this.jobsRequest) {
                return;
            }
            this.jobList =
                mode === 'append'
                    ? appendJobPage(this.jobList, page.jobs, page.nextCursor)
                    : refreshJobPage(this.jobList, page.jobs, page.nextCursor);
            this.jobsOrganizationId = organizationId;
            this.unpinIfListed();
            this.syncOpenPanel();
        } catch (err) {
            if (ticket !== this.jobsRequest) {
                return;
            }
            this.jobsError = err instanceof Error ? err.message : String(err);
        } finally {
            if (ticket === this.jobsRequest) {
                this.jobsLoading = false;
                this.post();
            }
        }
    }

    private visibleJobs(): JobSummary[] {
        return withPinned(this.jobList.jobs, this.pinnedJob);
    }

    private unpinIfListed(): void {
        if (
            this.pinnedJob &&
            this.jobList.jobs.some((job) => job.id === this.pinnedJob?.id)
        ) {
            this.pinnedJob = null;
        }
    }

    private async openJob(jobId: string): Promise<void> {
        if (!jobId) {
            return;
        }
        this.selectedJobId = jobId;
        this.jobsError = null;
        this.jobResults.show(this.jobModel(jobId), true);
        this.post();
        this.watchJob(jobId);
    }

    private watchJob(jobId: string): void {
        this.stopJobWatch();
        const ticket = this.jobWatchTicket;
        this.armJobWatch(jobId, ticket);
        void this.refreshOpenJob(jobId, ticket);
    }

    private armJobWatch(jobId: string, ticket: number): void {
        if (this.jobWatchTimer || ticket !== this.jobWatchTicket) {
            return;
        }
        this.jobWatchTimer = setInterval(() => {
            void this.refreshOpenJob(jobId, ticket);
        }, JOB_INTERVAL_MS);
    }

    private stopJobWatch(): void {
        if (this.jobWatchTimer) {
            clearInterval(this.jobWatchTimer);
            this.jobWatchTimer = undefined;
        }
        this.jobWatchTicket += 1;
        this.jobWatchBusy = false;
    }

    private async refreshOpenJob(jobId: string, ticket: number): Promise<void> {
        if (ticket !== this.jobWatchTicket || this.jobWatchBusy) {
            return;
        }
        this.jobWatchBusy = true;
        try {
            const client = await this.client();
            const job = await client.getJob(jobId);
            if (ticket !== this.jobWatchTicket) {
                return;
            }
            const output = await this.readJobOutput(
                client,
                jobId,
                job.outputDataUrl,
                job.calibrationDataUrl,
            );
            if (ticket !== this.jobWatchTicket) {
                return;
            }
            await this.applyJobDetails(client, jobId, job);
            if (ticket !== this.jobWatchTicket) {
                return;
            }
            this.jobResults.show(this.jobModel(jobId), false);
            const retryResults = output.resultsKind === 'error';
            if (isTerminalJobStatus(job.status) && !retryResults) {
                if (this.jobWatchTimer) {
                    clearInterval(this.jobWatchTimer);
                    this.jobWatchTimer = undefined;
                }
                if (!this.loggedResults.has(jobId)) {
                    this.loggedResults.add(jobId);
                    this.output.appendLine(
                        formatJobOutput({
                            jobId,
                            status: job.status,
                            counts: output.counts,
                            raw: output.raw,
                            calibration: output.calibration,
                        }),
                    );
                }
            } else {
                this.armJobWatch(jobId, ticket);
            }
            this.post();
        } catch (err) {
            if (
                ticket === this.jobWatchTicket &&
                this.selectedJobId === jobId
            ) {
                this.jobsError =
                    err instanceof Error ? err.message : String(err);
                this.post();
            }
        } finally {
            if (ticket === this.jobWatchTicket) {
                this.jobWatchBusy = false;
            }
        }
    }

    private async readJobOutput(
        client: OpenQuantumClient,
        jobId: string,
        outputDataUrl: string | null,
        calibrationDataUrl: string | null,
    ): Promise<CachedJobOutput> {
        const cached = this.outputCache.get(jobId);
        if (
            cached &&
            cached.resultsKind !== 'error' &&
            cached.outputDataUrl === outputDataUrl &&
            cached.calibrationDataUrl === calibrationDataUrl
        ) {
            return cached;
        }
        let output: unknown = null;
        let downloadText: string | null = null;
        let countsMap: Record<string, number> | null = null;
        let resultsKind: ResultsKind = outputDataUrl ? 'other' : 'none';
        if (outputDataUrl) {
            try {
                output = await client.downloadJson(outputDataUrl);
                downloadText = JSON.stringify(output, null, 2);
                countsMap = countsFromOutput(output);
                resultsKind = countsMap ? 'counts' : 'other';
            } catch {
                output = null;
                downloadText = null;
                countsMap = null;
                resultsKind = 'error';
            }
        }
        let calibration: string | null = null;
        if (calibrationDataUrl) {
            try {
                calibration = stringifyLimited(
                    await client.downloadJson(calibrationDataUrl),
                );
            } catch {
                calibration = null;
            }
        }
        const value: CachedJobOutput = {
            outputDataUrl,
            calibrationDataUrl,
            counts: countsMap ? countsToBars(countsMap) : null,
            countsMap,
            raw:
                output == null
                    ? resultsKind === 'error'
                        ? 'Could not read the results.'
                        : 'No output yet.'
                    : stringifyLimited(output),
            calibration,
            downloadText,
            resultsKind,
        };
        this.outputCache.set(jobId, value);
        return value;
    }

    /** Fill gaps from the lean job payload without clearing list fields. */
    private async applyJobDetails(
        client: OpenQuantumClient,
        jobId: string,
        job: JobRecord,
    ): Promise<void> {
        const listed = this.visibleJobs().find((item) => item.id === jobId);
        let backendClassId =
            job.backendClassId || listed?.backendClassId || null;
        if (!backendClassId && job.preparationId) {
            try {
                const preparation = await client.getPreparation(
                    job.preparationId,
                );
                backendClassId = preparation.backendClassId;
            } catch {
                backendClassId = null;
            }
        }
        const known = backendClassId
            ? this.backends.find(
                  (item) =>
                      item.id === backendClassId ||
                      item.shortCode === backendClassId,
              )
            : undefined;
        const providerFromCatalog = known
            ? this.providers.find(
                  (provider) => provider.id === known.providerId,
              )?.name
            : undefined;
        const patch: Partial<JobSummary> = {
            status: job.status,
            message: job.message,
        };
        if (job.submittedAt) {
            patch.submittedAt = job.submittedAt;
        }
        if (job.completedAt) {
            patch.completedAt = job.completedAt;
        }
        if (job.name) {
            patch.name = job.name;
        }
        if (job.creditsUsed != null) {
            patch.creditsUsed = job.creditsUsed;
        }
        if (job.executionPlanName) {
            patch.executionPlanName = job.executionPlanName;
        }
        if (job.backendName) {
            patch.backendName = job.backendName;
        } else if (!listed?.backendName && known) {
            patch.backendName = known.name;
        }
        if (job.providerName) {
            patch.providerName = job.providerName;
        } else if (!listed?.providerName && providerFromCatalog) {
            patch.providerName = providerFromCatalog;
        }
        if (backendClassId) {
            patch.backendClassId = backendClassId;
        }
        this.patchListedJob(jobId, patch);
    }

    private patchListedJob(jobId: string, patch: Partial<JobSummary>): void {
        const apply = (job: JobSummary): JobSummary =>
            job.id === jobId ? { ...job, ...patch } : job;
        this.jobList = {
            ...this.jobList,
            jobs: this.jobList.jobs.map(apply),
        };
        if (this.pinnedJob?.id === jobId) {
            this.pinnedJob = { ...this.pinnedJob, ...patch };
        }
    }

    private jobModel(jobId: string): JobResultModel {
        const listed = this.visibleJobs().find((job) => job.id === jobId);
        const cached = this.outputCache.get(jobId);
        return {
            id: jobId,
            name: listed?.name || 'Job',
            status: listed?.status || 'Loading',
            providerName: listed?.providerName || '',
            backendName: listed?.backendName || '',
            backendId: this.catalogBackendKey(listed?.backendClassId ?? null),
            submittedAt: listed?.submittedAt ?? null,
            completedAt: listed?.completedAt ?? null,
            creditsUsed: listed?.creditsUsed ?? null,
            executionPlanName: listed?.executionPlanName ?? null,
            message: listed?.message ?? null,
            resultsKind: cached?.resultsKind ?? 'loading',
            counts: cached?.countsMap ?? null,
            canDownload: Boolean(cached?.outputDataUrl),
        };
    }

    /** A catalog id the Live Capabilities panel can open, or null. */
    private catalogBackendKey(backendClassId: string | null): string | null {
        if (!backendClassId) {
            return null;
        }
        const backend = this.backends.find(
            (item) =>
                item.id === backendClassId || item.shortCode === backendClassId,
        );
        if (!backend) {
            return null;
        }
        return backend.shortCode || backend.id;
    }

    /** Keep an open job window aligned with a refreshed list row. */
    private syncOpenPanel(): void {
        const jobId = this.jobResults.currentJobId();
        if (!jobId) {
            return;
        }
        if (!this.visibleJobs().some((job) => job.id === jobId)) {
            return;
        }
        this.jobResults.show(this.jobModel(jobId), false);
    }

    private async downloadOpenJob(jobId: string): Promise<void> {
        const cached = this.outputCache.get(jobId);
        if (!cached?.outputDataUrl) {
            return;
        }
        let text = cached.downloadText;
        if (!text) {
            try {
                const client = await this.client();
                text = JSON.stringify(
                    await client.downloadJson(cached.outputDataUrl),
                    null,
                    2,
                );
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err);
                void vscode.window.showErrorMessage(message);
                return;
            }
        }
        const name =
            this.visibleJobs().find((job) => job.id === jobId)?.name ||
            'results';
        await this.saveTextFile(`${fileStem(name)}-results.json`, text, {
            JSON: ['json'],
        });
    }

    private async saveExplorerFile(
        filename: string,
        content: string,
    ): Promise<void> {
        const filters: Record<string, string[]> = filename.endsWith('.ipynb')
            ? { Notebook: ['ipynb'] }
            : { JSON: ['json'] };
        await this.saveTextFile(filename, content, filters);
    }

    private async saveTextFile(
        filename: string,
        content: string,
        filters: Record<string, string[]>,
    ): Promise<void> {
        try {
            const base =
                vscode.workspace.workspaceFolders?.[0]?.uri ??
                vscode.Uri.file(homedir());
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.joinPath(base, filename),
                filters,
            });
            if (!uri) {
                return;
            }
            await vscode.workspace.fs.writeFile(
                uri,
                new TextEncoder().encode(content),
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            void vscode.window.showErrorMessage(message);
        }
    }

    private clearJobs(): void {
        this.jobList = emptyJobList();
        this.pinnedJob = null;
        this.jobsLoading = false;
        this.jobsError = null;
        this.selectedJobId = null;
        this.outputCache.clear();
        this.stopJobWatch();
        this.jobResults.dispose();
    }

    /** The website reloads the jobs page every 30 seconds. */
    private syncJobsTimer(): void {
        const want =
            !!this.view?.visible &&
            this.history.page === 'jobs' &&
            this.credentials != null;
        if (want && !this.jobsTimer) {
            this.jobsTimer = setInterval(() => {
                void this.loadJobs('refresh');
            }, JOBS_REFRESH_MS);
            return;
        }
        if (!want) {
            this.stopJobsRefresh();
        }
    }

    private stopJobsRefresh(): void {
        if (this.jobsTimer) {
            clearInterval(this.jobsTimer);
            this.jobsTimer = undefined;
        }
    }

    private stopRun(): void {
        this.runController?.abort();
        this.runController = undefined;
        this.runLogged = false;
    }

    private async refreshCredentials(): Promise<void> {
        const envPath = process.env.OPENQUANTUM_SDK_KEY?.trim();
        let envFile: string | null = null;
        if (envPath) {
            try {
                envFile = readFileSync(envPath, 'utf8');
            } catch {
                envFile = null;
            }
        }
        this.credentials = resolveCredentials({
            savedJson: await this.context.secrets.get(SECRET_KEY),
            envFile,
            envClientId: process.env.OPENQUANTUM_CLIENT_ID,
            envClientSecret: process.env.OPENQUANTUM_CLIENT_SECRET,
        });
    }

    /** `.vscode/openquantum.json` in the workspace, or the public service. */
    private async serviceEndpoints(): Promise<PlatformEndpoints> {
        const folders = vscode.workspace.workspaceFolders ?? [];
        for (const folder of folders) {
            const uri = vscode.Uri.joinPath(
                folder.uri,
                '.vscode',
                'openquantum.json',
            );
            try {
                const bytes = await vscode.workspace.fs.readFile(uri);
                return endpointsFromJson(Buffer.from(bytes).toString('utf8'));
            } catch (err) {
                if (err instanceof EndpointSettingsError) {
                    throw err;
                }
            }
        }
        return { ...DEFAULT_ENDPOINTS };
    }

    private async client(): Promise<OpenQuantumClient> {
        if (!this.credentials) {
            await this.refreshCredentials();
        }
        if (!this.credentials) {
            throw new PlatformError(
                'No SDK key. Use Open Quantum: Set SDK Key, or set OPENQUANTUM_SDK_KEY.',
            );
        }
        const endpoints = await this.serviceEndpoints();
        const key = JSON.stringify({
            clientId: this.credentials.clientId,
            secretHash: createHash('sha256')
                .update(this.credentials.clientSecret)
                .digest('hex'),
            endpoints,
        });
        if (this.clientCache?.key === key) {
            return this.clientCache.client;
        }
        const client = new OpenQuantumClient(endpoints, {
            clientId: this.credentials.clientId,
            clientSecret: this.credentials.clientSecret,
        });
        this.clientCache = { key, client };
        return client;
    }

    private organizationId(): string | null {
        const stored = this.context.workspaceState.get<string>(
            'openquantum.organizationId',
        );
        if (stored && this.organizations.some((org) => org.id === stored)) {
            return stored;
        }
        return this.organizations[0]?.id ?? null;
    }

    private requireOrganization(): string {
        const id = this.organizationId();
        if (!id) {
            throw new PlatformError(
                'No organization was found for this SDK key.',
            );
        }
        return id;
    }

    private backendId(): string | null {
        const stored = this.context.workspaceState.get<string>(
            'openquantum.backendId',
        );
        if (
            stored &&
            this.backends.some(
                (backend) =>
                    backend.id === stored || backend.shortCode === stored,
            )
        ) {
            return stored;
        }
        return (
            this.backends.find((backend) => backend.shortCode)?.shortCode ??
            this.backends[0]?.shortCode ??
            this.backends[0]?.id ??
            null
        );
    }

    private requireBackend(): string {
        const id = this.backendId();
        if (!id) {
            throw new PlatformError('Choose a backend.');
        }
        return id;
    }

    private categoryKey(item: {
        shortCode: string | null;
        id: string;
    }): string {
        return item.shortCode || item.id;
    }

    private categoryValue(): string {
        const stored = this.context.workspaceState.get<string>(
            'openquantum.category',
        );
        if (
            stored &&
            this.categories.some(
                (category) => this.categoryKey(category) === stored,
            )
        ) {
            return stored;
        }
        const match = this.subcategories.find(
            (item) => this.categoryKey(item) === DEFAULT_SUBCATEGORY,
        );
        if (match) {
            return match.categoryShortCode || match.categoryId;
        }
        const first = this.categories[0];
        return first ? this.categoryKey(first) : '';
    }

    private subcategoriesFor(category: string): SubcategoryInfo[] {
        return this.subcategories.filter(
            (item) => (item.categoryShortCode || item.categoryId) === category,
        );
    }

    private subcategory(): string {
        const category = this.categoryValue();
        const choices = this.subcategoriesFor(category);
        const stored = this.context.workspaceState.get<string>(
            'openquantum.subcategory',
        );
        if (
            stored &&
            choices.some((item) => this.categoryKey(item) === stored)
        ) {
            return stored;
        }
        if (
            choices.some(
                (item) => this.categoryKey(item) === DEFAULT_SUBCATEGORY,
            )
        ) {
            return DEFAULT_SUBCATEGORY;
        }
        const first = choices[0];
        return first ? this.categoryKey(first) : DEFAULT_SUBCATEGORY;
    }

    private planId(): string | null {
        const stored =
            this.context.workspaceState.get<string>('openquantum.planId');
        return stored || null;
    }

    private priorityId(): string | null {
        const stored = this.context.workspaceState.get<string>(
            'openquantum.priorityId',
        );
        return stored || null;
    }

    private currentQuote(): ChosenQuote | null {
        if (this.quotePlans.length === 0) {
            return null;
        }
        return selectQuote(this.quotePlans, this.planId(), this.priorityId());
    }

    private storedConfigs(): Record<string, ConfigData> {
        const stored = this.context.workspaceState.get<
            Record<string, ConfigData>
        >('openquantum.configByBackend');
        return stored && typeof stored === 'object' ? stored : {};
    }

    private currentConfig(): ConfigData {
        const schema = this.configSchema;
        const backendId = this.configBackendId;
        if (!schema || !backendId) {
            return {};
        }
        const stored = this.storedConfigs()[backendId];
        const merged = mergeConfig(schema, stored);
        if (!stored && schema.properties && 'shots' in schema.properties) {
            const legacy =
                this.context.workspaceState.get<string>('openquantum.shots');
            if (legacy && legacy.trim()) {
                const shots = Number(legacy.trim());
                if (Number.isInteger(shots)) {
                    merged.shots = shots;
                }
            }
        }
        return merged;
    }

    private async rememberConfig(
        backendId: string,
        data: ConfigData,
    ): Promise<void> {
        await this.context.workspaceState.update(
            'openquantum.configByBackend',
            { ...this.storedConfigs(), [backendId]: data },
        );
    }

    private async loadConfiguration(backendId: string): Promise<void> {
        const ticket = ++this.configLoad;
        this.configSchema = null;
        this.configBackendId = backendId;
        this.post();
        const client = await this.client();
        const details = await client.getBackendClass(
            backendId,
            this.organizationId(),
        );
        if (ticket !== this.configLoad || this.backendId() !== backendId) {
            return;
        }
        this.configSchema = asSchema(details.configuration_schema);
        this.post();
    }

    private clearQuote(): void {
        this.quotePlans = [];
        this.preparationId = undefined;
        this.preparedHash = undefined;
        if (this.step === 'quote') {
            this.step = 'setup';
        }
        if (this.phase === 'quote') {
            this.phase = 'idle';
        }
    }

    private beginRun(document: vscode.TextDocument): void {
        this.runLogged = true;
        this.runDiagnostics.delete(document.uri);
        const name =
            document.fileName.split(/[\\/]/).pop() || document.fileName;
        this.output.appendLine('');
        this.output.appendLine(name);
    }

    /** Panel status that is also a line in the Open Quantum output channel. */
    private say(status: string): void {
        if (status === this.status) {
            return;
        }
        if (status) {
            this.output.appendLine(status);
        }
        this.status = status;
        this.post();
    }

    private activeQasmDocument(): vscode.TextDocument | undefined {
        const editor = vscode.window.activeTextEditor;
        if (editor && isQasmLanguage(editor.document.languageId)) {
            return editor.document;
        }
        return undefined;
    }

    private publishRunProblem(
        document: vscode.TextDocument,
        problem: LocatedProblem,
    ): void {
        const lineIndex = Math.min(
            Math.max(0, problem.line - 1),
            Math.max(0, document.lineCount - 1),
        );
        const text =
            document.lineCount === 0 ? '' : document.lineAt(lineIndex).text;
        const span = problemSpan(text, problem.column);
        const diagnostic = new vscode.Diagnostic(
            new vscode.Range(lineIndex, span.start, lineIndex, span.end),
            problem.message,
            vscode.DiagnosticSeverity.Error,
        );
        diagnostic.source = 'Open Quantum';
        this.runDiagnostics.set(document.uri, [diagnostic]);
    }

    private fail(err: unknown, document?: vscode.TextDocument): void {
        const message = err instanceof Error ? err.message : String(err);
        const problem = document ? locatedProblem(message) : null;
        const log = this.runLogged;
        this.runLogged = false;
        this.phase = 'error';
        this.status = '';
        if (problem && document) {
            this.publishRunProblem(document, problem);
            if (log) {
                this.output.appendLine(problem.message);
            }
            this.error = null;
            this.post();
            this.focusProblems();
            return;
        }
        if (log) {
            const summary = message.split('\n')[0] || message;
            if (summary) {
                this.output.appendLine(summary);
            }
        }
        this.error = message;
        this.post();
        if (document && this.circuitHasProblems(document)) {
            this.focusProblems();
        }
    }

    private circuitHasProblems(document: vscode.TextDocument): boolean {
        return syncCircuitDiagnostics(document) > 0;
    }

    /** Leave the run form and open Problems. The circuit is not submitted. */
    private showCircuitProblems(): void {
        this.phase = 'idle';
        this.step = 'setup';
        this.status = '';
        this.error = null;
        this.post();
        this.focusProblems();
    }

    private focusProblems(): void {
        void vscode.commands
            .executeCommand('workbench.action.problems.focus')
            .then(undefined, () =>
                vscode.commands
                    .executeCommand('workbench.actions.view.problems')
                    .then(undefined, () => undefined),
            );
    }

    /** The open circuit file name, until the user types a different job name. */
    private activeQasmName(): string {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isQasmLanguage(editor.document.languageId)) {
            return '';
        }
        return editor.document.fileName.split(/[\\/]/).pop() || '';
    }

    private syncJobName(): boolean {
        const file = this.activeQasmName();
        if (this.jobNameEdited || !file || this.jobName === file) {
            return false;
        }
        this.jobName = file;
        void this.context.workspaceState.update('openquantum.jobName', file);
        void this.context.workspaceState.update(
            'openquantum.jobNameEdited',
            false,
        );
        if (this.preparationId) {
            this.clearQuote();
        }
        return true;
    }

    private rememberJobName(raw: string): void {
        const name = raw.slice(0, 255);
        const file = this.activeQasmName();
        this.jobName = name;
        this.jobNameEdited = name.trim() !== file;
        void this.context.workspaceState.update('openquantum.jobName', name);
        void this.context.workspaceState.update(
            'openquantum.jobNameEdited',
            this.jobNameEdited,
        );
    }

    private post(): void {
        this.syncJobName();
        const providerNames = new Map(
            this.providers.map((provider) => [provider.id, provider.name]),
        );
        const category = this.categoryValue();
        const quote = this.currentQuote();
        const selectedPlan = quote
            ? this.quotePlans.find(
                  (plan) => plan.executionPlanId === quote.planId,
              )
            : undefined;
        const state: PanelState = {
            signedIn: this.credentials != null,
            organizations: this.organizations.map((org) => ({
                id: org.id,
                name: org.name,
            })),
            organizationId: this.organizationId(),
            balance: this.balance,
            backends: this.backends.map((backend) => ({
                id: backend.id,
                name: backend.name,
                shortCode: backend.shortCode,
                providerId: backend.providerId,
                providerName:
                    providerNames.get(backend.providerId) || 'Provider',
                type: backend.type,
                status: backend.status,
                queueDepth: backend.queueDepth,
                acceptingJobs: backend.acceptingJobs,
                light: backendLight(backend.status, backend.acceptingJobs),
                sparkAvailable: backend.sparkAvailable,
                description: backend.description,
            })),
            backendId: this.backendId(),
            categories: this.categories.map((item) => ({
                value: this.categoryKey(item),
                label: item.name,
            })),
            category,
            subcategories: this.subcategoriesFor(category).map((item) => ({
                id: item.id,
                value: this.categoryKey(item),
                label: item.name,
            })),
            subcategory: this.subcategory(),
            jobName: this.jobName,
            configReady:
                this.configSchema != null &&
                this.configBackendId === this.backendId(),
            configFields:
                this.configSchema && this.configBackendId === this.backendId()
                    ? configFields(this.configSchema, this.currentConfig())
                    : [],
            configErrors:
                this.configSchema && this.configBackendId === this.backendId()
                    ? checkConfiguration(
                          this.configSchema,
                          this.currentConfig(),
                      ).errors
                    : [],
            phase: this.phase,
            step: this.step,
            page: this.history.page,
            canGoBack: canGoBack({
                history: this.history,
                step: this.step,
                working: this.phase === 'working',
            }),
            status: this.status,
            plans: this.quotePlans.map((plan) => ({
                id: plan.executionPlanId,
                name: plan.name,
                price: plan.price,
            })),
            queues: (selectedPlan?.queuePriorities ?? []).map((priority) => ({
                id: priority.queuePriorityId,
                name: priority.name,
                priceIncrease: priority.priceIncrease,
            })),
            quote: quote
                ? {
                      planId: quote.planId,
                      priorityId: quote.priorityId,
                      planName: quote.planName,
                      priorityName: quote.priorityName,
                      credits: quote.credits,
                      citation: quote.citation,
                  }
                : null,
            error: this.error,
            jobs: this.visibleJobs().map((job): ViewJob => ({
                id: job.id,
                name: job.name,
                status: job.status,
                backendName: job.backendName,
                providerName: job.providerName,
                submittedAt: job.submittedAt,
                creditsUsed: job.creditsUsed,
            })),
            jobsCursor: this.jobList.cursor,
            jobsLoading: this.jobsLoading,
            jobsError: this.jobsError,
            selectedJobId: this.selectedJobId,
        };
        void this.view?.webview.postMessage({ type: 'state', state });
    }
}

interface CachedJobOutput {
    outputDataUrl: string | null;
    calibrationDataUrl: string | null;
    counts: CountBar[] | null;
    countsMap: Record<string, number> | null;
    raw: string;
    calibration: string | null;
    downloadText: string | null;
    resultsKind: ResultsKind;
}

function fileStem(name: string): string {
    const stem = name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
    return stem || 'results';
}

function creditLabel(credits: number): string {
    if (credits === 0) {
        return 'free';
    }
    return `${credits} credit${credits === 1 ? '' : 's'}`;
}

function stringifyLimited(value: unknown): string {
    const text = JSON.stringify(value, null, 2) ?? String(value);
    if (text.length <= RAW_LIMIT) {
        return text;
    }
    return `${text.slice(0, RAW_LIMIT)}\n… truncated`;
}

function throwIfAborted(controller: AbortController): void {
    if (controller.signal.aborted) {
        throw new PlatformError('Cancelled.');
    }
}
