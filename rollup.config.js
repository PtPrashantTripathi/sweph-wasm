import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import url from "@rollup/plugin-url"; // for .wasm
import copy from "rollup-plugin-copy"; // for raw emcc JS shim
import terser from "@rollup/plugin-terser";

export default {
    input: "src/index.ts",
    output: [
        {
            file: "dist/index.js",
            format: "esm",
            sourcemap: true,
        },
        {
            file: "dist/index.cjs",
            format: "cjs",
            sourcemap: true,
            exports: "auto",
        },
        {
            file: "dist/index.umd.js",
            format: "umd",
            name: "SwissEPH", // <- global var name for browsers
            sourcemap: true,
        },
    ],
    plugins: [
        resolve({ browser: true, preferBuiltins: false }),
        commonjs(),
        typescript({ tsconfig: "./tsconfig.json" }),

        url({
            include: ["**/*.wasm"],
            limit: 0,
            fileName: "wasm/[name][extname]", // dist/wa`sm/swisseph.wasm
        }),
        copy({
            targets: [
                { src: "src/wasm/swisseph.d.ts", dest: "dist/wasm" },
                { src: "src/wasm/swisseph.wasm", dest: "dist" },
            ],
            hook: "writeBundle",
            verbose: true,
        }),
        terser(),
    ],
    treeshake: true,
    external: ["module"],
};
