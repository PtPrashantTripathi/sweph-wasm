/**
 * Runtime abstraction layer for Deno and Node.js compatibility.
 * Provides unified interfaces for file system, subprocess, and path operations.
 */

// Runtime detection
export const isDeno = typeof Deno !== "undefined";
export const isNode = !isDeno;

// Type definitions for runtime operations
export interface RuntimeFS {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    mkdir(path: string, recursive?: boolean): Promise<void>;
    exists(path: string): Promise<boolean>;
    remove(path: string, recursive?: boolean): Promise<void>;
}

export interface RuntimeProcess {
    spawn(
        command: string,
        args: string[],
        options?: { cwd?: string }
    ): Promise<{ stdout: string; stderr: string; code: number }>;
}

export interface RuntimePath {
    join(...paths: string[]): string;
    dirname(path: string): string;
    resolve(...paths: string[]): string;
    basename(path: string): string;
}

// Deno implementation
const denoFS: RuntimeFS = {
    async readFile(path: string): Promise<string> {
        return await Deno.readTextFile(path);
    },

    async writeFile(path: string, content: string): Promise<void> {
        await Deno.writeTextFile(path, content);
    },

    async mkdir(path: string, recursive = true): Promise<void> {
        await Deno.mkdir(path, { recursive });
    },

    async exists(path: string): Promise<boolean> {
        try {
            await Deno.stat(path);
            return true;
        } catch {
            return false;
        }
    },

    async remove(path: string, recursive = true): Promise<void> {
        await Deno.remove(path, { recursive });
    },
};

const denoProcess: RuntimeProcess = {
    async spawn(
        command: string,
        args: string[],
        options?: { cwd?: string }
    ): Promise<{ stdout: string; stderr: string; code: number }> {
        const cmd = new Deno.Command(command, {
            args,
            cwd: options?.cwd,
            stdout: "piped",
            stderr: "piped",
        });

        const output = await cmd.output();
        const decoder = new TextDecoder();

        return {
            stdout: decoder.decode(output.stdout),
            stderr: decoder.decode(output.stderr),
            code: output.code,
        };
    },
};

const denoPath: RuntimePath = {
    join(...paths: string[]): string {
        // Use Deno's built-in path module if available in imports
        return paths.join("/").replace(/\/+/g, "/");
    },

    dirname(path: string): string {
        const parts = path.split("/");
        parts.pop();
        return parts.join("/") || "/";
    },

    resolve(...paths: string[]): string {
        const cwd = Deno.cwd();
        const joined = [cwd, ...paths].join("/");
        return joined.replace(/\/+/g, "/");
    },

    basename(path: string): string {
        return path.split("/").pop() || "";
    },
};

// Node.js implementation
let nodeFS: RuntimeFS;
let nodeProcess: RuntimeProcess;
let nodePath: RuntimePath;

if (isNode) {
    // Dynamic imports for Node.js (to avoid errors in Deno)
    const fsPromises = await import("fs/promises");
    const childProcess = await import("child_process");
    const pathModule = await import("path");
    const { promisify } = await import("util");
    const execFile = promisify(childProcess.execFile);

    nodeFS = {
        async readFile(path: string): Promise<string> {
            return await fsPromises.readFile(path, "utf-8");
        },

        async writeFile(path: string, content: string): Promise<void> {
            await fsPromises.writeFile(path, content, "utf-8");
        },

        async mkdir(path: string, recursive = true): Promise<void> {
            await fsPromises.mkdir(path, { recursive });
        },

        async exists(path: string): Promise<boolean> {
            try {
                await fsPromises.access(path);
                return true;
            } catch {
                return false;
            }
        },

        async remove(path: string, recursive = true): Promise<void> {
            await fsPromises.rm(path, { recursive, force: true });
        },
    };

    nodeProcess = {
        async spawn(
            command: string,
            args: string[],
            options?: { cwd?: string }
        ): Promise<{ stdout: string; stderr: string; code: number }> {
            try {
                const { stdout, stderr } = await execFile(command, args, {
                    cwd: options?.cwd,
                    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                });
                return {
                    stdout: stdout || "",
                    stderr: stderr || "",
                    code: 0,
                };
            } catch (error: any) {
                return {
                    stdout: error.stdout || "",
                    stderr: error.stderr || "",
                    code: error.code || 1,
                };
            }
        },
    };

    nodePath = {
        join(...paths: string[]): string {
            return pathModule.join(...paths);
        },

        dirname(path: string): string {
            return pathModule.dirname(path);
        },

        resolve(...paths: string[]): string {
            return pathModule.resolve(...paths);
        },

        basename(path: string): string {
            return pathModule.basename(path);
        },
    };
}

// Export unified interfaces
export const fs: RuntimeFS = isDeno ? denoFS : nodeFS;
export const process: RuntimeProcess = isDeno ? denoProcess : nodeProcess;
export const path: RuntimePath = isDeno ? denoPath : nodePath;

// Get current working directory
export function cwd(): string {
    return isDeno ? Deno.cwd() : globalThis.process.cwd();
}

// Exit process with code
export function exit(code: number): never {
    if (isDeno) {
        Deno.exit(code);
    } else {
        globalThis.process.exit(code);
    }
}

// Console utilities
export const console = globalThis.console;
