// Default key shipped with the extension so users don't have to paste one.
// Override by typing a different value in the popup — it's persisted to
// chrome.storage on the next Run click and reused across sessions.
const DEFAULT_GEMINI_KEY = "AIzaSyCcC7r8gGSSfnRCiP7BhfWqFgK6llIN6rI";

document.addEventListener('DOMContentLoaded', async () => {
    const runBtn = document.getElementById('runBtn');
    const closeBtn = document.getElementById('closeBtn');
    const promptInput = document.getElementById('prompt');
    const apiKeyInput = document.getElementById('apiKey');
    const statusDiv = document.getElementById('status');
    const statusMsg = document.getElementById('statusMsg');
    const actionList = document.getElementById('actionList');

    // Load saved API Key (or fall back to the bundled default)
    const data = await chrome.storage.local.get(['geminiApiKey']);
    apiKeyInput.value = data.geminiApiKey || DEFAULT_GEMINI_KEY;

    // The popup is now a real Chrome window — only the Close button shuts it.
    // Stay open across focus changes (the previous default popup would auto-close
    // when the user clicked back into the Blockly page).
    if (closeBtn) {
        closeBtn.addEventListener('click', () => window.close());
    }

    runBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!prompt || !apiKey) {
            alert('Please provide both an API Key and a prompt.');
            return;
        }

        // Resolve the Blockly tab the agent will inject into. The popup is now
        // a standalone Chrome window, so `{active:true, currentWindow:true}`
        // would return the popup's own tab (a chrome-extension://... URL that
        // chrome.scripting can't inject into). Strategy:
        //   1. Look for a tab on a Robo-Phone URL anywhere.
        //   2. Fall back to the active tab in the last-focused non-popup window.
        //   3. Final fallback: the active tab in any window (filter out our own
        //      chrome-extension:// pages).
        let tabId = null;
        const isInjectable = (t) => t && t.id && typeof t.url === "string" && !t.url.startsWith("chrome-extension://") && !t.url.startsWith("chrome://") && !t.url.startsWith("edge://");
        try {
            // 1) Robo-Phone tabs (covers staging / prod / localhost dev).
            const roboTabs = await chrome.tabs.query({ url: [
                "*://*.robo-phone.com/*",
                "*://localhost/*",
                "*://localhost:*/*",
                "*://127.0.0.1/*",
                "*://127.0.0.1:*/*"
            ]});
            const roboCandidate = roboTabs.find(t => t.active) || roboTabs[0];
            if (roboCandidate && roboCandidate.id) {
                tabId = roboCandidate.id;
            }
        } catch (_) {}
        if (tabId == null) {
            try {
                // 2) Active tab in the most-recently-focused Chrome window
                //    (excluding this popup if it happens to be returned).
                const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                if (isInjectable(t)) tabId = t.id;
            } catch (_) {}
        }
        if (tabId == null) {
            try {
                // 3) Active tab in any window — filter out chrome-extension://.
                const all = await chrome.tabs.query({ active: true });
                const t = all.find(isInjectable);
                if (t) tabId = t.id;
            } catch (_) {}
        }
        if (tabId == null) {
            statusMsg.innerText = "Couldn't find a Robo-Phone tab to automate. Open https://staging.code.robo-phone.com/home in another tab and click Run again.";
            statusMsg.className = "error";
            statusDiv.classList.remove('hidden');
            return;
        }

        // Save API Key
        await chrome.storage.local.set({ geminiApiKey: apiKey });

        runBtn.disabled = true;
        statusDiv.classList.remove('hidden');
        statusMsg.innerText = "Connecting to Gemini... (this can take 30-90s while it plans against the manual)";
        statusMsg.className = "";
        actionList.innerHTML = "";

        chrome.runtime.sendMessage({
            action: "SEND_PROMPT_TO_GEMINI",
            prompt: prompt,
            apiKey: apiKey,
            tabId: tabId
        }, (response) => {
            runBtn.disabled = false;
            // Surface SW disconnects / dropped responses instead of hanging
            // forever on "Connecting to Gemini...". chrome.runtime.lastError
            // is set when the service worker dies before sendResponse fires.
            if (chrome.runtime.lastError) {
                statusMsg.innerText = "Service worker error: " + chrome.runtime.lastError.message;
                statusMsg.className = "error";
                return;
            }
            if (!response) {
                statusMsg.innerText = "No response from background. Open chrome://extensions → 'Service worker' to inspect logs.";
                statusMsg.className = "error";
                return;
            }
            if (response.error) {
                statusMsg.innerText = "Error: " + response.error;
                statusMsg.className = "error";
            } else if (response.status === "success") {
                const cnt = response.commandsEmitted;
                statusMsg.innerText = (typeof cnt === "number")
                    ? `Success! ${cnt} block command(s) executed.`
                    : "Success! Actions completed:";
                statusMsg.className = "success";
                response.actions.forEach(action => {
                    const li = document.createElement('li');
                    li.innerText = action;
                    actionList.appendChild(li);
                });
            } else if (response.message) {
                statusMsg.innerText = response.message;
            }
        });
    });
});
