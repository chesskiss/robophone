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

// ── Floating chat widget (robo-phone.com only) ────────────────────────────────
(function injectChatWidget() {
    if (document.getElementById('robo-ai-widget')) return;

    const style = document.createElement('style');
    style.textContent = `
        #robo-ai-widget {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 2147483647;
            font-family: system-ui, -apple-system, sans-serif;
        }
        #robo-ai-toggle-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #4f46e5, #0ea5e9);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(79,70,229,0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s;
            outline: none;
        }
        #robo-ai-toggle-btn:hover {
            transform: scale(1.08);
            box-shadow: 0 6px 22px rgba(79,70,229,0.55);
        }
        #robo-ai-toggle-btn svg { pointer-events: none; }
        #robo-ai-panel {
            position: absolute;
            bottom: 68px;
            right: 0;
            width: 400px;
            height: 620px;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 12px 40px rgba(0,0,0,0.35);
            display: flex;
            flex-direction: column;
            transition: opacity 0.2s, transform 0.2s;
            transform-origin: bottom right;
        }
        #robo-ai-panel.robo-ai-hidden {
            opacity: 0;
            transform: scale(0.92);
            pointer-events: none;
        }
        #robo-ai-frame {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }
    `;
    document.head.appendChild(style);

    const widget = document.createElement('div');
    widget.id = 'robo-ai-widget';
    widget.innerHTML = `
        <div id="robo-ai-panel" class="robo-ai-hidden">
            <iframe id="robo-ai-frame"
                src="${chrome.runtime.getURL('popup.html')}"
                allow="microphone"
                title="Blockly AI Assistant">
            </iframe>
        </div>
        <button id="robo-ai-toggle-btn" title="Blockly AI Assistant" aria-label="Open AI assistant">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"
                 fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
        </button>
    `;
    document.body.appendChild(widget);

    const panel  = document.getElementById('robo-ai-panel');
    const btn    = document.getElementById('robo-ai-toggle-btn');

    btn.addEventListener('click', () => {
        panel.classList.toggle('robo-ai-hidden');
    });

    // Close panel when popup's own close button posts a message
    window.addEventListener('message', (e) => {
        if (e.data === 'robo-ai:close') panel.classList.add('robo-ai-hidden');
    });
})();
