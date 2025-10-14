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

### [In Progress] Phase 1: Project Setup
- [x] Create build-tool directory
- [x] Create PLAN.md
- [ ] Implement runtime.ts
- [ ] Implement types.ts
- [ ] Implement config.ts
- [ ] Create deno.json
- [ ] Create tsconfig.json

### [Pending] Phase 2: Core Functionality
- [ ] Implement download.ts
- [ ] Implement builder.ts (header parsing)
- [ ] Implement builder.ts (WASM compilation)
- [ ] Implement builder.ts (TS declaration generation)

### [Pending] Phase 3: CLI & Integration
- [ ] Implement index.ts (CLI)
- [ ] Update package.json
- [ ] Update GitHub workflows
- [ ] Testing & validation

### [Pending] Phase 4: Cleanup
- [ ] Remove Python build_tool
- [ ] Update documentation

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

---

Last Updated: 2025-10-13
