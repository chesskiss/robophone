(function initExecutorBridge(globalScope) {
    async function resolveInjectableTab(preferredTabId) {
        const isInjectable = (t) => t && typeof t.id === "number"
            && typeof t.url === "string"
            && !t.url.startsWith("chrome-extension://")
            && !t.url.startsWith("chrome://")
            && !t.url.startsWith("edge://")
            && !t.url.startsWith("about:");

        let tab = null;
        let why = "";

        if (preferredTabId != null) {
            try {
                const candidate = await chrome.tabs.get(preferredTabId);
                if (isInjectable(candidate)) {
                    tab = candidate;
                } else {
                    why = `preferredTabId ${preferredTabId} resolves to a non-injectable URL (${candidate?.url}); will fall back`;
                    console.warn(`[BlocklyAgent] ${why}`);
                }
            } catch (e) {
                console.warn(`[BlocklyAgent] preferredTabId ${preferredTabId} no longer exists:`, e.message);
            }
        }

        if (!tab) {
            try {
                const list = await chrome.tabs.query({
                    url: [
                        "*://*.robo-phone.com/*",
                        "*://localhost/*",
                        "*://localhost:*/*",
                        "*://127.0.0.1/*",
                        "*://127.0.0.1:*/*",
                    ],
                });
                const candidate = list.find((t) => t.active) || list[0];
                if (isInjectable(candidate)) {
                    tab = candidate;
                }
            } catch (_) {}
        }

        if (!tab) {
            const [candidate] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (isInjectable(candidate)) {
                tab = candidate;
            }
        }

        if (!tab) {
            const all = await chrome.tabs.query({ active: true });
            const candidate = all.find(isInjectable);
            if (candidate) {
                tab = candidate;
            }
        }

        if (!tab) {
            throw new Error(
                "No injectable Blockly tab found. Open https://staging.code.robo-phone.com/home in a normal browser tab and click Run again."
                + (why ? ` (Note: ${why})` : "")
            );
        }
        return tab;
    }

    async function getPageContext(preferredTabId) {
        const tab = await resolveInjectableTab(preferredTabId);
        let context = {
            url: tab.url,
            title: tab.title || "",
            blocklyAgentPresent: false,
            foundWorkspace: false,
        };
        try {
            const probe = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => ({
                    url: window.location.href,
                    title: document.title,
                    blocklyAgentPresent: !!window.BlocklyAgent,
                    foundWorkspace: !!(window.Blockly && typeof window.Blockly.getMainWorkspace === "function" && window.Blockly.getMainWorkspace()),
                }),
                world: "MAIN",
            });
            if (probe?.[0]?.result) {
                context = probe[0].result;
            }
        } catch (err) {
            console.warn("[BlocklyAgent] Failed to probe page context:", err);
        }
        return { tab, context };
    }

    async function executePlannedScript(script, preferredTabId) {
        const tab = await resolveInjectableTab(preferredTabId);
        console.log(`[BlocklyAgent] target tab id=${tab.id} url=${tab.url}`);

        try {
            const probe = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => !!window.BlocklyAgent,
                world: "MAIN",
            });
            const present = !!probe?.[0]?.result;
            console.log(`[BlocklyAgent] BlocklyAgent present in MAIN world: ${present}`);
            if (!present) {
                console.log("[BlocklyAgent] injecting blockly_methods.js into MAIN world...");
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["blockly_methods.js"],
                    world: "MAIN",
                });
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        } catch (probeErr) {
            console.error("[BlocklyAgent] Probe/inject failed:", probeErr);
            throw new Error(`Could not inject into tab ${tab.id} (${tab.url}). Refresh the Blockly page and retry. Underlying: ${probeErr.message}`);
        }

        return new Promise((resolve, reject) => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (methodName, argsObj) => {
                    if (methodName === "execute_blockly_script") {
                        if (!window.BlocklyAgent) {
                            return { ok: false, error: "BlocklyAgent not loaded in MAIN world (injection failed)." };
                        }
                        try {
                            return await window.BlocklyAgent.execute(argsObj.script);
                        } catch (e) {
                            return { ok: false, error: String((e && e.message) || e) };
                        }
                    }
                    return { ok: false, error: `Method ${methodName} not found in MAIN world.` };
                },
                args: ["execute_blockly_script", { script }],
                world: "MAIN",
            }, (results) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                const result = results && results[0] && results[0].result;
                if (!result || typeof result !== "object") {
                    return reject(new Error("MAIN-world function returned no result. Check the page console for the actual exception."));
                }
                if (result.ok === false) {
                    return reject(new Error(result.error || "Blockly execution failed."));
                }
                if (Number(result.spawnedCount || 0) === 0) {
                    const commandsExecuted = Number(result.commandsExecuted || 0);
                    const hint = commandsExecuted === 0
                        ? "the post-normalize script was empty (every LLM command was rejected before execution)"
                        : `the script had ${commandsExecuted} command(s) but nothing was placed`;
                    return reject(new Error(
                        `Blockly execution completed but no blocks were placed on the workspace. `
                        + `commandsExecuted=${commandsExecuted}, spawnedCount=0. Likely cause: ${hint}.`
                    ));
                }
                resolve({ status: "success", result });
            });
        });
    }

    globalScope.BlocklyExecutorBridge = {
        getPageContext,
        executePlannedScript,
    };
})(self);
