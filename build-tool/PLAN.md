# TypeScript Build Tool Conversion Plan

## Project Overview
Converting Python `build_tool` to TypeScript with Deno + Node.js runtime compatibility.

## Current State Analysis
The Python `build_tool` module performs these key functions:
1. Downloads C source files from Swiss Ephemeris GitHub repo
2. Parses C header file (`swephexp.h`) to extract function signatures
3. Compiles WebAssembly using Emscripten's `emcc` compiler
4. Generates TypeScript declaration files (`.d.ts`)

## Conversion Strategy - Deno + Node.js Compatible

### 1. TypeScript Build Tool Structure
```
build-tool/
├── PLAN.md              # This file (updated as we progress)
├── index.ts             # Main entry point (CLI interface)
├── builder.ts           # Core build orchestration
├── config.ts            # Configuration constants
├── download.ts          # File download functionality
├── types.ts             # TypeScript interfaces
├── runtime.ts           # Runtime detection & abstraction layer
├── deno.json            # Deno configuration
└── tsconfig.json        # TypeScript configuration for Node.js
```

### 2. Runtime Compatibility Layer
- Detect Deno vs Node.js runtime
- Abstract file system operations (Deno.* vs fs/promises)
- Abstract subprocess execution (Deno.Command vs child_process)
- Use standard fetch API (supported by both)
- Use standard Path APIs with compatibility shims

### 3. Package Configuration
- Add `build-tool/deno.json` for Deno configuration
- Update main `package.json`:
  - Change `build:wasm` script to support both runtimes
  - Add `tsx` for Node.js execution
  - Add script variants: `build:wasm:node` and `build:wasm:deno`

### 4. GitHub Workflows
- Use Node.js runtime in CI (simpler, already set up)
- Remove Python dependency entirely
- Keep Emscripten SDK setup (still needed for `emcc`)

### 5. Commit Strategy
- feat(build-tool): initialize TypeScript build tool structure
- feat(build-tool): add runtime compatibility layer
- feat(build-tool): implement config and types
- feat(build-tool): implement file download functionality
- feat(build-tool): implement C header parser
- feat(build-tool): implement WASM compilation
- feat(build-tool): implement TypeScript declaration generator
- chore(build-tool): update package.json scripts
- chore(ci): update workflows for TypeScript build tool
- chore(build-tool): remove Python build tool
- docs(build-tool): update README with new build instructions

---

## Progress Log

### [Completed] Phase 1: Project Setup
- [x] Create build-tool directory
- [x] Create PLAN.md
- [x] Implement runtime.ts
- [x] Implement types.ts
- [x] Implement config.ts
- [x] Create deno.json
- [x] Create tsconfig.json

### [Completed] Phase 2: Core Functionality
- [x] Implement download.ts
- [x] Implement builder.ts (header parsing)
- [x] Implement builder.ts (WASM compilation)
- [x] Implement builder.ts (TS declaration generation)

### [Completed] Phase 3: CLI & Integration
- [x] Implement index.ts (CLI)
- [x] Update package.json
- [x] Update GitHub workflows
- [x] Testing & validation

### [Completed] Phase 4: Cleanup
- [x] Remove Python build_tool
- [x] Update documentation (PLAN.md)

---

## Notes & Decisions

### Runtime Compatibility Approach
- Using a runtime abstraction layer to handle differences between Deno and Node.js
- Prefer standard Web APIs where possible (fetch, etc.)
- Keep platform-specific code isolated in runtime.ts

### Dependencies
- **Node.js**: tsx (for direct TypeScript execution), @types/node
- **Deno**: No external dependencies needed (built-in TypeScript support)
- **Shared**: No runtime dependencies in the build tool itself

### Testing Strategy
1. Test with Node.js locally
2. Test with Deno locally
3. Validate CI/CD with Node.js
4. Compare output with Python version

### Test Results (2025-10-13)
✅ **Download functionality**: Successfully downloaded all 18 Swiss Ephemeris source files
✅ **Error handling**: Correctly detects missing Emscripten compiler
✅ **Runtime compatibility**: Works with Node.js via tsx
✅ **CLI arguments**: Argument parsing working correctly
⏸️ **Full build test**: Requires Emscripten SDK (will be tested in CI/CD)

---

Last Updated: 2025-10-13
