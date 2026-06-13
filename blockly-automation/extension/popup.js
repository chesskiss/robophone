// Default key shipped with the extension so users don't have to paste one.
// Override by typing a different value in the popup — it's persisted to
// chrome.storage on the next Run click and reused across sessions.
const DEFAULT_GEMINI_KEY = "REMOVED_GEMINI_API_KEY";

// Built-in test payload for the "Run Test Script (no LLM)" button: the
// sin-graph program, exactly as Gemini emitted it in a real run — including
// the bogus GRAPH cat path ["CATSMARTPHONE","CATVIRTUALACTION","CATMATH"],
// which doubles as a regression test for the background's category sanitizer.
const DIRECT_TEST_SCRIPT = [
    { "action": "spawn", "block": "INITIATE", "cat": ["CATLOOPS"], "id": "start" },
    { "action": "spawn", "block": "RESET_GRAPH", "cat": ["CATSMARTPHONE", "CATVIRTUALACTION"], "id": "reset", "parent": "start", "pos": "nested" },
    { "action": "input", "block": "reset", "value": "red" },
    { "action": "spawn", "block": "CONTROLS_FOR", "cat": ["CATLOOPS"], "id": "loop", "parent": "reset", "pos": "next" },
    { "action": "input", "block": "loop", "value": "angleDeg" },
    { "action": "input", "block": "loop", "value": "-360" },
    { "action": "input", "block": "loop", "value": "360" },
    { "action": "input", "block": "loop", "value": "10" },
    { "action": "spawn", "block": "GRAPH", "cat": ["CATSMARTPHONE", "CATVIRTUALACTION", "CATMATH"], "id": "draw", "parent": "loop", "pos": "nested" },
    { "action": "spawn", "block": "MATH_ADVANCED", "cat": ["CATMATH"], "id": "xrad_calc", "parent": "draw", "pos": "nested" },
    { "action": "input", "block": "xrad_calc", "value": "a*3.1416/180" },
    { "action": "spawn", "block": "VAR_GET", "cat": ["Variables"], "id": "get_angle", "parent": "xrad_calc", "pos": "nested" },
    { "action": "input", "block": "get_angle", "value": "angleDeg" },
    { "action": "spawn", "block": "MATH_TRIG", "cat": ["CATMATH"], "id": "ysin_calc", "parent": "draw", "pos": "nested" },
    { "action": "input", "block": "ysin_calc", "value": "sin" },
    { "action": "spawn", "block": "VAR_GET", "cat": ["Variables"], "id": "get_angle2", "parent": "ysin_calc", "pos": "nested" },
    { "action": "input", "block": "get_angle2", "value": "angleDeg" },
    { "action": "input", "block": "draw", "value": "red" },
    { "action": "input", "block": "draw", "value": "false" }
];

// Resolve the Blockly tab the agent will inject into. The popup is a
// standalone Chrome window, so `{active:true, currentWindow:true}` would
// return the popup's own tab (a chrome-extension://... URL that
// chrome.scripting can't inject into). Strategy:
//   1. Look for a tab on a Robo-Phone URL anywhere.
//   2. Fall back to the active tab in the last-focused non-popup window.
//   3. Final fallback: the active tab in any window (filter out our own
//      chrome-extension:// pages).
async function resolveTargetTabId() {
    const isInjectable = (t) => t && t.id && typeof t.url === "string"
        && !t.url.startsWith("chrome-extension://")
        && !t.url.startsWith("chrome://")
        && !t.url.startsWith("edge://");
    try {
        const roboTabs = await chrome.tabs.query({
            url: [
                "*://*.robo-phone.com/*",
                "*://localhost/*",
                "*://localhost:*/*",
                "*://127.0.0.1/*",
                "*://127.0.0.1:*/*"
            ]
        });
        const roboCandidate = roboTabs.find(t => t.active) || roboTabs[0];
        if (roboCandidate && roboCandidate.id) return roboCandidate.id;
    } catch (_) { }
    try {
        const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (isInjectable(t)) return t.id;
    } catch (_) { }
    try {
        const all = await chrome.tabs.query({ active: true });
        const t = all.find(isInjectable);
        if (t) return t.id;
    } catch (_) { }
    return null;
}

document.addEventListener('DOMContentLoaded', async () => {
    const runBtn = document.getElementById('runBtn');
    const testBtn = document.getElementById('testBtn');
    const closeBtn = document.getElementById('closeBtn');
    const promptInput = document.getElementById('prompt');
    const apiKeyInput = document.getElementById('apiKey');
    const statusDiv = document.getElementById('status');
    const statusMsg = document.getElementById('statusMsg');
    const actionList = document.getElementById('actionList');

    // Load saved API Key (or fall back to the bundled default)
    const data = await chrome.storage.local.get(['geminiApiKey']);
    apiKeyInput.value = data.geminiApiKey || DEFAULT_GEMINI_KEY;

    // The popup is a real Chrome window — only the Close button shuts it.
    // Stay open across focus changes (the previous default popup would
    // auto-close when the user clicked back into the Blockly page).
    if (closeBtn) {
        closeBtn.addEventListener('click', () => window.close());
    }

    const showStatus = (text, cls) => {
        statusDiv.classList.remove('hidden');
        statusMsg.innerText = text;
        statusMsg.className = cls || "";
    };

    const setBusy = (busy) => {
        runBtn.disabled = busy;
        if (testBtn) testBtn.disabled = busy;
    };

    // Shared response handling for both the Gemini flow and the direct test.
    const handleResponse = (response) => {
        setBusy(false);
        // Surface SW disconnects / dropped responses instead of hanging
        // forever. chrome.runtime.lastError is set when the service worker
        // dies before sendResponse fires.
        if (chrome.runtime.lastError) {
            showStatus("Service worker error: " + chrome.runtime.lastError.message, "error");
            return;
        }
        if (!response) {
            showStatus("No response from background. Open chrome://extensions → 'Service worker' to inspect logs.", "error");
            return;
        }
        if (response.error) {
            showStatus("Error: " + response.error, "error");
        } else if (response.status === "success") {
            const cnt = response.commandsEmitted;
            const placed = response.blocksPlaced;
            const stats = response.spawnStats ? `, spawns api:${response.spawnStats.api} drag:${response.spawnStats.drag}` : "";
            const mode = response.placementMode ? ` [${response.placementMode} mode${stats}]` : "";
            const warnings = response.warnings || [];
            const normalization = response.normalization || null;
            const warnNote = warnings.length ? ` ⚠ ${warnings.length} field warning(s) — see below.` : "";
            showStatus(
                (typeof cnt === "number")
                    ? `Success! ${cnt} command(s) executed${(typeof placed === "number") ? `, ${placed} block(s) placed` : ""}.${mode}${warnNote}`
                    : "Success! Actions completed:",
                "success"
            );
            if (normalization) {
                const lang = document.createElement('li');
                lang.innerText = `🌐 detected language: ${normalization.detectedLanguage} (confidence ${normalization.confidence})`;
                actionList.appendChild(lang);
                const normalized = document.createElement('li');
                normalized.innerText = `📝 normalized prompt: ${normalization.normalizedEnglish}`;
                actionList.appendChild(normalized);
                if (normalization.usedFallback || normalization.notes) {
                    const note = document.createElement('li');
                    note.innerText = `ℹ normalization notes: ${normalization.notes || "used original prompt fallback"}`;
                    note.style.color = "#1d4ed8";
                    actionList.appendChild(note);
                }
            }
            (response.actions || []).forEach(action => {
                const li = document.createElement('li');
                li.innerText = action;
                actionList.appendChild(li);
            });
            warnings.forEach(w => {
                const li = document.createElement('li');
                li.innerText = "⚠ " + w;
                li.style.color = "#b45309";
                actionList.appendChild(li);
            });
        } else if (response.message) {
            showStatus(response.message, "");
            const normalization = response.normalization || null;
            if (normalization) {
                const lang = document.createElement('li');
                lang.innerText = `🌐 detected language: ${normalization.detectedLanguage} (confidence ${normalization.confidence})`;
                actionList.appendChild(lang);
                const normalized = document.createElement('li');
                normalized.innerText = `📝 normalized prompt: ${normalization.normalizedEnglish}`;
                actionList.appendChild(normalized);
            }
        }
    };

    runBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!prompt || !apiKey) {
            alert('Please provide both an API Key and a prompt.');
            return;
        }

        const tabId = await resolveTargetTabId();
        if (tabId == null) {
            showStatus("Couldn't find a Robo-Phone tab to automate. Open https://staging.code.robo-phone.com/home in another tab and click Run again.", "error");
            return;
        }

        // Save API Key
        await chrome.storage.local.set({ geminiApiKey: apiKey });

        setBusy(true);
        actionList.innerHTML = "";
        showStatus("Connecting to Gemini... (this can take 30-90s while it plans against the manual)");

        chrome.runtime.sendMessage({
            action: "SEND_PROMPT_TO_GEMINI",
            prompt: prompt,
            apiKey: apiKey,
            tabId: tabId
        }, handleResponse);
    });

    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            const tabId = await resolveTargetTabId();
            if (tabId == null) {
                showStatus("Couldn't find a Robo-Phone tab to automate. Open https://staging.code.robo-phone.com/home in another tab and click again.", "error");
                return;
            }
            setBusy(true);
            actionList.innerHTML = "";
            showStatus(`Running built-in test script (${DIRECT_TEST_SCRIPT.length} commands, no LLM)...`);
            chrome.runtime.sendMessage({
                action: "RUN_DIRECT_SCRIPT",
                script: DIRECT_TEST_SCRIPT,
                tabId: tabId
            }, handleResponse);
        });
    }
});
