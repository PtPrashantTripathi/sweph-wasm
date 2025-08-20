// This file configures Prettier, a code formatter.

export default {
    plugins: ["prettier-plugin-jsdoc"],
    arrowParens: "avoid",
    bracketSameLine: true,
    bracketSpacing: true,
    embeddedLanguageFormatting: "auto",
    endOfLine: "auto",
    htmlWhitespaceSensitivity: "css",
    insertPragma: false,
    jsxSingleQuote: false,
    printWidth: 80,
    proseWrap: "always",
    quoteProps: "as-needed",
    semi: true,
    singleAttributePerLine: false,
    singleQuote: false,
    tabWidth: 4,
    trailingComma: "es5",
    useTabs: false,
    overrides: [
        {
            files: "*.ts",
            options: {
                parser: "typescript",
            },
        },
        {
            files: "*.json",
            options: {
                parser: "json",
            },
        },
        {
            files: "*.md",
            options: {
                parser: "markdown",
            },
        },
        {
            files: ["*.yml", "*.yaml"],
            options: {
                parser: "yaml",
            },
        },
    ],
};
