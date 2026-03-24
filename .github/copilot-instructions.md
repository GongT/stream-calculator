# Copilot Workspace Instructions

## Scope
- This repository is a pnpm monorepo for real-time stream calculation and adapter composition.
- Follow existing package boundaries and avoid moving code across layers unless explicitly requested.

## Locale
- Must use Chinese for:
  - Comments and documentation.
  - User-facing messages (logs, errors, etc.).
  - Exception:
    - Wellknown technical terms, eg. "Internal Server Error".
    - Abbreviations and names, eg. "API", "Node.js", "TypeScript", "Python".
- Must use English for:
  - Code.
  - You must think in English.
- Only Chinese or English is allowed.

## Monorepo Layout
- `@core/*`: core logic.
- `@adapter/*`: data source, transform, and output adapters (nodes registered into adapter host).
- `@program/*`: backend wiring, API logic and frontend.

Any other folder at root level is going to be documentation or configuration.

## Architecture And Boundaries

#### File Structure
- Protocol types and wire format live in `@core/protocol`. It contains both network and in-memory data structure, all logic is related to serialization, deserialization, and validation of protocol data.
- You should avoid modifying `@core/bootstrap` and `@core/custom-rig`.

#### Main Architecture
- Each adapter package should define and register exactly one `Adapter` subclass.
- Each adapter can define and register many `Node` subclasses.
- Adapter is singleton, Node is per-instance.
- Register logic: Application -1:1-> Adapter Host (adapters) -1:N-> Adapter (nodes) -1:N-> Node.
- Instances is automatically managed by the framework, but classes is required to be registered by calling `registerAdapter` and `registerNode`.

#### Timestamps (and time spans)
- All timestamps and time spans are in microseconds (µs).
- In TypeScript:
  - It's a `TimestampT` (defined in `@core/protocol`). It is actually an alias of `number`, but everyone must use `TimestampT` instead of `number`.
  - Make new timestamp by `Number(process.hrtime.bigint() / 1_000n)`
- In Python:
  - It's an `int`, never be `datetime`.
  - Make new timestamp by `time.time_ns() // 1_000`
- Timestamps can be fractional in TypeScript, never implicitly convert them to integer when sending to network (check and throw error). But note using fraction is correct during calculation.

#### Streams
- Stream is virtual, a theoretically continuous stream of data. Physically, it is represented as a sequence of data frames, each frame contains a timestamp, a framerate, a function number and a data payload. Data payload normally is a typed array, but in some very special cases can be a object. Framerate and data type is consistent within a stream.
  - Timestamp represents the start time of the first value in the payload. Rounded down to microsecond, eg. the data may start at `1.001`µs, but the timestamp should be integer `1`.
  - Framerate will never larger than 1_000_000 (no more than 1 value per microsecond).
  - Function number is used by the user (and nodes), it may or may not be used as stream multiplexing.
  - Frames have a metadata field, you should not modify it without user instruction, but you can read and use it for your logic.
- You will see some generaters in this project, but they are all for testing. The actual data flow is comes from sensors, which are not part of this project.
- Each Node can have multiple stream passing in and out, then may have different data type and frame rate.
- The data may not contiguous, there can be gaps or overlaps between frames, this issue can be handled by the TimeAlign adapter if needed. Nodes can assume that the input stream is always valid and no overlap or gap. The user has the responsibility to use TimeAlign adapter.


## Build And Run
- Install dependencies from repo root: `pnpm install`.
- Workspace build: `pnpm run build`.
- Watch mode: `pnpm run watch`.
- Start sample stack: `pnpm run start`.
- Clean all packages: `pnpm run clean`.
- Reformat code:
  - TypeScript: `pnpm exec biome check file.ts`.
  - Python: `black file.py`.

## Package-Level Workflow
- Most packages use TypeScript project references and have:
  - `pnpm -C <pkg dir> run build`
  - `pnpm -C <pkg dir> run clean`
- Don't run scripts starting with `pre`, they automatically execute, eg. `prebuild`.
- For most cases, you should do workspace-level build instead of package-level build.

## Project Conventions
- Language: TypeScript / Python.
- Dependency: Use latest version of everything, never maintain old versions or compatibility. Including Node, Python, language features and grammar.
- This is a private codebase, feel free to modify anything as needed without worrying about backward compatibility or public API stability.
- Formatting/linting: 
  - You don't need to care about formatting and linting for code. Use the above tools when necessary.
  - You should maintain good formatting for documentation and comments.
- Generated files:
  - `*.generated.*` are generated artifacts and should not be hand-edited.
  - `autoindex` output and tsconfig graph are part of prebuild pipeline.
  - `lib` folders are output of build and should be ignored.
- Import discipline:
  - For TypeScript, keep `.js` extension and restricted import rules compatible with Biome config.
  - For cross-package imports, only import from the package entry point, never deep import internal files.
  - For intra-package imports, relative paths is enforced.

## Validation Expectations
- There is no single universal test command at root.
- Validate changes by running workspace build.
- For protocol/time logic changes, confirm timestamp unit assumptions remain microseconds.

## Known Pitfalls
- Time unit incorrectly using milliseconds instead of microseconds before, but has been corrected, if you see code that assumes millisecond timestamps, it is likely a bug, you should point out for correction rather than perpetuating the mistake.

## Link-First References
- Protocol and payload format: `README.md`

## Change Strategy For Agents
- Prefer minimal, localized edits.
- Do not reformat unrelated files.
