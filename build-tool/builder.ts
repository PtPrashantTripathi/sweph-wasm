/**
 * Core build orchestration for Swisseph WebAssembly module.
 * Ported from Python build_tool/builder.py
 */

import { fs, path, process as runtimeProcess, console } from "./runtime.ts";
import {
    SOURCE_FILES,
    CTYPE_TO_JS,
    BASE_EMCC_FLAGS,
    PROD_EMCC_FLAGS,
    EXPORTED_RUNTIME_METHODS,
} from "./config.ts";
import type {
    BuilderOptions,
    FunctionMetadata,
    FunctionArg,
    EmscriptenTarget,
} from "./types.ts";

/**
 * Orchestrates the entire WebAssembly build process for Swisseph.
 */
export class Builder {
    private baseDir: string;
    private srcDir: string;
    private buildDir: string;
    private env: string;
    private verbose: boolean;
    private emsdkPath?: string;
    private metadata: FunctionMetadata[] = [];

    constructor(options: BuilderOptions) {
        this.baseDir = options.baseDir;
        this.srcDir = path.join(this.baseDir, "swisseph");
        this.buildDir = path.join(this.baseDir, "src", "wasm");
        this.env = options.env;
        this.verbose = options.verbose;
        this.emsdkPath = options.emsdkPath;
    }

    /**
     * Executes the full build pipeline.
     */
    async run(targets: EmscriptenTarget[]): Promise<void> {
        console.log("Starting Swisseph WASM build process...");
        await this.checkEmcc();
        await this.parseMetadata();
        await this.buildTargets(targets);
        await this.generateTsDeclaration();
        console.log("Build process completed successfully!");
    }

    /**
     * Checks if the Emscripten compiler (emcc) is available.
     * If emsdkPath is provided, sources the emsdk environment first.
     */
    private async checkEmcc(): Promise<void> {
        console.log("Checking for Emscripten (emcc)...");

        // If emsdk path is provided, source the environment
        if (this.emsdkPath) {
            console.log(`Sourcing Emscripten SDK from: ${this.emsdkPath}`);
            const envScript = path.join(this.emsdkPath, "emsdk_env.sh");

            // Check if emsdk_env.sh exists
            if (!(await fs.exists(envScript))) {
                throw new Error(
                    `emsdk_env.sh not found at ${envScript}. Please check the --emsdk-path value.`
                );
            }

            // Source the environment by running a shell command
            // We'll check for emcc with the sourced environment
            try {
                const result = await runtimeProcess.spawn("bash", [
                    "-c",
                    `source ${envScript} && which emcc`,
                ]);

                if (result.code !== 0) {
                    throw new Error("emcc not found after sourcing emsdk environment");
                }

                console.log("Emscripten found (from emsdk).");
                return;
            } catch (error) {
                throw new Error(
                    `Failed to source Emscripten SDK from ${this.emsdkPath}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        // Normal PATH check if no emsdk path provided
        try {
            const result = await runtimeProcess.spawn("which", ["emcc"]);
            if (result.code !== 0) {
                throw new Error("emcc not found in PATH");
            }
            console.log("Emscripten found.");
        } catch (error) {
            throw new Error(
                "Emscripten (emcc) not found. Please install and configure the Emscripten SDK, or use --emsdk-path to specify its location."
            );
        }
    }

    /**
     * Parses the C header file to extract function metadata.
     */
    private async parseMetadata(): Promise<void> {
        console.log("Parsing header file to extract function metadata...");

        const headerFile = path.join(this.srcDir, "swephexp.h");
        let text = await fs.readFile(headerFile);

        // Clean the header content for easier parsing
        const replacements: Record<string, string> = {
            "ext_def(x)": "",
            const: "",
            // Add dummy var names for consistent parsing
            "swe_version(char *)": "swe_version(char *s)",
            "swe_get_library_path(char *)": "swe_get_library_path(char *s)",
        };

        for (const [oldStr, newStr] of Object.entries(replacements)) {
            text = text.replaceAll(oldStr, newStr);
        }

        // Remove C comments
        text = text.replace(/\/\*.*?\*\//gs, "");
        // Normalize whitespace
        text = text.replace(/\s+/g, " ").replace(/\n/g, " ").trim();

        // Find all function definitions
        const matches = text.match(/ext_def[\s\S]*?\);/g) || [];
        console.log(`Found ${matches.length} potential functions in header file.`);

        // Parse each function signature
        for (const match of matches) {
            try {
                const metadata = this.parseFunctionSignature(match);
                this.metadata.push(metadata);
            } catch (error) {
                console.log(
                    `Skipped malformed function signature: ${match.substring(0, 50)}... (${error instanceof Error ? error.message : String(error)})`
                );
            }
        }

        // Sort by function name
        this.metadata.sort((a, b) => a.func_name.localeCompare(b.func_name));
        console.log(`Successfully parsed ${this.metadata.length} functions.`);
    }

    /**
     * Parses a single C function signature string.
     */
    private parseFunctionSignature(signature: string): FunctionMetadata {
        const cleanSig = signature.trim().replace(/;$/, "");

        // Regex to capture: 1=return type, 2=function name, 3=arguments string
        const pattern = /ext_def\s*?\(([\w\s\*]+?)\)\s*?([\w\d_]+)\s*\((.*?)\)/;
        const match = cleanSig.match(pattern);

        if (!match) {
            throw new Error("Invalid function signature format.");
        }

        const [, returnTypeRaw, name, argStr] = match;
        const returnType = returnTypeRaw.replace(/\*/g, "").trim();
        const isPtr = returnTypeRaw.includes("*");

        const args: FunctionArg[] = [];
        if (argStr.trim().toLowerCase() !== "void") {
            const argParts = argStr
                .split(",")
                .map((arg) => arg.trim())
                .filter((arg) => arg);
            args.push(...argParts.map((arg) => this.parseArg(arg)));
        }

        return {
            func_name: name,
            pointer: isPtr,
            c_type: returnType,
            js_type: isPtr ? "number" : CTYPE_TO_JS[returnType] || "unknown",
            args,
        };
    }

    /**
     * Parses a single C function argument string.
     */
    private parseArg(argStr: string): FunctionArg {
        const tokens = argStr.trim().split(/\s+/);
        if (tokens.length < 2) {
            throw new Error(`Malformed argument: ${argStr}`);
        }

        const cType = tokens
            .slice(0, -1)
            .join(" ")
            .replace(/\*/g, "")
            .trim();
        const name = tokens[tokens.length - 1].replace(/\*/g, "").trim();
        const isPtr = argStr.includes("*");

        return {
            name,
            pointer: isPtr,
            c_type: cType,
            js_type: isPtr ? "number" : CTYPE_TO_JS[cType] || "unknown",
        };
    }

    /**
     * Compiles the C source into WASM for specified targets.
     */
    private async buildTargets(targets: EmscriptenTarget[]): Promise<void> {
        // Cleanup last build if any
        if (await fs.exists(this.buildDir)) {
            await fs.remove(this.buildDir);
        }
        await fs.mkdir(this.buildDir, true);

        console.log(`Building WebAssembly for targets: ${targets.join(", ")}`);

        const outputFile = path.join(this.buildDir, "swisseph.js");

        const exportedFuncs = [
            "_free",
            "_malloc",
            ...this.metadata.map((info) => `_${info.func_name}`),
        ];

        const command = ["emcc"];

        // Add source files
        const cFiles = SOURCE_FILES.filter((f) => f.endsWith(".c")).map((f) =>
            path.join(this.srcDir, f)
        );
        command.push(...cFiles);

        // Add base flags
        command.push(...BASE_EMCC_FLAGS);

        // Add production flags if needed
        if (this.env === "prod") {
            command.push(...PROD_EMCC_FLAGS);
        }

        // Add verbose flag if needed
        if (this.verbose) {
            command.push("-v");
        }

        // Add target-specific flags
        command.push(`-sENVIRONMENT=[${targets.join(",")}]`);
        command.push(`-sEXPORTED_FUNCTIONS=[${exportedFuncs.join(",")}]`);
        command.push(
            `-sEXPORTED_RUNTIME_METHODS=[${EXPORTED_RUNTIME_METHODS.join(",")}]`
        );
        command.push("-o", outputFile);

        console.log(`Executing emcc command: ${command.join(" ")}`);

        try {
            let result;

            // If emsdkPath is provided, source the environment before running emcc
            if (this.emsdkPath) {
                const envScript = path.join(this.emsdkPath, "emsdk_env.sh");
                const fullCommand = `source ${envScript} && ${command.join(" ")}`;
                result = await runtimeProcess.spawn("bash", ["-c", fullCommand]);
            } else {
                result = await runtimeProcess.spawn(command[0], command.slice(1));
            }

            if (result.code !== 0) {
                console.error("emcc compilation failed.");
                console.error(`STDOUT: ${result.stdout}`);
                console.error(`STDERR: ${result.stderr}`);
                throw new Error(`emcc exited with code ${result.code}`);
            }

            console.log(`WASM build complete -> ${path.basename(outputFile)}`);
        } catch (error) {
            console.error("emcc compilation failed.");
            throw error;
        }
    }

    /**
     * Generates the swisseph.d.ts TypeScript declaration file.
     */
    private async generateTsDeclaration(): Promise<void> {
        console.log("Generating TypeScript declaration file...");

        const outputFile = path.join(this.buildDir, "swisseph.d.ts");

        const functionDeclarations: string[] = [];

        for (const fn of this.metadata) {
            // JSDoc block
            const jsdoc = ["    /**"];

            for (const arg of fn.args) {
                const cTypeStr = `${arg.c_type}${arg.pointer ? "*" : ""}`;
                jsdoc.push(
                    `     * @param {${arg.js_type}} ${arg.name} - C Type: \`${cTypeStr}\``
                );
            }

            const returnCTypeStr = `${fn.c_type}${fn.pointer ? "*" : ""}`;
            jsdoc.push(
                `     * @returns {${fn.js_type}} - C Type: \`${returnCTypeStr}\``
            );
            jsdoc.push("     */");

            // Function signature
            const argSig = fn.args
                .map((arg) => `${arg.name}: ${arg.js_type}`)
                .join(", ");
            const signature = `    _${fn.func_name}(${argSig}): ${fn.js_type};`;

            functionDeclarations.push(jsdoc.join("\n") + "\n" + signature);
        }

        const template = this.getTsTemplate();
        const content = template.replace(
            "###OTHER_CODE###",
            functionDeclarations.join("\n\n")
        );

        await fs.writeFile(outputFile, content);
        console.log(`TypeScript declaration generated -> ${outputFile}`);
    }

    /**
     * Returns the base string template for the .d.ts file.
     */
    private getTsTemplate(): string {
        return `/// <reference types="emscripten" />

/**
 * TypeScript bindings for the Swisseph Emscripten-generated WebAssembly module.
 * Extends the EmscriptenModule with custom wrapped native functions.
 */
export interface SwissephModule extends EmscriptenModule {
    // --- Standard Emscripten Runtime Methods ---
    /* [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/Reference/JavaScript_interface/Memory) */
    wasmMemory: WebAssembly.Memory;

    /** Sets a value in the WebAssembly heap memory. */
    setValue: typeof setValue;

    /** Retrieves a value from the WebAssembly heap memory. */
    getValue: typeof getValue;

    /** Converts a JavaScript string to a UTF-8 encoded string in the WebAssembly memory. */
    stringToUTF8: typeof stringToUTF8;

    /** Converts a UTF-8 encoded string from the WebAssembly memory to a JavaScript string. */
    UTF8ToString: typeof UTF8ToString;

    /** Returns the number of bytes required to encode a JavaScript string as UTF-8. */
    lengthBytesUTF8: typeof lengthBytesUTF8;

    /** Provides access to the Emscripten virtual file system. */
    FS: typeof FS;

    /**
     * Frees allocated memory in the WebAssembly heap.
     *
     * Equivalent to \`free(void* ptr)\` in C.
     * @param ptr Pointer to the memory location to free.
     */
    _free(ptr: number): void;

    /**
     * Allocates memory in the WebAssembly heap.
     *
     * Equivalent to \`malloc(size_t size)\` in C.
     * @param size Number of bytes to allocate.
     * @returns A pointer to the beginning of the allocated memory block.
     */
    _malloc(size: number): number;

    // --- Exported Swisseph C Functions ---
###OTHER_CODE###
}

/**
 * Initializes and returns the Swisseph WebAssembly module.
 *
 * @param moduleArg - Optional configuration object for the Emscripten module.
 * @returns A Promise that resolves to the initialized Swisseph instance.
 */
export default function Module(moduleArg?: Partial<EmscriptenModule>): Promise<SwissephModule>;
`;
    }
}
