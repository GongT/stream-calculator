# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
pnpm install                  # Install dependencies (from repo root)
pnpm run build                # Full workspace build (TypeScript project references)
pnpm run watch                # Watch mode rebuild
pnpm run start                # Start sample stack (nodemon + bootstrap)
pnpm run clean                # Remove all build artifacts
```

**Package-level** (when you only need to rebuild one package):
```bash
pnpm -C <pkg-dir> run build
pnpm -C <pkg-dir> run clean
```

**Formatting/linting:**
```bash
pnpm exec biome check file.ts   # TypeScript
black file.py                   # Python
```

- Never manually invoke scripts prefixed with `pre` — they run automatically.
- Validate changes by running `pnpm run build` (no universal test command exists).
- Don't reformat unrelated files.

## Monorepo Layout

```
@core/*       Core framework (protocol, api, bootstrap, database, core runtime)
@adapter/*    Data adapters — sensors, transforms, outputs
@program/*    Application wiring, backend APIs, and frontend
```

Avoid modifying `@core/bootstrap` and `@core/custom-rig`. Do not move code across layers unless explicitly requested.

## Architecture

### Application & Adapter Host

The global `application` singleton (`@core/core/src/common/app-host.ts`) holds:
- `application.adapters` — `AdapterHost`: registry of adapters and nodes
- `application.api` — HTTP/WebSocket server (port `38083`)
- `application.logger`

Each `@adapter/*` package must define exactly **one** `Adapter` subclass (singleton) and any number of `Node` subclasses (per-instance). Both must be registered at module load time:

```typescript
application.adapters.registerAdapter(MyAdapter);
application.adapters.registerNode(MyNode);
```

### Node Types

Three node base classes in `@core/core/src/stream/`:

| Class | Direction | Usage |
|---|---|---|
| `SendorNode` | Output only | Data generators/sensors — call `emitData(frame, metadata?)` |
| `FinalizedNode` | Input only | Data sinks — override `process(frame, metadata?)` |
| `CalculatorNode` | Both | Transforms — receives and re-emits data |

Connect nodes with `node.pipeTo(downstream)` — only before initialization.

### Data Frames (`IDataFrame`)

- `content: TypedArray` — binary data (uint8/16/32, float32/64, int8/16/32)
- `timestamp: TimestampT` — **microseconds**, start of first sample
- `rate: number` — samples per second (max 1,000,000)
- `functionNumber?: number` — user-defined multiplex code
- `metadata?: any` — pass-through, do not modify without instruction
- `flow: string[]` — per-hop trace (auto-managed)

Frames may have gaps or overlaps; use the `TimeAlign` adapter if contiguous input is required. Nodes may assume their input is valid (no overlap/gap).

### Startup Sequence

Bootstrap (`@core/bootstrap`) loads program packages, activates adapters and nodes (5 s timeout per node), then starts the HTTP/WebSocket server on `38083`.

```bash
# start expands to approximately:
node ./@core/bootstrap/lib/main.js \
  --program @program/sample-app \
  --backend @program/sample-management \
  --frontend @program/example-website
```

## Conventions

### Language & Locale
- **Code**: English only.
- **Comments, logs, user-facing messages**: Chinese (except well-known technical terms like "API", "Node.js", "TypeScript").
- No other languages.

### Timestamps
- Always **microseconds** — use `TimestampT` (not bare `number`) in TypeScript.
- Create: `Number(process.hrtime.bigint() / 1_000n)` (TS) / `time.time_ns() // 1_000` (Python).
- Fractional values are valid during calculation; validate before sending over the network.
- If you encounter code using milliseconds, it is a bug — flag it.

### Imports
- TypeScript local imports must include `.js` extension.
- Cross-package: import from the package entry point only, never internal paths.
- Intra-package: relative paths only.

### Generated Files
- `*.generated.*` and `autoindex.ts` — do not hand-edit.
- `lib/` folders — build output, ignored.

### Compatibility
- Private codebase — no backward compatibility or public API stability required.
- Use latest language/runtime features freely.

## Protocol Reference

Binary wire format defined in `@core/protocol`. Frame structure (big-endian, timestamps in µs):
- START marker / version / sender / action / metadata / payload / END marker
- Type encoding: `u` (unsigned), `s` (signed), `f` (float); bit depths 8/16/32

Full format: see `README.md`.
