// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

/** Subset of JSON Schema used by backend configuration_schema documents. */
export interface JsonSchema {
    type?: string | string[];
    title?: string;
    description?: string;
    default?: unknown;
    const?: unknown;
    enum?: unknown[];
    enumNames?: unknown[];
    oneOf?: JsonSchema[];
    anyOf?: JsonSchema[];
    allOf?: JsonSchema[];
    not?: JsonSchema;
    properties?: Record<string, JsonSchema | boolean>;
    required?: string[];
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
    if?: JsonSchema;
    then?: JsonSchema;
    else?: JsonSchema;
}

export type ConfigData = Record<string, unknown>;

export interface ConfigChoice {
    value: string;
    label: string;
}

export interface ConfigField {
    key: string;
    label: string;
    description: string | null;
    kind: 'integer' | 'number' | 'boolean' | 'string' | 'enum' | 'unsupported';
    required: boolean;
    value: string;
    choices: ConfigChoice[];
    min: number | null;
    max: number | null;
    step: number | null;
}

export interface ConfigCheck {
    ok: boolean;
    errors: string[];
    data: ConfigData;
    shots: number | null;
}

const CONTEXT_KEYS = new Set(['input_format']);

export function asSchema(value: unknown): JsonSchema {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as JsonSchema;
}

/** Seed a form from schema defaults. Context keys such as input_format are omitted. */
export function initialConfig(
    schema: JsonSchema | null | undefined,
): ConfigData {
    const values: ConfigData = {};
    for (const [key, prop] of Object.entries(properties(schema))) {
        if (CONTEXT_KEYS.has(key) || typeof prop === 'boolean') {
            continue;
        }
        if (prop.default !== undefined) {
            values[key] = prop.default;
        } else if (prop.type === 'boolean') {
            values[key] = false;
        } else if (prop.type === 'string') {
            values[key] = '';
        }
    }
    return values;
}

/** Schema defaults, with a saved form overlaid on known properties. */
export function mergeConfig(
    schema: JsonSchema | null | undefined,
    stored: ConfigData | undefined,
): ConfigData {
    const merged = initialConfig(schema);
    if (!stored) {
        return merged;
    }
    const props = properties(schema);
    for (const [key, value] of Object.entries(stored)) {
        if (key in props && !CONTEXT_KEYS.has(key)) {
            merged[key] = value;
        }
    }
    return merged;
}

export function configFields(
    schema: JsonSchema | null | undefined,
    data: ConfigData | undefined,
): ConfigField[] {
    const evaluated = withContext(schema, data);
    const applicability = fieldApplicability(schema, evaluated);
    const fields: ConfigField[] = [];
    for (const [key, prop] of Object.entries(properties(schema))) {
        if (!applicability.visible.has(key) || typeof prop === 'boolean') {
            continue;
        }
        const choices = enumChoices(prop);
        const kind = fieldKind(prop, choices);
        fields.push({
            key,
            label: fieldLabel(prop, key),
            description: fieldDescription(prop),
            kind,
            required: applicability.required.has(key),
            value: displayValue(data?.[key], kind),
            choices,
            min: typeof prop.minimum === 'number' ? prop.minimum : null,
            max: typeof prop.maximum === 'number' ? prop.maximum : null,
            step:
                typeof prop.multipleOf === 'number' && prop.multipleOf > 0
                    ? prop.multipleOf
                    : prop.type === 'integer'
                      ? 1
                      : null,
        });
    }
    return fields;
}

/** Apply one panel edit. Empty numbers are removed so a required check can fire. */
export function applyConfigInput(
    schema: JsonSchema | null | undefined,
    data: ConfigData,
    key: string,
    raw: string,
): ConfigData {
    const prop = properties(schema)[key];
    if (!prop || typeof prop === 'boolean' || CONTEXT_KEYS.has(key)) {
        return data;
    }
    const next: ConfigData = { ...data };
    if (prop.type === 'boolean') {
        next[key] = raw === 'true';
        return next;
    }
    if (prop.type === 'integer' || prop.type === 'number') {
        const trimmed = raw.trim();
        if (!trimmed) {
            delete next[key];
            return next;
        }
        const value = Number(trimmed);
        next[key] = Number.isNaN(value) ? trimmed : value;
        return next;
    }
    next[key] = raw;
    return next;
}

/**
 * Validate the form against the schema, then return the object to send.
 * input_format is injected as qasm for conditional rules and is not stored.
 */
export function checkConfiguration(
    schema: JsonSchema | null | undefined,
    data: ConfigData | undefined,
): ConfigCheck {
    const evaluated = withContext(schema, data);
    const errors = validate(schema, evaluated);
    const clean = sanitize(schema, evaluated);
    for (const key of CONTEXT_KEYS) {
        delete clean[key];
    }
    const shots = clean.shots;
    return {
        ok: errors.length === 0,
        errors,
        data: clean,
        shots:
            typeof shots === 'number' && Number.isInteger(shots) ? shots : null,
    };
}

function withContext(
    schema: JsonSchema | null | undefined,
    data: ConfigData | undefined,
): ConfigData {
    const out: ConfigData = { ...(data ?? {}) };
    const props = properties(schema);
    if ('input_format' in props) {
        out.input_format = 'qasm';
    }
    return out;
}

function properties(
    schema: JsonSchema | null | undefined,
): Record<string, JsonSchema | boolean> {
    if (
        !schema ||
        !schema.properties ||
        typeof schema.properties !== 'object'
    ) {
        return {};
    }
    return schema.properties;
}

function fieldKind(
    prop: JsonSchema,
    choices: ConfigChoice[],
): ConfigField['kind'] {
    if (choices.length > 0) {
        return 'enum';
    }
    if (prop.type === 'integer') {
        return 'integer';
    }
    if (prop.type === 'number') {
        return 'number';
    }
    if (prop.type === 'boolean') {
        return 'boolean';
    }
    if (prop.type === 'string') {
        return 'string';
    }
    return 'unsupported';
}

function fieldLabel(prop: JsonSchema, key: string): string {
    return typeof prop.title === 'string' && prop.title.trim()
        ? prop.title.trim()
        : key;
}

function fieldDescription(prop: JsonSchema): string | null {
    return typeof prop.description === 'string' && prop.description.trim()
        ? prop.description.trim()
        : null;
}

function enumChoices(prop: JsonSchema): ConfigChoice[] {
    const alts = Array.isArray(prop.oneOf)
        ? prop.oneOf
        : Array.isArray(prop.anyOf)
          ? prop.anyOf
          : [];
    const fromAlts: ConfigChoice[] = [];
    for (const item of alts) {
        if (!item || typeof item !== 'object' || !('const' in item)) {
            continue;
        }
        fromAlts.push({
            value: String(item.const),
            label:
                typeof item.title === 'string' && item.title.trim()
                    ? item.title.trim()
                    : String(item.const),
        });
    }
    if (fromAlts.length > 0) {
        return fromAlts;
    }
    if (!Array.isArray(prop.enum) || prop.enum.length === 0) {
        return [];
    }
    const names = Array.isArray(prop.enumNames) ? prop.enumNames : [];
    return prop.enum.map((value, index) => ({
        value: String(value),
        label:
            typeof names[index] === 'string' && String(names[index]).trim()
                ? String(names[index]).trim()
                : String(value),
    }));
}

function displayValue(value: unknown, kind: ConfigField['kind']): string {
    if (kind === 'boolean') {
        return value === true ? 'true' : 'false';
    }
    if (value === undefined || value === null) {
        return '';
    }
    return String(value);
}

interface Applicability {
    visible: Set<string>;
    required: Set<string>;
}

function fieldApplicability(
    schema: JsonSchema | null | undefined,
    data: ConfigData | undefined,
): Applicability {
    const props = properties(schema);
    const keys = Object.keys(props).filter((key) => !CONTEXT_KEYS.has(key));
    const visible = new Set(keys);
    const required = new Set<string>();
    if (schema && Array.isArray(schema.required)) {
        for (const key of schema.required) {
            if (visible.has(key)) {
                required.add(key);
            }
        }
    }
    const value = data ?? {};
    for (const rule of conditionalRules(schema)) {
        const matches = matchesCondition(rule.ifSchema, value);
        const thenRequired = requiredKeys(rule.thenSchema);
        const elseRequired = requiredKeys(rule.elseSchema);
        const thenForbidden = forbiddenKeys(rule.thenSchema);
        const elseForbidden = forbiddenKeys(rule.elseSchema);
        if (matches) {
            for (const key of thenRequired) {
                if (visible.has(key)) {
                    required.add(key);
                }
            }
            for (const key of thenForbidden) {
                hide(visible, required, key);
            }
            for (const key of elseForbidden) {
                if (key in props) {
                    visible.add(key);
                }
            }
        } else {
            for (const key of elseRequired) {
                if (visible.has(key)) {
                    required.add(key);
                }
            }
            for (const key of elseForbidden) {
                hide(visible, required, key);
            }
            for (const key of thenForbidden) {
                if (key in props) {
                    visible.add(key);
                }
            }
            for (const key of thenRequired) {
                hide(visible, required, key);
            }
        }
    }
    for (const key of keys) {
        if (!visible.has(key)) {
            required.delete(key);
        }
    }
    return { visible, required };
}

function hide(visible: Set<string>, required: Set<string>, key: string): void {
    visible.delete(key);
    required.delete(key);
}

interface ConditionalRule {
    ifSchema: JsonSchema;
    thenSchema?: JsonSchema;
    elseSchema?: JsonSchema;
}

function conditionalRules(
    schema: JsonSchema | null | undefined,
): ConditionalRule[] {
    if (!schema || typeof schema !== 'object') {
        return [];
    }
    const rules: ConditionalRule[] = [];
    if (schema.if && typeof schema.if === 'object') {
        rules.push({
            ifSchema: schema.if,
            thenSchema: schema.then,
            elseSchema: schema.else,
        });
    }
    if (Array.isArray(schema.allOf)) {
        for (const sub of schema.allOf) {
            if (sub && typeof sub === 'object') {
                rules.push(...conditionalRules(sub));
            }
        }
    }
    return rules;
}

function requiredKeys(branch: JsonSchema | undefined): string[] {
    if (!branch || typeof branch !== 'object') {
        return [];
    }
    const keys = Array.isArray(branch.required) ? [...branch.required] : [];
    if (Array.isArray(branch.allOf)) {
        for (const sub of branch.allOf) {
            keys.push(...requiredKeys(sub));
        }
    }
    return keys;
}

function forbiddenKeys(branch: JsonSchema | undefined): string[] {
    if (!branch || typeof branch !== 'object') {
        return [];
    }
    const keys: string[] = [];
    const blocked = branch.not;
    if (blocked && typeof blocked === 'object') {
        if (Array.isArray(blocked.required)) {
            keys.push(...blocked.required);
        }
        if (blocked.properties && typeof blocked.properties === 'object') {
            keys.push(...Object.keys(blocked.properties));
        }
    }
    if (branch.properties && typeof branch.properties === 'object') {
        for (const [key, sub] of Object.entries(branch.properties)) {
            if (sub === false) {
                keys.push(key);
            }
        }
    }
    if (Array.isArray(branch.allOf)) {
        for (const sub of branch.allOf) {
            keys.push(...forbiddenKeys(sub));
        }
    }
    return keys;
}

function matchesCondition(
    condition: JsonSchema | undefined,
    data: unknown,
): boolean {
    if (!condition || typeof condition !== 'object') {
        return true;
    }
    const value =
        data && typeof data === 'object' && !Array.isArray(data)
            ? (data as ConfigData)
            : {};
    if (Array.isArray(condition.required)) {
        for (const key of condition.required) {
            if (value[key] === undefined || value[key] === null) {
                return false;
            }
        }
    }
    if ('const' in condition) {
        return same(data, condition.const);
    }
    if (Array.isArray(condition.enum)) {
        return condition.enum.some((item) => same(data, item));
    }
    if (condition.type && !matchesType(data, condition.type)) {
        return false;
    }
    if (condition.properties && typeof condition.properties === 'object') {
        for (const [key, sub] of Object.entries(condition.properties)) {
            if (typeof sub === 'boolean') {
                continue;
            }
            if (!(key in value) || value[key] === undefined) {
                if (condition.required?.includes(key)) {
                    return false;
                }
                continue;
            }
            if (!matchesCondition(sub, value[key])) {
                return false;
            }
        }
    }
    if (Array.isArray(condition.allOf)) {
        return condition.allOf.every((sub) => matchesCondition(sub, data));
    }
    if (Array.isArray(condition.anyOf)) {
        return condition.anyOf.some((sub) => matchesCondition(sub, data));
    }
    if (condition.not) {
        return !matchesCondition(condition.not, data);
    }
    return true;
}

function matchesType(value: unknown, type: string | string[]): boolean {
    const types = Array.isArray(type) ? type : [type];
    return types.some((item) => {
        switch (item) {
            case 'boolean':
                return typeof value === 'boolean';
            case 'string':
                return typeof value === 'string';
            case 'integer':
                return typeof value === 'number' && Number.isInteger(value);
            case 'number':
                return typeof value === 'number' && !Number.isNaN(value);
            case 'array':
                return Array.isArray(value);
            case 'object':
                return (
                    value !== null &&
                    typeof value === 'object' &&
                    !Array.isArray(value)
                );
            case 'null':
                return value === null;
            default:
                return true;
        }
    });
}

function same(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
        return true;
    }
    return JSON.stringify(a) === JSON.stringify(b);
}

function isEmpty(value: unknown): boolean {
    if (value === undefined || value === null) {
        return true;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return true;
    }
    if (typeof value === 'number' && Number.isNaN(value)) {
        return true;
    }
    return false;
}

function validate(
    schema: JsonSchema | null | undefined,
    data: ConfigData,
): string[] {
    const errors: string[] = [];
    const applicability = fieldApplicability(schema, data);
    for (const [key, prop] of Object.entries(properties(schema))) {
        if (!applicability.visible.has(key) || typeof prop === 'boolean') {
            continue;
        }
        const label = fieldLabel(prop, key);
        const value = data[key];
        if (fieldKind(prop, enumChoices(prop)) === 'unsupported') {
            errors.push(`${label} cannot be set in this editor.`);
            continue;
        }
        if (applicability.required.has(key) && isEmpty(value)) {
            errors.push(`${label} is required`);
            continue;
        }
        if (isEmpty(value)) {
            continue;
        }
        const choices = enumChoices(prop);
        if (
            choices.length > 0 &&
            !choices.some((item) => item.value === String(value))
        ) {
            errors.push(
                `${label} must be one of: ${choices.map((item) => item.label).join(', ')}`,
            );
        }
        if (prop.type === 'integer' || prop.type === 'number') {
            if (typeof value !== 'number' || Number.isNaN(value)) {
                errors.push(`${label} must be a number`);
                continue;
            }
            if (prop.type === 'integer' && !Number.isInteger(value)) {
                errors.push(`${label} must be an integer`);
            }
            if (typeof prop.minimum === 'number' && value < prop.minimum) {
                errors.push(`${label} must be at least ${prop.minimum}`);
            }
            if (
                typeof prop.exclusiveMinimum === 'number' &&
                value <= prop.exclusiveMinimum
            ) {
                errors.push(
                    `${label} must be greater than ${prop.exclusiveMinimum}`,
                );
            }
            if (typeof prop.maximum === 'number' && value > prop.maximum) {
                errors.push(`${label} must be at most ${prop.maximum}`);
            }
            if (
                typeof prop.exclusiveMaximum === 'number' &&
                value >= prop.exclusiveMaximum
            ) {
                errors.push(
                    `${label} must be less than ${prop.exclusiveMaximum}`,
                );
            }
        } else if (prop.type === 'string' && typeof value !== 'string') {
            errors.push(`${label} must be a string`);
        } else if (prop.type === 'boolean' && typeof value !== 'boolean') {
            errors.push(`${label} must be a boolean`);
        }
    }
    return errors;
}

function sanitize(
    schema: JsonSchema | null | undefined,
    data: ConfigData,
): ConfigData {
    const applicability = fieldApplicability(schema, data);
    const result: ConfigData = {};
    for (const [key, prop] of Object.entries(properties(schema))) {
        if (!applicability.visible.has(key) || typeof prop === 'boolean') {
            continue;
        }
        if (CONTEXT_KEYS.has(key)) {
            continue;
        }
        const value = data[key];
        if (isEmpty(value)) {
            continue;
        }
        result[key] = value;
    }
    return result;
}
