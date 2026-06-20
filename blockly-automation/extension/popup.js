// No default key — paste your Gemini API key into the popup field.
// It is persisted to chrome.storage on the first Run click and reused across sessions.
// For local development, copy .env.example to .env and set GEMINI_API_KEY there
// (a bundler step would inject it here at build time).
const DEFAULT_GEMINI_KEY = "";

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

// ── Language / direction helpers ─────────────────────────────────────────────

// RTL Unicode ranges: Hebrew, Arabic, Syriac, Thaana, NKo, etc.
const RTL_REGEX = /[֐-׿؀-ۿ܀-ݏ߀-߿ࠀ-࠿]/;

function detectDir(text) {
    return RTL_REGEX.test(text) ? "rtl" : "ltr";
}

function applyDir(el, text) {
    el.dir = detectDir(text);
}

// Maps language names (as returned by Gemini normalization) to BCP-47 tags.
// Used to pass a language hint to the audio transcription call.
const LANG_NAME_TO_BCP47 = {
    hebrew: "he", arabic: "ar", russian: "ru", french: "fr",
    german: "de", spanish: "es", portuguese: "pt", italian: "it",
    chinese: "zh", japanese: "ja", korean: "ko", turkish: "tr",
    dutch: "nl", polish: "pl", ukrainian: "uk"
};

function langNameToBcp47(name) {
    return LANG_NAME_TO_BCP47[(name || "").toLowerCase().split(" ")[0]] || null;
}

// ── STT via Gemini audio input ────────────────────────────────────────────────
// Records a webm/opus blob, base64-encodes it, and sends it to Gemini as an
// inline audio part. Gemini returns { text, langHint } where langHint is the
// BCP-47 code Gemini detected (for subsequent prompts / direction detection).
const STT_GEMINI_MODEL = "gemini-2.5-flash-lite";

async function transcribeWithGemini(blob, apiKey, langHint) {
    const arrayBuf = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);

    const langLine = langHint
        ? `The speaker is using language code "${langHint}". `
        : "";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${STT_GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const body = {
        contents: [{
            role: "user",
            parts: [
                { inlineData: { mimeType: "audio/webm", data: b64 } },
                {
                    text: `${langLine}Transcribe this audio verbatim in its original language. ` +
                          `Return ONLY the spoken text. No translation, no commentary, no punctuation changes.`
                }
            ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 1024 }
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const text = data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "").join("").trim();
    if (!text) throw new Error("Gemini returned empty transcription");
    return text;
}

document.addEventListener('DOMContentLoaded', async () => {
    const runBtn = document.getElementById('runBtn');
    const testBtn = document.getElementById('testBtn');
    const closeBtn = document.getElementById('closeBtn');
    const micBtn = document.getElementById('micBtn');
    const sttStatus = document.getElementById('sttStatus');
    const langSelect = document.getElementById('langSelect');
    const promptInput = document.getElementById('prompt');
    const apiKeyInput = document.getElementById('apiKey');
    const statusDiv = document.getElementById('status');
    const statusMsg = document.getElementById('statusMsg');
    const actionList = document.getElementById('actionList');

    // Load saved API Key and language preference
    const data = await chrome.storage.local.get(['geminiApiKey', 'sttLang']);
    apiKeyInput.value = data.geminiApiKey || DEFAULT_GEMINI_KEY;
    if (langSelect && data.sttLang) langSelect.value = data.sttLang;

    // Persist language selection changes
    if (langSelect) {
        langSelect.addEventListener('change', () => {
            chrome.storage.local.set({ sttLang: langSelect.value });
        });
    }

    // Auto-detect RTL/LTR direction as the user types into the textarea
    promptInput.addEventListener('input', () => {
        if (promptInput.value) applyDir(promptInput, promptInput.value);
    });

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

    // ── Mic / STT button ──────────────────────────────────────────────────────
    let mediaRecorder = null;
    let audioChunks = [];

    const setSttStatus = (msg, color) => {
        sttStatus.textContent = msg;
        sttStatus.style.color = color || "#64748b";
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
        micBtn.classList.remove("recording");
        micBtn.title = "Record voice prompt";
    };

    micBtn.addEventListener("click", async () => {
        if (micBtn.classList.contains("recording")) {
            stopRecording();
            return;
        }

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            setSttStatus("Paste a Gemini API key first.", "#ef4444");
            return;
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            setSttStatus("Mic access denied: " + e.message, "#ef4444");
            return;
        }

        audioChunks = [];
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus" : "audio/webm";
        mediaRecorder = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            setSttStatus("Transcribing with Gemini…", "#0ea5e9");
            micBtn.disabled = true;
            try {
                const blob = new Blob(audioChunks, { type: mimeType });
                // Pass a language hint if the user has previously spoken and we
                // detected a language from normalization (stored on the element).
                const hint = langSelect ? langSelect.value || null : null;
                const text = await transcribeWithGemini(blob, apiKey, hint);
                promptInput.value = text;
                applyDir(promptInput, text);
                setSttStatus("✓ Transcription done", "#22c55e");
            } catch (e) {
                setSttStatus("Transcription error: " + e.message, "#ef4444");
            } finally {
                micBtn.disabled = false;
            }
        };

        mediaRecorder.start();
        micBtn.classList.add("recording");
        micBtn.title = "Click to stop recording";
        setSttStatus("● Recording… click mic to stop", "#ef4444");
    });

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
