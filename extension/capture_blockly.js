(function () {
    // Temporary diagnostic hook:
    // - tests whether RoboPhone exposes a native Blockly workspace through Blockly.inject
    // - helps decide whether native Blockly execution is possible
    // If no workspace is captured after reload, continue with the deterministic DOM/socket-aware executor.
    const LOG_PREFIX = "[BlocklyHook]";

    console.log(`${LOG_PREFIX} document_start MAIN hook loaded`);

    window.__ROBOPHONE_HOOK_LOGS = window.__ROBOPHONE_HOOK_LOGS || [];
    window.__ROBOPHONE_WORKSPACES = window.__ROBOPHONE_WORKSPACES || [];

    function log(...args) {
        try {
            console.log(LOG_PREFIX, ...args);
        } catch (_) {}
        try {
            window.__ROBOPHONE_HOOK_LOGS.push(args);
        } catch (_) {}
    }

    function summarizeKeys(obj, limit = 30) {
        try {
            return Object.keys(obj || {}).slice(0, limit);
        } catch (_) {
            return [];
        }
    }

    function patchInject(blocklyObj, source) {
        if (!blocklyObj || typeof blocklyObj.inject !== "function") return false;
        if (blocklyObj.__robophoneInjectPatched) return true;

        const originalInject = blocklyObj.inject;
        if (typeof originalInject !== "function") return false;

        blocklyObj.inject = function (...args) {
            log("Blockly.inject called", {
                source,
                argCount: args.length,
            });

            const workspace = originalInject.apply(this, args);

            try {
                window.__ROBOPHONE_WORKSPACE = workspace;
                window.__ROBOPHONE_WORKSPACES.push(workspace);
            } catch (_) {}

            let blockCount = null;
            try {
                if (typeof workspace?.getAllBlocks === "function") {
                    blockCount = workspace.getAllBlocks(false).length;
                }
            } catch (_) {}

            log("Captured workspace", {
                id: workspace && workspace.id,
                hasNewBlock: !!workspace?.newBlock,
                blockCount,
            });

            return workspace;
        };

        try {
            Object.defineProperty(blocklyObj, "__robophoneInjectPatched", {
                configurable: true,
                enumerable: false,
                writable: true,
                value: true,
            });
        } catch (_) {
            blocklyObj.__robophoneInjectPatched = true;
        }

        log("Blockly.inject patched", {
            source,
            keys: summarizeKeys(blocklyObj, 20),
        });
        return true;
    }

    function captureBlocklyObject(obj, source) {
        if (!obj || obj.__robophoneHooked) return;

        const hasInject = typeof obj.inject === "function";
        const hasWorkspace = !!obj.Workspace;

        if (!hasInject && !hasWorkspace) {
            return;
        }

        log("Potential Blockly object found", {
            source,
            hasInject,
            hasWorkspace,
            keys: summarizeKeys(obj),
        });

        if (hasInject) {
            patchInject(obj, source);
        }

        try {
            Object.defineProperty(obj, "__robophoneHooked", {
                configurable: true,
                enumerable: false,
                writable: true,
                value: true,
            });
        } catch (_) {
            obj.__robophoneHooked = true;
        }
    }

    let currentBlockly = window.Blockly;

    try {
        Object.defineProperty(window, "Blockly", {
            configurable: true,
            enumerable: true,
            get() {
                return currentBlockly;
            },
            set(value) {
                currentBlockly = value;
                log("window.Blockly assigned", summarizeKeys(value, 20));
                captureBlocklyObject(value, "window.Blockly setter");
            },
        });
        log("window.Blockly setter hook installed");
    } catch (error) {
        log("Failed to install window.Blockly setter hook", error && error.message);
    }

    if (currentBlockly) {
        log("Existing window.Blockly detected on load", summarizeKeys(currentBlockly, 20));
        captureBlocklyObject(currentBlockly, "existing window.Blockly");
    }
})();
