/** Type definitions for the build tool. */

/** Build environment type. */
export type BuildEnv = "dev" | "prod";

/** Emscripten target environment. */
export type EmscriptenTarget = "node" | "web" | "worker";

/** CLI arguments interface. */
export interface CLIArgs {
    env: BuildEnv;
    verbose: boolean;
    targets: EmscriptenTarget[];
    download: boolean;
    emsdkPath?: string;
}

/** Represents a parsed C function argument. */
export interface FunctionArg {
    name: string;
    pointer: boolean;
    c_type: string;
    js_type: string;
}

/** Represents a parsed C function signature. */
export interface FunctionMetadata {
    func_name: string;
    pointer: boolean;
    c_type: string;
    js_type: string;
    args: FunctionArg[];
}

/** Builder class options. */
export interface BuilderOptions {
    baseDir: string;
    env: BuildEnv;
    verbose: boolean;
    emsdkPath?: string;
}

/** C to JavaScript type mapping. */
export interface CTypeToJSMap {
    [key: string]: string;
}
