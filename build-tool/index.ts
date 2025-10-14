#!/usr/bin/env -S deno run --allow-all
/**
 * Main entry point for the Swisseph WebAssembly build tool.
 * Ported from Python build_tool/__main__.py
 *
 * This file can be run with either Deno or Node.js (via tsx):
 * - Deno: deno run --allow-all build-tool/index.ts
 * - Node: tsx build-tool/index.ts
 */

import { cwd, exit, console, path, isDeno, isNode } from "./runtime.ts";
import { Builder } from "./builder.ts";
import { downloadFiles } from "./download.ts";
import type { CLIArgs, BuildEnv, EmscriptenTarget } from "./types.ts";

/**
 * Parses command-line arguments.
 */
function parseArgs(): CLIArgs {
    // Get arguments based on runtime
    const args = isDeno ? Deno.args : globalThis.process.argv.slice(2);

    const parsed: CLIArgs = {
        env: "dev",
        verbose: false,
        targets: ["node", "web", "worker"],
        download: false,
        emsdkPath: undefined,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case "-e":
            case "--env":
                i++;
                const env = args[i];
                if (env !== "dev" && env !== "prod") {
                    console.error(
                        `Invalid environment: ${env}. Must be 'dev' or 'prod'.`
                    );
                    exit(1);
                }
                parsed.env = env as BuildEnv;
                break;

            case "-v":
            case "--verbose":
                parsed.verbose = true;
                break;

            case "-t":
            case "--targets": {
                i++;
                const targets: EmscriptenTarget[] = [];
                while (i < args.length && !args[i].startsWith("-")) {
                    const target = args[i];
                    if (
                        target !== "node" &&
                        target !== "web" &&
                        target !== "worker"
                    ) {
                        console.error(
                            `Invalid target: ${target}. Must be 'node', 'web', or 'worker'.`
                        );
                        exit(1);
                    }
                    targets.push(target as EmscriptenTarget);
                    i++;
                }
                i--; // Step back one since the loop will increment
                if (targets.length > 0) {
                    parsed.targets = targets;
                }
                break;
            }

            case "-d":
            case "--download":
                parsed.download = true;
                break;

            case "-p":
            case "--emsdk-path":
                i++;
                if (i >= args.length) {
                    console.error("Missing path value for --emsdk-path");
                    exit(1);
                }
                parsed.emsdkPath = args[i];
                break;

            case "-h":
            case "--help":
                printHelp();
                exit(0);
                break;

            default:
                console.error(`Unknown argument: ${arg}`);
                printHelp();
                exit(1);
        }
    }

    return parsed;
}

/**
 * Prints help message.
 */
function printHelp(): void {
    const runtime = isDeno ? "Deno" : "Node.js";
    console.log(`
Swisseph WebAssembly Build Tool (${runtime})

Usage:
  ${isDeno ? "deno run --allow-all" : "tsx"} build-tool/index.ts [options]

Options:
  -e, --env <env>         Build environment: 'dev' or 'prod' (default: dev)
  -v, --verbose           Enable verbose output for debugging
  -t, --targets <targets> Space-separated list of Emscripten environments
                          to build for: node, web, worker (default: all three)
  -d, --download          Download source files before building
  -p, --emsdk-path <path> Path to Emscripten SDK directory (sources emsdk_env.sh)
  -h, --help              Show this help message

Examples:
  ${isDeno ? "deno run --allow-all" : "tsx"} build-tool/index.ts -e prod
  ${isDeno ? "deno run --allow-all" : "tsx"} build-tool/index.ts -t web -e prod
  ${isDeno ? "deno run --allow-all" : "tsx"} build-tool/index.ts -d -e dev -v
`);
}

/**
 * Main function.
 */
async function main(): Promise<void> {
    const args = parseArgs();

    // The base directory is the parent of the 'build-tool' directory
    const baseDir = path.dirname(path.dirname(new URL(import.meta.url).pathname));

    try {
        if (args.download) {
            const swissephDir = path.join(baseDir, "swisseph");
            await downloadFiles(swissephDir);
        }

        const builder = new Builder({
            baseDir,
            env: args.env,
            verbose: args.verbose,
            emsdkPath: args.emsdkPath,
        });

        await builder.run(args.targets);
    } catch (error) {
        console.error(
            `\nA critical error occurred: ${error instanceof Error ? error.message : String(error)}`
        );
        if (args.verbose && error instanceof Error && error.stack) {
            console.error(error.stack);
        }
        exit(1);
    }
}

// Run main function
main();
