// eslint.config.js
import prettier from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import js from "@eslint/js";
import ts from "typescript-eslint";
import { globalIgnores } from "eslint/config";

export default ts.config([
    globalIgnores(["dist", "node_modules"]),
    {
        files: ["**/*.ts"],
        extends: [prettier, js.configs.recommended, ts.configs.recommended],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",

            globals: globals.browser,
        },
        plugins: {
            "unused-imports": unusedImports,
            "simple-import-sort": simpleImportSort,
        },

        rules: {
            // "no-console": "warn",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "unused-imports/no-unused-imports": "warn",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                },
            ],
            "simple-import-sort/exports": "warn",
            "simple-import-sort/imports": "warn",

            "no-var": "warn",
            "object-shorthand": ["warn", "properties"],

            eqeqeq: ["error", "always", { null: "ignore" }],

            "lines-between-class-members": [
                "error",
                "always",
                { exceptAfterSingleLine: true },
            ],

            "spaced-comment": [
                "error",
                "always",
                {
                    line: { markers: ["*package", "!", "/", ",", "="] },
                    block: {
                        balanced: true,
                        markers: [
                            "*package",
                            "!",
                            ",",
                            ":",
                            "::",
                            "flow-include",
                        ],
                        exceptions: ["*"],
                    },
                },
            ],
            // "symbol-description": "error",
        },
    },
]);
