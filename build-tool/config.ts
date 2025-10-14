/**
 * Configuration constants for the build tool.
 * Ported from Python build_tool/config.py
 */

import type { CTypeToJSMap } from "./types.ts";

/**
 * Source files to download and compile from the Swiss Ephemeris repository.
 */
export const SOURCE_FILES: string[] = [
    "swemptab.h",
    "swemmoon.c",
    "swehouse.h",
    "swephexp.h",
    "sweph.h",
    "swedate.h",
    "swehel.c",
    "swejpl.h",
    "swephlib.h",
    "swehouse.c",
    "swecl.c",
    "swenut2000a.h",
    "sweph.c",
    "swedate.c",
    "swemplan.c",
    "swephlib.c",
    "swejpl.c",
    "sweodef.h",
];

/**
 * C to JavaScript type mapping for TypeScript declaration generation.
 */
export const CTYPE_TO_JS: CTypeToJSMap = {
    int: "number",
    short: "number",
    long: "number",
    float: "number",
    double: "number",
    char: "number",
    unsigned: "number",
    void: "void",
    // Typedefs from swephexp.h
    int32: "number",
    int64: "number",
    int16: "number",
    uint32: "number",
    UINT4: "number",
    INT4: "number",
    REAL8: "number",
    UINT2: "number",
    AS_BOOL: "number",
    CSEC: "number",
    centisec: "number",
};

/**
 * Common Emscripten compiler flags for all builds.
 */
export const BASE_EMCC_FLAGS: string[] = [
    "-sWASM=1",
    "-sMODULARIZE=1",
    "-sEXPORT_ES6=1",
    "-sALLOW_MEMORY_GROWTH=1",
    "-sINITIAL_MEMORY=16MB",
    "-sMAXIMUM_MEMORY=128MB",
    "-sSTACK_OVERFLOW_CHECK=1",
    "-sSAFE_HEAP=1",
    "--no-entry",
];

/**
 * Production-specific Emscripten compiler flags.
 */
export const PROD_EMCC_FLAGS: string[] = [
    "-O3",
    "-g0",
    // Note: --closure=1 is commented out in Python version as "very bad idea"
];

/**
 * JavaScript methods to export from the Emscripten runtime.
 */
export const EXPORTED_RUNTIME_METHODS: string[] = [
    "setValue",
    "getValue",
    "stringToUTF8",
    "UTF8ToString",
    "lengthBytesUTF8",
    "FS",
    "wasmMemory",
];

/**
 * Base URL for downloading Swiss Ephemeris source files.
 */
export const SWISSEPH_BASE_URL =
    "https://raw.githubusercontent.com/aloistr/swisseph/refs/heads/master";
