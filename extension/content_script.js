// This script runs on the Blockly page and has access to the injected window methods.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "PING") {
        sendResponse({ status: "ready" });
        return true;
    }
    if (request.action === "EXECUTE_BLOCKLY_METHOD") {
        const { method, args } = request;

        console.log(`[ContentScript] Executing: ${method}`, args);

        if (typeof window[method] === "function") {
            // Execute the method defined in blockly_methods.js
            // Since blockly_methods.js exposes methods to 'window'
            window[method](...(Object.values(args || {})))
                .then(() => {
                    console.log(`[ContentScript] ${method} completed successfully.`);
                    sendResponse({ status: "success" });
                })
                .catch(err => {
                    console.error(`[ContentScript] Error in ${method}:`, err);
                    sendResponse({ status: "error", error: err.message });
                });
            return true; // Keep channel open for async response
        } else {
            const errorMsg = `Method ${method} not found in window object.`;
            console.error(`[ContentScript] ${errorMsg}`);
            sendResponse({ status: "error", error: errorMsg });
        }
    }
});

console.log("🚀 Blockly AI Content Script Loaded.");
