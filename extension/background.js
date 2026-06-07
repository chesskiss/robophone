importScripts(
    "planner_modules/planner_catalog.js",
    "planner_modules/manual_loader.js",
    "planner_modules/planner_schema.js",
    "planner_modules/planner_normalizer.js",
    "planner_modules/planner_prompt.js",
    "planner_modules/executor_bridge.js",
    "planner_modules/planner_client.js",
);

const POPUP_WIN_KEY = "blocklyPopupWindowId";
const POPUP_WIDTH = 460;
const POPUP_HEIGHT = 640;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SEND_PROMPT_TO_GEMINI") {
        self.BlocklyPlannerClient.executeInstruction({
            prompt: request.prompt,
            apiKey: request.apiKey,
            tabId: request.tabId,
        })
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ error: err.message }));
        return true;
    }
    if (request.action === "PLAN_PROMPT_ONLY") {
        self.BlocklyPlannerClient.planInstruction({
            prompt: request.prompt,
            apiKey: request.apiKey,
            tabId: request.tabId,
        })
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ error: err.message }));
        return true;
    }
    return false;
});

chrome.action.onClicked.addListener(async () => {
    try {
        const stored = await chrome.storage.session.get(POPUP_WIN_KEY);
        const existingId = stored[POPUP_WIN_KEY];
        if (typeof existingId === "number") {
            try {
                await chrome.windows.update(existingId, { focused: true });
                return;
            } catch (_) {
                // The window was closed externally.
            }
        }
        const win = await chrome.windows.create({
            url: chrome.runtime.getURL("popup.html"),
            type: "popup",
            width: POPUP_WIDTH,
            height: POPUP_HEIGHT,
            focused: true,
        });
        if (win && typeof win.id === "number") {
            await chrome.storage.session.set({ [POPUP_WIN_KEY]: win.id });
        }
    } catch (e) {
        console.error("[BlocklyAgent] failed to open popup window:", e);
    }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
    const stored = await chrome.storage.session.get(POPUP_WIN_KEY);
    if (stored[POPUP_WIN_KEY] === windowId) {
        await chrome.storage.session.remove(POPUP_WIN_KEY);
    }
});
