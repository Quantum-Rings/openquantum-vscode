// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

export const PANEL_PAGES = [
    'home',
    'create',
    'jobs',
    'keys',
    'settings',
] as const;

export type PanelPage = (typeof PANEL_PAGES)[number];

export type WizardStep = 'setup' | 'quote' | 'job';

const STACK_LIMIT = 12;

export interface PageHistory {
    page: PanelPage;
    stack: PanelPage[];
}

export function isPanelPage(value: string): value is PanelPage {
    return (PANEL_PAGES as readonly string[]).includes(value);
}

export function initialHistory(): PageHistory {
    return { page: 'home', stack: [] };
}

export function openPage(history: PageHistory, page: PanelPage): PageHistory {
    if (page === history.page) {
        return history;
    }
    return {
        page,
        stack: [...history.stack, history.page].slice(-STACK_LIMIT),
    };
}

export function goHome(history: PageHistory): PageHistory {
    if (history.page === 'home' && history.stack.length === 0) {
        return history;
    }
    return { page: 'home', stack: [] };
}

/** Pop the page stack. An empty stack on any other page returns home. */
export function goBackPage(history: PageHistory): PageHistory {
    if (history.stack.length === 0) {
        return history.page === 'home' ? history : { page: 'home', stack: [] };
    }
    const stack = history.stack.slice(0, -1);
    return { page: history.stack[history.stack.length - 1], stack };
}

export interface BackContext {
    history: PageHistory;
    step: WizardStep;
    working: boolean;
}

export interface BackResult {
    history: PageHistory;
    step: WizardStep;
    /** False while a submit is in progress. The page stays put. */
    handled: boolean;
    /** True when Back left the create-job wizard for another page. */
    pageChanged: boolean;
}

/**
 * Back inside Create job returns from the quote or result to the form.
 * Another Back leaves the page. Home clears the stack.
 */
export function goBackInPanel(context: BackContext): BackResult {
    if (context.working) {
        return {
            history: context.history,
            step: context.step,
            handled: false,
            pageChanged: false,
        };
    }
    if (context.history.page === 'create' && context.step !== 'setup') {
        return {
            history: context.history,
            step: 'setup',
            handled: true,
            pageChanged: false,
        };
    }
    const history = goBackPage(context.history);
    return {
        history,
        step: 'setup',
        handled: true,
        pageChanged: history.page !== context.history.page,
    };
}

export function canGoBack(context: BackContext): boolean {
    if (context.working) {
        return false;
    }
    if (context.history.page === 'create' && context.step !== 'setup') {
        return true;
    }
    return context.history.stack.length > 0 || context.history.page !== 'home';
}
