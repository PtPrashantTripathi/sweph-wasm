// This code implements the `-sMODULARIZE` settings by taking the generated
// JS program code (INNER_JS_CODE) and wrapping it in a factory function.

// When targetting node and ES6 we use `await import ..` in the generated code
// so the outer function needs to be marked as async.
async function Module(moduleArg = {}) {
    var moduleRtn;

    // include: shell.js
    // The Module object: Our interface to the outside world. We import
    // and export values on it. There are various ways Module can be used:
    // 1. Not defined. We create it here
    // 2. A function parameter, function(moduleArg) => Promise<Module>
    // 3. pre-run appended it, var Module = {}; ..generated code..
    // 4. External script tag defines var Module.
    // We need to check if Module already exists (e.g. case 3 above).
    // Substitution will be replaced with actual code on later stage of the build,
    // this way Closure Compiler will not mangle it (e.g. case 4. above).
    // Note that if you want to run closure, and also to use Module
    // after the generated code, you will need to define   var Module = {};
    // before the code. Then that object will be used in the code, and you
    // can continue to use Module afterwards as well.
    var Module = moduleArg;

    // Determine the runtime environment we are in. You can customize this by
    // setting the ENVIRONMENT setting at compile time (see settings.js).
    // Attempt to auto-detect the environment
    var ENVIRONMENT_IS_WEB = typeof window == "object";

    var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";

    // N.b. Electron.js environment is simultaneously a NODE-environment, but
    // also a web environment.
    var ENVIRONMENT_IS_NODE =
        typeof process == "object" &&
        process.versions?.node &&
        process.type != "renderer";

    var ENVIRONMENT_IS_SHELL =
        !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

    if (ENVIRONMENT_IS_NODE) {
        // When building an ES module `require` is not normally available.
        // We need to use `createRequire()` to construct the require()` function.
        const { createRequire } = await import("module");
        /** @suppress {duplicate} */ var require = createRequire(
            import.meta.url
        );
    }

    // --pre-jses are emitted after the Module integration code, so that they can
    // refer to Module (if they choose; they can also define Module)
    var arguments_ = [];

    var thisProgram = "./this.program";

    var quit_ = (status, toThrow) => {
        throw toThrow;
    };

    var _scriptName = import.meta.url;

    // `/` should be present at the end if `scriptDirectory` is not empty
    var scriptDirectory = "";

    function locateFile(path) {
        if (Module["locateFile"]) {
            return Module["locateFile"](path, scriptDirectory);
        }
        return scriptDirectory + path;
    }

    // Hooks that are implemented differently in different runtime environments.
    var readAsync, readBinary;

    if (ENVIRONMENT_IS_NODE) {
        const isNode =
            typeof process == "object" &&
            process.versions?.node &&
            process.type != "renderer";
        if (!isNode)
            throw new Error(
                "not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)"
            );
        var nodeVersion = process.versions.node;
        var numericVersion = nodeVersion.split(".").slice(0, 3);
        numericVersion =
            numericVersion[0] * 1e4 +
            numericVersion[1] * 100 +
            numericVersion[2].split("-")[0] * 1;
        if (numericVersion < 16e4) {
            throw new Error(
                "This emscripten-generated code requires node v16.0.0 (detected v" +
                    nodeVersion +
                    ")"
            );
        }
        // These modules will usually be used on Node.js. Load them eagerly to avoid
        // the complexity of lazy-loading.
        var fs = require("fs");
        if (_scriptName.startsWith("file:")) {
            scriptDirectory =
                require("path").dirname(
                    require("url").fileURLToPath(_scriptName)
                ) + "/";
        }
        // include: node_shell_read.js
        readBinary = filename => {
            // We need to re-wrap `file://` strings to URLs.
            filename = isFileURI(filename) ? new URL(filename) : filename;
            var ret = fs.readFileSync(filename);
            assert(Buffer.isBuffer(ret));
            return ret;
        };
        readAsync = async (filename, binary = true) => {
            // See the comment in the `readBinary` function.
            filename = isFileURI(filename) ? new URL(filename) : filename;
            var ret = fs.readFileSync(filename, binary ? undefined : "utf8");
            assert(binary ? Buffer.isBuffer(ret) : typeof ret == "string");
            return ret;
        };
        // end include: node_shell_read.js
        if (process.argv.length > 1) {
            thisProgram = process.argv[1].replace(/\\/g, "/");
        }
        arguments_ = process.argv.slice(2);
        quit_ = (status, toThrow) => {
            process.exitCode = status;
            throw toThrow;
        };
    } else if (ENVIRONMENT_IS_SHELL) {
        const isNode =
            typeof process == "object" &&
            process.versions?.node &&
            process.type != "renderer";
        if (
            isNode ||
            typeof window == "object" ||
            typeof WorkerGlobalScope != "undefined"
        )
            throw new Error(
                "not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)"
            );
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
        // Note that this includes Node.js workers when relevant (pthreads is enabled).
        // Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
        // ENVIRONMENT_IS_NODE.
        try {
            scriptDirectory = new URL(".", _scriptName).href;
        } catch {}
        if (
            !(
                typeof window == "object" ||
                typeof WorkerGlobalScope != "undefined"
            )
        )
            throw new Error(
                "not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)"
            );
        {
            // include: web_or_worker_shell_read.js
            if (ENVIRONMENT_IS_WORKER) {
                readBinary = url => {
                    var xhr = new XMLHttpRequest();
                    xhr.open("GET", url, false);
                    xhr.responseType = "arraybuffer";
                    xhr.send(null);
                    return new Uint8Array(
                        /** @type {!ArrayBuffer} */ (xhr.response)
                    );
                };
            }
            readAsync = async url => {
                assert(
                    !isFileURI(url),
                    "readAsync does not work with file:// URLs"
                );
                var response = await fetch(url, {
                    credentials: "same-origin",
                });
                if (response.ok) {
                    return response.arrayBuffer();
                }
                throw new Error(response.status + " : " + response.url);
            };
        }
    } else {
        throw new Error("environment detection error");
    }

    var out = console.log.bind(console);

    var err = console.error.bind(console);

    var IDBFS = "IDBFS is no longer included by default; build with -lidbfs.js";

    var PROXYFS =
        "PROXYFS is no longer included by default; build with -lproxyfs.js";

    var WORKERFS =
        "WORKERFS is no longer included by default; build with -lworkerfs.js";

    var FETCHFS =
        "FETCHFS is no longer included by default; build with -lfetchfs.js";

    var ICASEFS =
        "ICASEFS is no longer included by default; build with -licasefs.js";

    var JSFILEFS =
        "JSFILEFS is no longer included by default; build with -ljsfilefs.js";

    var OPFS = "OPFS is no longer included by default; build with -lopfs.js";

    var NODEFS =
        "NODEFS is no longer included by default; build with -lnodefs.js";

    // perform assertions in shell.js after we set up out() and err(), as otherwise
    // if an assertion fails it cannot print the message
    assert(
        !ENVIRONMENT_IS_SHELL,
        "shell environment detected but not enabled at build time.  Add `shell` to `-sENVIRONMENT` to enable."
    );

    // end include: shell.js
    // include: preamble.js
    // === Preamble library stuff ===
    // Documentation for the public APIs defined in this file must be updated in:
    //    site/source/docs/api_reference/preamble.js.rst
    // A prebuilt local version of the documentation is available at:
    //    site/build/text/docs/api_reference/preamble.js.txt
    // You can also build docs locally as HTML or other formats in site/
    // An online HTML version (which may be of a different version of Emscripten)
    //    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
    var wasmBinary;

    if (typeof WebAssembly != "object") {
        err("no native wasm support detected");
    }

    // Wasm globals
    //========================================
    // Runtime essentials
    //========================================
    // whether we are quitting the application. no code should run after this.
    // set in exit() and abort()
    var ABORT = false;

    // set by exit() and abort().  Passed to 'onExit' handler.
    // NOTE: This is also used as the process return code code in shell environments
    // but only when noExitRuntime is false.
    var EXITSTATUS;

    // In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
    // don't define it at all in release modes.  This matches the behaviour of
    // MINIMAL_RUNTIME.
    // TODO(sbc): Make this the default even without STRICT enabled.
    /** @type {function( any , string=)} */ function assert(condition, text) {
        if (!condition) {
            abort("Assertion failed" + (text ? ": " + text : ""));
        }
    }

    // We used to include malloc/free by default in the past. Show a helpful error in
    // builds with assertions.
    /**
     * Indicates whether filename is delivered via file protocol (as opposed to
     * http/https)
     *
     * @noinline
     */ var isFileURI = filename => filename.startsWith("file://");

    // include: runtime_common.js
    // include: runtime_stack_check.js
    // Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
    function writeStackCookie() {
        var max = _emscripten_stack_get_end();
        assert((max & 3) == 0);
        // If the stack ends at address zero we write our cookies 4 bytes into the
        // stack.  This prevents interference with SAFE_HEAP and ASAN which also
        // monitor writes to address zero.
        if (max == 0) {
            max += 4;
        }
        // The stack grow downwards towards _emscripten_stack_get_end.
        // We write cookies to the final two words in the stack and detect if they are
        // ever overwritten.
        SAFE_HEAP_STORE(HEAPU32, max >> 2, 34821223);
        SAFE_HEAP_STORE(HEAPU32, (max + 4) >> 2, 2310721022);
    }

    function checkStackCookie() {
        if (ABORT) return;
        var max = _emscripten_stack_get_end();
        // See writeStackCookie().
        if (max == 0) {
            max += 4;
        }
        var cookie1 = SAFE_HEAP_LOAD(HEAPU32, max >> 2);
        var cookie2 = SAFE_HEAP_LOAD(HEAPU32, (max + 4) >> 2);
        if (cookie1 != 34821223 || cookie2 != 2310721022) {
            abort(
                `Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`
            );
        }
    }

    // end include: runtime_stack_check.js
    // include: runtime_exceptions.js
    // end include: runtime_exceptions.js
    // include: runtime_debug.js
    var runtimeDebug = true;

    // Switch to false at runtime to disable logging at the right times
    // Used by XXXXX_DEBUG settings to output debug messages.
    function dbg(...args) {
        if (!runtimeDebug && typeof runtimeDebug != "undefined") return;
        // TODO(sbc): Make this configurable somehow.  Its not always convenient for
        // logging to show up as warnings.
        console.warn(...args);
    }

    // Endianness check
    (() => {
        var h16 = new Int16Array(1);
        var h8 = new Int8Array(h16.buffer);
        h16[0] = 25459;
        if (h8[0] !== 115 || h8[1] !== 99)
            throw "Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)";
    })();

    function consumedModuleProp(prop) {
        if (!Object.getOwnPropertyDescriptor(Module, prop)) {
            Object.defineProperty(Module, prop, {
                configurable: true,
                set() {
                    abort(
                        `Attempt to set \`Module.${prop}\` after it has already been processed.  This can happen, for example, when code is injected via '--post-js' rather than '--pre-js'`
                    );
                },
            });
        }
    }

    function makeInvalidEarlyAccess(name) {
        return () =>
            assert(
                false,
                `call to '${name}' via reference taken before Wasm module initialization`
            );
    }

    function ignoredModuleProp(prop) {
        if (Object.getOwnPropertyDescriptor(Module, prop)) {
            abort(
                `\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`
            );
        }
    }

    // forcing the filesystem exports a few things by default
    function isExportedByForceFilesystem(name) {
        return (
            name === "FS_createPath" ||
            name === "FS_createDataFile" ||
            name === "FS_createPreloadedFile" ||
            name === "FS_preloadFile" ||
            name === "FS_unlink" ||
            name === "addRunDependency" || // The old FS has some functionality that WasmFS lacks.
            name === "FS_createLazyFile" ||
            name === "FS_createDevice" ||
            name === "removeRunDependency"
        );
    }

    function missingLibrarySymbol(sym) {
        // Any symbol that is not included from the JS library is also (by definition)
        // not exported on the Module object.
        unexportedRuntimeSymbol(sym);
    }

    function unexportedRuntimeSymbol(sym) {
        if (!Object.getOwnPropertyDescriptor(Module, sym)) {
            Object.defineProperty(Module, sym, {
                configurable: true,
                get() {
                    var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
                    if (isExportedByForceFilesystem(sym)) {
                        msg +=
                            ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
                    }
                    abort(msg);
                },
            });
        }
    }

    // end include: runtime_debug.js
    // include: runtime_safe_heap.js
    function SAFE_HEAP_INDEX(arr, idx, action) {
        const bytes = arr.BYTES_PER_ELEMENT;
        const dest = idx * bytes;
        if (idx <= 0)
            abort(
                `segmentation fault ${action} ${bytes} bytes at address ${dest}`
            );
        if (runtimeInitialized) {
            var brk = _sbrk(0);
            if (dest + bytes > brk)
                abort(
                    `segmentation fault, exceeded the top of the available dynamic heap when ${action} ${bytes} bytes at address ${dest}. DYNAMICTOP=${brk}`
                );
            if (brk < _emscripten_stack_get_base())
                abort(
                    `brk >= _emscripten_stack_get_base() (brk=${brk}, _emscripten_stack_get_base()=${_emscripten_stack_get_base()})`
                );
            // sbrk-managed memory must be above the stack
            if (brk > wasmMemory.buffer.byteLength)
                abort(
                    `brk <= wasmMemory.buffer.byteLength (brk=${brk}, wasmMemory.buffer.byteLength=${wasmMemory.buffer.byteLength})`
                );
        }
        return idx;
    }

    function SAFE_HEAP_LOAD(arr, idx) {
        return arr[SAFE_HEAP_INDEX(arr, idx, "loading")];
    }

    function SAFE_HEAP_STORE(arr, idx, value) {
        return (arr[SAFE_HEAP_INDEX(arr, idx, "storing")] = value);
    }

    function segfault() {
        abort("segmentation fault");
    }

    function alignfault() {
        abort("alignment fault");
    }

    // end include: runtime_safe_heap.js
    var readyPromiseResolve, readyPromiseReject;

    // Memory management
    var wasmMemory;

    var /** @type {!Int8Array} */ HEAP8,
        /** @type {!Uint8Array} */ HEAPU8,
        /** @type {!Int16Array} */ HEAP16,
        /** @type {!Uint16Array} */ HEAPU16,
        /** @type {!Int32Array} */ HEAP32,
        /** @type {!Uint32Array} */ HEAPU32,
        /** @type {!Float32Array} */ HEAPF32,
        /** @type {!Float64Array} */ HEAPF64;

    // BigInt64Array type is not correctly defined in closure
    var /** Not-@type {!BigInt64Array} */ HEAP64,
        /* BigUint64Array type is not correctly defined in closure
/** not-@type {!BigUint64Array} */ HEAPU64;

    var runtimeInitialized = false;

    function updateMemoryViews() {
        var b = wasmMemory.buffer;
        HEAP8 = new Int8Array(b);
        HEAP16 = new Int16Array(b);
        HEAPU8 = new Uint8Array(b);
        HEAPU16 = new Uint16Array(b);
        HEAP32 = new Int32Array(b);
        HEAPU32 = new Uint32Array(b);
        HEAPF32 = new Float32Array(b);
        HEAPF64 = new Float64Array(b);
        HEAP64 = new BigInt64Array(b);
        HEAPU64 = new BigUint64Array(b);
    }

    // include: memoryprofiler.js
    // end include: memoryprofiler.js
    // end include: runtime_common.js
    assert(
        typeof Int32Array != "undefined" &&
            typeof Float64Array !== "undefined" &&
            Int32Array.prototype.subarray != undefined &&
            Int32Array.prototype.set != undefined,
        "JS engine does not provide full typed array support"
    );

    function preRun() {
        if (Module["preRun"]) {
            if (typeof Module["preRun"] == "function")
                Module["preRun"] = [Module["preRun"]];
            while (Module["preRun"].length) {
                addOnPreRun(Module["preRun"].shift());
            }
        }
        consumedModuleProp("preRun");
        // Begin ATPRERUNS hooks
        callRuntimeCallbacks(onPreRuns);
    }

    function initRuntime() {
        assert(!runtimeInitialized);
        runtimeInitialized = true;
        checkStackCookie();
        // Begin ATINITS hooks
        if (!Module["noFSInit"] && !FS.initialized) FS.init();
        TTY.init();
        // End ATINITS hooks
        wasmExports["__wasm_call_ctors"]();
        // Begin ATPOSTCTORS hooks
        FS.ignorePermissions = false;
    }

    function postRun() {
        checkStackCookie();
        // PThreads reuse the runtime from the main thread.
        if (Module["postRun"]) {
            if (typeof Module["postRun"] == "function")
                Module["postRun"] = [Module["postRun"]];
            while (Module["postRun"].length) {
                addOnPostRun(Module["postRun"].shift());
            }
        }
        consumedModuleProp("postRun");
        // Begin ATPOSTRUNS hooks
        callRuntimeCallbacks(onPostRuns);
    }

    /** @param {string | number} [what] */ function abort(what) {
        Module["onAbort"]?.(what);
        what = "Aborted(" + what + ")";
        // TODO(sbc): Should we remove printing and leave it up to whoever
        // catches the exception?
        err(what);
        ABORT = true;
        // Use a wasm runtime error, because a JS error might be seen as a foreign
        // exception, which means we'd run destructors on it. We need the error to
        // simply make the program stop.
        // FIXME This approach does not work in Wasm EH because it currently does not assume
        // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
        // a trap or not based on a hidden field within the object. So at the moment
        // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
        // allows this in the wasm spec.
        // Suppress closure compiler warning here. Closure compiler's builtin extern
        // definition for WebAssembly.RuntimeError claims it takes no arguments even
        // though it can.
        // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
        /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(
            what
        );
        readyPromiseReject?.(e);
        // Throw the error whether or not MODULARIZE is set because abort is used
        // in code paths apart from instantiation where an exception is expected
        // to be thrown when abort is called.
        throw e;
    }

    function createExportWrapper(name, nargs) {
        return (...args) => {
            assert(
                runtimeInitialized,
                `native function \`${name}\` called before runtime initialization`
            );
            var f = wasmExports[name];
            assert(f, `exported native function \`${name}\` not found`);
            // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
            assert(
                args.length <= nargs,
                `native function \`${name}\` called with ${args.length} args but expects ${nargs}`
            );
            return f(...args);
        };
    }

    var wasmBinaryFile;

    function findWasmBinary() {
        if (Module["locateFile"]) {
            return locateFile("swisseph.wasm");
        }
        // Use bundler-friendly `new URL(..., import.meta.url)` pattern; works in browsers too.
        return new URL("swisseph.wasm", import.meta.url).href;
    }

    function getBinarySync(file) {
        if (file == wasmBinaryFile && wasmBinary) {
            return new Uint8Array(wasmBinary);
        }
        if (readBinary) {
            return readBinary(file);
        }
        throw "both async and sync fetching of the wasm failed";
    }

    async function getWasmBinary(binaryFile) {
        // If we don't have the binary yet, load it asynchronously using readAsync.
        if (!wasmBinary) {
            // Fetch the binary using readAsync
            try {
                var response = await readAsync(binaryFile);
                return new Uint8Array(response);
            } catch {}
        }
        // Otherwise, getBinarySync should be able to get it synchronously
        return getBinarySync(binaryFile);
    }

    async function instantiateArrayBuffer(binaryFile, imports) {
        try {
            var binary = await getWasmBinary(binaryFile);
            var instance = await WebAssembly.instantiate(binary, imports);
            return instance;
        } catch (reason) {
            err(`failed to asynchronously prepare wasm: ${reason}`);
            // Warn on some common problems.
            if (isFileURI(wasmBinaryFile)) {
                err(
                    `warning: Loading from a file URI (${wasmBinaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`
                );
            }
            abort(reason);
        }
    }

    async function instantiateAsync(binary, binaryFile, imports) {
        if (!binary && !ENVIRONMENT_IS_NODE) {
            try {
                var response = fetch(binaryFile, {
                    credentials: "same-origin",
                });
                var instantiationResult =
                    await WebAssembly.instantiateStreaming(response, imports);
                return instantiationResult;
            } catch (reason) {
                // We expect the most common failure cause to be a bad MIME type for the binary,
                // in which case falling back to ArrayBuffer instantiation should work.
                err(`wasm streaming compile failed: ${reason}`);
                err("falling back to ArrayBuffer instantiation");
            }
        }
        return instantiateArrayBuffer(binaryFile, imports);
    }

    function getWasmImports() {
        // prepare imports
        return {
            env: wasmImports,
            wasi_snapshot_preview1: wasmImports,
        };
    }

    // Create the wasm instance.
    // Receives the wasm imports, returns the exports.
    async function createWasm() {
        // Load the wasm module and create an instance of using native support in the JS engine.
        // handle a generated wasm instance, receiving its exports and
        // performing other necessary setup
        /** @param {WebAssembly.Module} [module] */ function receiveInstance(
            instance,
            module
        ) {
            wasmExports = instance.exports;
            wasmMemory = wasmExports["memory"];
            Module["wasmMemory"] = wasmMemory;
            assert(wasmMemory, "memory not found in wasm exports");
            updateMemoryViews();
            assignWasmExports(wasmExports);
            return wasmExports;
        }
        // Prefer streaming instantiation if available.
        // Async compilation can be confusing when an error on the page overwrites Module
        // (for example, if the order of elements is wrong, and the one defining Module is
        // later), so we save Module and check it later.
        var trueModule = Module;
        function receiveInstantiationResult(result) {
            // 'result' is a ResultObject object which has both the module and instance.
            // receiveInstance() will swap in the exports (to Module.asm) so they can be called
            assert(
                Module === trueModule,
                "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?"
            );
            trueModule = null;
            // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
            // When the regression is fixed, can restore the above PTHREADS-enabled path.
            return receiveInstance(result["instance"]);
        }
        var info = getWasmImports();
        // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
        // to manually instantiate the Wasm module themselves. This allows pages to
        // run the instantiation parallel to any other async startup actions they are
        // performing.
        // Also pthreads and wasm workers initialize the wasm instance through this
        // path.
        if (Module["instantiateWasm"]) {
            return new Promise((resolve, reject) => {
                try {
                    Module["instantiateWasm"](info, (mod, inst) => {
                        resolve(receiveInstance(mod, inst));
                    });
                } catch (e) {
                    err(
                        `Module.instantiateWasm callback failed with error: ${e}`
                    );
                    reject(e);
                }
            });
        }
        wasmBinaryFile ??= findWasmBinary();
        var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
        var exports = receiveInstantiationResult(result);
        return exports;
    }

    // end include: preamble.js
    // Begin JS library code
    class ExitStatus {
        name = "ExitStatus";
        constructor(status) {
            this.message = `Program terminated with exit(${status})`;
            this.status = status;
        }
    }

    var callRuntimeCallbacks = callbacks => {
        while (callbacks.length > 0) {
            // Pass the module as the first argument.
            callbacks.shift()(Module);
        }
    };

    var onPostRuns = [];

    var addOnPostRun = cb => onPostRuns.push(cb);

    var onPreRuns = [];

    var addOnPreRun = cb => onPreRuns.push(cb);

    /**
     * @param {number} ptr
     * @param {string} type
     */ function getValue(ptr, type = "i8") {
        if (type.endsWith("*")) type = "*";
        switch (type) {
            case "i1":
                return SAFE_HEAP_LOAD(HEAP8, ptr);

            case "i8":
                return SAFE_HEAP_LOAD(HEAP8, ptr);

            case "i16":
                return SAFE_HEAP_LOAD(HEAP16, ptr >> 1);

            case "i32":
                return SAFE_HEAP_LOAD(HEAP32, ptr >> 2);

            case "i64":
                return SAFE_HEAP_LOAD(HEAP64, ptr >> 3);

            case "float":
                return SAFE_HEAP_LOAD(HEAPF32, ptr >> 2);

            case "double":
                return SAFE_HEAP_LOAD(HEAPF64, ptr >> 3);

            case "*":
                return SAFE_HEAP_LOAD(HEAPU32, ptr >> 2);

            default:
                abort(`invalid type for getValue: ${type}`);
        }
    }

    var noExitRuntime = true;

    var ptrToString = ptr => {
        assert(typeof ptr === "number");
        // Convert to 32-bit unsigned value
        ptr >>>= 0;
        return "0x" + ptr.toString(16).padStart(8, "0");
    };

    /**
     * @param {number} ptr
     * @param {number} value
     * @param {string} type
     */ function setValue(ptr, value, type = "i8") {
        if (type.endsWith("*")) type = "*";
        switch (type) {
            case "i1":
                SAFE_HEAP_STORE(HEAP8, ptr, value);
                break;

            case "i8":
                SAFE_HEAP_STORE(HEAP8, ptr, value);
                break;

            case "i16":
                SAFE_HEAP_STORE(HEAP16, ptr >> 1, value);
                break;

            case "i32":
                SAFE_HEAP_STORE(HEAP32, ptr >> 2, value);
                break;

            case "i64":
                SAFE_HEAP_STORE(HEAP64, ptr >> 3, BigInt(value));
                break;

            case "float":
                SAFE_HEAP_STORE(HEAPF32, ptr >> 2, value);
                break;

            case "double":
                SAFE_HEAP_STORE(HEAPF64, ptr >> 3, value);
                break;

            case "*":
                SAFE_HEAP_STORE(HEAPU32, ptr >> 2, value);
                break;

            default:
                abort(`invalid type for setValue: ${type}`);
        }
    }

    var stackRestore = val => __emscripten_stack_restore(val);

    var stackSave = () => _emscripten_stack_get_current();

    var warnOnce = text => {
        warnOnce.shown ||= {};
        if (!warnOnce.shown[text]) {
            warnOnce.shown[text] = 1;
            if (ENVIRONMENT_IS_NODE) text = "warning: " + text;
            err(text);
        }
    };

    /** @suppress {duplicate} */ var syscallGetVarargI = () => {
        assert(SYSCALLS.varargs != undefined);
        // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
        var ret = SAFE_HEAP_LOAD(HEAP32, +SYSCALLS.varargs >> 2);
        SYSCALLS.varargs += 4;
        return ret;
    };

    var syscallGetVarargP = syscallGetVarargI;

    var PATH = {
        isAbs: path => path.charAt(0) === "/",
        splitPath: filename => {
            var splitPathRe =
                /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
            return splitPathRe.exec(filename).slice(1);
        },
        normalizeArray: (parts, allowAboveRoot) => {
            // if the path tries to go above the root, `up` ends up > 0
            var up = 0;
            for (var i = parts.length - 1; i >= 0; i--) {
                var last = parts[i];
                if (last === ".") {
                    parts.splice(i, 1);
                } else if (last === "..") {
                    parts.splice(i, 1);
                    up++;
                } else if (up) {
                    parts.splice(i, 1);
                    up--;
                }
            }
            // if the path is allowed to go above the root, restore leading ..s
            if (allowAboveRoot) {
                for (; up; up--) {
                    parts.unshift("..");
                }
            }
            return parts;
        },
        normalize: path => {
            var isAbsolute = PATH.isAbs(path),
                trailingSlash = path.slice(-1) === "/";
            // Normalize the path
            path = PATH.normalizeArray(
                path.split("/").filter(p => !!p),
                !isAbsolute
            ).join("/");
            if (!path && !isAbsolute) {
                path = ".";
            }
            if (path && trailingSlash) {
                path += "/";
            }
            return (isAbsolute ? "/" : "") + path;
        },
        dirname: path => {
            var result = PATH.splitPath(path),
                root = result[0],
                dir = result[1];
            if (!root && !dir) {
                // No dirname whatsoever
                return ".";
            }
            if (dir) {
                // It has a dirname, strip trailing slash
                dir = dir.slice(0, -1);
            }
            return root + dir;
        },
        basename: path => path && path.match(/([^\/]+|\/)\/*$/)[1],
        join: (...paths) => PATH.normalize(paths.join("/")),
        join2: (l, r) => PATH.normalize(l + "/" + r),
    };

    var initRandomFill = () => {
        // This block is not needed on v19+ since crypto.getRandomValues is builtin
        if (ENVIRONMENT_IS_NODE) {
            var nodeCrypto = require("crypto");
            return view => nodeCrypto.randomFillSync(view);
        }
        return view => crypto.getRandomValues(view);
    };

    var randomFill = view => {
        // Lazily init on the first invocation.
        (randomFill = initRandomFill())(view);
    };

    var PATH_FS = {
        resolve: (...args) => {
            var resolvedPath = "",
                resolvedAbsolute = false;
            for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
                var path = i >= 0 ? args[i] : FS.cwd();
                // Skip empty and invalid entries
                if (typeof path != "string") {
                    throw new TypeError(
                        "Arguments to path.resolve must be strings"
                    );
                } else if (!path) {
                    return "";
                }
                resolvedPath = path + "/" + resolvedPath;
                resolvedAbsolute = PATH.isAbs(path);
            }
            // At this point the path should be resolved to a full absolute path, but
            // handle relative paths to be safe (might happen when process.cwd() fails)
            resolvedPath = PATH.normalizeArray(
                resolvedPath.split("/").filter(p => !!p),
                !resolvedAbsolute
            ).join("/");
            return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
        },
        relative: (from, to) => {
            from = PATH_FS.resolve(from).slice(1);
            to = PATH_FS.resolve(to).slice(1);
            function trim(arr) {
                var start = 0;
                for (; start < arr.length; start++) {
                    if (arr[start] !== "") break;
                }
                var end = arr.length - 1;
                for (; end >= 0; end--) {
                    if (arr[end] !== "") break;
                }
                if (start > end) return [];
                return arr.slice(start, end - start + 1);
            }
            var fromParts = trim(from.split("/"));
            var toParts = trim(to.split("/"));
            var length = Math.min(fromParts.length, toParts.length);
            var samePartsLength = length;
            for (var i = 0; i < length; i++) {
                if (fromParts[i] !== toParts[i]) {
                    samePartsLength = i;
                    break;
                }
            }
            var outputParts = [];
            for (var i = samePartsLength; i < fromParts.length; i++) {
                outputParts.push("..");
            }
            outputParts = outputParts.concat(toParts.slice(samePartsLength));
            return outputParts.join("/");
        },
    };

    var UTF8Decoder =
        typeof TextDecoder != "undefined" ? new TextDecoder() : undefined;

    var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
        var maxIdx = idx + maxBytesToRead;
        if (ignoreNul) return maxIdx;
        // TextDecoder needs to know the byte length in advance, it doesn't stop on
        // null terminator by itself.
        // As a tiny code save trick, compare idx against maxIdx using a negation,
        // so that maxBytesToRead=undefined/NaN means Infinity.
        while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
        return idx;
    };

    /**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the
     * given array that contains uint8 values, returns a copy of that string as
     * a Javascript String object. heapOrArray is either a regular array, or a
     * JavaScript typed array view.
     *
     * @param {number} [idx]
     * @param {number} [maxBytesToRead]
     * @param {boolean} [ignoreNul] - If true, the function will not stop on a
     *   NUL character.
     * @returns {string}
     */ var UTF8ArrayToString = (
        heapOrArray,
        idx = 0,
        maxBytesToRead,
        ignoreNul
    ) => {
        var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
        // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
        if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
            return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
        }
        var str = "";
        while (idx < endPtr) {
            // For UTF8 byte structure, see:
            // http://en.wikipedia.org/wiki/UTF-8#Description
            // https://www.ietf.org/rfc/rfc2279.txt
            // https://tools.ietf.org/html/rfc3629
            var u0 = heapOrArray[idx++];
            if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue;
            }
            var u1 = heapOrArray[idx++] & 63;
            if ((u0 & 224) == 192) {
                str += String.fromCharCode(((u0 & 31) << 6) | u1);
                continue;
            }
            var u2 = heapOrArray[idx++] & 63;
            if ((u0 & 240) == 224) {
                u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
            } else {
                if ((u0 & 248) != 240)
                    warnOnce(
                        "Invalid UTF-8 leading byte " +
                            ptrToString(u0) +
                            " encountered when deserializing a UTF-8 string in wasm memory to a JS string!"
                    );
                u0 =
                    ((u0 & 7) << 18) |
                    (u1 << 12) |
                    (u2 << 6) |
                    (heapOrArray[idx++] & 63);
            }
            if (u0 < 65536) {
                str += String.fromCharCode(u0);
            } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(
                    55296 | (ch >> 10),
                    56320 | (ch & 1023)
                );
            }
        }
        return str;
    };

    var FS_stdin_getChar_buffer = [];

    var lengthBytesUTF8 = str => {
        var len = 0;
        for (var i = 0; i < str.length; ++i) {
            // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
            // unit, not a Unicode code point of the character! So decode
            // UTF16->UTF32->UTF8.
            // See http://unicode.org/faq/utf_bom.html#utf16-3
            var c = str.charCodeAt(i);
            // possibly a lead surrogate
            if (c <= 127) {
                len++;
            } else if (c <= 2047) {
                len += 2;
            } else if (c >= 55296 && c <= 57343) {
                len += 4;
                ++i;
            } else {
                len += 3;
            }
        }
        return len;
    };

    var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
        assert(
            typeof str === "string",
            `stringToUTF8Array expects a string (got ${typeof str})`
        );
        // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
        // undefined and false each don't write out any bytes.
        if (!(maxBytesToWrite > 0)) return 0;
        var startIdx = outIdx;
        var endIdx = outIdx + maxBytesToWrite - 1;
        // -1 for string null terminator.
        for (var i = 0; i < str.length; ++i) {
            // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
            // and https://www.ietf.org/rfc/rfc2279.txt
            // and https://tools.ietf.org/html/rfc3629
            var u = str.codePointAt(i);
            if (u <= 127) {
                if (outIdx >= endIdx) break;
                heap[outIdx++] = u;
            } else if (u <= 2047) {
                if (outIdx + 1 >= endIdx) break;
                heap[outIdx++] = 192 | (u >> 6);
                heap[outIdx++] = 128 | (u & 63);
            } else if (u <= 65535) {
                if (outIdx + 2 >= endIdx) break;
                heap[outIdx++] = 224 | (u >> 12);
                heap[outIdx++] = 128 | ((u >> 6) & 63);
                heap[outIdx++] = 128 | (u & 63);
            } else {
                if (outIdx + 3 >= endIdx) break;
                if (u > 1114111)
                    warnOnce(
                        "Invalid Unicode code point " +
                            ptrToString(u) +
                            " encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF)."
                    );
                heap[outIdx++] = 240 | (u >> 18);
                heap[outIdx++] = 128 | ((u >> 12) & 63);
                heap[outIdx++] = 128 | ((u >> 6) & 63);
                heap[outIdx++] = 128 | (u & 63);
                // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
                // We need to manually skip over the second code unit for correct iteration.
                i++;
            }
        }
        // Null-terminate the pointer to the buffer.
        heap[outIdx] = 0;
        return outIdx - startIdx;
    };

    /** @type {function(string, boolean=, number=)} */ var intArrayFromString =
        (stringy, dontAddNull, length) => {
            var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
            var u8array = new Array(len);
            var numBytesWritten = stringToUTF8Array(
                stringy,
                u8array,
                0,
                u8array.length
            );
            if (dontAddNull) u8array.length = numBytesWritten;
            return u8array;
        };

    var FS_stdin_getChar = () => {
        if (!FS_stdin_getChar_buffer.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
                // we will read data by chunks of BUFSIZE
                var BUFSIZE = 256;
                var buf = Buffer.alloc(BUFSIZE);
                var bytesRead = 0;
                // For some reason we must suppress a closure warning here, even though
                // fd definitely exists on process.stdin, and is even the proper way to
                // get the fd of stdin,
                // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
                // This started to happen after moving this logic out of library_tty.js,
                // so it is related to the surrounding code in some unclear manner.
                /** @suppress {missingProperties} */ var fd = process.stdin.fd;
                try {
                    bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
                } catch (e) {
                    // Cross-platform differences: on Windows, reading EOF throws an
                    // exception, but on other OSes, reading EOF returns 0. Uniformize
                    // behavior by treating the EOF exception to return 0.
                    if (e.toString().includes("EOF")) bytesRead = 0;
                    else throw e;
                }
                if (bytesRead > 0) {
                    result = buf.slice(0, bytesRead).toString("utf-8");
                }
            } else if (
                typeof window != "undefined" &&
                typeof window.prompt == "function"
            ) {
                // Browser.
                result = window.prompt("Input: ");
                // returns null on cancel
                if (result !== null) {
                    result += "\n";
                }
            } else {
            }
            if (!result) {
                return null;
            }
            FS_stdin_getChar_buffer = intArrayFromString(result, true);
        }
        return FS_stdin_getChar_buffer.shift();
    };

    var TTY = {
        ttys: [],
        init() {},
        shutdown() {},
        register(dev, ops) {
            TTY.ttys[dev] = {
                input: [],
                output: [],
                ops,
            };
            FS.registerDevice(dev, TTY.stream_ops);
        },
        stream_ops: {
            open(stream) {
                var tty = TTY.ttys[stream.node.rdev];
                if (!tty) {
                    throw new FS.ErrnoError(43);
                }
                stream.tty = tty;
                stream.seekable = false;
            },
            close(stream) {
                // flush any pending line data
                stream.tty.ops.fsync(stream.tty);
            },
            fsync(stream) {
                stream.tty.ops.fsync(stream.tty);
            },
            read(stream, buffer, offset, length, pos) {
                if (!stream.tty || !stream.tty.ops.get_char) {
                    throw new FS.ErrnoError(60);
                }
                var bytesRead = 0;
                for (var i = 0; i < length; i++) {
                    var result;
                    try {
                        result = stream.tty.ops.get_char(stream.tty);
                    } catch (e) {
                        throw new FS.ErrnoError(29);
                    }
                    if (result === undefined && bytesRead === 0) {
                        throw new FS.ErrnoError(6);
                    }
                    if (result === null || result === undefined) break;
                    bytesRead++;
                    buffer[offset + i] = result;
                }
                if (bytesRead) {
                    stream.node.atime = Date.now();
                }
                return bytesRead;
            },
            write(stream, buffer, offset, length, pos) {
                if (!stream.tty || !stream.tty.ops.put_char) {
                    throw new FS.ErrnoError(60);
                }
                try {
                    for (var i = 0; i < length; i++) {
                        stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
                    }
                } catch (e) {
                    throw new FS.ErrnoError(29);
                }
                if (length) {
                    stream.node.mtime = stream.node.ctime = Date.now();
                }
                return i;
            },
        },
        default_tty_ops: {
            get_char(tty) {
                return FS_stdin_getChar();
            },
            put_char(tty, val) {
                if (val === null || val === 10) {
                    out(UTF8ArrayToString(tty.output));
                    tty.output = [];
                } else {
                    if (val != 0) tty.output.push(val);
                }
            },
            fsync(tty) {
                if (tty.output?.length > 0) {
                    out(UTF8ArrayToString(tty.output));
                    tty.output = [];
                }
            },
            ioctl_tcgets(tty) {
                // typical setting
                return {
                    c_iflag: 25856,
                    c_oflag: 5,
                    c_cflag: 191,
                    c_lflag: 35387,
                    c_cc: [
                        3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23,
                        22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                    ],
                };
            },
            ioctl_tcsets(tty, optional_actions, data) {
                // currently just ignore
                return 0;
            },
            ioctl_tiocgwinsz(tty) {
                return [24, 80];
            },
        },
        default_tty1_ops: {
            put_char(tty, val) {
                if (val === null || val === 10) {
                    err(UTF8ArrayToString(tty.output));
                    tty.output = [];
                } else {
                    if (val != 0) tty.output.push(val);
                }
            },
            fsync(tty) {
                if (tty.output?.length > 0) {
                    err(UTF8ArrayToString(tty.output));
                    tty.output = [];
                }
            },
        },
    };

    var mmapAlloc = size => {
        abort(
            "internal error: mmapAlloc called but `emscripten_builtin_memalign` native symbol not exported"
        );
    };

    var MEMFS = {
        ops_table: null,
        mount(mount) {
            return MEMFS.createNode(null, "/", 16895, 0);
        },
        createNode(parent, name, mode, dev) {
            if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
                // no supported
                throw new FS.ErrnoError(63);
            }
            MEMFS.ops_table ||= {
                dir: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr,
                        lookup: MEMFS.node_ops.lookup,
                        mknod: MEMFS.node_ops.mknod,
                        rename: MEMFS.node_ops.rename,
                        unlink: MEMFS.node_ops.unlink,
                        rmdir: MEMFS.node_ops.rmdir,
                        readdir: MEMFS.node_ops.readdir,
                        symlink: MEMFS.node_ops.symlink,
                    },
                    stream: {
                        llseek: MEMFS.stream_ops.llseek,
                    },
                },
                file: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr,
                    },
                    stream: {
                        llseek: MEMFS.stream_ops.llseek,
                        read: MEMFS.stream_ops.read,
                        write: MEMFS.stream_ops.write,
                        mmap: MEMFS.stream_ops.mmap,
                        msync: MEMFS.stream_ops.msync,
                    },
                },
                link: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr,
                        readlink: MEMFS.node_ops.readlink,
                    },
                    stream: {},
                },
                chrdev: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr,
                    },
                    stream: FS.chrdev_stream_ops,
                },
            };
            var node = FS.createNode(parent, name, mode, dev);
            if (FS.isDir(node.mode)) {
                node.node_ops = MEMFS.ops_table.dir.node;
                node.stream_ops = MEMFS.ops_table.dir.stream;
                node.contents = {};
            } else if (FS.isFile(node.mode)) {
                node.node_ops = MEMFS.ops_table.file.node;
                node.stream_ops = MEMFS.ops_table.file.stream;
                node.usedBytes = 0;
                // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
                // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
                // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
                // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
                node.contents = null;
            } else if (FS.isLink(node.mode)) {
                node.node_ops = MEMFS.ops_table.link.node;
                node.stream_ops = MEMFS.ops_table.link.stream;
            } else if (FS.isChrdev(node.mode)) {
                node.node_ops = MEMFS.ops_table.chrdev.node;
                node.stream_ops = MEMFS.ops_table.chrdev.stream;
            }
            node.atime = node.mtime = node.ctime = Date.now();
            // add the new node to the parent
            if (parent) {
                parent.contents[name] = node;
                parent.atime = parent.mtime = parent.ctime = node.atime;
            }
            return node;
        },
        getFileDataAsTypedArray(node) {
            if (!node.contents) return new Uint8Array(0);
            if (node.contents.subarray)
                return node.contents.subarray(0, node.usedBytes);
            // Make sure to not return excess unused bytes.
            return new Uint8Array(node.contents);
        },
        expandFileStorage(node, newCapacity) {
            var prevCapacity = node.contents ? node.contents.length : 0;
            if (prevCapacity >= newCapacity) return;
            // No need to expand, the storage was already large enough.
            // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
            // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
            // avoid overshooting the allocation cap by a very large margin.
            var CAPACITY_DOUBLING_MAX = 1024 * 1024;
            newCapacity = Math.max(
                newCapacity,
                (prevCapacity *
                    (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>>
                    0
            );
            if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
            // At minimum allocate 256b for each file when expanding.
            var oldContents = node.contents;
            node.contents = new Uint8Array(newCapacity);
            // Allocate new storage.
            if (node.usedBytes > 0)
                node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        },
        resizeFileStorage(node, newSize) {
            if (node.usedBytes == newSize) return;
            if (newSize == 0) {
                node.contents = null;
                // Fully decommit when requesting a resize to zero.
                node.usedBytes = 0;
            } else {
                var oldContents = node.contents;
                node.contents = new Uint8Array(newSize);
                // Allocate new storage.
                if (oldContents) {
                    node.contents.set(
                        oldContents.subarray(
                            0,
                            Math.min(newSize, node.usedBytes)
                        )
                    );
                }
                node.usedBytes = newSize;
            }
        },
        node_ops: {
            getattr(node) {
                var attr = {};
                // device numbers reuse inode numbers.
                attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
                attr.ino = node.id;
                attr.mode = node.mode;
                attr.nlink = 1;
                attr.uid = 0;
                attr.gid = 0;
                attr.rdev = node.rdev;
                if (FS.isDir(node.mode)) {
                    attr.size = 4096;
                } else if (FS.isFile(node.mode)) {
                    attr.size = node.usedBytes;
                } else if (FS.isLink(node.mode)) {
                    attr.size = node.link.length;
                } else {
                    attr.size = 0;
                }
                attr.atime = new Date(node.atime);
                attr.mtime = new Date(node.mtime);
                attr.ctime = new Date(node.ctime);
                // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
                //       but this is not required by the standard.
                attr.blksize = 4096;
                attr.blocks = Math.ceil(attr.size / attr.blksize);
                return attr;
            },
            setattr(node, attr) {
                for (const key of ["mode", "atime", "mtime", "ctime"]) {
                    if (attr[key] != null) {
                        node[key] = attr[key];
                    }
                }
                if (attr.size !== undefined) {
                    MEMFS.resizeFileStorage(node, attr.size);
                }
            },
            lookup(parent, name) {
                throw new FS.ErrnoError(44);
            },
            mknod(parent, name, mode, dev) {
                return MEMFS.createNode(parent, name, mode, dev);
            },
            rename(old_node, new_dir, new_name) {
                var new_node;
                try {
                    new_node = FS.lookupNode(new_dir, new_name);
                } catch (e) {}
                if (new_node) {
                    if (FS.isDir(old_node.mode)) {
                        // if we're overwriting a directory at new_name, make sure it's empty.
                        for (var i in new_node.contents) {
                            throw new FS.ErrnoError(55);
                        }
                    }
                    FS.hashRemoveNode(new_node);
                }
                // do the internal rewiring
                delete old_node.parent.contents[old_node.name];
                new_dir.contents[new_name] = old_node;
                old_node.name = new_name;
                new_dir.ctime =
                    new_dir.mtime =
                    old_node.parent.ctime =
                    old_node.parent.mtime =
                        Date.now();
            },
            unlink(parent, name) {
                delete parent.contents[name];
                parent.ctime = parent.mtime = Date.now();
            },
            rmdir(parent, name) {
                var node = FS.lookupNode(parent, name);
                for (var i in node.contents) {
                    throw new FS.ErrnoError(55);
                }
                delete parent.contents[name];
                parent.ctime = parent.mtime = Date.now();
            },
            readdir(node) {
                return [".", "..", ...Object.keys(node.contents)];
            },
            symlink(parent, newname, oldpath) {
                var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
                node.link = oldpath;
                return node;
            },
            readlink(node) {
                if (!FS.isLink(node.mode)) {
                    throw new FS.ErrnoError(28);
                }
                return node.link;
            },
        },
        stream_ops: {
            read(stream, buffer, offset, length, position) {
                var contents = stream.node.contents;
                if (position >= stream.node.usedBytes) return 0;
                var size = Math.min(stream.node.usedBytes - position, length);
                assert(size >= 0);
                if (size > 8 && contents.subarray) {
                    // non-trivial, and typed array
                    buffer.set(
                        contents.subarray(position, position + size),
                        offset
                    );
                } else {
                    for (var i = 0; i < size; i++)
                        buffer[offset + i] = contents[position + i];
                }
                return size;
            },
            write(stream, buffer, offset, length, position, canOwn) {
                // The data buffer should be a typed array view
                assert(!(buffer instanceof ArrayBuffer));
                // If the buffer is located in main memory (HEAP), and if
                // memory can grow, we can't hold on to references of the
                // memory buffer, as they may get invalidated. That means we
                // need to do copy its contents.
                if (buffer.buffer === HEAP8.buffer) {
                    canOwn = false;
                }
                if (!length) return 0;
                var node = stream.node;
                node.mtime = node.ctime = Date.now();
                if (
                    buffer.subarray &&
                    (!node.contents || node.contents.subarray)
                ) {
                    // This write is from a typed array to a typed array?
                    if (canOwn) {
                        assert(
                            position === 0,
                            "canOwn must imply no weird position inside the file"
                        );
                        node.contents = buffer.subarray(
                            offset,
                            offset + length
                        );
                        node.usedBytes = length;
                        return length;
                    } else if (node.usedBytes === 0 && position === 0) {
                        // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
                        node.contents = buffer.slice(offset, offset + length);
                        node.usedBytes = length;
                        return length;
                    } else if (position + length <= node.usedBytes) {
                        // Writing to an already allocated and used subrange of the file?
                        node.contents.set(
                            buffer.subarray(offset, offset + length),
                            position
                        );
                        return length;
                    }
                }
                // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
                MEMFS.expandFileStorage(node, position + length);
                if (node.contents.subarray && buffer.subarray) {
                    // Use typed array write which is available.
                    node.contents.set(
                        buffer.subarray(offset, offset + length),
                        position
                    );
                } else {
                    for (var i = 0; i < length; i++) {
                        node.contents[position + i] = buffer[offset + i];
                    }
                }
                node.usedBytes = Math.max(node.usedBytes, position + length);
                return length;
            },
            llseek(stream, offset, whence) {
                var position = offset;
                if (whence === 1) {
                    position += stream.position;
                } else if (whence === 2) {
                    if (FS.isFile(stream.node.mode)) {
                        position += stream.node.usedBytes;
                    }
                }
                if (position < 0) {
                    throw new FS.ErrnoError(28);
                }
                return position;
            },
            mmap(stream, length, position, prot, flags) {
                if (!FS.isFile(stream.node.mode)) {
                    throw new FS.ErrnoError(43);
                }
                var ptr;
                var allocated;
                var contents = stream.node.contents;
                // Only make a new copy when MAP_PRIVATE is specified.
                if (
                    !(flags & 2) &&
                    contents &&
                    contents.buffer === HEAP8.buffer
                ) {
                    // We can't emulate MAP_SHARED when the file is not backed by the
                    // buffer we're mapping to (e.g. the HEAP buffer).
                    allocated = false;
                    ptr = contents.byteOffset;
                } else {
                    allocated = true;
                    ptr = mmapAlloc(length);
                    if (!ptr) {
                        throw new FS.ErrnoError(48);
                    }
                    if (contents) {
                        // Try to avoid unnecessary slices.
                        if (
                            position > 0 ||
                            position + length < contents.length
                        ) {
                            if (contents.subarray) {
                                contents = contents.subarray(
                                    position,
                                    position + length
                                );
                            } else {
                                contents = Array.prototype.slice.call(
                                    contents,
                                    position,
                                    position + length
                                );
                            }
                        }
                        HEAP8.set(contents, ptr);
                    }
                }
                return {
                    ptr,
                    allocated,
                };
            },
            msync(stream, buffer, offset, length, mmapFlags) {
                MEMFS.stream_ops.write(
                    stream,
                    buffer,
                    0,
                    length,
                    offset,
                    false
                );
                // should we check if bytesWritten and length are the same?
                return 0;
            },
        },
    };

    var FS_modeStringToFlags = str => {
        var flagModes = {
            r: 0,
            "r+": 2,
            w: 512 | 64 | 1,
            "w+": 512 | 64 | 2,
            a: 1024 | 64 | 1,
            "a+": 1024 | 64 | 2,
        };
        var flags = flagModes[str];
        if (typeof flags == "undefined") {
            throw new Error(`Unknown file open mode: ${str}`);
        }
        return flags;
    };

    var FS_getMode = (canRead, canWrite) => {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
    };

    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String
     * object.
     *
     * @param {number} ptr
     * @param {number} [maxBytesToRead] - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan
     *   the string until the first 0 byte. If maxBytesToRead is passed, and the
     *   string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
     *   middle, then the string will cut short at that byte index.
     * @param {boolean} [ignoreNul] - If true, the function will not stop on a
     *   NUL character.
     * @returns {string}
     */ var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
        assert(
            typeof ptr == "number",
            `UTF8ToString expects a number (got ${typeof ptr})`
        );
        return ptr
            ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul)
            : "";
    };

    var strError = errno => UTF8ToString(_strerror(errno));

    var ERRNO_CODES = {
        EPERM: 63,
        ENOENT: 44,
        ESRCH: 71,
        EINTR: 27,
        EIO: 29,
        ENXIO: 60,
        E2BIG: 1,
        ENOEXEC: 45,
        EBADF: 8,
        ECHILD: 12,
        EAGAIN: 6,
        EWOULDBLOCK: 6,
        ENOMEM: 48,
        EACCES: 2,
        EFAULT: 21,
        ENOTBLK: 105,
        EBUSY: 10,
        EEXIST: 20,
        EXDEV: 75,
        ENODEV: 43,
        ENOTDIR: 54,
        EISDIR: 31,
        EINVAL: 28,
        ENFILE: 41,
        EMFILE: 33,
        ENOTTY: 59,
        ETXTBSY: 74,
        EFBIG: 22,
        ENOSPC: 51,
        ESPIPE: 70,
        EROFS: 69,
        EMLINK: 34,
        EPIPE: 64,
        EDOM: 18,
        ERANGE: 68,
        ENOMSG: 49,
        EIDRM: 24,
        ECHRNG: 106,
        EL2NSYNC: 156,
        EL3HLT: 107,
        EL3RST: 108,
        ELNRNG: 109,
        EUNATCH: 110,
        ENOCSI: 111,
        EL2HLT: 112,
        EDEADLK: 16,
        ENOLCK: 46,
        EBADE: 113,
        EBADR: 114,
        EXFULL: 115,
        ENOANO: 104,
        EBADRQC: 103,
        EBADSLT: 102,
        EDEADLOCK: 16,
        EBFONT: 101,
        ENOSTR: 100,
        ENODATA: 116,
        ETIME: 117,
        ENOSR: 118,
        ENONET: 119,
        ENOPKG: 120,
        EREMOTE: 121,
        ENOLINK: 47,
        EADV: 122,
        ESRMNT: 123,
        ECOMM: 124,
        EPROTO: 65,
        EMULTIHOP: 36,
        EDOTDOT: 125,
        EBADMSG: 9,
        ENOTUNIQ: 126,
        EBADFD: 127,
        EREMCHG: 128,
        ELIBACC: 129,
        ELIBBAD: 130,
        ELIBSCN: 131,
        ELIBMAX: 132,
        ELIBEXEC: 133,
        ENOSYS: 52,
        ENOTEMPTY: 55,
        ENAMETOOLONG: 37,
        ELOOP: 32,
        EOPNOTSUPP: 138,
        EPFNOSUPPORT: 139,
        ECONNRESET: 15,
        ENOBUFS: 42,
        EAFNOSUPPORT: 5,
        EPROTOTYPE: 67,
        ENOTSOCK: 57,
        ENOPROTOOPT: 50,
        ESHUTDOWN: 140,
        ECONNREFUSED: 14,
        EADDRINUSE: 3,
        ECONNABORTED: 13,
        ENETUNREACH: 40,
        ENETDOWN: 38,
        ETIMEDOUT: 73,
        EHOSTDOWN: 142,
        EHOSTUNREACH: 23,
        EINPROGRESS: 26,
        EALREADY: 7,
        EDESTADDRREQ: 17,
        EMSGSIZE: 35,
        EPROTONOSUPPORT: 66,
        ESOCKTNOSUPPORT: 137,
        EADDRNOTAVAIL: 4,
        ENETRESET: 39,
        EISCONN: 30,
        ENOTCONN: 53,
        ETOOMANYREFS: 141,
        EUSERS: 136,
        EDQUOT: 19,
        ESTALE: 72,
        ENOTSUP: 138,
        ENOMEDIUM: 148,
        EILSEQ: 25,
        EOVERFLOW: 61,
        ECANCELED: 11,
        ENOTRECOVERABLE: 56,
        EOWNERDEAD: 62,
        ESTRPIPE: 135,
    };

    var asyncLoad = async url => {
        var arrayBuffer = await readAsync(url);
        assert(
            arrayBuffer,
            `Loading data file "${url}" failed (no arrayBuffer).`
        );
        return new Uint8Array(arrayBuffer);
    };

    var FS_createDataFile = (...args) => FS.createDataFile(...args);

    var getUniqueRunDependency = id => {
        var orig = id;
        while (1) {
            if (!runDependencyTracking[id]) return id;
            id = orig + Math.random();
        }
    };

    var runDependencies = 0;

    var dependenciesFulfilled = null;

    var runDependencyTracking = {};

    var runDependencyWatcher = null;

    var removeRunDependency = id => {
        runDependencies--;
        Module["monitorRunDependencies"]?.(runDependencies);
        assert(id, "removeRunDependency requires an ID");
        assert(runDependencyTracking[id]);
        delete runDependencyTracking[id];
        if (runDependencies == 0) {
            if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
            }
            if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
            }
        }
    };

    var addRunDependency = id => {
        runDependencies++;
        Module["monitorRunDependencies"]?.(runDependencies);
        assert(id, "addRunDependency requires an ID");
        assert(!runDependencyTracking[id]);
        runDependencyTracking[id] = 1;
        if (
            runDependencyWatcher === null &&
            typeof setInterval != "undefined"
        ) {
            // Check for missing dependencies every few seconds
            runDependencyWatcher = setInterval(() => {
                if (ABORT) {
                    clearInterval(runDependencyWatcher);
                    runDependencyWatcher = null;
                    return;
                }
                var shown = false;
                for (var dep in runDependencyTracking) {
                    if (!shown) {
                        shown = true;
                        err("still waiting on run dependencies:");
                    }
                    err(`dependency: ${dep}`);
                }
                if (shown) {
                    err("(end of list)");
                }
            }, 1e4);
            // Prevent this timer from keeping the runtime alive if nothing
            // else is.
            runDependencyWatcher.unref?.();
        }
    };

    var preloadPlugins = [];

    var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
        // Ensure plugins are ready.
        if (typeof Browser != "undefined") Browser.init();
        for (var plugin of preloadPlugins) {
            if (plugin["canHandle"](fullname)) {
                assert(
                    plugin["handle"].constructor.name === "AsyncFunction",
                    "Filesystem plugin handlers must be async functions (See #24914)"
                );
                return plugin["handle"](byteArray, fullname);
            }
        }
        // In no plugin handled this file then return the original/unmodified
        // byteArray.
        return byteArray;
    };

    var FS_preloadFile = async (
        parent,
        name,
        url,
        canRead,
        canWrite,
        dontCreateFile,
        canOwn,
        preFinish
    ) => {
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name
            ? PATH_FS.resolve(PATH.join2(parent, name))
            : parent;
        var dep = getUniqueRunDependency(`cp ${fullname}`);
        // might have several active requests for the same fullname
        addRunDependency(dep);
        try {
            var byteArray = url;
            if (typeof url == "string") {
                byteArray = await asyncLoad(url);
            }
            byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
            preFinish?.();
            if (!dontCreateFile) {
                FS_createDataFile(
                    parent,
                    name,
                    byteArray,
                    canRead,
                    canWrite,
                    canOwn
                );
            }
        } finally {
            removeRunDependency(dep);
        }
    };

    var FS_createPreloadedFile = (
        parent,
        name,
        url,
        canRead,
        canWrite,
        onload,
        onerror,
        dontCreateFile,
        canOwn,
        preFinish
    ) => {
        FS_preloadFile(
            parent,
            name,
            url,
            canRead,
            canWrite,
            dontCreateFile,
            canOwn,
            preFinish
        )
            .then(onload)
            .catch(onerror);
    };

    var FS = {
        root: null,
        mounts: [],
        devices: {},
        streams: [],
        nextInode: 1,
        nameTable: null,
        currentPath: "/",
        initialized: false,
        ignorePermissions: true,
        filesystems: null,
        syncFSRequests: 0,
        readFiles: {},
        ErrnoError: class extends Error {
            name = "ErrnoError";
            // We set the `name` property to be able to identify `FS.ErrnoError`
            // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
            // - when using PROXYFS, an error can come from an underlying FS
            // as different FS objects have their own FS.ErrnoError each,
            // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
            // we'll use the reliable test `err.name == "ErrnoError"` instead
            constructor(errno) {
                super(runtimeInitialized ? strError(errno) : "");
                this.errno = errno;
                for (var key in ERRNO_CODES) {
                    if (ERRNO_CODES[key] === errno) {
                        this.code = key;
                        break;
                    }
                }
            }
        },
        FSStream: class {
            shared = {};
            get object() {
                return this.node;
            }
            set object(val) {
                this.node = val;
            }
            get isRead() {
                return (this.flags & 2097155) !== 1;
            }
            get isWrite() {
                return (this.flags & 2097155) !== 0;
            }
            get isAppend() {
                return this.flags & 1024;
            }
            get flags() {
                return this.shared.flags;
            }
            set flags(val) {
                this.shared.flags = val;
            }
            get position() {
                return this.shared.position;
            }
            set position(val) {
                this.shared.position = val;
            }
        },
        FSNode: class {
            node_ops = {};
            stream_ops = {};
            readMode = 292 | 73;
            writeMode = 146;
            mounted = null;
            constructor(parent, name, mode, rdev) {
                if (!parent) {
                    parent = this;
                }
                this.parent = parent;
                this.mount = parent.mount;
                this.id = FS.nextInode++;
                this.name = name;
                this.mode = mode;
                this.rdev = rdev;
                this.atime = this.mtime = this.ctime = Date.now();
            }
            get read() {
                return (this.mode & this.readMode) === this.readMode;
            }
            set read(val) {
                val
                    ? (this.mode |= this.readMode)
                    : (this.mode &= ~this.readMode);
            }
            get write() {
                return (this.mode & this.writeMode) === this.writeMode;
            }
            set write(val) {
                val
                    ? (this.mode |= this.writeMode)
                    : (this.mode &= ~this.writeMode);
            }
            get isFolder() {
                return FS.isDir(this.mode);
            }
            get isDevice() {
                return FS.isChrdev(this.mode);
            }
        },
        lookupPath(path, opts = {}) {
            if (!path) {
                throw new FS.ErrnoError(44);
            }
            opts.follow_mount ??= true;
            if (!PATH.isAbs(path)) {
                path = FS.cwd() + "/" + path;
            }
            // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
            linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
                // split the absolute path
                var parts = path.split("/").filter(p => !!p);
                // start at the root
                var current = FS.root;
                var current_path = "/";
                for (var i = 0; i < parts.length; i++) {
                    var islast = i === parts.length - 1;
                    if (islast && opts.parent) {
                        // stop resolving
                        break;
                    }
                    if (parts[i] === ".") {
                        continue;
                    }
                    if (parts[i] === "..") {
                        current_path = PATH.dirname(current_path);
                        if (FS.isRoot(current)) {
                            path =
                                current_path +
                                "/" +
                                parts.slice(i + 1).join("/");
                            // We're making progress here, don't let many consecutive ..'s
                            // lead to ELOOP
                            nlinks--;
                            continue linkloop;
                        } else {
                            current = current.parent;
                        }
                        continue;
                    }
                    current_path = PATH.join2(current_path, parts[i]);
                    try {
                        current = FS.lookupNode(current, parts[i]);
                    } catch (e) {
                        // if noent_okay is true, suppress a ENOENT in the last component
                        // and return an object with an undefined node. This is needed for
                        // resolving symlinks in the path when creating a file.
                        if (e?.errno === 44 && islast && opts.noent_okay) {
                            return {
                                path: current_path,
                            };
                        }
                        throw e;
                    }
                    // jump to the mount's root node if this is a mountpoint
                    if (
                        FS.isMountpoint(current) &&
                        (!islast || opts.follow_mount)
                    ) {
                        current = current.mounted.root;
                    }
                    // by default, lookupPath will not follow a symlink if it is the final path component.
                    // setting opts.follow = true will override this behavior.
                    if (FS.isLink(current.mode) && (!islast || opts.follow)) {
                        if (!current.node_ops.readlink) {
                            throw new FS.ErrnoError(52);
                        }
                        var link = current.node_ops.readlink(current);
                        if (!PATH.isAbs(link)) {
                            link = PATH.dirname(current_path) + "/" + link;
                        }
                        path = link + "/" + parts.slice(i + 1).join("/");
                        continue linkloop;
                    }
                }
                return {
                    path: current_path,
                    node: current,
                };
            }
            throw new FS.ErrnoError(32);
        },
        getPath(node) {
            var path;
            while (true) {
                if (FS.isRoot(node)) {
                    var mount = node.mount.mountpoint;
                    if (!path) return mount;
                    return mount[mount.length - 1] !== "/"
                        ? `${mount}/${path}`
                        : mount + path;
                }
                path = path ? `${node.name}/${path}` : node.name;
                node = node.parent;
            }
        },
        hashName(parentid, name) {
            var hash = 0;
            for (var i = 0; i < name.length; i++) {
                hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
            }
            return ((parentid + hash) >>> 0) % FS.nameTable.length;
        },
        hashAddNode(node) {
            var hash = FS.hashName(node.parent.id, node.name);
            node.name_next = FS.nameTable[hash];
            FS.nameTable[hash] = node;
        },
        hashRemoveNode(node) {
            var hash = FS.hashName(node.parent.id, node.name);
            if (FS.nameTable[hash] === node) {
                FS.nameTable[hash] = node.name_next;
            } else {
                var current = FS.nameTable[hash];
                while (current) {
                    if (current.name_next === node) {
                        current.name_next = node.name_next;
                        break;
                    }
                    current = current.name_next;
                }
            }
        },
        lookupNode(parent, name) {
            var errCode = FS.mayLookup(parent);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            var hash = FS.hashName(parent.id, name);
            for (var node = FS.nameTable[hash]; node; node = node.name_next) {
                var nodeName = node.name;
                if (node.parent.id === parent.id && nodeName === name) {
                    return node;
                }
            }
            // if we failed to find it in the cache, call into the VFS
            return FS.lookup(parent, name);
        },
        createNode(parent, name, mode, rdev) {
            assert(typeof parent == "object");
            var node = new FS.FSNode(parent, name, mode, rdev);
            FS.hashAddNode(node);
            return node;
        },
        destroyNode(node) {
            FS.hashRemoveNode(node);
        },
        isRoot(node) {
            return node === node.parent;
        },
        isMountpoint(node) {
            return !!node.mounted;
        },
        isFile(mode) {
            return (mode & 61440) === 32768;
        },
        isDir(mode) {
            return (mode & 61440) === 16384;
        },
        isLink(mode) {
            return (mode & 61440) === 40960;
        },
        isChrdev(mode) {
            return (mode & 61440) === 8192;
        },
        isBlkdev(mode) {
            return (mode & 61440) === 24576;
        },
        isFIFO(mode) {
            return (mode & 61440) === 4096;
        },
        isSocket(mode) {
            return (mode & 49152) === 49152;
        },
        flagsToPermissionString(flag) {
            var perms = ["r", "w", "rw"][flag & 3];
            if (flag & 512) {
                perms += "w";
            }
            return perms;
        },
        nodePermissions(node, perms) {
            if (FS.ignorePermissions) {
                return 0;
            }
            // return 0 if any user, group or owner bits are set.
            if (perms.includes("r") && !(node.mode & 292)) {
                return 2;
            } else if (perms.includes("w") && !(node.mode & 146)) {
                return 2;
            } else if (perms.includes("x") && !(node.mode & 73)) {
                return 2;
            }
            return 0;
        },
        mayLookup(dir) {
            if (!FS.isDir(dir.mode)) return 54;
            var errCode = FS.nodePermissions(dir, "x");
            if (errCode) return errCode;
            if (!dir.node_ops.lookup) return 2;
            return 0;
        },
        mayCreate(dir, name) {
            if (!FS.isDir(dir.mode)) {
                return 54;
            }
            try {
                var node = FS.lookupNode(dir, name);
                return 20;
            } catch (e) {}
            return FS.nodePermissions(dir, "wx");
        },
        mayDelete(dir, name, isdir) {
            var node;
            try {
                node = FS.lookupNode(dir, name);
            } catch (e) {
                return e.errno;
            }
            var errCode = FS.nodePermissions(dir, "wx");
            if (errCode) {
                return errCode;
            }
            if (isdir) {
                if (!FS.isDir(node.mode)) {
                    return 54;
                }
                if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                    return 10;
                }
            } else {
                if (FS.isDir(node.mode)) {
                    return 31;
                }
            }
            return 0;
        },
        mayOpen(node, flags) {
            if (!node) {
                return 44;
            }
            if (FS.isLink(node.mode)) {
                return 32;
            } else if (FS.isDir(node.mode)) {
                if (
                    FS.flagsToPermissionString(flags) !== "r" ||
                    flags & (512 | 64)
                ) {
                    // TODO: check for O_SEARCH? (== search for dir only)
                    return 31;
                }
            }
            return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
        },
        checkOpExists(op, err) {
            if (!op) {
                throw new FS.ErrnoError(err);
            }
            return op;
        },
        MAX_OPEN_FDS: 4096,
        nextfd() {
            for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
                if (!FS.streams[fd]) {
                    return fd;
                }
            }
            throw new FS.ErrnoError(33);
        },
        getStreamChecked(fd) {
            var stream = FS.getStream(fd);
            if (!stream) {
                throw new FS.ErrnoError(8);
            }
            return stream;
        },
        getStream: fd => FS.streams[fd],
        createStream(stream, fd = -1) {
            assert(fd >= -1);
            // clone it, so we can return an instance of FSStream
            stream = Object.assign(new FS.FSStream(), stream);
            if (fd == -1) {
                fd = FS.nextfd();
            }
            stream.fd = fd;
            FS.streams[fd] = stream;
            return stream;
        },
        closeStream(fd) {
            FS.streams[fd] = null;
        },
        dupStream(origStream, fd = -1) {
            var stream = FS.createStream(origStream, fd);
            stream.stream_ops?.dup?.(stream);
            return stream;
        },
        doSetAttr(stream, node, attr) {
            var setattr = stream?.stream_ops.setattr;
            var arg = setattr ? stream : node;
            setattr ??= node.node_ops.setattr;
            FS.checkOpExists(setattr, 63);
            setattr(arg, attr);
        },
        chrdev_stream_ops: {
            open(stream) {
                var device = FS.getDevice(stream.node.rdev);
                // override node's stream ops with the device's
                stream.stream_ops = device.stream_ops;
                // forward the open call
                stream.stream_ops.open?.(stream);
            },
            llseek() {
                throw new FS.ErrnoError(70);
            },
        },
        major: dev => dev >> 8,
        minor: dev => dev & 255,
        makedev: (ma, mi) => (ma << 8) | mi,
        registerDevice(dev, ops) {
            FS.devices[dev] = {
                stream_ops: ops,
            };
        },
        getDevice: dev => FS.devices[dev],
        getMounts(mount) {
            var mounts = [];
            var check = [mount];
            while (check.length) {
                var m = check.pop();
                mounts.push(m);
                check.push(...m.mounts);
            }
            return mounts;
        },
        syncfs(populate, callback) {
            if (typeof populate == "function") {
                callback = populate;
                populate = false;
            }
            FS.syncFSRequests++;
            if (FS.syncFSRequests > 1) {
                err(
                    `warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`
                );
            }
            var mounts = FS.getMounts(FS.root.mount);
            var completed = 0;
            function doCallback(errCode) {
                assert(FS.syncFSRequests > 0);
                FS.syncFSRequests--;
                return callback(errCode);
            }
            function done(errCode) {
                if (errCode) {
                    if (!done.errored) {
                        done.errored = true;
                        return doCallback(errCode);
                    }
                    return;
                }
                if (++completed >= mounts.length) {
                    doCallback(null);
                }
            }
            // sync all mounts
            mounts.forEach(mount => {
                if (!mount.type.syncfs) {
                    return done(null);
                }
                mount.type.syncfs(mount, populate, done);
            });
        },
        mount(type, opts, mountpoint) {
            if (typeof type == "string") {
                // The filesystem was not included, and instead we have an error
                // message stored in the variable.
                throw type;
            }
            var root = mountpoint === "/";
            var pseudo = !mountpoint;
            var node;
            if (root && FS.root) {
                throw new FS.ErrnoError(10);
            } else if (!root && !pseudo) {
                var lookup = FS.lookupPath(mountpoint, {
                    follow_mount: false,
                });
                mountpoint = lookup.path;
                // use the absolute path
                node = lookup.node;
                if (FS.isMountpoint(node)) {
                    throw new FS.ErrnoError(10);
                }
                if (!FS.isDir(node.mode)) {
                    throw new FS.ErrnoError(54);
                }
            }
            var mount = {
                type,
                opts,
                mountpoint,
                mounts: [],
            };
            // create a root node for the fs
            var mountRoot = type.mount(mount);
            mountRoot.mount = mount;
            mount.root = mountRoot;
            if (root) {
                FS.root = mountRoot;
            } else if (node) {
                // set as a mountpoint
                node.mounted = mount;
                // add the new mount to the current mount's children
                if (node.mount) {
                    node.mount.mounts.push(mount);
                }
            }
            return mountRoot;
        },
        unmount(mountpoint) {
            var lookup = FS.lookupPath(mountpoint, {
                follow_mount: false,
            });
            if (!FS.isMountpoint(lookup.node)) {
                throw new FS.ErrnoError(28);
            }
            // destroy the nodes for this mount, and all its child mounts
            var node = lookup.node;
            var mount = node.mounted;
            var mounts = FS.getMounts(mount);
            Object.keys(FS.nameTable).forEach(hash => {
                var current = FS.nameTable[hash];
                while (current) {
                    var next = current.name_next;
                    if (mounts.includes(current.mount)) {
                        FS.destroyNode(current);
                    }
                    current = next;
                }
            });
            // no longer a mountpoint
            node.mounted = null;
            // remove this mount from the child mounts
            var idx = node.mount.mounts.indexOf(mount);
            assert(idx !== -1);
            node.mount.mounts.splice(idx, 1);
        },
        lookup(parent, name) {
            return parent.node_ops.lookup(parent, name);
        },
        mknod(path, mode, dev) {
            var lookup = FS.lookupPath(path, {
                parent: true,
            });
            var parent = lookup.node;
            var name = PATH.basename(path);
            if (!name) {
                throw new FS.ErrnoError(28);
            }
            if (name === "." || name === "..") {
                throw new FS.ErrnoError(20);
            }
            var errCode = FS.mayCreate(parent, name);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.mknod) {
                throw new FS.ErrnoError(63);
            }
            return parent.node_ops.mknod(parent, name, mode, dev);
        },
        statfs(path) {
            return FS.statfsNode(
                FS.lookupPath(path, {
                    follow: true,
                }).node
            );
        },
        statfsStream(stream) {
            // We keep a separate statfsStream function because noderawfs overrides
            // it. In noderawfs, stream.node is sometimes null. Instead, we need to
            // look at stream.path.
            return FS.statfsNode(stream.node);
        },
        statfsNode(node) {
            // NOTE: None of the defaults here are true. We're just returning safe and
            //       sane values. Currently nodefs and rawfs replace these defaults,
            //       other file systems leave them alone.
            var rtn = {
                bsize: 4096,
                frsize: 4096,
                blocks: 1e6,
                bfree: 5e5,
                bavail: 5e5,
                files: FS.nextInode,
                ffree: FS.nextInode - 1,
                fsid: 42,
                flags: 2,
                namelen: 255,
            };
            if (node.node_ops.statfs) {
                Object.assign(rtn, node.node_ops.statfs(node.mount.opts.root));
            }
            return rtn;
        },
        create(path, mode = 438) {
            mode &= 4095;
            mode |= 32768;
            return FS.mknod(path, mode, 0);
        },
        mkdir(path, mode = 511) {
            mode &= 511 | 512;
            mode |= 16384;
            return FS.mknod(path, mode, 0);
        },
        mkdirTree(path, mode) {
            var dirs = path.split("/");
            var d = "";
            for (var dir of dirs) {
                if (!dir) continue;
                if (d || PATH.isAbs(path)) d += "/";
                d += dir;
                try {
                    FS.mkdir(d, mode);
                } catch (e) {
                    if (e.errno != 20) throw e;
                }
            }
        },
        mkdev(path, mode, dev) {
            if (typeof dev == "undefined") {
                dev = mode;
                mode = 438;
            }
            mode |= 8192;
            return FS.mknod(path, mode, dev);
        },
        symlink(oldpath, newpath) {
            if (!PATH_FS.resolve(oldpath)) {
                throw new FS.ErrnoError(44);
            }
            var lookup = FS.lookupPath(newpath, {
                parent: true,
            });
            var parent = lookup.node;
            if (!parent) {
                throw new FS.ErrnoError(44);
            }
            var newname = PATH.basename(newpath);
            var errCode = FS.mayCreate(parent, newname);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.symlink) {
                throw new FS.ErrnoError(63);
            }
            return parent.node_ops.symlink(parent, newname, oldpath);
        },
        rename(old_path, new_path) {
            var old_dirname = PATH.dirname(old_path);
            var new_dirname = PATH.dirname(new_path);
            var old_name = PATH.basename(old_path);
            var new_name = PATH.basename(new_path);
            // parents must exist
            var lookup, old_dir, new_dir;
            // let the errors from non existent directories percolate up
            lookup = FS.lookupPath(old_path, {
                parent: true,
            });
            old_dir = lookup.node;
            lookup = FS.lookupPath(new_path, {
                parent: true,
            });
            new_dir = lookup.node;
            if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
            // need to be part of the same mount
            if (old_dir.mount !== new_dir.mount) {
                throw new FS.ErrnoError(75);
            }
            // source must exist
            var old_node = FS.lookupNode(old_dir, old_name);
            // old path should not be an ancestor of the new path
            var relative = PATH_FS.relative(old_path, new_dirname);
            if (relative.charAt(0) !== ".") {
                throw new FS.ErrnoError(28);
            }
            // new path should not be an ancestor of the old path
            relative = PATH_FS.relative(new_path, old_dirname);
            if (relative.charAt(0) !== ".") {
                throw new FS.ErrnoError(55);
            }
            // see if the new path already exists
            var new_node;
            try {
                new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {}
            // early out if nothing needs to change
            if (old_node === new_node) {
                return;
            }
            // we'll need to delete the old entry
            var isdir = FS.isDir(old_node.mode);
            var errCode = FS.mayDelete(old_dir, old_name, isdir);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            // need delete permissions if we'll be overwriting.
            // need create permissions if new doesn't already exist.
            errCode = new_node
                ? FS.mayDelete(new_dir, new_name, isdir)
                : FS.mayCreate(new_dir, new_name);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!old_dir.node_ops.rename) {
                throw new FS.ErrnoError(63);
            }
            if (
                FS.isMountpoint(old_node) ||
                (new_node && FS.isMountpoint(new_node))
            ) {
                throw new FS.ErrnoError(10);
            }
            // if we are going to change the parent, check write permissions
            if (new_dir !== old_dir) {
                errCode = FS.nodePermissions(old_dir, "w");
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
            }
            // remove the node from the lookup hash
            FS.hashRemoveNode(old_node);
            // do the underlying fs rename
            try {
                old_dir.node_ops.rename(old_node, new_dir, new_name);
                // update old node (we do this here to avoid each backend
                // needing to)
                old_node.parent = new_dir;
            } catch (e) {
                throw e;
            } finally {
                // add the node back to the hash (in case node_ops.rename
                // changed its name)
                FS.hashAddNode(old_node);
            }
        },
        rmdir(path) {
            var lookup = FS.lookupPath(path, {
                parent: true,
            });
            var parent = lookup.node;
            var name = PATH.basename(path);
            var node = FS.lookupNode(parent, name);
            var errCode = FS.mayDelete(parent, name, true);
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.rmdir) {
                throw new FS.ErrnoError(63);
            }
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(10);
            }
            parent.node_ops.rmdir(parent, name);
            FS.destroyNode(node);
        },
        readdir(path) {
            var lookup = FS.lookupPath(path, {
                follow: true,
            });
            var node = lookup.node;
            var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
            return readdir(node);
        },
        unlink(path) {
            var lookup = FS.lookupPath(path, {
                parent: true,
            });
            var parent = lookup.node;
            if (!parent) {
                throw new FS.ErrnoError(44);
            }
            var name = PATH.basename(path);
            var node = FS.lookupNode(parent, name);
            var errCode = FS.mayDelete(parent, name, false);
            if (errCode) {
                // According to POSIX, we should map EISDIR to EPERM, but
                // we instead do what Linux does (and we must, as we use
                // the musl linux libc).
                throw new FS.ErrnoError(errCode);
            }
            if (!parent.node_ops.unlink) {
                throw new FS.ErrnoError(63);
            }
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(10);
            }
            parent.node_ops.unlink(parent, name);
            FS.destroyNode(node);
        },
        readlink(path) {
            var lookup = FS.lookupPath(path);
            var link = lookup.node;
            if (!link) {
                throw new FS.ErrnoError(44);
            }
            if (!link.node_ops.readlink) {
                throw new FS.ErrnoError(28);
            }
            return link.node_ops.readlink(link);
        },
        stat(path, dontFollow) {
            var lookup = FS.lookupPath(path, {
                follow: !dontFollow,
            });
            var node = lookup.node;
            var getattr = FS.checkOpExists(node.node_ops.getattr, 63);
            return getattr(node);
        },
        fstat(fd) {
            var stream = FS.getStreamChecked(fd);
            var node = stream.node;
            var getattr = stream.stream_ops.getattr;
            var arg = getattr ? stream : node;
            getattr ??= node.node_ops.getattr;
            FS.checkOpExists(getattr, 63);
            return getattr(arg);
        },
        lstat(path) {
            return FS.stat(path, true);
        },
        doChmod(stream, node, mode, dontFollow) {
            FS.doSetAttr(stream, node, {
                mode: (mode & 4095) | (node.mode & ~4095),
                ctime: Date.now(),
                dontFollow,
            });
        },
        chmod(path, mode, dontFollow) {
            var node;
            if (typeof path == "string") {
                var lookup = FS.lookupPath(path, {
                    follow: !dontFollow,
                });
                node = lookup.node;
            } else {
                node = path;
            }
            FS.doChmod(null, node, mode, dontFollow);
        },
        lchmod(path, mode) {
            FS.chmod(path, mode, true);
        },
        fchmod(fd, mode) {
            var stream = FS.getStreamChecked(fd);
            FS.doChmod(stream, stream.node, mode, false);
        },
        doChown(stream, node, dontFollow) {
            FS.doSetAttr(stream, node, {
                timestamp: Date.now(),
                dontFollow,
            });
        },
        chown(path, uid, gid, dontFollow) {
            var node;
            if (typeof path == "string") {
                var lookup = FS.lookupPath(path, {
                    follow: !dontFollow,
                });
                node = lookup.node;
            } else {
                node = path;
            }
            FS.doChown(null, node, dontFollow);
        },
        lchown(path, uid, gid) {
            FS.chown(path, uid, gid, true);
        },
        fchown(fd, uid, gid) {
            var stream = FS.getStreamChecked(fd);
            FS.doChown(stream, stream.node, false);
        },
        doTruncate(stream, node, len) {
            if (FS.isDir(node.mode)) {
                throw new FS.ErrnoError(31);
            }
            if (!FS.isFile(node.mode)) {
                throw new FS.ErrnoError(28);
            }
            var errCode = FS.nodePermissions(node, "w");
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            FS.doSetAttr(stream, node, {
                size: len,
                timestamp: Date.now(),
            });
        },
        truncate(path, len) {
            if (len < 0) {
                throw new FS.ErrnoError(28);
            }
            var node;
            if (typeof path == "string") {
                var lookup = FS.lookupPath(path, {
                    follow: true,
                });
                node = lookup.node;
            } else {
                node = path;
            }
            FS.doTruncate(null, node, len);
        },
        ftruncate(fd, len) {
            var stream = FS.getStreamChecked(fd);
            if (len < 0 || (stream.flags & 2097155) === 0) {
                throw new FS.ErrnoError(28);
            }
            FS.doTruncate(stream, stream.node, len);
        },
        utime(path, atime, mtime) {
            var lookup = FS.lookupPath(path, {
                follow: true,
            });
            var node = lookup.node;
            var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
            setattr(node, {
                atime,
                mtime,
            });
        },
        open(path, flags, mode = 438) {
            if (path === "") {
                throw new FS.ErrnoError(44);
            }
            flags =
                typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
            if (flags & 64) {
                mode = (mode & 4095) | 32768;
            } else {
                mode = 0;
            }
            var node;
            var isDirPath;
            if (typeof path == "object") {
                node = path;
            } else {
                isDirPath = path.endsWith("/");
                // noent_okay makes it so that if the final component of the path
                // doesn't exist, lookupPath returns `node: undefined`. `path` will be
                // updated to point to the target of all symlinks.
                var lookup = FS.lookupPath(path, {
                    follow: !(flags & 131072),
                    noent_okay: true,
                });
                node = lookup.node;
                path = lookup.path;
            }
            // perhaps we need to create the node
            var created = false;
            if (flags & 64) {
                if (node) {
                    // if O_CREAT and O_EXCL are set, error out if the node already exists
                    if (flags & 128) {
                        throw new FS.ErrnoError(20);
                    }
                } else if (isDirPath) {
                    throw new FS.ErrnoError(31);
                } else {
                    // node doesn't exist, try to create it
                    // Ignore the permission bits here to ensure we can `open` this new
                    // file below. We use chmod below the apply the permissions once the
                    // file is open.
                    node = FS.mknod(path, mode | 511, 0);
                    created = true;
                }
            }
            if (!node) {
                throw new FS.ErrnoError(44);
            }
            // can't truncate a device
            if (FS.isChrdev(node.mode)) {
                flags &= ~512;
            }
            // if asked only for a directory, then this must be one
            if (flags & 65536 && !FS.isDir(node.mode)) {
                throw new FS.ErrnoError(54);
            }
            // check permissions, if this is not a file we just created now (it is ok to
            // create and write to a file with read-only permissions; it is read-only
            // for later use)
            if (!created) {
                var errCode = FS.mayOpen(node, flags);
                if (errCode) {
                    throw new FS.ErrnoError(errCode);
                }
            }
            // do truncation if necessary
            if (flags & 512 && !created) {
                FS.truncate(node, 0);
            }
            // we've already handled these, don't pass down to the underlying vfs
            flags &= ~(128 | 512 | 131072);
            // register the stream with the filesystem
            var stream = FS.createStream({
                node,
                path: FS.getPath(node),
                // we want the absolute path to the node
                flags,
                seekable: true,
                position: 0,
                stream_ops: node.stream_ops,
                // used by the file family libc calls (fopen, fwrite, ferror, etc.)
                ungotten: [],
                error: false,
            });
            // call the new stream's open function
            if (stream.stream_ops.open) {
                stream.stream_ops.open(stream);
            }
            if (created) {
                FS.chmod(node, mode & 511);
            }
            if (Module["logReadFiles"] && !(flags & 1)) {
                if (!(path in FS.readFiles)) {
                    FS.readFiles[path] = 1;
                }
            }
            return stream;
        },
        close(stream) {
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }
            if (stream.getdents) stream.getdents = null;
            // free readdir state
            try {
                if (stream.stream_ops.close) {
                    stream.stream_ops.close(stream);
                }
            } catch (e) {
                throw e;
            } finally {
                FS.closeStream(stream.fd);
            }
            stream.fd = null;
        },
        isClosed(stream) {
            return stream.fd === null;
        },
        llseek(stream, offset, whence) {
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }
            if (!stream.seekable || !stream.stream_ops.llseek) {
                throw new FS.ErrnoError(70);
            }
            if (whence != 0 && whence != 1 && whence != 2) {
                throw new FS.ErrnoError(28);
            }
            stream.position = stream.stream_ops.llseek(stream, offset, whence);
            stream.ungotten = [];
            return stream.position;
        },
        read(stream, buffer, offset, length, position) {
            assert(offset >= 0);
            if (length < 0 || position < 0) {
                throw new FS.ErrnoError(28);
            }
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }
            if ((stream.flags & 2097155) === 1) {
                throw new FS.ErrnoError(8);
            }
            if (FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(31);
            }
            if (!stream.stream_ops.read) {
                throw new FS.ErrnoError(28);
            }
            var seeking = typeof position != "undefined";
            if (!seeking) {
                position = stream.position;
            } else if (!stream.seekable) {
                throw new FS.ErrnoError(70);
            }
            var bytesRead = stream.stream_ops.read(
                stream,
                buffer,
                offset,
                length,
                position
            );
            if (!seeking) stream.position += bytesRead;
            return bytesRead;
        },
        write(stream, buffer, offset, length, position, canOwn) {
            assert(offset >= 0);
            if (length < 0 || position < 0) {
                throw new FS.ErrnoError(28);
            }
            if (FS.isClosed(stream)) {
                throw new FS.ErrnoError(8);
            }
            if ((stream.flags & 2097155) === 0) {
                throw new FS.ErrnoError(8);
            }
            if (FS.isDir(stream.node.mode)) {
                throw new FS.ErrnoError(31);
            }
            if (!stream.stream_ops.write) {
                throw new FS.ErrnoError(28);
            }
            if (stream.seekable && stream.flags & 1024) {
                // seek to the end before writing in append mode
                FS.llseek(stream, 0, 2);
            }
            var seeking = typeof position != "undefined";
            if (!seeking) {
                position = stream.position;
            } else if (!stream.seekable) {
                throw new FS.ErrnoError(70);
            }
            var bytesWritten = stream.stream_ops.write(
                stream,
                buffer,
                offset,
                length,
                position,
                canOwn
            );
            if (!seeking) stream.position += bytesWritten;
            return bytesWritten;
        },
        mmap(stream, length, position, prot, flags) {
            // User requests writing to file (prot & PROT_WRITE != 0).
            // Checking if we have permissions to write to the file unless
            // MAP_PRIVATE flag is set. According to POSIX spec it is possible
            // to write to file opened in read-only mode with MAP_PRIVATE flag,
            // as all modifications will be visible only in the memory of
            // the current process.
            if (
                (prot & 2) !== 0 &&
                (flags & 2) === 0 &&
                (stream.flags & 2097155) !== 2
            ) {
                throw new FS.ErrnoError(2);
            }
            if ((stream.flags & 2097155) === 1) {
                throw new FS.ErrnoError(2);
            }
            if (!stream.stream_ops.mmap) {
                throw new FS.ErrnoError(43);
            }
            if (!length) {
                throw new FS.ErrnoError(28);
            }
            return stream.stream_ops.mmap(
                stream,
                length,
                position,
                prot,
                flags
            );
        },
        msync(stream, buffer, offset, length, mmapFlags) {
            assert(offset >= 0);
            if (!stream.stream_ops.msync) {
                return 0;
            }
            return stream.stream_ops.msync(
                stream,
                buffer,
                offset,
                length,
                mmapFlags
            );
        },
        ioctl(stream, cmd, arg) {
            if (!stream.stream_ops.ioctl) {
                throw new FS.ErrnoError(59);
            }
            return stream.stream_ops.ioctl(stream, cmd, arg);
        },
        readFile(path, opts = {}) {
            opts.flags = opts.flags || 0;
            opts.encoding = opts.encoding || "binary";
            if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
                throw new Error(`Invalid encoding type "${opts.encoding}"`);
            }
            var stream = FS.open(path, opts.flags);
            var stat = FS.stat(path);
            var length = stat.size;
            var buf = new Uint8Array(length);
            FS.read(stream, buf, 0, length, 0);
            if (opts.encoding === "utf8") {
                buf = UTF8ArrayToString(buf);
            }
            FS.close(stream);
            return buf;
        },
        writeFile(path, data, opts = {}) {
            opts.flags = opts.flags || 577;
            var stream = FS.open(path, opts.flags, opts.mode);
            if (typeof data == "string") {
                data = new Uint8Array(intArrayFromString(data, true));
            }
            if (ArrayBuffer.isView(data)) {
                FS.write(
                    stream,
                    data,
                    0,
                    data.byteLength,
                    undefined,
                    opts.canOwn
                );
            } else {
                throw new Error("Unsupported data type");
            }
            FS.close(stream);
        },
        cwd: () => FS.currentPath,
        chdir(path) {
            var lookup = FS.lookupPath(path, {
                follow: true,
            });
            if (lookup.node === null) {
                throw new FS.ErrnoError(44);
            }
            if (!FS.isDir(lookup.node.mode)) {
                throw new FS.ErrnoError(54);
            }
            var errCode = FS.nodePermissions(lookup.node, "x");
            if (errCode) {
                throw new FS.ErrnoError(errCode);
            }
            FS.currentPath = lookup.path;
        },
        createDefaultDirectories() {
            FS.mkdir("/tmp");
            FS.mkdir("/home");
            FS.mkdir("/home/web_user");
        },
        createDefaultDevices() {
            // create /dev
            FS.mkdir("/dev");
            // setup /dev/null
            FS.registerDevice(FS.makedev(1, 3), {
                read: () => 0,
                write: (stream, buffer, offset, length, pos) => length,
                llseek: () => 0,
            });
            FS.mkdev("/dev/null", FS.makedev(1, 3));
            // setup /dev/tty and /dev/tty1
            // stderr needs to print output using err() rather than out()
            // so we register a second tty just for it.
            TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
            TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
            FS.mkdev("/dev/tty", FS.makedev(5, 0));
            FS.mkdev("/dev/tty1", FS.makedev(6, 0));
            // setup /dev/[u]random
            // use a buffer to avoid overhead of individual crypto calls per byte
            var randomBuffer = new Uint8Array(1024),
                randomLeft = 0;
            var randomByte = () => {
                if (randomLeft === 0) {
                    randomFill(randomBuffer);
                    randomLeft = randomBuffer.byteLength;
                }
                return randomBuffer[--randomLeft];
            };
            FS.createDevice("/dev", "random", randomByte);
            FS.createDevice("/dev", "urandom", randomByte);
            // we're not going to emulate the actual shm device,
            // just create the tmp dirs that reside in it commonly
            FS.mkdir("/dev/shm");
            FS.mkdir("/dev/shm/tmp");
        },
        createSpecialDirectories() {
            // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
            // name of the stream for fd 6 (see test_unistd_ttyname)
            FS.mkdir("/proc");
            var proc_self = FS.mkdir("/proc/self");
            FS.mkdir("/proc/self/fd");
            FS.mount(
                {
                    mount() {
                        var node = FS.createNode(proc_self, "fd", 16895, 73);
                        node.stream_ops = {
                            llseek: MEMFS.stream_ops.llseek,
                        };
                        node.node_ops = {
                            lookup(parent, name) {
                                var fd = +name;
                                var stream = FS.getStreamChecked(fd);
                                var ret = {
                                    parent: null,
                                    mount: {
                                        mountpoint: "fake",
                                    },
                                    node_ops: {
                                        readlink: () => stream.path,
                                    },
                                    id: fd + 1,
                                };
                                ret.parent = ret;
                                // make it look like a simple root node
                                return ret;
                            },
                            readdir() {
                                return Array.from(FS.streams.entries())
                                    .filter(([k, v]) => v)
                                    .map(([k, v]) => k.toString());
                            },
                        };
                        return node;
                    },
                },
                {},
                "/proc/self/fd"
            );
        },
        createStandardStreams(input, output, error) {
            // TODO deprecate the old functionality of a single
            // input / output callback and that utilizes FS.createDevice
            // and instead require a unique set of stream ops
            // by default, we symlink the standard streams to the
            // default tty devices. however, if the standard streams
            // have been overwritten we create a unique device for
            // them instead.
            if (input) {
                FS.createDevice("/dev", "stdin", input);
            } else {
                FS.symlink("/dev/tty", "/dev/stdin");
            }
            if (output) {
                FS.createDevice("/dev", "stdout", null, output);
            } else {
                FS.symlink("/dev/tty", "/dev/stdout");
            }
            if (error) {
                FS.createDevice("/dev", "stderr", null, error);
            } else {
                FS.symlink("/dev/tty1", "/dev/stderr");
            }
            // open default streams for the stdin, stdout and stderr devices
            var stdin = FS.open("/dev/stdin", 0);
            var stdout = FS.open("/dev/stdout", 1);
            var stderr = FS.open("/dev/stderr", 1);
            assert(stdin.fd === 0, `invalid handle for stdin (${stdin.fd})`);
            assert(stdout.fd === 1, `invalid handle for stdout (${stdout.fd})`);
            assert(stderr.fd === 2, `invalid handle for stderr (${stderr.fd})`);
        },
        staticInit() {
            FS.nameTable = new Array(4096);
            FS.mount(MEMFS, {}, "/");
            FS.createDefaultDirectories();
            FS.createDefaultDevices();
            FS.createSpecialDirectories();
            FS.filesystems = {
                MEMFS: MEMFS,
            };
        },
        init(input, output, error) {
            assert(
                !FS.initialized,
                "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)"
            );
            FS.initialized = true;
            // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
            input ??= Module["stdin"];
            output ??= Module["stdout"];
            error ??= Module["stderr"];
            FS.createStandardStreams(input, output, error);
        },
        quit() {
            FS.initialized = false;
            // force-flush all streams, so we get musl std streams printed out
            _fflush(0);
            // close all of our streams
            for (var stream of FS.streams) {
                if (stream) {
                    FS.close(stream);
                }
            }
        },
        findObject(path, dontResolveLastLink) {
            var ret = FS.analyzePath(path, dontResolveLastLink);
            if (!ret.exists) {
                return null;
            }
            return ret.object;
        },
        analyzePath(path, dontResolveLastLink) {
            // operate from within the context of the symlink's target
            try {
                var lookup = FS.lookupPath(path, {
                    follow: !dontResolveLastLink,
                });
                path = lookup.path;
            } catch (e) {}
            var ret = {
                isRoot: false,
                exists: false,
                error: 0,
                name: null,
                path: null,
                object: null,
                parentExists: false,
                parentPath: null,
                parentObject: null,
            };
            try {
                var lookup = FS.lookupPath(path, {
                    parent: true,
                });
                ret.parentExists = true;
                ret.parentPath = lookup.path;
                ret.parentObject = lookup.node;
                ret.name = PATH.basename(path);
                lookup = FS.lookupPath(path, {
                    follow: !dontResolveLastLink,
                });
                ret.exists = true;
                ret.path = lookup.path;
                ret.object = lookup.node;
                ret.name = lookup.node.name;
                ret.isRoot = lookup.path === "/";
            } catch (e) {
                ret.error = e.errno;
            }
            return ret;
        },
        createPath(parent, path, canRead, canWrite) {
            parent = typeof parent == "string" ? parent : FS.getPath(parent);
            var parts = path.split("/").reverse();
            while (parts.length) {
                var part = parts.pop();
                if (!part) continue;
                var current = PATH.join2(parent, part);
                try {
                    FS.mkdir(current);
                } catch (e) {
                    if (e.errno != 20) throw e;
                }
                parent = current;
            }
            return current;
        },
        createFile(parent, name, properties, canRead, canWrite) {
            var path = PATH.join2(
                typeof parent == "string" ? parent : FS.getPath(parent),
                name
            );
            var mode = FS_getMode(canRead, canWrite);
            return FS.create(path, mode);
        },
        createDataFile(parent, name, data, canRead, canWrite, canOwn) {
            var path = name;
            if (parent) {
                parent =
                    typeof parent == "string" ? parent : FS.getPath(parent);
                path = name ? PATH.join2(parent, name) : parent;
            }
            var mode = FS_getMode(canRead, canWrite);
            var node = FS.create(path, mode);
            if (data) {
                if (typeof data == "string") {
                    var arr = new Array(data.length);
                    for (var i = 0, len = data.length; i < len; ++i)
                        arr[i] = data.charCodeAt(i);
                    data = arr;
                }
                // make sure we can write to the file
                FS.chmod(node, mode | 146);
                var stream = FS.open(node, 577);
                FS.write(stream, data, 0, data.length, 0, canOwn);
                FS.close(stream);
                FS.chmod(node, mode);
            }
        },
        createDevice(parent, name, input, output) {
            var path = PATH.join2(
                typeof parent == "string" ? parent : FS.getPath(parent),
                name
            );
            var mode = FS_getMode(!!input, !!output);
            FS.createDevice.major ??= 64;
            var dev = FS.makedev(FS.createDevice.major++, 0);
            // Create a fake device that a set of stream ops to emulate
            // the old behavior.
            FS.registerDevice(dev, {
                open(stream) {
                    stream.seekable = false;
                },
                close(stream) {
                    // flush any pending line data
                    if (output?.buffer?.length) {
                        output(10);
                    }
                },
                read(stream, buffer, offset, length, pos) {
                    var bytesRead = 0;
                    for (var i = 0; i < length; i++) {
                        var result;
                        try {
                            result = input();
                        } catch (e) {
                            throw new FS.ErrnoError(29);
                        }
                        if (result === undefined && bytesRead === 0) {
                            throw new FS.ErrnoError(6);
                        }
                        if (result === null || result === undefined) break;
                        bytesRead++;
                        buffer[offset + i] = result;
                    }
                    if (bytesRead) {
                        stream.node.atime = Date.now();
                    }
                    return bytesRead;
                },
                write(stream, buffer, offset, length, pos) {
                    for (var i = 0; i < length; i++) {
                        try {
                            output(buffer[offset + i]);
                        } catch (e) {
                            throw new FS.ErrnoError(29);
                        }
                    }
                    if (length) {
                        stream.node.mtime = stream.node.ctime = Date.now();
                    }
                    return i;
                },
            });
            return FS.mkdev(path, mode, dev);
        },
        forceLoadFile(obj) {
            if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
                return true;
            if (typeof XMLHttpRequest != "undefined") {
                throw new Error(
                    "Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread."
                );
            } else {
                // Command-line.
                try {
                    obj.contents = readBinary(obj.url);
                } catch (e) {
                    throw new FS.ErrnoError(29);
                }
            }
        },
        createLazyFile(parent, name, url, canRead, canWrite) {
            // Lazy chunked Uint8Array (implements get and length from Uint8Array).
            // Actual getting is abstracted away for eventual reuse.
            class LazyUint8Array {
                lengthKnown = false;
                chunks = [];
                // Loaded chunks. Index is the chunk number
                get(idx) {
                    if (idx > this.length - 1 || idx < 0) {
                        return undefined;
                    }
                    var chunkOffset = idx % this.chunkSize;
                    var chunkNum = (idx / this.chunkSize) | 0;
                    return this.getter(chunkNum)[chunkOffset];
                }
                setDataGetter(getter) {
                    this.getter = getter;
                }
                cacheLength() {
                    // Find length
                    var xhr = new XMLHttpRequest();
                    xhr.open("HEAD", url, false);
                    xhr.send(null);
                    if (
                        !(
                            (xhr.status >= 200 && xhr.status < 300) ||
                            xhr.status === 304
                        )
                    )
                        throw new Error(
                            "Couldn't load " + url + ". Status: " + xhr.status
                        );
                    var datalength = Number(
                        xhr.getResponseHeader("Content-length")
                    );
                    var header;
                    var hasByteServing =
                        (header = xhr.getResponseHeader("Accept-Ranges")) &&
                        header === "bytes";
                    var usesGzip =
                        (header = xhr.getResponseHeader("Content-Encoding")) &&
                        header === "gzip";
                    var chunkSize = 1024 * 1024;
                    // Chunk size in bytes
                    if (!hasByteServing) chunkSize = datalength;
                    // Function to get a range from the remote URL.
                    var doXHR = (from, to) => {
                        if (from > to)
                            throw new Error(
                                "invalid range (" +
                                    from +
                                    ", " +
                                    to +
                                    ") or no bytes requested!"
                            );
                        if (to > datalength - 1)
                            throw new Error(
                                "only " +
                                    datalength +
                                    " bytes available! programmer error!"
                            );
                        // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
                        var xhr = new XMLHttpRequest();
                        xhr.open("GET", url, false);
                        if (datalength !== chunkSize)
                            xhr.setRequestHeader(
                                "Range",
                                "bytes=" + from + "-" + to
                            );
                        // Some hints to the browser that we want binary data.
                        xhr.responseType = "arraybuffer";
                        if (xhr.overrideMimeType) {
                            xhr.overrideMimeType(
                                "text/plain; charset=x-user-defined"
                            );
                        }
                        xhr.send(null);
                        if (
                            !(
                                (xhr.status >= 200 && xhr.status < 300) ||
                                xhr.status === 304
                            )
                        )
                            throw new Error(
                                "Couldn't load " +
                                    url +
                                    ". Status: " +
                                    xhr.status
                            );
                        if (xhr.response !== undefined) {
                            return new Uint8Array(
                                /** @type {number[]} */ (xhr.response || [])
                            );
                        }
                        return intArrayFromString(xhr.responseText || "", true);
                    };
                    var lazyArray = this;
                    lazyArray.setDataGetter(chunkNum => {
                        var start = chunkNum * chunkSize;
                        var end = (chunkNum + 1) * chunkSize - 1;
                        // including this byte
                        end = Math.min(end, datalength - 1);
                        // if datalength-1 is selected, this is the last block
                        if (typeof lazyArray.chunks[chunkNum] == "undefined") {
                            lazyArray.chunks[chunkNum] = doXHR(start, end);
                        }
                        if (typeof lazyArray.chunks[chunkNum] == "undefined")
                            throw new Error("doXHR failed!");
                        return lazyArray.chunks[chunkNum];
                    });
                    if (usesGzip || !datalength) {
                        // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
                        chunkSize = datalength = 1;
                        // this will force getter(0)/doXHR do download the whole file
                        datalength = this.getter(0).length;
                        chunkSize = datalength;
                        out(
                            "LazyFiles on gzip forces download of the whole file when length is accessed"
                        );
                    }
                    this._length = datalength;
                    this._chunkSize = chunkSize;
                    this.lengthKnown = true;
                }
                get length() {
                    if (!this.lengthKnown) {
                        this.cacheLength();
                    }
                    return this._length;
                }
                get chunkSize() {
                    if (!this.lengthKnown) {
                        this.cacheLength();
                    }
                    return this._chunkSize;
                }
            }
            if (typeof XMLHttpRequest != "undefined") {
                if (!ENVIRONMENT_IS_WORKER)
                    throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
                var lazyArray = new LazyUint8Array();
                var properties = {
                    isDevice: false,
                    contents: lazyArray,
                };
            } else {
                var properties = {
                    isDevice: false,
                    url,
                };
            }
            var node = FS.createFile(
                parent,
                name,
                properties,
                canRead,
                canWrite
            );
            // This is a total hack, but I want to get this lazy file code out of the
            // core of MEMFS. If we want to keep this lazy file concept I feel it should
            // be its own thin LAZYFS proxying calls to MEMFS.
            if (properties.contents) {
                node.contents = properties.contents;
            } else if (properties.url) {
                node.contents = null;
                node.url = properties.url;
            }
            // Add a function that defers querying the file size until it is asked the first time.
            Object.defineProperties(node, {
                usedBytes: {
                    get: function () {
                        return this.contents.length;
                    },
                },
            });
            // override each stream op with one that tries to force load the lazy file first
            var stream_ops = {};
            var keys = Object.keys(node.stream_ops);
            keys.forEach(key => {
                var fn = node.stream_ops[key];
                stream_ops[key] = (...args) => {
                    FS.forceLoadFile(node);
                    return fn(...args);
                };
            });
            function writeChunks(stream, buffer, offset, length, position) {
                var contents = stream.node.contents;
                if (position >= contents.length) return 0;
                var size = Math.min(contents.length - position, length);
                assert(size >= 0);
                if (contents.slice) {
                    // normal array
                    for (var i = 0; i < size; i++) {
                        buffer[offset + i] = contents[position + i];
                    }
                } else {
                    for (var i = 0; i < size; i++) {
                        // LazyUint8Array from sync binary XHR
                        buffer[offset + i] = contents.get(position + i);
                    }
                }
                return size;
            }
            // use a custom read function
            stream_ops.read = (stream, buffer, offset, length, position) => {
                FS.forceLoadFile(node);
                return writeChunks(stream, buffer, offset, length, position);
            };
            // use a custom mmap function
            stream_ops.mmap = (stream, length, position, prot, flags) => {
                FS.forceLoadFile(node);
                var ptr = mmapAlloc(length);
                if (!ptr) {
                    throw new FS.ErrnoError(48);
                }
                writeChunks(stream, HEAP8, ptr, length, position);
                return {
                    ptr,
                    allocated: true,
                };
            };
            node.stream_ops = stream_ops;
            return node;
        },
        absolutePath() {
            abort(
                "FS.absolutePath has been removed; use PATH_FS.resolve instead"
            );
        },
        createFolder() {
            abort("FS.createFolder has been removed; use FS.mkdir instead");
        },
        createLink() {
            abort("FS.createLink has been removed; use FS.symlink instead");
        },
        joinPath() {
            abort("FS.joinPath has been removed; use PATH.join instead");
        },
        mmapAlloc() {
            abort(
                "FS.mmapAlloc has been replaced by the top level function mmapAlloc"
            );
        },
        standardizePath() {
            abort(
                "FS.standardizePath has been removed; use PATH.normalize instead"
            );
        },
    };

    var SYSCALLS = {
        DEFAULT_POLLMASK: 5,
        calculateAt(dirfd, path, allowEmpty) {
            if (PATH.isAbs(path)) {
                return path;
            }
            // relative path
            var dir;
            if (dirfd === -100) {
                dir = FS.cwd();
            } else {
                var dirstream = SYSCALLS.getStreamFromFD(dirfd);
                dir = dirstream.path;
            }
            if (path.length == 0) {
                if (!allowEmpty) {
                    throw new FS.ErrnoError(44);
                }
                return dir;
            }
            return dir + "/" + path;
        },
        writeStat(buf, stat) {
            SAFE_HEAP_STORE(HEAPU32, buf >> 2, stat.dev);
            SAFE_HEAP_STORE(HEAPU32, (buf + 4) >> 2, stat.mode);
            SAFE_HEAP_STORE(HEAPU32, (buf + 8) >> 2, stat.nlink);
            SAFE_HEAP_STORE(HEAPU32, (buf + 12) >> 2, stat.uid);
            SAFE_HEAP_STORE(HEAPU32, (buf + 16) >> 2, stat.gid);
            SAFE_HEAP_STORE(HEAPU32, (buf + 20) >> 2, stat.rdev);
            SAFE_HEAP_STORE(HEAP64, (buf + 24) >> 3, BigInt(stat.size));
            SAFE_HEAP_STORE(HEAP32, (buf + 32) >> 2, 4096);
            SAFE_HEAP_STORE(HEAP32, (buf + 36) >> 2, stat.blocks);
            var atime = stat.atime.getTime();
            var mtime = stat.mtime.getTime();
            var ctime = stat.ctime.getTime();
            SAFE_HEAP_STORE(
                HEAP64,
                (buf + 40) >> 3,
                BigInt(Math.floor(atime / 1e3))
            );
            SAFE_HEAP_STORE(
                HEAPU32,
                (buf + 48) >> 2,
                (atime % 1e3) * 1e3 * 1e3
            );
            SAFE_HEAP_STORE(
                HEAP64,
                (buf + 56) >> 3,
                BigInt(Math.floor(mtime / 1e3))
            );
            SAFE_HEAP_STORE(
                HEAPU32,
                (buf + 64) >> 2,
                (mtime % 1e3) * 1e3 * 1e3
            );
            SAFE_HEAP_STORE(
                HEAP64,
                (buf + 72) >> 3,
                BigInt(Math.floor(ctime / 1e3))
            );
            SAFE_HEAP_STORE(
                HEAPU32,
                (buf + 80) >> 2,
                (ctime % 1e3) * 1e3 * 1e3
            );
            SAFE_HEAP_STORE(HEAP64, (buf + 88) >> 3, BigInt(stat.ino));
            return 0;
        },
        writeStatFs(buf, stats) {
            SAFE_HEAP_STORE(HEAPU32, (buf + 4) >> 2, stats.bsize);
            SAFE_HEAP_STORE(HEAPU32, (buf + 60) >> 2, stats.bsize);
            SAFE_HEAP_STORE(HEAP64, (buf + 8) >> 3, BigInt(stats.blocks));
            SAFE_HEAP_STORE(HEAP64, (buf + 16) >> 3, BigInt(stats.bfree));
            SAFE_HEAP_STORE(HEAP64, (buf + 24) >> 3, BigInt(stats.bavail));
            SAFE_HEAP_STORE(HEAP64, (buf + 32) >> 3, BigInt(stats.files));
            SAFE_HEAP_STORE(HEAP64, (buf + 40) >> 3, BigInt(stats.ffree));
            SAFE_HEAP_STORE(HEAPU32, (buf + 48) >> 2, stats.fsid);
            SAFE_HEAP_STORE(HEAPU32, (buf + 64) >> 2, stats.flags);
            // ST_NOSUID
            SAFE_HEAP_STORE(HEAPU32, (buf + 56) >> 2, stats.namelen);
        },
        doMsync(addr, stream, len, flags, offset) {
            if (!FS.isFile(stream.node.mode)) {
                throw new FS.ErrnoError(43);
            }
            if (flags & 2) {
                // MAP_PRIVATE calls need not to be synced back to underlying fs
                return 0;
            }
            var buffer = HEAPU8.slice(addr, addr + len);
            FS.msync(stream, buffer, offset, len, flags);
        },
        getStreamFromFD(fd) {
            var stream = FS.getStreamChecked(fd);
            return stream;
        },
        varargs: undefined,
        getStr(ptr) {
            var ret = UTF8ToString(ptr);
            return ret;
        },
    };

    function ___syscall_fcntl64(fd, cmd, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            switch (cmd) {
                case 0: {
                    var arg = syscallGetVarargI();
                    if (arg < 0) {
                        return -28;
                    }
                    while (FS.streams[arg]) {
                        arg++;
                    }
                    var newStream;
                    newStream = FS.dupStream(stream, arg);
                    return newStream.fd;
                }

                case 1:
                case 2:
                    return 0;

                // FD_CLOEXEC makes no sense for a single process.
                case 3:
                    return stream.flags;

                case 4: {
                    var arg = syscallGetVarargI();
                    stream.flags |= arg;
                    return 0;
                }

                case 12: {
                    var arg = syscallGetVarargP();
                    var offset = 0;
                    // We're always unlocked.
                    SAFE_HEAP_STORE(HEAP16, (arg + offset) >> 1, 2);
                    return 0;
                }

                case 13:
                case 14:
                    // Pretend that the locking is successful. These are process-level locks,
                    // and Emscripten programs are a single process. If we supported linking a
                    // filesystem between programs, we'd need to do more here.
                    // See https://github.com/emscripten-core/emscripten/issues/23697
                    return 0;
            }
            return -28;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
        }
    }

    function ___syscall_ioctl(fd, op, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            switch (op) {
                case 21509: {
                    if (!stream.tty) return -59;
                    return 0;
                }

                case 21505: {
                    if (!stream.tty) return -59;
                    if (stream.tty.ops.ioctl_tcgets) {
                        var termios = stream.tty.ops.ioctl_tcgets(stream);
                        var argp = syscallGetVarargP();
                        SAFE_HEAP_STORE(
                            HEAP32,
                            argp >> 2,
                            termios.c_iflag || 0
                        );
                        SAFE_HEAP_STORE(
                            HEAP32,
                            (argp + 4) >> 2,
                            termios.c_oflag || 0
                        );
                        SAFE_HEAP_STORE(
                            HEAP32,
                            (argp + 8) >> 2,
                            termios.c_cflag || 0
                        );
                        SAFE_HEAP_STORE(
                            HEAP32,
                            (argp + 12) >> 2,
                            termios.c_lflag || 0
                        );
                        for (var i = 0; i < 32; i++) {
                            SAFE_HEAP_STORE(
                                HEAP8,
                                argp + i + 17,
                                termios.c_cc[i] || 0
                            );
                        }
                        return 0;
                    }
                    return 0;
                }

                case 21510:
                case 21511:
                case 21512: {
                    if (!stream.tty) return -59;
                    return 0;
                }

                case 21506:
                case 21507:
                case 21508: {
                    if (!stream.tty) return -59;
                    if (stream.tty.ops.ioctl_tcsets) {
                        var argp = syscallGetVarargP();
                        var c_iflag = SAFE_HEAP_LOAD(HEAP32, argp >> 2);
                        var c_oflag = SAFE_HEAP_LOAD(HEAP32, (argp + 4) >> 2);
                        var c_cflag = SAFE_HEAP_LOAD(HEAP32, (argp + 8) >> 2);
                        var c_lflag = SAFE_HEAP_LOAD(HEAP32, (argp + 12) >> 2);
                        var c_cc = [];
                        for (var i = 0; i < 32; i++) {
                            c_cc.push(SAFE_HEAP_LOAD(HEAP8, argp + i + 17));
                        }
                        return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
                            c_iflag,
                            c_oflag,
                            c_cflag,
                            c_lflag,
                            c_cc,
                        });
                    }
                    return 0;
                }

                case 21519: {
                    if (!stream.tty) return -59;
                    var argp = syscallGetVarargP();
                    SAFE_HEAP_STORE(HEAP32, argp >> 2, 0);
                    return 0;
                }

                case 21520: {
                    if (!stream.tty) return -59;
                    return -28;
                }

                case 21537:
                case 21531: {
                    var argp = syscallGetVarargP();
                    return FS.ioctl(stream, op, argp);
                }

                case 21523: {
                    // TODO: in theory we should write to the winsize struct that gets
                    // passed in, but for now musl doesn't read anything on it
                    if (!stream.tty) return -59;
                    if (stream.tty.ops.ioctl_tiocgwinsz) {
                        var winsize = stream.tty.ops.ioctl_tiocgwinsz(
                            stream.tty
                        );
                        var argp = syscallGetVarargP();
                        SAFE_HEAP_STORE(HEAP16, argp >> 1, winsize[0]);
                        SAFE_HEAP_STORE(HEAP16, (argp + 2) >> 1, winsize[1]);
                    }
                    return 0;
                }

                case 21524: {
                    // TODO: technically, this ioctl call should change the window size.
                    // but, since emscripten doesn't have any concept of a terminal window
                    // yet, we'll just silently throw it away as we do TIOCGWINSZ
                    if (!stream.tty) return -59;
                    return 0;
                }

                case 21515: {
                    if (!stream.tty) return -59;
                    return 0;
                }

                default:
                    return -28;
            }
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
        }
    }

    function ___syscall_openat(dirfd, path, flags, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);
            var mode = varargs ? syscallGetVarargI() : 0;
            return FS.open(path, flags, mode).fd;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
        }
    }

    var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
        assert(
            typeof maxBytesToWrite == "number",
            "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!"
        );
        return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };

    function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
        try {
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);
            if (bufsize <= 0) return -28;
            var ret = FS.readlink(path);
            var len = Math.min(bufsize, lengthBytesUTF8(ret));
            var endChar = SAFE_HEAP_LOAD(HEAP8, buf + len);
            stringToUTF8(ret, buf, bufsize + 1);
            // readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
            // stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
            SAFE_HEAP_STORE(HEAP8, buf + len, endChar);
            return len;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
        }
    }

    var __abort_js = () => abort("native code called abort()");

    var getHeapMax = () =>
        // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
        // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
        // for any code that deals with heap sizes, which would require special
        // casing all heap size related code to treat 0 specially.
        134217728;

    var alignMemory = (size, alignment) => {
        assert(alignment, "alignment argument is required");
        return Math.ceil(size / alignment) * alignment;
    };

    var growMemory = size => {
        var oldHeapSize = wasmMemory.buffer.byteLength;
        var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
        try {
            // round size grow request up to wasm page size (fixed 64KB per spec)
            wasmMemory.grow(pages);
            // .grow() takes a delta compared to the previous size
            updateMemoryViews();
            return 1;
        } catch (e) {
            err(
                `growMemory: Attempted to grow heap from ${oldHeapSize} bytes to ${size} bytes, but got error: ${e}`
            );
        }
    };

    var _emscripten_resize_heap = requestedSize => {
        var oldSize = HEAPU8.length;
        // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
        requestedSize >>>= 0;
        // With multithreaded builds, races can happen (another thread might increase the size
        // in between), so return a failure, and let the caller retry.
        assert(requestedSize > oldSize);
        // Memory resize rules:
        // 1.  Always increase heap size to at least the requested size, rounded up
        //     to next page multiple.
        // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
        //     geometrically: increase the heap size according to
        //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
        //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
        // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
        //     linearly: increase the heap size by at least
        //     MEMORY_GROWTH_LINEAR_STEP bytes.
        // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
        //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
        // 4.  If we were unable to allocate as much memory, it may be due to
        //     over-eager decision to excessively reserve due to (3) above.
        //     Hence if an allocation fails, cut down on the amount of excess
        //     growth, in an attempt to succeed to perform a smaller allocation.
        // A limit is set for how much we can grow. We should not exceed that
        // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
        var maxHeapSize = getHeapMax();
        if (requestedSize > maxHeapSize) {
            err(
                `Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`
            );
            return false;
        }
        // Loop through potential heap size increases. If we attempt a too eager
        // reservation that fails, cut down on the attempted size and reserve a
        // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
        for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
            var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
            // ensure geometric growth
            // but limit overreserving (default to capping at +96MB overgrowth at most)
            overGrownHeapSize = Math.min(
                overGrownHeapSize,
                requestedSize + 100663296
            );
            var newSize = Math.min(
                maxHeapSize,
                alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536)
            );
            var replacement = growMemory(newSize);
            if (replacement) {
                return true;
            }
        }
        err(
            `Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`
        );
        return false;
    };

    var ENV = {};

    var getExecutableName = () => thisProgram || "./this.program";

    var getEnvStrings = () => {
        if (!getEnvStrings.strings) {
            // Default values.
            // Browser language detection #8751
            var lang =
                (
                    (typeof navigator == "object" && navigator.language) ||
                    "C"
                ).replace("-", "_") + ".UTF-8";
            var env = {
                USER: "web_user",
                LOGNAME: "web_user",
                PATH: "/",
                PWD: "/",
                HOME: "/home/web_user",
                LANG: lang,
                _: getExecutableName(),
            };
            // Apply the user-provided values, if any.
            for (var x in ENV) {
                // x is a key in ENV; if ENV[x] is undefined, that means it was
                // explicitly set to be so. We allow user code to do that to
                // force variables with default values to remain unset.
                if (ENV[x] === undefined) delete env[x];
                else env[x] = ENV[x];
            }
            var strings = [];
            for (var x in env) {
                strings.push(`${x}=${env[x]}`);
            }
            getEnvStrings.strings = strings;
        }
        return getEnvStrings.strings;
    };

    var _environ_get = (__environ, environ_buf) => {
        var bufSize = 0;
        var envp = 0;
        for (var string of getEnvStrings()) {
            var ptr = environ_buf + bufSize;
            SAFE_HEAP_STORE(HEAPU32, (__environ + envp) >> 2, ptr);
            bufSize += stringToUTF8(string, ptr, Infinity) + 1;
            envp += 4;
        }
        return 0;
    };

    var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
        var strings = getEnvStrings();
        SAFE_HEAP_STORE(HEAPU32, penviron_count >> 2, strings.length);
        var bufSize = 0;
        for (var string of strings) {
            bufSize += lengthBytesUTF8(string) + 1;
        }
        SAFE_HEAP_STORE(HEAPU32, penviron_buf_size >> 2, bufSize);
        return 0;
    };

    function _fd_close(fd) {
        try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            FS.close(stream);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return e.errno;
        }
    }

    /** @param {number} [offset] */ var doReadv = (
        stream,
        iov,
        iovcnt,
        offset
    ) => {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
            var ptr = SAFE_HEAP_LOAD(HEAPU32, iov >> 2);
            var len = SAFE_HEAP_LOAD(HEAPU32, (iov + 4) >> 2);
            iov += 8;
            var curr = FS.read(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr;
            if (curr < len) break;
            // nothing more to read
            if (typeof offset != "undefined") {
                offset += curr;
            }
        }
        return ret;
    };

    function _fd_read(fd, iov, iovcnt, pnum) {
        try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = doReadv(stream, iov, iovcnt);
            SAFE_HEAP_STORE(HEAPU32, pnum >> 2, num);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return e.errno;
        }
    }

    var INT53_MAX = 9007199254740992;

    var INT53_MIN = -9007199254740992;

    var bigintToI53Checked = num =>
        num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);

    function _fd_seek(fd, offset, whence, newOffset) {
        offset = bigintToI53Checked(offset);
        try {
            if (isNaN(offset)) return 61;
            var stream = SYSCALLS.getStreamFromFD(fd);
            FS.llseek(stream, offset, whence);
            SAFE_HEAP_STORE(HEAP64, newOffset >> 3, BigInt(stream.position));
            if (stream.getdents && offset === 0 && whence === 0)
                stream.getdents = null;
            // reset readdir state
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return e.errno;
        }
    }

    /** @param {number} [offset] */ var doWritev = (
        stream,
        iov,
        iovcnt,
        offset
    ) => {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
            var ptr = SAFE_HEAP_LOAD(HEAPU32, iov >> 2);
            var len = SAFE_HEAP_LOAD(HEAPU32, (iov + 4) >> 2);
            iov += 8;
            var curr = FS.write(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr;
            if (curr < len) {
                // No more space to write.
                break;
            }
            if (typeof offset != "undefined") {
                offset += curr;
            }
        }
        return ret;
    };

    function _fd_write(fd, iov, iovcnt, pnum) {
        try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = doWritev(stream, iov, iovcnt);
            SAFE_HEAP_STORE(HEAPU32, pnum >> 2, num);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return e.errno;
        }
    }

    FS.createPreloadedFile = FS_createPreloadedFile;

    FS.preloadFile = FS_preloadFile;

    FS.staticInit();

    // End JS library code
    // include: postlibrary.js
    // This file is included after the automatically-generated JS library code
    // but before the wasm module is created.
    {
        // Begin ATMODULES hooks
        if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
        if (Module["preloadPlugins"]) preloadPlugins = Module["preloadPlugins"];
        if (Module["print"]) out = Module["print"];
        if (Module["printErr"]) err = Module["printErr"];
        if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
        // End ATMODULES hooks
        checkIncomingModuleAPI();
        if (Module["arguments"]) arguments_ = Module["arguments"];
        if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
        // Assertions on removed incoming Module JS APIs.
        assert(
            typeof Module["memoryInitializerPrefixURL"] == "undefined",
            "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead"
        );
        assert(
            typeof Module["pthreadMainPrefixURL"] == "undefined",
            "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead"
        );
        assert(
            typeof Module["cdInitializerPrefixURL"] == "undefined",
            "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead"
        );
        assert(
            typeof Module["filePackagePrefixURL"] == "undefined",
            "Module.filePackagePrefixURL option was removed, use Module.locateFile instead"
        );
        assert(
            typeof Module["read"] == "undefined",
            "Module.read option was removed"
        );
        assert(
            typeof Module["readAsync"] == "undefined",
            "Module.readAsync option was removed (modify readAsync in JS)"
        );
        assert(
            typeof Module["readBinary"] == "undefined",
            "Module.readBinary option was removed (modify readBinary in JS)"
        );
        assert(
            typeof Module["setWindowTitle"] == "undefined",
            "Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)"
        );
        assert(
            typeof Module["TOTAL_MEMORY"] == "undefined",
            "Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY"
        );
        assert(
            typeof Module["ENVIRONMENT"] == "undefined",
            "Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)"
        );
        assert(
            typeof Module["STACK_SIZE"] == "undefined",
            "STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time"
        );
        // If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
        assert(
            typeof Module["wasmMemory"] == "undefined",
            "Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally"
        );
        assert(
            typeof Module["INITIAL_MEMORY"] == "undefined",
            "Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically"
        );
        if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function")
                Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
                Module["preInit"].shift()();
            }
        }
        consumedModuleProp("preInit");
    }

    // Begin runtime exports
    Module["wasmMemory"] = wasmMemory;

    Module["setValue"] = setValue;

    Module["getValue"] = getValue;

    Module["UTF8ToString"] = UTF8ToString;

    Module["stringToUTF8"] = stringToUTF8;

    Module["lengthBytesUTF8"] = lengthBytesUTF8;

    Module["FS"] = FS;

    var missingLibrarySymbols = [
        "writeI53ToI64",
        "writeI53ToI64Clamped",
        "writeI53ToI64Signaling",
        "writeI53ToU64Clamped",
        "writeI53ToU64Signaling",
        "readI53FromI64",
        "readI53FromU64",
        "convertI32PairToI53",
        "convertI32PairToI53Checked",
        "convertU32PairToI53",
        "stackAlloc",
        "getTempRet0",
        "setTempRet0",
        "zeroMemory",
        "exitJS",
        "withStackSave",
        "inetPton4",
        "inetNtop4",
        "inetPton6",
        "inetNtop6",
        "readSockaddr",
        "writeSockaddr",
        "readEmAsmArgs",
        "jstoi_q",
        "autoResumeAudioContext",
        "getDynCaller",
        "dynCall",
        "handleException",
        "keepRuntimeAlive",
        "runtimeKeepalivePush",
        "runtimeKeepalivePop",
        "callUserCallback",
        "maybeExit",
        "asmjsMangle",
        "HandleAllocator",
        "getNativeTypeSize",
        "addOnInit",
        "addOnPostCtor",
        "addOnPreMain",
        "addOnExit",
        "STACK_SIZE",
        "STACK_ALIGN",
        "POINTER_SIZE",
        "ASSERTIONS",
        "ccall",
        "cwrap",
        "convertJsFunctionToWasm",
        "getEmptyTableSlot",
        "updateTableMap",
        "getFunctionAddress",
        "addFunction",
        "removeFunction",
        "intArrayToString",
        "AsciiToString",
        "stringToAscii",
        "UTF16ToString",
        "stringToUTF16",
        "lengthBytesUTF16",
        "UTF32ToString",
        "stringToUTF32",
        "lengthBytesUTF32",
        "stringToNewUTF8",
        "stringToUTF8OnStack",
        "writeArrayToMemory",
        "registerKeyEventCallback",
        "maybeCStringToJsString",
        "findEventTarget",
        "getBoundingClientRect",
        "fillMouseEventData",
        "registerMouseEventCallback",
        "registerWheelEventCallback",
        "registerUiEventCallback",
        "registerFocusEventCallback",
        "fillDeviceOrientationEventData",
        "registerDeviceOrientationEventCallback",
        "fillDeviceMotionEventData",
        "registerDeviceMotionEventCallback",
        "screenOrientation",
        "fillOrientationChangeEventData",
        "registerOrientationChangeEventCallback",
        "fillFullscreenChangeEventData",
        "registerFullscreenChangeEventCallback",
        "JSEvents_requestFullscreen",
        "JSEvents_resizeCanvasForFullscreen",
        "registerRestoreOldStyle",
        "hideEverythingExceptGivenElement",
        "restoreHiddenElements",
        "setLetterbox",
        "softFullscreenResizeWebGLRenderTarget",
        "doRequestFullscreen",
        "fillPointerlockChangeEventData",
        "registerPointerlockChangeEventCallback",
        "registerPointerlockErrorEventCallback",
        "requestPointerLock",
        "fillVisibilityChangeEventData",
        "registerVisibilityChangeEventCallback",
        "registerTouchEventCallback",
        "fillGamepadEventData",
        "registerGamepadEventCallback",
        "registerBeforeUnloadEventCallback",
        "fillBatteryEventData",
        "registerBatteryEventCallback",
        "setCanvasElementSize",
        "getCanvasElementSize",
        "jsStackTrace",
        "getCallstack",
        "convertPCtoSourceLocation",
        "checkWasiClock",
        "wasiRightsToMuslOFlags",
        "wasiOFlagsToMuslOFlags",
        "safeSetTimeout",
        "setImmediateWrapped",
        "safeRequestAnimationFrame",
        "clearImmediateWrapped",
        "registerPostMainLoop",
        "registerPreMainLoop",
        "getPromise",
        "makePromise",
        "idsToPromises",
        "makePromiseCallback",
        "ExceptionInfo",
        "findMatchingCatch",
        "Browser_asyncPrepareDataCounter",
        "isLeapYear",
        "ydayFromDate",
        "arraySum",
        "addDays",
        "getSocketFromFD",
        "getSocketAddress",
        "FS_mkdirTree",
        "_setNetworkCallback",
        "heapObjectForWebGLType",
        "toTypedArrayIndex",
        "webgl_enable_ANGLE_instanced_arrays",
        "webgl_enable_OES_vertex_array_object",
        "webgl_enable_WEBGL_draw_buffers",
        "webgl_enable_WEBGL_multi_draw",
        "webgl_enable_EXT_polygon_offset_clamp",
        "webgl_enable_EXT_clip_control",
        "webgl_enable_WEBGL_polygon_mode",
        "emscriptenWebGLGet",
        "computeUnpackAlignedImageSize",
        "colorChannelsInGlTextureFormat",
        "emscriptenWebGLGetTexPixelData",
        "emscriptenWebGLGetUniform",
        "webglGetUniformLocation",
        "webglPrepareUniformLocationsBeforeFirstUse",
        "webglGetLeftBracePos",
        "emscriptenWebGLGetVertexAttrib",
        "__glGetActiveAttribOrUniform",
        "writeGLArray",
        "registerWebGlEventCallback",
        "runAndAbortIfError",
        "ALLOC_NORMAL",
        "ALLOC_STACK",
        "allocate",
        "writeStringToMemory",
        "writeAsciiToMemory",
        "demangle",
        "stackTrace",
    ];

    missingLibrarySymbols.forEach(missingLibrarySymbol);

    var unexportedSymbols = [
        "run",
        "out",
        "err",
        "callMain",
        "abort",
        "wasmExports",
        "HEAPF32",
        "HEAPF64",
        "HEAP8",
        "HEAPU8",
        "HEAP16",
        "HEAPU16",
        "HEAP32",
        "HEAPU32",
        "HEAP64",
        "HEAPU64",
        "writeStackCookie",
        "checkStackCookie",
        "INT53_MAX",
        "INT53_MIN",
        "bigintToI53Checked",
        "stackSave",
        "stackRestore",
        "ptrToString",
        "getHeapMax",
        "growMemory",
        "ENV",
        "ERRNO_CODES",
        "strError",
        "DNS",
        "Protocols",
        "Sockets",
        "timers",
        "warnOnce",
        "readEmAsmArgsArray",
        "getExecutableName",
        "asyncLoad",
        "alignMemory",
        "mmapAlloc",
        "wasmTable",
        "getUniqueRunDependency",
        "noExitRuntime",
        "addRunDependency",
        "removeRunDependency",
        "addOnPreRun",
        "addOnPostRun",
        "freeTableIndexes",
        "functionsInTableMap",
        "PATH",
        "PATH_FS",
        "UTF8Decoder",
        "UTF8ArrayToString",
        "stringToUTF8Array",
        "intArrayFromString",
        "UTF16Decoder",
        "JSEvents",
        "specialHTMLTargets",
        "findCanvasEventTarget",
        "currentFullscreenStrategy",
        "restoreOldWindowedStyle",
        "UNWIND_CACHE",
        "ExitStatus",
        "getEnvStrings",
        "doReadv",
        "doWritev",
        "initRandomFill",
        "randomFill",
        "emSetImmediate",
        "emClearImmediate_deps",
        "emClearImmediate",
        "promiseMap",
        "uncaughtExceptionCount",
        "exceptionLast",
        "exceptionCaught",
        "Browser",
        "requestFullscreen",
        "requestFullScreen",
        "setCanvasSize",
        "getUserMedia",
        "createContext",
        "getPreloadedImageData__data",
        "wget",
        "MONTH_DAYS_REGULAR",
        "MONTH_DAYS_LEAP",
        "MONTH_DAYS_REGULAR_CUMULATIVE",
        "MONTH_DAYS_LEAP_CUMULATIVE",
        "SYSCALLS",
        "preloadPlugins",
        "FS_createPreloadedFile",
        "FS_preloadFile",
        "FS_modeStringToFlags",
        "FS_getMode",
        "FS_stdin_getChar_buffer",
        "FS_stdin_getChar",
        "FS_unlink",
        "FS_createPath",
        "FS_createDevice",
        "FS_readFile",
        "FS_root",
        "FS_mounts",
        "FS_devices",
        "FS_streams",
        "FS_nextInode",
        "FS_nameTable",
        "FS_currentPath",
        "FS_initialized",
        "FS_ignorePermissions",
        "FS_filesystems",
        "FS_syncFSRequests",
        "FS_readFiles",
        "FS_lookupPath",
        "FS_getPath",
        "FS_hashName",
        "FS_hashAddNode",
        "FS_hashRemoveNode",
        "FS_lookupNode",
        "FS_createNode",
        "FS_destroyNode",
        "FS_isRoot",
        "FS_isMountpoint",
        "FS_isFile",
        "FS_isDir",
        "FS_isLink",
        "FS_isChrdev",
        "FS_isBlkdev",
        "FS_isFIFO",
        "FS_isSocket",
        "FS_flagsToPermissionString",
        "FS_nodePermissions",
        "FS_mayLookup",
        "FS_mayCreate",
        "FS_mayDelete",
        "FS_mayOpen",
        "FS_checkOpExists",
        "FS_nextfd",
        "FS_getStreamChecked",
        "FS_getStream",
        "FS_createStream",
        "FS_closeStream",
        "FS_dupStream",
        "FS_doSetAttr",
        "FS_chrdev_stream_ops",
        "FS_major",
        "FS_minor",
        "FS_makedev",
        "FS_registerDevice",
        "FS_getDevice",
        "FS_getMounts",
        "FS_syncfs",
        "FS_mount",
        "FS_unmount",
        "FS_lookup",
        "FS_mknod",
        "FS_statfs",
        "FS_statfsStream",
        "FS_statfsNode",
        "FS_create",
        "FS_mkdir",
        "FS_mkdev",
        "FS_symlink",
        "FS_rename",
        "FS_rmdir",
        "FS_readdir",
        "FS_readlink",
        "FS_stat",
        "FS_fstat",
        "FS_lstat",
        "FS_doChmod",
        "FS_chmod",
        "FS_lchmod",
        "FS_fchmod",
        "FS_doChown",
        "FS_chown",
        "FS_lchown",
        "FS_fchown",
        "FS_doTruncate",
        "FS_truncate",
        "FS_ftruncate",
        "FS_utime",
        "FS_open",
        "FS_close",
        "FS_isClosed",
        "FS_llseek",
        "FS_read",
        "FS_write",
        "FS_mmap",
        "FS_msync",
        "FS_ioctl",
        "FS_writeFile",
        "FS_cwd",
        "FS_chdir",
        "FS_createDefaultDirectories",
        "FS_createDefaultDevices",
        "FS_createSpecialDirectories",
        "FS_createStandardStreams",
        "FS_staticInit",
        "FS_init",
        "FS_quit",
        "FS_findObject",
        "FS_analyzePath",
        "FS_createFile",
        "FS_createDataFile",
        "FS_forceLoadFile",
        "FS_createLazyFile",
        "FS_absolutePath",
        "FS_createFolder",
        "FS_createLink",
        "FS_joinPath",
        "FS_mmapAlloc",
        "FS_standardizePath",
        "MEMFS",
        "TTY",
        "PIPEFS",
        "SOCKFS",
        "tempFixedLengthArray",
        "miniTempWebGLFloatBuffers",
        "miniTempWebGLIntBuffers",
        "GL",
        "AL",
        "GLUT",
        "EGL",
        "GLEW",
        "IDBStore",
        "SDL",
        "SDL_gfx",
        "allocateUTF8",
        "allocateUTF8OnStack",
        "print",
        "printErr",
        "jstoi_s",
    ];

    unexportedSymbols.forEach(unexportedRuntimeSymbol);

    // End runtime exports
    // Begin JS library exports
    // End JS library exports
    // end include: postlibrary.js
    function checkIncomingModuleAPI() {
        ignoredModuleProp("fetchSettings");
    }

    // Imports from the Wasm binary.
    var _swe_degnorm = (Module["_swe_degnorm"] =
        makeInvalidEarlyAccess("_swe_degnorm"));

    var _swe_vis_limit_mag = (Module["_swe_vis_limit_mag"] =
        makeInvalidEarlyAccess("_swe_vis_limit_mag"));

    var _swe_set_topo = (Module["_swe_set_topo"] =
        makeInvalidEarlyAccess("_swe_set_topo"));

    var _swe_revjul = (Module["_swe_revjul"] =
        makeInvalidEarlyAccess("_swe_revjul"));

    var _swe_deltat_ex = (Module["_swe_deltat_ex"] =
        makeInvalidEarlyAccess("_swe_deltat_ex"));

    var _swe_calc = (Module["_swe_calc"] = makeInvalidEarlyAccess("_swe_calc"));

    var _swe_azalt = (Module["_swe_azalt"] =
        makeInvalidEarlyAccess("_swe_azalt"));

    var _swe_pheno_ut = (Module["_swe_pheno_ut"] =
        makeInvalidEarlyAccess("_swe_pheno_ut"));

    var _swe_topo_arcus_visionis = (Module["_swe_topo_arcus_visionis"] =
        makeInvalidEarlyAccess("_swe_topo_arcus_visionis"));

    var _swe_heliacal_angle = (Module["_swe_heliacal_angle"] =
        makeInvalidEarlyAccess("_swe_heliacal_angle"));

    var _swe_heliacal_pheno_ut = (Module["_swe_heliacal_pheno_ut"] =
        makeInvalidEarlyAccess("_swe_heliacal_pheno_ut"));

    var _swe_heliacal_ut = (Module["_swe_heliacal_ut"] =
        makeInvalidEarlyAccess("_swe_heliacal_ut"));

    var _swe_get_planet_name = (Module["_swe_get_planet_name"] =
        makeInvalidEarlyAccess("_swe_get_planet_name"));

    var _swe_fixstar = (Module["_swe_fixstar"] =
        makeInvalidEarlyAccess("_swe_fixstar"));

    var _swe_fixstar_mag = (Module["_swe_fixstar_mag"] =
        makeInvalidEarlyAccess("_swe_fixstar_mag"));

    var _swe_calc_ut = (Module["_swe_calc_ut"] =
        makeInvalidEarlyAccess("_swe_calc_ut"));

    var _swe_rise_trans = (Module["_swe_rise_trans"] =
        makeInvalidEarlyAccess("_swe_rise_trans"));

    var _swe_houses = (Module["_swe_houses"] =
        makeInvalidEarlyAccess("_swe_houses"));

    var _swe_sidtime0 = (Module["_swe_sidtime0"] =
        makeInvalidEarlyAccess("_swe_sidtime0"));

    var _swe_houses_armc_ex2 = (Module["_swe_houses_armc_ex2"] =
        makeInvalidEarlyAccess("_swe_houses_armc_ex2"));

    var _swe_difdeg2n = (Module["_swe_difdeg2n"] =
        makeInvalidEarlyAccess("_swe_difdeg2n"));

    var _swe_houses_ex = (Module["_swe_houses_ex"] =
        makeInvalidEarlyAccess("_swe_houses_ex"));

    var _swe_houses_ex2 = (Module["_swe_houses_ex2"] =
        makeInvalidEarlyAccess("_swe_houses_ex2"));

    var _swe_set_sid_mode = (Module["_swe_set_sid_mode"] =
        makeInvalidEarlyAccess("_swe_set_sid_mode"));

    var _swe_get_ayanamsa_ex = (Module["_swe_get_ayanamsa_ex"] =
        makeInvalidEarlyAccess("_swe_get_ayanamsa_ex"));

    var _swe_houses_armc = (Module["_swe_houses_armc"] =
        makeInvalidEarlyAccess("_swe_houses_armc"));

    var _swe_cotrans = (Module["_swe_cotrans"] =
        makeInvalidEarlyAccess("_swe_cotrans"));

    var _swe_house_name = (Module["_swe_house_name"] =
        makeInvalidEarlyAccess("_swe_house_name"));

    var _swe_house_pos = (Module["_swe_house_pos"] =
        makeInvalidEarlyAccess("_swe_house_pos"));

    var _swe_radnorm = (Module["_swe_radnorm"] =
        makeInvalidEarlyAccess("_swe_radnorm"));

    var _swe_sol_eclipse_where = (Module["_swe_sol_eclipse_where"] =
        makeInvalidEarlyAccess("_swe_sol_eclipse_where"));

    var _swe_sidtime = (Module["_swe_sidtime"] =
        makeInvalidEarlyAccess("_swe_sidtime"));

    var _swe_lun_occult_where = (Module["_swe_lun_occult_where"] =
        makeInvalidEarlyAccess("_swe_lun_occult_where"));

    var _swe_sol_eclipse_how = (Module["_swe_sol_eclipse_how"] =
        makeInvalidEarlyAccess("_swe_sol_eclipse_how"));

    var _swe_refrac_extended = (Module["_swe_refrac_extended"] =
        makeInvalidEarlyAccess("_swe_refrac_extended"));

    var _swe_sol_eclipse_when_glob = (Module["_swe_sol_eclipse_when_glob"] =
        makeInvalidEarlyAccess("_swe_sol_eclipse_when_glob"));

    var _swe_lun_occult_when_glob = (Module["_swe_lun_occult_when_glob"] =
        makeInvalidEarlyAccess("_swe_lun_occult_when_glob"));

    var _swe_sol_eclipse_when_loc = (Module["_swe_sol_eclipse_when_loc"] =
        makeInvalidEarlyAccess("_swe_sol_eclipse_when_loc"));

    var _swe_lun_occult_when_loc = (Module["_swe_lun_occult_when_loc"] =
        makeInvalidEarlyAccess("_swe_lun_occult_when_loc"));

    var _swe_azalt_rev = (Module["_swe_azalt_rev"] =
        makeInvalidEarlyAccess("_swe_azalt_rev"));

    var _swe_refrac = (Module["_swe_refrac"] =
        makeInvalidEarlyAccess("_swe_refrac"));

    var _swe_set_lapse_rate = (Module["_swe_set_lapse_rate"] =
        makeInvalidEarlyAccess("_swe_set_lapse_rate"));

    var _swe_lun_eclipse_how = (Module["_swe_lun_eclipse_how"] =
        makeInvalidEarlyAccess("_swe_lun_eclipse_how"));

    var _swe_lun_eclipse_when = (Module["_swe_lun_eclipse_when"] =
        makeInvalidEarlyAccess("_swe_lun_eclipse_when"));

    var _swe_lun_eclipse_when_loc = (Module["_swe_lun_eclipse_when_loc"] =
        makeInvalidEarlyAccess("_swe_lun_eclipse_when_loc"));

    var _swe_rise_trans_true_hor = (Module["_swe_rise_trans_true_hor"] =
        makeInvalidEarlyAccess("_swe_rise_trans_true_hor"));

    var _swe_pheno = (Module["_swe_pheno"] =
        makeInvalidEarlyAccess("_swe_pheno"));

    var _swe_nod_aps = (Module["_swe_nod_aps"] =
        makeInvalidEarlyAccess("_swe_nod_aps"));

    var _swe_nod_aps_ut = (Module["_swe_nod_aps_ut"] =
        makeInvalidEarlyAccess("_swe_nod_aps_ut"));

    var _swe_get_orbital_elements = (Module["_swe_get_orbital_elements"] =
        makeInvalidEarlyAccess("_swe_get_orbital_elements"));

    var _swe_orbit_max_min_true_distance = (Module[
        "_swe_orbit_max_min_true_distance"
    ] = makeInvalidEarlyAccess("_swe_orbit_max_min_true_distance"));

    var _swe_gauquelin_sector = (Module["_swe_gauquelin_sector"] =
        makeInvalidEarlyAccess("_swe_gauquelin_sector"));

    var _swe_version = (Module["_swe_version"] =
        makeInvalidEarlyAccess("_swe_version"));

    var _swe_get_library_path = (Module["_swe_get_library_path"] =
        makeInvalidEarlyAccess("_swe_get_library_path"));

    var _swe_set_tid_acc = (Module["_swe_set_tid_acc"] =
        makeInvalidEarlyAccess("_swe_set_tid_acc"));

    var _free = (Module["_free"] = makeInvalidEarlyAccess("_free"));

    var _swe_set_ephe_path = (Module["_swe_set_ephe_path"] =
        makeInvalidEarlyAccess("_swe_set_ephe_path"));

    var _swe_difrad2n = (Module["_swe_difrad2n"] =
        makeInvalidEarlyAccess("_swe_difrad2n"));

    var _swe_close = (Module["_swe_close"] =
        makeInvalidEarlyAccess("_swe_close"));

    var _swe_set_jpl_file = (Module["_swe_set_jpl_file"] =
        makeInvalidEarlyAccess("_swe_set_jpl_file"));

    var _swe_get_ayanamsa_ex_ut = (Module["_swe_get_ayanamsa_ex_ut"] =
        makeInvalidEarlyAccess("_swe_get_ayanamsa_ex_ut"));

    var _swe_get_ayanamsa = (Module["_swe_get_ayanamsa"] =
        makeInvalidEarlyAccess("_swe_get_ayanamsa"));

    var _swe_get_ayanamsa_ut = (Module["_swe_get_ayanamsa_ut"] =
        makeInvalidEarlyAccess("_swe_get_ayanamsa_ut"));

    var _swe_fixstar2 = (Module["_swe_fixstar2"] =
        makeInvalidEarlyAccess("_swe_fixstar2"));

    var _swe_fixstar2_ut = (Module["_swe_fixstar2_ut"] =
        makeInvalidEarlyAccess("_swe_fixstar2_ut"));

    var _swe_fixstar2_mag = (Module["_swe_fixstar2_mag"] =
        makeInvalidEarlyAccess("_swe_fixstar2_mag"));

    var _swe_get_ayanamsa_name = (Module["_swe_get_ayanamsa_name"] =
        makeInvalidEarlyAccess("_swe_get_ayanamsa_name"));

    var _swe_time_equ = (Module["_swe_time_equ"] =
        makeInvalidEarlyAccess("_swe_time_equ"));

    var _swe_lmt_to_lat = (Module["_swe_lmt_to_lat"] =
        makeInvalidEarlyAccess("_swe_lmt_to_lat"));

    var _swe_lat_to_lmt = (Module["_swe_lat_to_lmt"] =
        makeInvalidEarlyAccess("_swe_lat_to_lmt"));

    var _swe_fixstar_ut = (Module["_swe_fixstar_ut"] =
        makeInvalidEarlyAccess("_swe_fixstar_ut"));

    var _swe_calc_pctr = (Module["_swe_calc_pctr"] =
        makeInvalidEarlyAccess("_swe_calc_pctr"));

    var _swe_get_current_file_data = (Module["_swe_get_current_file_data"] =
        makeInvalidEarlyAccess("_swe_get_current_file_data"));

    var _swe_solcross = (Module["_swe_solcross"] =
        makeInvalidEarlyAccess("_swe_solcross"));

    var _swe_solcross_ut = (Module["_swe_solcross_ut"] =
        makeInvalidEarlyAccess("_swe_solcross_ut"));

    var _swe_mooncross = (Module["_swe_mooncross"] =
        makeInvalidEarlyAccess("_swe_mooncross"));

    var _swe_mooncross_ut = (Module["_swe_mooncross_ut"] =
        makeInvalidEarlyAccess("_swe_mooncross_ut"));

    var _swe_mooncross_node = (Module["_swe_mooncross_node"] =
        makeInvalidEarlyAccess("_swe_mooncross_node"));

    var _swe_mooncross_node_ut = (Module["_swe_mooncross_node_ut"] =
        makeInvalidEarlyAccess("_swe_mooncross_node_ut"));

    var _swe_helio_cross = (Module["_swe_helio_cross"] =
        makeInvalidEarlyAccess("_swe_helio_cross"));

    var _swe_helio_cross_ut = (Module["_swe_helio_cross_ut"] =
        makeInvalidEarlyAccess("_swe_helio_cross_ut"));

    var _malloc = (Module["_malloc"] = makeInvalidEarlyAccess("_malloc"));

    var _swe_date_conversion = (Module["_swe_date_conversion"] =
        makeInvalidEarlyAccess("_swe_date_conversion"));

    var _swe_julday = (Module["_swe_julday"] =
        makeInvalidEarlyAccess("_swe_julday"));

    var _swe_utc_time_zone = (Module["_swe_utc_time_zone"] =
        makeInvalidEarlyAccess("_swe_utc_time_zone"));

    var _swe_utc_to_jd = (Module["_swe_utc_to_jd"] =
        makeInvalidEarlyAccess("_swe_utc_to_jd"));

    var _swe_jdet_to_utc = (Module["_swe_jdet_to_utc"] =
        makeInvalidEarlyAccess("_swe_jdet_to_utc"));

    var _swe_jdut1_to_utc = (Module["_swe_jdut1_to_utc"] =
        makeInvalidEarlyAccess("_swe_jdut1_to_utc"));

    var _swe_deg_midp = (Module["_swe_deg_midp"] =
        makeInvalidEarlyAccess("_swe_deg_midp"));

    var _swe_rad_midp = (Module["_swe_rad_midp"] =
        makeInvalidEarlyAccess("_swe_rad_midp"));

    var _swe_cotrans_sp = (Module["_swe_cotrans_sp"] =
        makeInvalidEarlyAccess("_swe_cotrans_sp"));

    var _swe_deltat = (Module["_swe_deltat"] =
        makeInvalidEarlyAccess("_swe_deltat"));

    var _swe_get_tid_acc = (Module["_swe_get_tid_acc"] =
        makeInvalidEarlyAccess("_swe_get_tid_acc"));

    var _swe_set_delta_t_userdef = (Module["_swe_set_delta_t_userdef"] =
        makeInvalidEarlyAccess("_swe_set_delta_t_userdef"));

    var _swe_set_interpolate_nut = (Module["_swe_set_interpolate_nut"] =
        makeInvalidEarlyAccess("_swe_set_interpolate_nut"));

    var _swe_csnorm = (Module["_swe_csnorm"] =
        makeInvalidEarlyAccess("_swe_csnorm"));

    var _swe_difcsn = (Module["_swe_difcsn"] =
        makeInvalidEarlyAccess("_swe_difcsn"));

    var _swe_difdegn = (Module["_swe_difdegn"] =
        makeInvalidEarlyAccess("_swe_difdegn"));

    var _swe_difcs2n = (Module["_swe_difcs2n"] =
        makeInvalidEarlyAccess("_swe_difcs2n"));

    var _swe_csroundsec = (Module["_swe_csroundsec"] =
        makeInvalidEarlyAccess("_swe_csroundsec"));

    var _swe_d2l = (Module["_swe_d2l"] = makeInvalidEarlyAccess("_swe_d2l"));

    var _swe_day_of_week = (Module["_swe_day_of_week"] =
        makeInvalidEarlyAccess("_swe_day_of_week"));

    var _swe_cs2timestr = (Module["_swe_cs2timestr"] =
        makeInvalidEarlyAccess("_swe_cs2timestr"));

    var _swe_cs2lonlatstr = (Module["_swe_cs2lonlatstr"] =
        makeInvalidEarlyAccess("_swe_cs2lonlatstr"));

    var _swe_cs2degstr = (Module["_swe_cs2degstr"] =
        makeInvalidEarlyAccess("_swe_cs2degstr"));

    var _swe_split_deg = (Module["_swe_split_deg"] =
        makeInvalidEarlyAccess("_swe_split_deg"));

    var _swe_set_astro_models = (Module["_swe_set_astro_models"] =
        makeInvalidEarlyAccess("_swe_set_astro_models"));

    var _swe_get_astro_models = (Module["_swe_get_astro_models"] =
        makeInvalidEarlyAccess("_swe_get_astro_models"));

    var _fflush = makeInvalidEarlyAccess("_fflush");

    var _strerror = makeInvalidEarlyAccess("_strerror");

    var _emscripten_stack_get_end = makeInvalidEarlyAccess(
        "_emscripten_stack_get_end"
    );

    var _emscripten_stack_get_base = makeInvalidEarlyAccess(
        "_emscripten_stack_get_base"
    );

    var _sbrk = makeInvalidEarlyAccess("_sbrk");

    var _emscripten_get_sbrk_ptr = makeInvalidEarlyAccess(
        "_emscripten_get_sbrk_ptr"
    );

    var _emscripten_stack_init = makeInvalidEarlyAccess(
        "_emscripten_stack_init"
    );

    var _emscripten_stack_get_free = makeInvalidEarlyAccess(
        "_emscripten_stack_get_free"
    );

    var __emscripten_stack_restore = makeInvalidEarlyAccess(
        "__emscripten_stack_restore"
    );

    var __emscripten_stack_alloc = makeInvalidEarlyAccess(
        "__emscripten_stack_alloc"
    );

    var _emscripten_stack_get_current = makeInvalidEarlyAccess(
        "_emscripten_stack_get_current"
    );

    function assignWasmExports(wasmExports) {
        Module["_swe_degnorm"] = _swe_degnorm = createExportWrapper(
            "swe_degnorm",
            1
        );
        Module["_swe_vis_limit_mag"] = _swe_vis_limit_mag = createExportWrapper(
            "swe_vis_limit_mag",
            8
        );
        Module["_swe_set_topo"] = _swe_set_topo = createExportWrapper(
            "swe_set_topo",
            3
        );
        Module["_swe_revjul"] = _swe_revjul = createExportWrapper(
            "swe_revjul",
            6
        );
        Module["_swe_deltat_ex"] = _swe_deltat_ex = createExportWrapper(
            "swe_deltat_ex",
            3
        );
        Module["_swe_calc"] = _swe_calc = createExportWrapper("swe_calc", 5);
        Module["_swe_azalt"] = _swe_azalt = createExportWrapper("swe_azalt", 7);
        Module["_swe_pheno_ut"] = _swe_pheno_ut = createExportWrapper(
            "swe_pheno_ut",
            5
        );
        Module["_swe_topo_arcus_visionis"] = _swe_topo_arcus_visionis =
            createExportWrapper("swe_topo_arcus_visionis", 13);
        Module["_swe_heliacal_angle"] = _swe_heliacal_angle =
            createExportWrapper("swe_heliacal_angle", 12);
        Module["_swe_heliacal_pheno_ut"] = _swe_heliacal_pheno_ut =
            createExportWrapper("swe_heliacal_pheno_ut", 9);
        Module["_swe_heliacal_ut"] = _swe_heliacal_ut = createExportWrapper(
            "swe_heliacal_ut",
            9
        );
        Module["_swe_get_planet_name"] = _swe_get_planet_name =
            createExportWrapper("swe_get_planet_name", 2);
        Module["_swe_fixstar"] = _swe_fixstar = createExportWrapper(
            "swe_fixstar",
            5
        );
        Module["_swe_fixstar_mag"] = _swe_fixstar_mag = createExportWrapper(
            "swe_fixstar_mag",
            3
        );
        Module["_swe_calc_ut"] = _swe_calc_ut = createExportWrapper(
            "swe_calc_ut",
            5
        );
        Module["_swe_rise_trans"] = _swe_rise_trans = createExportWrapper(
            "swe_rise_trans",
            10
        );
        Module["_swe_houses"] = _swe_houses = createExportWrapper(
            "swe_houses",
            6
        );
        Module["_swe_sidtime0"] = _swe_sidtime0 = createExportWrapper(
            "swe_sidtime0",
            3
        );
        Module["_swe_houses_armc_ex2"] = _swe_houses_armc_ex2 =
            createExportWrapper("swe_houses_armc_ex2", 9);
        Module["_swe_difdeg2n"] = _swe_difdeg2n = createExportWrapper(
            "swe_difdeg2n",
            2
        );
        Module["_swe_houses_ex"] = _swe_houses_ex = createExportWrapper(
            "swe_houses_ex",
            7
        );
        Module["_swe_houses_ex2"] = _swe_houses_ex2 = createExportWrapper(
            "swe_houses_ex2",
            10
        );
        Module["_swe_set_sid_mode"] = _swe_set_sid_mode = createExportWrapper(
            "swe_set_sid_mode",
            3
        );
        Module["_swe_get_ayanamsa_ex"] = _swe_get_ayanamsa_ex =
            createExportWrapper("swe_get_ayanamsa_ex", 4);
        Module["_swe_houses_armc"] = _swe_houses_armc = createExportWrapper(
            "swe_houses_armc",
            6
        );
        Module["_swe_cotrans"] = _swe_cotrans = createExportWrapper(
            "swe_cotrans",
            3
        );
        Module["_swe_house_name"] = _swe_house_name = createExportWrapper(
            "swe_house_name",
            1
        );
        Module["_swe_house_pos"] = _swe_house_pos = createExportWrapper(
            "swe_house_pos",
            6
        );
        Module["_swe_radnorm"] = _swe_radnorm = createExportWrapper(
            "swe_radnorm",
            1
        );
        Module["_swe_sol_eclipse_where"] = _swe_sol_eclipse_where =
            createExportWrapper("swe_sol_eclipse_where", 5);
        Module["_swe_sidtime"] = _swe_sidtime = createExportWrapper(
            "swe_sidtime",
            1
        );
        Module["_swe_lun_occult_where"] = _swe_lun_occult_where =
            createExportWrapper("swe_lun_occult_where", 7);
        Module["_swe_sol_eclipse_how"] = _swe_sol_eclipse_how =
            createExportWrapper("swe_sol_eclipse_how", 5);
        Module["_swe_refrac_extended"] = _swe_refrac_extended =
            createExportWrapper("swe_refrac_extended", 7);
        Module["_swe_sol_eclipse_when_glob"] = _swe_sol_eclipse_when_glob =
            createExportWrapper("swe_sol_eclipse_when_glob", 6);
        Module["_swe_lun_occult_when_glob"] = _swe_lun_occult_when_glob =
            createExportWrapper("swe_lun_occult_when_glob", 8);
        Module["_swe_sol_eclipse_when_loc"] = _swe_sol_eclipse_when_loc =
            createExportWrapper("swe_sol_eclipse_when_loc", 7);
        Module["_swe_lun_occult_when_loc"] = _swe_lun_occult_when_loc =
            createExportWrapper("swe_lun_occult_when_loc", 9);
        Module["_swe_azalt_rev"] = _swe_azalt_rev = createExportWrapper(
            "swe_azalt_rev",
            5
        );
        Module["_swe_refrac"] = _swe_refrac = createExportWrapper(
            "swe_refrac",
            4
        );
        Module["_swe_set_lapse_rate"] = _swe_set_lapse_rate =
            createExportWrapper("swe_set_lapse_rate", 1);
        Module["_swe_lun_eclipse_how"] = _swe_lun_eclipse_how =
            createExportWrapper("swe_lun_eclipse_how", 5);
        Module["_swe_lun_eclipse_when"] = _swe_lun_eclipse_when =
            createExportWrapper("swe_lun_eclipse_when", 6);
        Module["_swe_lun_eclipse_when_loc"] = _swe_lun_eclipse_when_loc =
            createExportWrapper("swe_lun_eclipse_when_loc", 7);
        Module["_swe_rise_trans_true_hor"] = _swe_rise_trans_true_hor =
            createExportWrapper("swe_rise_trans_true_hor", 11);
        Module["_swe_pheno"] = _swe_pheno = createExportWrapper("swe_pheno", 5);
        Module["_swe_nod_aps"] = _swe_nod_aps = createExportWrapper(
            "swe_nod_aps",
            9
        );
        Module["_swe_nod_aps_ut"] = _swe_nod_aps_ut = createExportWrapper(
            "swe_nod_aps_ut",
            9
        );
        Module["_swe_get_orbital_elements"] = _swe_get_orbital_elements =
            createExportWrapper("swe_get_orbital_elements", 5);
        Module["_swe_orbit_max_min_true_distance"] =
            _swe_orbit_max_min_true_distance = createExportWrapper(
                "swe_orbit_max_min_true_distance",
                7
            );
        Module["_swe_gauquelin_sector"] = _swe_gauquelin_sector =
            createExportWrapper("swe_gauquelin_sector", 10);
        Module["_swe_version"] = _swe_version = createExportWrapper(
            "swe_version",
            1
        );
        Module["_swe_get_library_path"] = _swe_get_library_path =
            createExportWrapper("swe_get_library_path", 1);
        Module["_swe_set_tid_acc"] = _swe_set_tid_acc = createExportWrapper(
            "swe_set_tid_acc",
            1
        );
        Module["_free"] = _free = createExportWrapper("free", 1);
        Module["_swe_set_ephe_path"] = _swe_set_ephe_path = createExportWrapper(
            "swe_set_ephe_path",
            1
        );
        Module["_swe_difrad2n"] = _swe_difrad2n = createExportWrapper(
            "swe_difrad2n",
            2
        );
        Module["_swe_close"] = _swe_close = createExportWrapper("swe_close", 0);
        Module["_swe_set_jpl_file"] = _swe_set_jpl_file = createExportWrapper(
            "swe_set_jpl_file",
            1
        );
        Module["_swe_get_ayanamsa_ex_ut"] = _swe_get_ayanamsa_ex_ut =
            createExportWrapper("swe_get_ayanamsa_ex_ut", 4);
        Module["_swe_get_ayanamsa"] = _swe_get_ayanamsa = createExportWrapper(
            "swe_get_ayanamsa",
            1
        );
        Module["_swe_get_ayanamsa_ut"] = _swe_get_ayanamsa_ut =
            createExportWrapper("swe_get_ayanamsa_ut", 1);
        Module["_swe_fixstar2"] = _swe_fixstar2 = createExportWrapper(
            "swe_fixstar2",
            5
        );
        Module["_swe_fixstar2_ut"] = _swe_fixstar2_ut = createExportWrapper(
            "swe_fixstar2_ut",
            5
        );
        Module["_swe_fixstar2_mag"] = _swe_fixstar2_mag = createExportWrapper(
            "swe_fixstar2_mag",
            3
        );
        Module["_swe_get_ayanamsa_name"] = _swe_get_ayanamsa_name =
            createExportWrapper("swe_get_ayanamsa_name", 1);
        Module["_swe_time_equ"] = _swe_time_equ = createExportWrapper(
            "swe_time_equ",
            3
        );
        Module["_swe_lmt_to_lat"] = _swe_lmt_to_lat = createExportWrapper(
            "swe_lmt_to_lat",
            4
        );
        Module["_swe_lat_to_lmt"] = _swe_lat_to_lmt = createExportWrapper(
            "swe_lat_to_lmt",
            4
        );
        Module["_swe_fixstar_ut"] = _swe_fixstar_ut = createExportWrapper(
            "swe_fixstar_ut",
            5
        );
        Module["_swe_calc_pctr"] = _swe_calc_pctr = createExportWrapper(
            "swe_calc_pctr",
            6
        );
        Module["_swe_get_current_file_data"] = _swe_get_current_file_data =
            createExportWrapper("swe_get_current_file_data", 4);
        Module["_swe_solcross"] = _swe_solcross = createExportWrapper(
            "swe_solcross",
            4
        );
        Module["_swe_solcross_ut"] = _swe_solcross_ut = createExportWrapper(
            "swe_solcross_ut",
            4
        );
        Module["_swe_mooncross"] = _swe_mooncross = createExportWrapper(
            "swe_mooncross",
            4
        );
        Module["_swe_mooncross_ut"] = _swe_mooncross_ut = createExportWrapper(
            "swe_mooncross_ut",
            4
        );
        Module["_swe_mooncross_node"] = _swe_mooncross_node =
            createExportWrapper("swe_mooncross_node", 5);
        Module["_swe_mooncross_node_ut"] = _swe_mooncross_node_ut =
            createExportWrapper("swe_mooncross_node_ut", 5);
        Module["_swe_helio_cross"] = _swe_helio_cross = createExportWrapper(
            "swe_helio_cross",
            7
        );
        Module["_swe_helio_cross_ut"] = _swe_helio_cross_ut =
            createExportWrapper("swe_helio_cross_ut", 7);
        Module["_malloc"] = _malloc = createExportWrapper("malloc", 1);
        Module["_swe_date_conversion"] = _swe_date_conversion =
            createExportWrapper("swe_date_conversion", 6);
        Module["_swe_julday"] = _swe_julday = createExportWrapper(
            "swe_julday",
            5
        );
        Module["_swe_utc_time_zone"] = _swe_utc_time_zone = createExportWrapper(
            "swe_utc_time_zone",
            13
        );
        Module["_swe_utc_to_jd"] = _swe_utc_to_jd = createExportWrapper(
            "swe_utc_to_jd",
            9
        );
        Module["_swe_jdet_to_utc"] = _swe_jdet_to_utc = createExportWrapper(
            "swe_jdet_to_utc",
            8
        );
        Module["_swe_jdut1_to_utc"] = _swe_jdut1_to_utc = createExportWrapper(
            "swe_jdut1_to_utc",
            8
        );
        Module["_swe_deg_midp"] = _swe_deg_midp = createExportWrapper(
            "swe_deg_midp",
            2
        );
        Module["_swe_rad_midp"] = _swe_rad_midp = createExportWrapper(
            "swe_rad_midp",
            2
        );
        Module["_swe_cotrans_sp"] = _swe_cotrans_sp = createExportWrapper(
            "swe_cotrans_sp",
            3
        );
        Module["_swe_deltat"] = _swe_deltat = createExportWrapper(
            "swe_deltat",
            1
        );
        Module["_swe_get_tid_acc"] = _swe_get_tid_acc = createExportWrapper(
            "swe_get_tid_acc",
            0
        );
        Module["_swe_set_delta_t_userdef"] = _swe_set_delta_t_userdef =
            createExportWrapper("swe_set_delta_t_userdef", 1);
        Module["_swe_set_interpolate_nut"] = _swe_set_interpolate_nut =
            createExportWrapper("swe_set_interpolate_nut", 1);
        Module["_swe_csnorm"] = _swe_csnorm = createExportWrapper(
            "swe_csnorm",
            1
        );
        Module["_swe_difcsn"] = _swe_difcsn = createExportWrapper(
            "swe_difcsn",
            2
        );
        Module["_swe_difdegn"] = _swe_difdegn = createExportWrapper(
            "swe_difdegn",
            2
        );
        Module["_swe_difcs2n"] = _swe_difcs2n = createExportWrapper(
            "swe_difcs2n",
            2
        );
        Module["_swe_csroundsec"] = _swe_csroundsec = createExportWrapper(
            "swe_csroundsec",
            1
        );
        Module["_swe_d2l"] = _swe_d2l = createExportWrapper("swe_d2l", 1);
        Module["_swe_day_of_week"] = _swe_day_of_week = createExportWrapper(
            "swe_day_of_week",
            1
        );
        Module["_swe_cs2timestr"] = _swe_cs2timestr = createExportWrapper(
            "swe_cs2timestr",
            4
        );
        Module["_swe_cs2lonlatstr"] = _swe_cs2lonlatstr = createExportWrapper(
            "swe_cs2lonlatstr",
            4
        );
        Module["_swe_cs2degstr"] = _swe_cs2degstr = createExportWrapper(
            "swe_cs2degstr",
            2
        );
        Module["_swe_split_deg"] = _swe_split_deg = createExportWrapper(
            "swe_split_deg",
            7
        );
        Module["_swe_set_astro_models"] = _swe_set_astro_models =
            createExportWrapper("swe_set_astro_models", 2);
        Module["_swe_get_astro_models"] = _swe_get_astro_models =
            createExportWrapper("swe_get_astro_models", 3);
        _fflush = createExportWrapper("fflush", 1);
        _strerror = createExportWrapper("strerror", 1);
        _emscripten_stack_get_end = wasmExports["emscripten_stack_get_end"];
        _emscripten_stack_get_base = wasmExports["emscripten_stack_get_base"];
        _sbrk = createExportWrapper("sbrk", 1);
        _emscripten_get_sbrk_ptr = createExportWrapper(
            "emscripten_get_sbrk_ptr",
            0
        );
        _emscripten_stack_init = wasmExports["emscripten_stack_init"];
        _emscripten_stack_get_free = wasmExports["emscripten_stack_get_free"];
        __emscripten_stack_restore = wasmExports["_emscripten_stack_restore"];
        __emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"];
        _emscripten_stack_get_current =
            wasmExports["emscripten_stack_get_current"];
    }

    var wasmImports = {
        /** @export */ __syscall_fcntl64: ___syscall_fcntl64,
        /** @export */ __syscall_ioctl: ___syscall_ioctl,
        /** @export */ __syscall_openat: ___syscall_openat,
        /** @export */ __syscall_readlinkat: ___syscall_readlinkat,
        /** @export */ _abort_js: __abort_js,
        /** @export */ alignfault,
        /** @export */ emscripten_resize_heap: _emscripten_resize_heap,
        /** @export */ environ_get: _environ_get,
        /** @export */ environ_sizes_get: _environ_sizes_get,
        /** @export */ fd_close: _fd_close,
        /** @export */ fd_read: _fd_read,
        /** @export */ fd_seek: _fd_seek,
        /** @export */ fd_write: _fd_write,
        /** @export */ segfault,
    };

    // include: postamble.js
    // === Auto-generated postamble setup entry stuff ===
    var calledRun;

    function stackCheckInit() {
        // This is normally called automatically during __wasm_call_ctors but need to
        // get these values before even running any of the ctors so we call it redundantly
        // here.
        _emscripten_stack_init();
        // TODO(sbc): Move writeStackCookie to native to to avoid this.
        writeStackCookie();
    }

    function run() {
        if (runDependencies > 0) {
            dependenciesFulfilled = run;
            return;
        }
        stackCheckInit();
        preRun();
        // a preRun added a dependency, run will be called later
        if (runDependencies > 0) {
            dependenciesFulfilled = run;
            return;
        }
        function doRun() {
            // run may have just been called through dependencies being fulfilled just in this very frame,
            // or while the async setStatus time below was happening
            assert(!calledRun);
            calledRun = true;
            Module["calledRun"] = true;
            if (ABORT) return;
            initRuntime();
            readyPromiseResolve?.(Module);
            Module["onRuntimeInitialized"]?.();
            consumedModuleProp("onRuntimeInitialized");
            assert(
                !Module["_main"],
                'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]'
            );
            postRun();
        }
        if (Module["setStatus"]) {
            Module["setStatus"]("Running...");
            setTimeout(() => {
                setTimeout(() => Module["setStatus"](""), 1);
                doRun();
            }, 1);
        } else {
            doRun();
        }
        checkStackCookie();
    }

    function checkUnflushedContent() {
        // Compiler settings do not allow exiting the runtime, so flushing
        // the streams is not possible. but in ASSERTIONS mode we check
        // if there was something to flush, and if so tell the user they
        // should request that the runtime be exitable.
        // Normally we would not even include flush() at all, but in ASSERTIONS
        // builds we do so just for this check, and here we see if there is any
        // content to flush, that is, we check if there would have been
        // something a non-ASSERTIONS build would have not seen.
        // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
        // mode (which has its own special function for this; otherwise, all
        // the code is inside libc)
        var oldOut = out;
        var oldErr = err;
        var has = false;
        out = err = x => {
            has = true;
        };
        try {
            // it doesn't matter if it fails
            _fflush(0);
            // also flush in the JS FS layer
            ["stdout", "stderr"].forEach(name => {
                var info = FS.analyzePath("/dev/" + name);
                if (!info) return;
                var stream = info.object;
                var rdev = stream.rdev;
                var tty = TTY.ttys[rdev];
                if (tty?.output?.length) {
                    has = true;
                }
            });
        } catch (e) {}
        out = oldOut;
        err = oldErr;
        if (has) {
            warnOnce(
                "stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc."
            );
        }
    }

    var wasmExports;

    // In modularize mode the generated code is within a factory function so we
    // can use await here (since it's not top-level-await).
    wasmExports = await createWasm();

    run();

    // end include: postamble.js
    // include: postamble_modularize.js
    // In MODULARIZE mode we wrap the generated code in a factory function
    // and return either the Module itself, or a promise of the module.
    // We assign to the `moduleRtn` global here and configure closure to see
    // this as and extern so it won't get minified.
    if (runtimeInitialized) {
        moduleRtn = Module;
    } else {
        // Set up the promise that indicates the Module is initialized
        moduleRtn = new Promise((resolve, reject) => {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
        });
    }

    // Assertion for attempting to access module properties on the incoming
    // moduleArg.  In the past we used this object as the prototype of the module
    // and assigned properties to it, but now we return a distinct object.  This
    // keeps the instance private until it is ready (i.e the promise has been
    // resolved).
    for (const prop of Object.keys(Module)) {
        if (!(prop in moduleArg)) {
            Object.defineProperty(moduleArg, prop, {
                configurable: true,
                get() {
                    abort(
                        `Access to module property ('${prop}') is no longer possible via the module constructor argument; Instead, use the result of the module constructor.`
                    );
                },
            });
        }
    }

    return moduleRtn;
}

// Export using a UMD style export, or ES6 exports if selected
export default Module;
