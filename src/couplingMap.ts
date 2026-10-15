// Copyright 2026 Open Quantum / Quantum Rings
// SPDX-License-Identifier: Apache-2.0

export type CouplingEdge = [number, number];

export interface CouplingNode {
    id: number;
    x: number;
    y: number;
    enabled: boolean;
    /** Neighbor count on the layout graph. The website uses this for node color. */
    degree: number;
}

export interface CouplingLayout {
    nodes: CouplingNode[];
    edges: CouplingEdge[];
    directed: boolean;
    dense: boolean;
    /** The device published an enabled set, so hover can say enabled or idle. */
    showEnabled: boolean;
}

/** Same density rule as the website coupling graph. */
export function isDenseCouplingMap(
    nodeCount: number,
    edgeCount: number,
): boolean {
    if (nodeCount < 3) {
        return false;
    }
    const maxUndirected = (nodeCount * (nodeCount - 1)) / 2;
    if (maxUndirected <= 0) {
        return false;
    }
    const density = edgeCount / maxUndirected;
    const averageDegree = (2 * edgeCount) / nodeCount;
    return density >= 0.45 || averageDegree >= 8;
}

export function normalizeCouplingEdges(
    raw: number[][],
    directed: boolean,
): CouplingEdge[] {
    const seen = new Set<string>();
    const edges: CouplingEdge[] = [];
    for (const edge of raw) {
        if (!Array.isArray(edge) || edge.length < 2) {
            continue;
        }
        const a = Number(edge[0]);
        const b = Number(edge[1]);
        if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
            continue;
        }
        const pair: CouplingEdge = directed ? [a, b] : a < b ? [a, b] : [b, a];
        const key = `${pair[0]},${pair[1]}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        edges.push(pair);
    }
    edges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
    return edges;
}

export function nodesFromEdges(groups: CouplingEdge[][]): number[] {
    const ids = new Set<number>();
    for (const edges of groups) {
        for (const [a, b] of edges) {
            ids.add(a);
            ids.add(b);
        }
    }
    return [...ids].sort((left, right) => left - right);
}

type Point = { x: number; y: number };

/**
 * Same placement as the website coupling graph.
 * Sparse maps use classical MDS of shortest-path distances, then stress refinement.
 * Dense maps use a circle, which is what the website asks cytoscape to draw.
 */
export function layoutCoupling(
    drawn: CouplingEdge[],
    layoutEdges: CouplingEdge[],
    enabledIndices: number[] | null,
    directed: boolean,
): CouplingLayout {
    const geometry = nodesFromEdges([drawn, layoutEdges]);
    const enabled =
        enabledIndices && enabledIndices.length > 0
            ? new Set(enabledIndices)
            : null;
    const dense = isDenseCouplingMap(geometry.length, drawn.length);
    const geometryEdges = undirected(
        layoutEdges.length > 0 ? layoutEdges : drawn,
    );
    const positions = dense
        ? circlePositions(geometry)
        : layoutPositions(geometry, geometryEdges, {
              idealEdge: geometry.length >= 40 ? 58 : 64,
              iterations: geometry.length >= 40 ? 360 : 180,
          });
    const degrees = adjacencyFromEdges(geometryEdges);
    return {
        directed,
        dense,
        showEnabled: enabled != null,
        edges: drawn,
        nodes: geometry.map((id) => ({
            id,
            x: round(positions[id]?.x ?? 0),
            y: round(positions[id]?.y ?? 0),
            enabled: enabled ? enabled.has(id) : true,
            degree: degrees.get(id)?.length ?? 0,
        })),
    };
}

/** High-quality sparse layout from the website's couplingMapLayout. */
export function layoutPositions(
    ids: number[],
    edges: CouplingEdge[],
    options: { idealEdge?: number; iterations?: number } = {},
): Record<number, Point> {
    const idealEdge = options.idealEdge ?? 64;
    const iterations = options.iterations ?? 320;
    const n = ids.length;
    const out: Record<number, Point> = {};
    if (n === 0) {
        return out;
    }
    if (n === 1) {
        out[ids[0]] = { x: 0, y: 0 };
        return out;
    }
    const dist = allPairsDistance(ids, edges);
    let pts = orientLandscape(ids, classicalMds(dist));
    const seedLen = median(adjacentLengths(ids, edges, pts));
    pts = scalePoints(pts, 1 / (seedLen || 1));
    pts = stressRefine(
        pts,
        dist,
        n >= 40 ? iterations : Math.min(iterations, 180),
    );
    pts = alignEdgesToAxes(ids, edges, pts);
    pts = pickOrientation(ids, pts);
    const med = median(adjacentLengths(ids, edges, pts)) || 1;
    pts = scalePoints(pts, idealEdge / med);
    for (let i = 0; i < n; i += 1) {
        out[ids[i]] = pts[i];
    }
    return out;
}

function undirected(edges: CouplingEdge[]): CouplingEdge[] {
    return normalizeCouplingEdges(edges, false);
}

function circlePositions(ids: number[]): Record<number, Point> {
    const out: Record<number, Point> = {};
    const count = ids.length;
    if (count === 0) {
        return out;
    }
    if (count === 1) {
        out[ids[0]] = { x: 0, y: 0 };
        return out;
    }
    const radius = (count * 64) / (2 * Math.PI);
    ids.forEach((id, index) => {
        const angle = (2 * Math.PI * index) / count - Math.PI / 2;
        out[id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    return out;
}

function adjacencyFromEdges(edges: CouplingEdge[]): Map<number, number[]> {
    const adj = new Map<number, number[]>();
    const add = (from: number, to: number) => {
        const list = adj.get(from) ?? [];
        list.push(to);
        adj.set(from, list);
    };
    for (const [a, b] of edges) {
        add(a, b);
        add(b, a);
    }
    for (const [id, list] of adj) {
        adj.set(
            id,
            [...new Set(list)].sort((left, right) => left - right),
        );
    }
    return adj;
}

function allPairsDistance(ids: number[], edges: CouplingEdge[]): number[][] {
    const idx = new Map(ids.map((id, i) => [id, i]));
    const n = ids.length;
    const adj = adjacencyFromEdges(edges);
    const inf = n + 2;
    const dist = Array.from({ length: n }, () => Array(n).fill(inf));
    for (let i = 0; i < n; i += 1) {
        dist[i][i] = 0;
    }
    for (const id of ids) {
        const si = idx.get(id);
        if (si === undefined) {
            continue;
        }
        const seen = new Set<number>([id]);
        let frontier = [id];
        let d = 0;
        while (frontier.length) {
            const next: number[] = [];
            d += 1;
            for (const u of frontier) {
                for (const v of adj.get(u) ?? []) {
                    if (seen.has(v)) {
                        continue;
                    }
                    const vi = idx.get(v);
                    if (vi === undefined) {
                        continue;
                    }
                    seen.add(v);
                    dist[si][vi] = d;
                    next.push(v);
                }
            }
            frontier = next;
        }
    }
    return dist;
}

function matVec(m: number[][], v: number[]): number[] {
    return m.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
}

function vectorNorm(v: number[]): number {
    return Math.sqrt(v.reduce((s, a) => s + a * a, 0));
}

function powerIteration(m: number[][], exclude?: number[]): number[] {
    const n = m.length;
    let v = Array.from({ length: n }, (_, i) => Math.sin((i + 1) * 1.7) || 0.1);
    for (let k = 0; k < 80; k += 1) {
        if (exclude && exclude.length === n) {
            const eNorm = vectorNorm(exclude) || 1;
            const dot = v.reduce((s, a, i) => s + a * exclude[i], 0) / eNorm;
            v = v.map((a, i) => a - dot * (exclude[i] / eNorm));
        }
        const w = matVec(m, v);
        const wNorm = vectorNorm(w) || 1;
        v = w.map((a) => a / wNorm);
    }
    return v;
}

function classicalMds(dist: number[][]): Point[] {
    const n = dist.length;
    const d2 = dist.map((row) => row.map((d) => d * d));
    const rowMean = d2.map((row) => row.reduce((s, a) => s + a, 0) / n);
    const colMean = Array(n).fill(0);
    for (let j = 0; j < n; j += 1) {
        let s = 0;
        for (let i = 0; i < n; i += 1) {
            s += d2[i][j];
        }
        colMean[j] = s / n;
    }
    const mean = rowMean.reduce((s, a) => s + a, 0) / n;
    const B = d2.map((row, i) =>
        row.map((val, j) => -0.5 * (val - rowMean[i] - colMean[j] + mean)),
    );
    const e1 = powerIteration(B);
    const e2 = n >= 3 ? powerIteration(B, e1) : Array(n).fill(0);
    return Array.from({ length: n }, (_, i) => ({ x: e1[i], y: e2[i] }));
}

function orientLandscape(ids: number[], pts: Point[]): Point[] {
    const n = pts.length;
    if (n === 0) {
        return [];
    }
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    let out = pts.map((p) => ({ x: p.x - mx, y: p.y - my }));
    const xx = out.reduce((s, p) => s + p.x * p.x, 0);
    const xy = out.reduce((s, p) => s + p.x * p.y, 0);
    const yy = out.reduce((s, p) => s + p.y * p.y, 0);
    const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
    const c = Math.cos(-theta);
    const s = Math.sin(-theta);
    out = out.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
    const xs = out.map((p) => p.x);
    const ys = out.map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;
    if (spanY > spanX) {
        out = out.map((p) => ({ x: p.y, y: -p.x }));
    }
    const minId = Math.min(...ids);
    const maxId = Math.max(...ids);
    const iMin = ids.indexOf(minId);
    const iMax = ids.indexOf(maxId);
    if (out[iMax].x < out[iMin].x) {
        out = out.map((p) => ({ x: -p.x, y: p.y }));
    }
    return out;
}

function median(values: number[]): number {
    if (values.length === 0) {
        return 1;
    }
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 1;
}

function adjacentLengths(
    ids: number[],
    edges: CouplingEdge[],
    pts: Point[],
): number[] {
    const idx = new Map(ids.map((id, i) => [id, i]));
    const lengths: number[] = [];
    for (const [a, b] of edges) {
        const i = idx.get(a);
        const j = idx.get(b);
        if (i === undefined || j === undefined) {
            continue;
        }
        lengths.push(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    }
    return lengths;
}

function scalePoints(pts: Point[], factor: number): Point[] {
    return pts.map((p) => ({ x: p.x * factor, y: p.y * factor }));
}

function alignEdgesToAxes(
    ids: number[],
    edges: CouplingEdge[],
    pts: Point[],
): Point[] {
    const idx = new Map(ids.map((id, i) => [id, i]));
    const mods: number[] = [];
    for (const [a, b] of edges) {
        const i = idx.get(a);
        const j = idx.get(b);
        if (i === undefined || j === undefined) {
            continue;
        }
        const ang = Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x);
        const quarter = Math.PI / 2;
        mods.push(((ang % quarter) + quarter) % quarter);
    }
    if (mods.length === 0) {
        return pts.map((p) => ({ ...p }));
    }
    const sin = mods.reduce((sum, m) => sum + Math.sin(4 * m), 0);
    const cos = mods.reduce((sum, m) => sum + Math.cos(4 * m), 0);
    const theta = -Math.atan2(sin, cos) / 4;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return pts.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

function pickOrientation(ids: number[], pts: Point[]): Point[] {
    if (pts.length === 0) {
        return [];
    }
    const variants = [
        pts,
        pts.map((p) => ({ x: -p.y, y: p.x })),
        pts.map((p) => ({ x: -p.x, y: -p.y })),
        pts.map((p) => ({ x: p.y, y: -p.x })),
    ];
    const minId = Math.min(...ids);
    const maxId = Math.max(...ids);
    const iMin = ids.indexOf(minId);
    const iMax = ids.indexOf(maxId);
    const scored = variants.map((v) => {
        const xs = v.map((p) => p.x);
        const ys = v.map((p) => p.y);
        const spanX = Math.max(...xs) - Math.min(...xs) || 1;
        const spanY = Math.max(...ys) - Math.min(...ys) || 1;
        const sortedX = [...xs].sort((a, b) => a - b);
        const right = Math.max(...xs) - sortedX[Math.floor(xs.length * 0.88)];
        return {
            v,
            landscape: spanX + 1e-6 >= spanY * 0.92,
            right,
            minLeft: v[iMax].x >= v[iMin].x ? 0 : 1,
        };
    });
    scored.sort((a, b) => {
        if (a.landscape !== b.landscape) {
            return a.landscape ? -1 : 1;
        }
        const slack = Math.max(0.35, 0.08 * Math.max(a.right, b.right, 1));
        if (Math.abs(a.right - b.right) > slack) {
            return a.right - b.right;
        }
        return a.minLeft - b.minLeft;
    });
    return scored[0].v;
}

function stressRefine(
    pts: Point[],
    dist: number[][],
    iterations = 320,
): Point[] {
    const n = pts.length;
    if (n < 2) {
        return pts.map((p) => ({ ...p }));
    }
    const weight = dist.map((row) => row.map((d) => (d > 0 ? 1 / (d * d) : 0)));
    let pos = pts.map((p) => ({ ...p }));
    let lr = 0.07;
    for (let iter = 0; iter < iterations; iter += 1) {
        const grad = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                let dx = pos[i].x - pos[j].x;
                let dy = pos[i].y - pos[j].y;
                let len = Math.hypot(dx, dy);
                if (len < 1e-8) {
                    const jitter = 0.01 * (1 + ((i * 13 + j) % 7));
                    dx = jitter;
                    dy = jitter * 0.6;
                    len = Math.hypot(dx, dy);
                }
                const target = dist[i][j];
                const w = weight[i][j];
                const pull = (w * (len - target)) / len;
                let fx = pull * dx;
                let fy = pull * dy;
                if (len < 0.62) {
                    const push = (0.62 - len) / len;
                    fx -= push * dx * 0.35;
                    fy -= push * dy * 0.35;
                }
                grad[i].x += fx;
                grad[i].y += fy;
                grad[j].x -= fx;
                grad[j].y -= fy;
            }
        }
        pos = pos.map((p, i) => ({
            x: p.x - lr * grad[i].x,
            y: p.y - lr * grad[i].y,
        }));
        if (iter % 40 === 39) {
            lr *= 0.86;
        }
    }
    return pos;
}

function round(value: number): number {
    return Math.round(value * 10) / 10;
}

function degreeFill(
    degree: number,
    maxDeg: number,
    active: boolean,
): {
    light: string;
    dark: string;
} {
    if (!active) {
        return { light: '#cbd5e1', dark: '#334155' };
    }
    const t =
        maxDeg <= 1
            ? 0.45
            : Math.min(1, Math.max(0, (degree - 1) / Math.max(1, maxDeg - 1)));
    return {
        light: mixHex('#047857', '#34d399', t),
        dark: mixHex('#0f766e', '#6ee7b7', t),
    };
}

function mixHex(a: string, b: string, t: number): string {
    const parse = (hex: string) => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    const ch = (x: number, y: number) =>
        Math.round(x + (y - x) * t)
            .toString(16)
            .padStart(2, '0');
    return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

export function couplingSvg(layout: CouplingLayout): string {
    if (layout.nodes.length === 0 || layout.edges.length === 0) {
        return '';
    }
    const radius = 9;
    const font = 8;
    const maxDeg = Math.max(1, ...layout.nodes.map((node) => node.degree));
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    const lines = layout.edges
        .map(([a, b]) => {
            const from = byId.get(a);
            const to = byId.get(b);
            if (!from || !to) {
                return '';
            }
            const marker = layout.directed
                ? ' marker-end="url(#oq-arrow)"'
                : '';
            return `<line class="edge" data-a="${a}" data-b="${b}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"${marker} />`;
        })
        .join('');
    const nodes = layout.nodes
        .map((node) => {
            const fill = degreeFill(node.degree, maxDeg, node.enabled);
            const on = node.enabled ? ' on' : '';
            return `<g class="qubit" data-id="${node.id}" data-on="${node.enabled ? '1' : '0'}"><circle class="node${on}" cx="${node.x}" cy="${node.y}" r="${radius}" style="--node-light:${fill.light};--node-dark:${fill.dark}" /><text class="label" x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="central" font-size="${font}">${node.id}</text></g>`;
        })
        .join('');
    const marker = layout.directed
        ? '<defs><marker id="oq-arrow" viewBox="0 0 10 10" refX="12" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>'
        : '';
    const xs = layout.nodes.map((node) => node.x);
    const ys = layout.nodes.map((node) => node.y);
    const pad = 28;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const width = Math.max(40, Math.max(...xs) - Math.min(...xs) + pad * 2);
    const height = Math.max(40, Math.max(...ys) - Math.min(...ys) + pad * 2);
    return `<svg class="map" data-track="${layout.showEnabled ? '1' : '0'}" viewBox="${round(minX)} ${round(minY)} ${round(width)} ${round(height)}" role="img" aria-label="Coupling map">${marker}${lines}${nodes}</svg>`;
}
