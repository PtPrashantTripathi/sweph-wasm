import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import terser from "@rollup/plugin-terser";

export default {
    input: "src/index.ts",
    output: [
        {
            dir: "dist",
            format: "esm",
            entryFileNames: "index.js",
            chunkFileNames: chunkInfo => {
                if (chunkInfo.name === "swisseph") {
                    return "wasm/swisseph.js";
                }
                return "[name].js";
            },
            sourcemap: true,
        },
        {
            dir: "dist",
            format: "cjs",
            entryFileNames: "index.cjs",
            chunkFileNames: chunkInfo => {
                if (chunkInfo.name === "swisseph") {
                    return "wasm/swisseph.cjs";
                }
                return "[name].cjs";
            },
            exports: "auto",
            sourcemap: true,
        },
    ],
    plugins: [
        resolve({ browser: true, preferBuiltins: false }),
        typescript({
            tsconfig: "./tsconfig.prod.json",
        }),
        copy({
            targets: [
                { src: "src/wasm/swisseph.d.ts", dest: "dist/wasm" },
                // { src: "src/wasm/swisseph.js", dest: "dist/wasm" },
                { src: "src/wasm/swisseph.wasm", dest: "dist/wasm" },
            ],
            hook: "writeBundle",
            verbose: true,
        }),
        terser(),
    ],
    treeshake: true,
    external: ["module"],
};
