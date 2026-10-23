// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

import {
    layoutCircuit,
    parseCircuitView,
    refusalDetail,
    type LayoutGate,
} from './circuitView';

/** Characters of a job file the job window will render. */
export const JOB_FILE_PREVIEW_CHARS = 200_000;

/** Lines of a job file the job window will render. */
export const JOB_FILE_PREVIEW_LINES = 4_000;

/** Characters kept from one rendered line. */
export const JOB_FILE_LINE_CHARS = 1_000;

/**
 * Counts documents larger than this stay on the chart and are not copied
 * into the editable textarea.
 */
export const COUNTS_EDITOR_MAX_CHARS = 100_000;

export const CHART_ROW_CAP = 64;
export const TABLE_ROW_CAP = 200;

export type InputFileId = 'original' | 'processed';

export type SelectedInputFiles =
    | { kind: 'single'; id: InputFileId; url: string }
    | { kind: 'tabs'; originalUrl: string; processedUrl: string };

export type JobFilePreview =
    | { kind: 'empty' }
    | { kind: 'binary' }
    | { kind: 'text'; text: string; truncated: boolean };

export type ClassifiedResults =
    | { kind: 'empty' }
    | { kind: 'binary' }
    | { kind: 'counts'; counts: Record<string, number> }
    | { kind: 'acquisitions'; text: string; truncated: boolean }
    | { kind: 'text'; text: string; truncated: boolean };

export interface InputFileModel {
    text: string;
    error: string | null;
    footer: string | null;
    canDownload: boolean;
}

export interface CircuitPanelModel {
    status: 'loading' | 'empty' | 'refused' | 'circuit';
    message: string | null;
    detail: string | null;
    wires: string[];
    columnCount: number;
    columnWidths: number[];
    gates: LayoutGate[];
}

export interface InputPanelModel {
    inputTitle: string;
    inputLoading: boolean;
    inputTabs: boolean;
    inputFiles: {
        original: InputFileModel | null;
        processed: InputFileModel | null;
    };
    circuit: CircuitPanelModel;
}

export interface StoredInputBody {
    text: string | null;
    error: string | null;
}

export interface StoredJobInput {
    prepLoaded: boolean;
    format: string;
    circuitRaw: unknown;
    inputUrl: string | null;
    processedUrl: string | null;
    bodies: Record<string, StoredInputBody>;
}

/**
 * Tabs only when the upload and the processed object are different paths.
 * A new presign query is the same file. A missing processed URL is one file.
 */
export function selectInputFiles(
    prep: {
        processed_data_url?: string | null;
        input_data_url?: string | null;
    } | null,
): SelectedInputFiles | null {
    const input = prep?.input_data_url?.trim() ?? '';
    const processed = prep?.processed_data_url?.trim() ?? '';
    if (
        input &&
        processed &&
        presignedObjectKey(input) !== presignedObjectKey(processed)
    ) {
        return {
            kind: 'tabs',
            originalUrl: input,
            processedUrl: processed,
        };
    }
    const url = processed || input;
    if (!url) {
        return null;
    }
    return {
        kind: 'single',
        id: processed ? 'processed' : 'original',
        url,
    };
}

/** Identity of a presigned object, without the signature query. */
export function presignedObjectKey(url: string | null | undefined): string {
    const trimmed = url?.trim();
    if (!trimmed) {
        return '';
    }
    try {
        const target = new URL(trimmed);
        return `${target.origin}${target.pathname}`;
    } catch {
        return trimmed;
    }
}

/** Missing format is OpenQASM. Unknown formats stay generic. */
export function inputFormatLabel(format: string | null | undefined): string {
    switch ((format ?? '').toLowerCase()) {
        case 'qasm':
            return 'OpenQASM';
        case 'qblox_sequence':
            return 'Qblox sequence';
        case 'qblox_schedule':
            return 'Qblox schedule';
        default:
            return 'Input';
    }
}

export function circuitUnavailableCopy(
    format: string | null | undefined,
): string {
    const resolved = (format ?? '').toLowerCase();
    if (resolved && resolved !== 'qasm') {
        return 'Circuit diagrams are drawn for OpenQASM inputs.';
    }
    return 'A circuit diagram was not stored for this job.';
}

export function prettyJsonForFormat(
    format: string | null | undefined,
): boolean {
    const resolved = (format ?? 'qasm').toLowerCase();
    return resolved === 'qblox_sequence' || resolved === 'qblox_schedule';
}

/** Finite, non-negative numbers. Nested objects are not counts. */
export function isCountsObject(
    value: unknown,
): value is Record<string, number> {
    return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value as object).length > 0 &&
        Object.values(value as Record<string, unknown>).every(
            (entry) =>
                typeof entry === 'number' &&
                Number.isFinite(entry) &&
                entry >= 0,
        )
    );
}

/** Counts at the top, or under counts / data / results[0]. */
export function extractPortalCounts(
    data: unknown,
): Record<string, number> | null {
    if (isCountsObject(data)) {
        return data;
    }
    if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        if (isCountsObject(record.counts)) {
            return record.counts;
        }
        if (record.data && typeof record.data === 'object') {
            const nested = record.data as Record<string, unknown>;
            if (isCountsObject(nested.counts)) {
                return nested.counts;
            }
            if (isCountsObject(record.data)) {
                return record.data;
            }
        }
        if (Array.isArray(record.results) && record.results[0]) {
            const first = record.results[0] as Record<string, unknown>;
            if (isCountsObject(first.counts)) {
                return first.counts;
            }
        }
    }
    return null;
}

/** Each value has an index and an acquisition. A counts map does not match. */
export function looksLikeAcquisitions(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return false;
    }
    const values = Object.values(data as Record<string, unknown>);
    if (values.length === 0) {
        return false;
    }
    return values.every((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }
        const entry = value as Record<string, unknown>;
        return (
            typeof entry.index === 'number' &&
            Number.isInteger(entry.index) &&
            entry.index >= 0 &&
            !!entry.acquisition &&
            typeof entry.acquisition === 'object' &&
            !Array.isArray(entry.acquisition)
        );
    });
}

export function looksLikeBinary(text: string): boolean {
    if (text.includes('\0')) {
        return true;
    }
    const sample = text.slice(0, 4_000);
    if (!sample) {
        return false;
    }
    let controls = 0;
    for (let i = 0; i < sample.length; i++) {
        const code = sample.charCodeAt(i);
        if (code === 9 || code === 10 || code === 13) {
            continue;
        }
        if (code < 32) {
            controls++;
        }
    }
    return controls / sample.length > 0.05;
}

/** Pretty-printing is opt-in so OpenQASM line numbers stay aligned. */
export function previewJobFile(
    text: string,
    options?: { prettyJson?: boolean },
): JobFilePreview {
    if (!text || !text.trim()) {
        return { kind: 'empty' };
    }
    if (looksLikeBinary(text)) {
        return { kind: 'binary' };
    }

    let body = text;
    let truncated = false;
    if (body.length > JOB_FILE_PREVIEW_CHARS) {
        body = body.slice(0, JOB_FILE_PREVIEW_CHARS);
        truncated = true;
    }

    if (options?.prettyJson && !truncated) {
        const trimmed = body.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
                if (pretty.length <= JOB_FILE_PREVIEW_CHARS) {
                    body = pretty;
                }
            } catch {
                // Not JSON. Show the original text.
            }
        }
    }

    const lines = body.split(/\r?\n/);
    const kept =
        lines.length > JOB_FILE_PREVIEW_LINES
            ? lines.slice(0, JOB_FILE_PREVIEW_LINES)
            : lines;
    if (kept.length !== lines.length) {
        truncated = true;
    }

    const clipped = kept.map((line) =>
        line.length > JOB_FILE_LINE_CHARS
            ? `${line.slice(0, JOB_FILE_LINE_CHARS)}…`
            : line,
    );
    if (clipped.some((line, index) => line !== kept[index])) {
        truncated = true;
    }

    return { kind: 'text', text: clipped.join('\n'), truncated };
}

/**
 * What a results file is. Counts stay on the chart. Acquisitions and other
 * text get a bounded preview. Empty and binary stay unlabeled files.
 */
export function classifyResultsText(text: string): ClassifiedResults {
    if (!text || !text.trim()) {
        return { kind: 'empty' };
    }
    if (looksLikeBinary(text)) {
        return { kind: 'binary' };
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed: unknown = JSON.parse(trimmed);
            const counts = extractPortalCounts(parsed);
            if (counts) {
                return { kind: 'counts', counts };
            }
            if (looksLikeAcquisitions(parsed)) {
                const preview = previewJobFile(text, { prettyJson: true });
                if (preview.kind === 'text') {
                    return {
                        kind: 'acquisitions',
                        text: preview.text,
                        truncated: preview.truncated,
                    };
                }
                return preview;
            }
        } catch {
            // Not JSON. Fall through to a text preview.
        }
    }

    const preview = previewJobFile(text, { prettyJson: true });
    if (preview.kind !== 'text') {
        return preview;
    }
    return { kind: 'text', text: preview.text, truncated: preview.truncated };
}

const LOADING_CIRCUIT: CircuitPanelModel = {
    status: 'loading',
    message: null,
    detail: null,
    wires: [],
    columnCount: 0,
    columnWidths: [],
    gates: [],
};

export function emptyInputPanel(): InputPanelModel {
    return {
        inputTitle: 'Input',
        inputLoading: true,
        inputTabs: false,
        inputFiles: { original: null, processed: null },
        circuit: LOADING_CIRCUIT,
    };
}

export function inputPanelFromStored(stored: StoredJobInput): InputPanelModel {
    if (!stored.prepLoaded) {
        return emptyInputPanel();
    }
    const format = stored.format || 'qasm';
    const selection = selectInputFiles({
        input_data_url: stored.inputUrl,
        processed_data_url: stored.processedUrl,
    });
    const files = {
        original: null as InputFileModel | null,
        processed: null as InputFileModel | null,
    };
    if (!selection) {
        files.original = {
            text: '',
            error: 'No input file is stored for this job.',
            footer: null,
            canDownload: false,
        };
    } else if (selection.kind === 'tabs') {
        files.original = fileModel(
            selection.originalUrl,
            stored.bodies,
            format,
        );
        files.processed = fileModel(
            selection.processedUrl,
            stored.bodies,
            format,
        );
    } else {
        files[selection.id] = fileModel(selection.url, stored.bodies, format);
    }
    return {
        inputTitle: inputFormatLabel(format),
        inputLoading: false,
        inputTabs: selection?.kind === 'tabs',
        inputFiles: files,
        circuit: circuitPanel(format, stored.circuitRaw),
    };
}

function fileModel(
    url: string,
    bodies: Record<string, StoredInputBody>,
    format: string,
): InputFileModel {
    const body = bodies[presignedObjectKey(url)];
    if (!body) {
        return {
            text: '',
            error: 'Could not load the input for this job.',
            footer: null,
            canDownload: true,
        };
    }
    if (body.error) {
        return {
            text: '',
            error: body.error,
            footer: null,
            canDownload: true,
        };
    }
    const preview = previewJobFile(body.text ?? '', {
        prettyJson: prettyJsonForFormat(format),
    });
    if (preview.kind === 'empty') {
        return {
            text: '',
            error: 'The input file is empty.',
            footer: null,
            canDownload: true,
        };
    }
    if (preview.kind === 'binary') {
        return {
            text: '',
            error: 'This input is not text. Download it to inspect it.',
            footer: null,
            canDownload: true,
        };
    }
    return {
        text: preview.text,
        error: null,
        footer: preview.truncated
            ? 'Showing the start of the file. Download it for the rest.'
            : null,
        canDownload: true,
    };
}

function circuitPanel(format: string, raw: unknown): CircuitPanelModel {
    const parsed = parseCircuitView(raw);
    if (!parsed) {
        return {
            status: 'empty',
            message: circuitUnavailableCopy(format),
            detail: null,
            wires: [],
            columnCount: 0,
            columnWidths: [],
            gates: [],
        };
    }
    if (parsed.kind === 'refused') {
        return {
            status: 'refused',
            message: parsed.reason,
            detail: refusalDetail(parsed),
            wires: [],
            columnCount: 0,
            columnWidths: [],
            gates: [],
        };
    }
    const layout = layoutCircuit(parsed);
    return {
        status: 'circuit',
        message: null,
        detail: null,
        wires: layout.wires,
        columnCount: layout.columnCount,
        columnWidths: layout.columnWidths,
        gates: layout.gates,
    };
}
