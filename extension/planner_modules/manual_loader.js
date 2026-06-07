(function initManualLoader(globalScope) {
    let cachedManual = null;

    async function loadRoboPhoneManual() {
        if (cachedManual !== null) {
            return cachedManual;
        }
        try {
            const manualUrl = chrome.runtime.getURL("robophone_llm_instructions.md");
            console.log(`[BlocklyAgent] fetching manual from ${manualUrl}`);
            const res = await fetch(manualUrl);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            cachedManual = await res.text();
            console.log(
                `[BlocklyAgent] manual loaded: ${cachedManual.length} chars. Head: ${JSON.stringify(cachedManual.slice(0, 200))}`
            );
        } catch (e) {
            console.error("[BlocklyAgent] FAILED to load robophone_llm_instructions.md:", e);
            cachedManual = "";
        }
        return cachedManual;
    }

    globalScope.BlocklyManualLoader = {
        loadRoboPhoneManual,
    };
})(self);
