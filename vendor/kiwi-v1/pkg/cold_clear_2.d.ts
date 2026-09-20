/* tslint:disable */
/* eslint-disable */

export class WasmBot {
    free(): void;
    [Symbol.dispose](): void;
    capabilities_json(): string;
    constructor();
    new_piece(piece: string): void;
    /**
     * Compatibility API: infer hold from piece type. Replays should use the
     * explicit API below to distinguish holding identical current/NEXT pieces.
     */
    play_json(placement_json: string): void;
    play_with_hold_json(placement_json: string, use_hold: boolean): void;
    player_state_json(): string;
    preview_refill_needed(): number;
    reset_stats(): void;
    start(start_json: string): void;
    /**
     * Tetrp review entrypoint. Public attack rules are transported explicitly
     * instead of inheriting the legacy base-0 defaults.
     */
    start_tetrp(start_json: string, rules_json: string, hold_locked: boolean): void;
    stats_json(): string;
    suggest_json(): string;
    /**
     * Compatibility API using CC2 work iterations. Product review code should
     * use think_nodes() so native and WASM use the same evaluator-node budget.
     */
    think(iterations: number): bigint;
    /**
     * Hard evaluator-node budget, matching H14's compute unit. Search may
     * return fewer nodes only if the current graph has no further work.
     */
    think_nodes(node_budget: number): bigint;
}

/**
 * Pending-aware, snapshot-only search across ten hypothetical hole scenarios.
 * Returns the timing/hole assumptions alongside suggestions, never a claim of
 * exact future replay simulation.
 */
export function analyze_pending_json(input_json: string): string;

/**
 * Snapshot-only exhibition helper. Keeps the normal review API unchanged while
 * allowing a visualization harness to compare the scored profile with the
 * corrected legacy evaluator under the same visible state and hard node budget.
 */
export function analyze_pending_profile_json(input_json: string, profile: string): string;

export function analyze_snapshot_json(text: string): string;

/**
 * Replay diagnostics at a fresh-spawn decision boundary. Counts and attack
 * packets can be compared against independently reconstructed replay locks.
 */
export function check_replay_lock_json(input_json: string): string;

/**
 * Diagnostic normal-cancel transition only. No board prediction, activation
 * forecast or opening double-cancel is implied by this API.
 */
export function preview_garbage_one_to_one(queue_json: string, attack: number, cleared_lines: number, cap: number): string;

export function snapshot_capabilities_json(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmbot_free: (a: number, b: number) => void;
    readonly analyze_pending_json: (a: number, b: number) => [number, number, number, number];
    readonly analyze_pending_profile_json: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly analyze_snapshot_json: (a: number, b: number) => [number, number, number, number];
    readonly check_replay_lock_json: (a: number, b: number) => [number, number, number, number];
    readonly preview_garbage_one_to_one: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly snapshot_capabilities_json: () => [number, number];
    readonly wasmbot_capabilities_json: (a: number) => [number, number, number, number];
    readonly wasmbot_new: () => number;
    readonly wasmbot_new_piece: (a: number, b: number, c: number) => [number, number];
    readonly wasmbot_play_json: (a: number, b: number, c: number) => [number, number];
    readonly wasmbot_play_with_hold_json: (a: number, b: number, c: number, d: number) => [number, number];
    readonly wasmbot_player_state_json: (a: number) => [number, number, number, number];
    readonly wasmbot_preview_refill_needed: (a: number) => [number, number, number];
    readonly wasmbot_reset_stats: (a: number) => void;
    readonly wasmbot_start: (a: number, b: number, c: number) => [number, number];
    readonly wasmbot_start_tetrp: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly wasmbot_stats_json: (a: number) => [number, number, number, number];
    readonly wasmbot_suggest_json: (a: number) => [number, number, number, number];
    readonly wasmbot_think: (a: number, b: number) => [bigint, number, number];
    readonly wasmbot_think_nodes: (a: number, b: number) => [bigint, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
