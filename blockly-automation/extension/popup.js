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

// ── Native SDK test suite ────────────────────────────────────────────────────
// Spawn/input command arrays from test_output.md (generated by run_tests.js).
const TESTS = [
    {
        title: "Set variable x to 42",
        commands: [{"block":"INITIATE","action":"spawn","cat":["CATLOOPS"],"id":"start"},{"pos":"nested","block":"VAR_SET","action":"spawn","cat":["Variables"],"id":"var_set1","parent":"start"},{"action":"input","block":"var_set1","value":"x"},{"cat":["CATMATH"],"id":"num_val","parent":"var_set1","pos":"nested","block":"MATH_NUMBER","action":"spawn"},{"value":"42","block":"num_val","action":"input"}]
    },
    {
        title: "result = (3+4)×2",
        commands: [{"cat":["CATLOOPS"],"id":"start","action":"spawn","block":"INITIATE"},{"parent":"start","action":"spawn","pos":"nested","cat":["Variables"],"block":"VAR_SET","id":"set_result"},{"action":"input","block":"set_result","value":"result"},{"id":"math_multiply","block":"MATH_ARITHMETIC","pos":"nested","cat":["CATMATH"],"action":"spawn","parent":"set_result"},{"value":"MULTIPLY","action":"input","block":"math_multiply"},{"block":"MATH_ARITHMETIC","id":"math_add","action":"spawn","parent":"math_multiply","pos":"nested","cat":["CATMATH"]},{"value":"ADD","action":"input","block":"math_add"},{"id":"num3","block":"MATH_NUMBER","pos":"nested","cat":["CATMATH"],"parent":"math_add","action":"spawn"},{"value":"3","action":"input","block":"num3"},{"pos":"nested","cat":["CATMATH"],"parent":"math_add","action":"spawn","id":"num4","block":"MATH_NUMBER"},{"action":"input","block":"num4","value":"4"},{"id":"num2","block":"MATH_NUMBER","pos":"nested","cat":["CATMATH"],"action":"spawn","parent":"math_multiply"},{"action":"input","block":"num2","value":"2"}]
    },
    {
        title: "y = sin(90)",
        commands: [{"cat":["CATLOOPS"],"id":"start","action":"spawn","block":"INITIATE"},{"parent":"start","pos":"nested","block":"VAR_SET","cat":["Variables"],"id":"var_set_y","action":"spawn"},{"action":"input","block":"var_set_y","value":"y"},{"block":"MATH_TRIG","action":"spawn","cat":["CATMATH"],"id":"sin_block","pos":"nested","parent":"var_set_y"},{"block":"sin_block","value":"sin","action":"input"},{"block":"MATH_NUMBER","action":"spawn","cat":["CATMATH"],"id":"num_90","pos":"nested","parent":"sin_block"},{"action":"input","block":"num_90","value":"90"}]
    },
    {
        title: "For i=1..10: total = i",
        commands: [{"block":"INITIATE","id":"start","cat":["CATLOOPS"],"action":"spawn"},{"cat":["CATLOOPS"],"action":"spawn","pos":"nested","block":"CONTROLS_FOR","id":"loop1","parent":"start"},{"block":"loop1","value":"i","action":"input"},{"pos":"nested","block":"MATH_NUMBER","parent":"loop1","id":"num_start","cat":["CATMATH"],"action":"spawn"},{"action":"input","block":"num_start","value":"1"},{"parent":"loop1","id":"num_end","pos":"nested","block":"MATH_NUMBER","cat":["CATMATH"],"action":"spawn"},{"value":"10","block":"num_end","action":"input"},{"parent":"loop1","id":"num_step","pos":"nested","block":"MATH_NUMBER","cat":["CATMATH"],"action":"spawn"},{"block":"num_step","value":"1","action":"input"},{"pos":"nested","block":"VAR_SET","parent":"loop1","id":"set_total","cat":["Variables"],"action":"spawn"},{"value":"total","block":"set_total","action":"input"},{"pos":"nested","block":"VAR_GET","id":"get_i","parent":"set_total","cat":["Variables"],"action":"spawn"},{"action":"input","value":"i","block":"get_i"}]
    },
    {
        title: "total=0; for i=1..100: total+=i",
        commands: [{"cat":["CATLOOPS"],"id":"start","action":"spawn","block":"INITIATE"},{"block":"VAR_SET","cat":["Variables"],"action":"spawn","parent":"start","pos":"nested","id":"set_total_init"},{"action":"input","value":"total","block":"set_total_init"},{"parent":"set_total_init","pos":"nested","id":"num_zero","cat":["CATMATH"],"action":"spawn","block":"MATH_NUMBER"},{"action":"input","value":"0","block":"num_zero"},{"action":"spawn","cat":["CATLOOPS"],"block":"CONTROLS_FOR","pos":"next","id":"loop_i","parent":"set_total_init"},{"action":"input","block":"loop_i","value":"i"},{"cat":["CATMATH"],"action":"spawn","block":"MATH_NUMBER","parent":"loop_i","pos":"nested","id":"num_one"},{"action":"input","block":"num_one","value":"1"},{"cat":["CATMATH"],"action":"spawn","block":"MATH_NUMBER","parent":"loop_i","pos":"nested","id":"num_hundred"},{"action":"input","value":"100","block":"num_hundred"},{"cat":["CATMATH"],"action":"spawn","block":"MATH_NUMBER","parent":"loop_i","pos":"nested","id":"num_step_one"},{"block":"num_step_one","value":"1","action":"input"},{"cat":["Variables"],"action":"spawn","block":"VAR_CHANGE","parent":"loop_i","pos":"nested","id":"change_total"},{"block":"change_total","value":"total","action":"input"},{"action":"spawn","cat":["Variables"],"block":"VAR_GET","pos":"nested","id":"get_i","parent":"change_total"},{"block":"get_i","value":"i","action":"input"}]
    },
    {
        title: "If x>10: label=1 else label=0",
        commands: [{"action":"spawn","cat":["CATLOOPS"],"id":"start","block":"INITIATE"},{"pos":"nested","parent":"start","block":"CONTROLS_IF","cat":["CATLOGIC"],"id":"if_block","action":"spawn"},{"cat":["CATMATH"],"id":"comp1","action":"spawn","pos":"nested","parent":"if_block","block":"LOGIC_COMPARE"},{"cat":["Variables"],"id":"var_x","action":"spawn","block":"VAR_GET","pos":"nested","parent":"comp1"},{"action":"input","value":"x","block":"var_x"},{"cat":["CATMATH"],"id":"num10","action":"spawn","block":"MATH_NUMBER","pos":"nested","parent":"comp1"},{"value":"10","block":"num10","action":"input"},{"value":"GT","block":"comp1","action":"input"},{"block":"VAR_SET","pos":"nested","parent":"if_block","cat":["Variables"],"id":"set_label1","action":"spawn"},{"value":"label","block":"set_label1","action":"input"},{"block":"MATH_NUMBER","pos":"nested","parent":"set_label1","action":"spawn","cat":["CATMATH"],"id":"num1"},{"value":"1","block":"num1","action":"input"},{"cat":["Variables"],"id":"set_label0","action":"spawn","block":"VAR_SET","pos":"nested","parent":"if_block"},{"value":"label","block":"set_label0","action":"input"},{"pos":"nested","parent":"set_label0","block":"MATH_NUMBER","action":"spawn","cat":["CATMATH"],"id":"num0"},{"value":"0","block":"num0","action":"input"}]
    },
    {
        title: "For angle=0..360: y=5×sin(angle)",
        commands: [{"block":"INITIATE","id":"start","action":"spawn","cat":["CATLOOPS"]},{"pos":"nested","parent":"start","action":"spawn","id":"loop1","block":"CONTROLS_FOR","cat":["CATLOOPS"]},{"value":"angle","block":"loop1","action":"input"},{"value":"0","block":"loop1","action":"input"},{"block":"loop1","value":"360","action":"input"},{"action":"input","block":"loop1","value":"10"},{"pos":"nested","parent":"loop1","action":"spawn","id":"set_y","block":"VAR_SET","cat":["Variables"]},{"value":"y","block":"set_y","action":"input"},{"action":"spawn","pos":"nested","parent":"set_y","cat":["CATMATH"],"block":"MATH_ARITHMETIC","id":"multiply_op"},{"block":"multiply_op","value":"MULTIPLY","action":"input"},{"cat":["CATMATH"],"block":"MATH_NUMBER","id":"num_5","action":"spawn","pos":"nested","parent":"multiply_op"},{"block":"num_5","value":"5","action":"input"},{"pos":"nested","parent":"multiply_op","action":"spawn","cat":["CATMATH"],"id":"sin_op","block":"MATH_TRIG"},{"action":"input","value":"sin","block":"sin_op"},{"id":"var_angle","block":"VAR_GET","cat":["Variables"],"pos":"nested","parent":"sin_op","action":"spawn"},{"action":"input","value":"angle","block":"var_angle"}]
    },
    {
        title: "discriminant = b²−4ac (a=1,b=5,c=6)",
        commands: [{"cat":["CATLOOPS"],"id":"start","action":"spawn","block":"INITIATE"},{"parent":"start","id":"set_a","pos":"nested","cat":["Variables"],"block":"VAR_SET","action":"spawn"},{"parent":"set_a","id":"num_1","value":"1","block":"MATH_NUMBER","action":"spawn","pos":"nested","cat":["CATMATH"]},{"block":"VAR_SET","action":"spawn","pos":"next","cat":["Variables"],"parent":"set_a","id":"set_b"},{"value":"5","parent":"set_b","id":"num_5","cat":["CATMATH"],"pos":"nested","action":"spawn","block":"MATH_NUMBER"},{"parent":"set_b","id":"set_c","pos":"next","cat":["Variables"],"block":"VAR_SET","action":"spawn"},{"action":"spawn","block":"MATH_NUMBER","cat":["CATMATH"],"pos":"nested","parent":"set_c","id":"num_6","value":"6"},{"parent":"set_c","id":"set_disc","pos":"next","cat":["Variables"],"block":"VAR_SET","action":"spawn"},{"value":"a","block":"set_a","action":"input"},{"block":"set_b","action":"input","value":"b"},{"action":"input","block":"set_c","value":"c"},{"value":"discriminant","block":"set_disc","action":"input"},{"parent":"set_disc","id":"sub_disc","action":"spawn","block":"MATH_ARITHMETIC","cat":["CATMATH"],"pos":"nested"},{"value":"MINUS","action":"input","block":"sub_disc"},{"action":"spawn","block":"MATH_ARITHMETIC","cat":["CATMATH"],"pos":"nested","parent":"sub_disc","id":"mul_bb"},{"value":"MULTIPLY","action":"input","block":"mul_bb"},{"parent":"mul_bb","id":"var_b_left","cat":["Variables"],"pos":"nested","action":"spawn","block":"VAR_GET"},{"block":"var_b_left","action":"input","value":"b"},{"pos":"next","cat":["Variables"],"block":"VAR_GET","action":"spawn","parent":"mul_bb","id":"var_b_right"},{"block":"var_b_right","action":"input","value":"b"},{"pos":"next","cat":["CATMATH"],"block":"MATH_ARITHMETIC","action":"spawn","parent":"sub_disc","id":"mul_4ac"},{"block":"mul_4ac","action":"input","value":"MULTIPLY"},{"parent":"mul_4ac","id":"mul_4a","pos":"nested","cat":["CATMATH"],"block":"MATH_ARITHMETIC","action":"spawn"},{"action":"input","block":"mul_4a","value":"MULTIPLY"},{"parent":"mul_4a","id":"num_4","value":"4","action":"spawn","block":"MATH_NUMBER","cat":["CATMATH"],"pos":"nested"},{"block":"VAR_GET","action":"spawn","pos":"next","cat":["Variables"],"parent":"mul_4a","id":"var_a_right"},{"action":"input","block":"var_a_right","value":"a"},{"action":"spawn","block":"VAR_GET","cat":["Variables"],"pos":"next","parent":"mul_4ac","id":"var_c_right"},{"value":"c","action":"input","block":"var_c_right"}]
    },
    {
        title: "For n=1..20: if n%2=0 even=n else odd=n",
        commands: [{"id":"start","action":"spawn","block":"INITIATE"},{"action":"spawn","id":"loop","parent":"start","block":"CONTROLS_FOR","pos":"nested"},{"block":"loop","value":"n","action":"input"},{"id":"num_start","parent":"loop","value":"1","action":"spawn","pos":"nested","block":"MATH_NUMBER"},{"pos":"nested","block":"MATH_NUMBER","id":"num_end","parent":"loop","value":"20","action":"spawn"},{"pos":"nested","block":"MATH_NUMBER","id":"num_by","parent":"loop","value":"1","action":"spawn"},{"block":"CONTROLS_IF","pos":"nested","action":"spawn","id":"if_block","parent":"loop"},{"block":"LOGIC_COMPARE","pos":"nested","action":"spawn","id":"compare_even","parent":"if_block"},{"value":"EQ","action":"input","block":"compare_even"},{"action":"spawn","id":"mod_op","parent":"compare_even","block":"MATH_ARITHMETIC","pos":"nested"},{"block":"mod_op","value":"MODULO","action":"input"},{"block":"VAR_GET","pos":"nested","action":"spawn","id":"var_n_mod","parent":"mod_op"},{"value":"n","action":"input","block":"var_n_mod"},{"block":"MATH_NUMBER","pos":"nested","value":"2","action":"spawn","id":"num_2","parent":"mod_op"},{"value":"0","action":"spawn","id":"num_0","parent":"compare_even","block":"MATH_NUMBER","pos":"nested"},{"action":"spawn","id":"set_even","parent":"if_block","block":"VAR_SET","pos":"nested"},{"value":"even","action":"input","block":"set_even"},{"pos":"nested","block":"VAR_GET","id":"var_n_even","parent":"set_even","action":"spawn"},{"block":"var_n_even","value":"n","action":"input"},{"id":"set_odd","parent":"if_block","action":"spawn","pos":"nested","block":"VAR_SET"},{"value":"odd","action":"input","block":"set_odd"},{"block":"VAR_GET","pos":"nested","action":"spawn","id":"var_n_odd","parent":"set_odd"},{"value":"n","action":"input","block":"var_n_odd"}]
    },
    {
        title: "Nested loops: total += i×j if i×j>10",
        commands: [{"action":"spawn","id":"start","block":"INITIATE","cat":["CATLOOPS"]},{"pos":"nested","parent":"start","id":"set_total","action":"spawn","block":"VAR_SET","cat":["Variables"]},{"value":"total","block":"set_total","action":"input"},{"pos":"nested","parent":"set_total","id":"num_0","action":"spawn","block":"MATH_NUMBER","cat":["CATMATH"]},{"value":"0","block":"num_0","action":"input"},{"block":"CONTROLS_FOR","cat":["CATLOOPS"],"action":"spawn","id":"outer_loop","pos":"next","parent":"set_total"},{"value":"i","block":"outer_loop","action":"input"},{"action":"spawn","block":"MATH_NUMBER","cat":["CATMATH"],"pos":"nested","parent":"outer_loop","id":"num_1_outer_start"},{"value":"1","block":"num_1_outer_start","action":"input"},{"cat":["CATMATH"],"block":"MATH_NUMBER","action":"spawn","id":"num_5_outer_end","parent":"outer_loop","pos":"nested"},{"action":"input","value":"5","block":"num_5_outer_end"},{"id":"num_1_outer_step","parent":"outer_loop","pos":"nested","cat":["CATMATH"],"block":"MATH_NUMBER","action":"spawn"},{"action":"input","value":"1","block":"num_1_outer_step"},{"block":"CONTROLS_FOR","cat":["CATLOOPS"],"action":"spawn","id":"inner_loop","pos":"nested","parent":"outer_loop"},{"action":"input","value":"j","block":"inner_loop"},{"action":"spawn","block":"MATH_NUMBER","cat":["CATMATH"],"pos":"nested","parent":"inner_loop","id":"num_1_inner_start"},{"action":"input","value":"1","block":"num_1_inner_start"},{"id":"num_5_inner_end","parent":"inner_loop","pos":"nested","cat":["CATMATH"],"block":"MATH_NUMBER","action":"spawn"},{"action":"input","value":"5","block":"num_5_inner_end"},{"action":"spawn","block":"MATH_NUMBER","cat":["CATMATH"],"pos":"nested","parent":"inner_loop","id":"num_1_inner_step"},{"action":"input","value":"1","block":"num_1_inner_step"},{"pos":"nested","parent":"inner_loop","id":"if_condition","action":"spawn","block":"CONTROLS_IF","cat":["CATLOOPS"]},{"parent":"if_condition","pos":"nested","id":"compare_ij_gt_10","action":"spawn","cat":["CATLOGIC"],"block":"LOGIC_COMPARE"},{"action":"input","value":"GT","block":"compare_ij_gt_10"},{"cat":["CATMATH"],"block":"MATH_ARITHMETIC","action":"spawn","id":"multiply_ij","parent":"compare_ij_gt_10","pos":"nested"},{"action":"input","value":"MULTIPLY","block":"multiply_ij"},{"parent":"multiply_ij","pos":"nested","id":"var_get_i_for_mult","action":"spawn","cat":["Variables"],"block":"VAR_GET"},{"action":"input","value":"i","block":"var_get_i_for_mult"},{"action":"spawn","block":"VAR_GET","cat":["Variables"],"pos":"next","parent":"multiply_ij","id":"var_get_j_for_mult"},{"value":"j","block":"var_get_j_for_mult","action":"input"},{"pos":"next","parent":"compare_ij_gt_10","id":"num_10","action":"spawn","block":"MATH_NUMBER","cat":["CATMATH"]},{"action":"input","value":"10","block":"num_10"},{"id":"change_total","parent":"if_condition","pos":"nested","cat":["Variables"],"block":"VAR_CHANGE","action":"spawn"},{"value":"total","block":"change_total","action":"input"},{"action":"spawn","cat":["CATMATH"],"block":"MATH_ARITHMETIC","parent":"change_total","pos":"nested","id":"multiply_ij_for_change"},{"value":"MULTIPLY","block":"multiply_ij_for_change","action":"input"},{"pos":"nested","parent":"multiply_ij_for_change","id":"var_get_i_for_change","action":"spawn","block":"VAR_GET","cat":["Variables"]},{"action":"input","value":"i","block":"var_get_i_for_change"},{"cat":["Variables"],"block":"VAR_GET","action":"spawn","id":"var_get_j_for_change","parent":"multiply_ij_for_change","pos":"next"},{"action":"input","value":"j","block":"var_get_j_for_change"}]
    },
];

document.addEventListener('DOMContentLoaded', async () => {
    const sendBtn     = document.getElementById('sendBtn');
    const clearWsBtn  = document.getElementById('clearWsBtn');
    const testBtn     = document.getElementById('testBtn');
    const closeBtn    = document.getElementById('closeBtn');
    const gearBtn     = document.getElementById('gearBtn');
    const micBtn      = document.getElementById('micBtn');
    const sttStatus   = document.getElementById('sttStatus');
    const langSelect  = document.getElementById('langSelect');
    const promptInput = document.getElementById('prompt');
    const apiKeyInput = document.getElementById('apiKey');
    const apiPanel    = document.getElementById('apiPanel');
    const chatHistory = document.getElementById('chatHistory');

    // Load saved settings
    const stored = await chrome.storage.local.get(['geminiApiKey', 'sttLang']);
    apiKeyInput.value = stored.geminiApiKey || DEFAULT_GEMINI_KEY;
    if (langSelect && stored.sttLang) langSelect.value = stored.sttLang;

    if (langSelect) {
        langSelect.addEventListener('change', () => {
            chrome.storage.local.set({ sttLang: langSelect.value });
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', () => {
        // When embedded as an iframe inside the page, post a close message to
        // the content script which hides the panel. When opened as a standalone
        // window (legacy detached mode), window.close() still works.
        window.parent.postMessage('robo-ai:close', '*');
        window.close();
    });

    if (gearBtn) {
        gearBtn.addEventListener('click', () => {
            apiPanel.classList.toggle('hidden');
            if (!apiPanel.classList.contains('hidden')) apiKeyInput.focus();
        });
    }

    apiKeyInput.addEventListener('change', () => {
        const key = apiKeyInput.value.trim();
        if (key) chrome.storage.local.set({ geminiApiKey: key });
    });

    promptInput.addEventListener('input', () => {
        if (promptInput.value) applyDir(promptInput, promptInput.value);
    });

    // Send on Enter (Shift+Enter inserts newline)
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    // ── Chat helpers ──────────────────────────────────────────────────────────

    function appendMessage(role, text, meta, isError) {
        const msg = document.createElement('div');
        msg.className = 'msg ' + role;

        const bubble = document.createElement('div');
        bubble.className = 'bubble' + (isError ? ' error' : '');
        bubble.textContent = text;
        msg.appendChild(bubble);

        if (meta) {
            const metaEl = document.createElement('div');
            metaEl.className = 'msg-meta';
            metaEl.textContent = meta;
            msg.appendChild(metaEl);
        }

        chatHistory.appendChild(msg);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return msg;
    }

    let typingEl = null;

    function showTyping() {
        typingEl = appendMessage('ai', '…');
        typingEl.querySelector('.bubble').classList.add('typing');
    }

    function hideTyping() {
        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
        typingEl = null;
    }

    const setBusy = (busy) => {
        sendBtn.disabled = busy;
        clearWsBtn.disabled = busy;
        if (testBtn) testBtn.disabled = busy;
    };

    async function requireTab() {
        const tabId = await resolveTargetTabId();
        if (tabId == null) {
            appendMessage('system', '⚠ Could not find a Robo-Phone tab. Open https://staging.code.robo-phone.com/home in a tab and try again.');
        }
        return tabId;
    }

    // ── Send button ───────────────────────────────────────────────────────────

    sendBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            appendMessage('system', '⚙ Click the gear icon to enter your Gemini API key.');
            apiPanel.classList.remove('hidden');
            apiKeyInput.focus();
            return;
        }
        if (!prompt) return;

        const tabId = await requireTab();
        if (tabId == null) return;

        await chrome.storage.local.set({ geminiApiKey: apiKey });

        appendMessage('user', prompt);
        promptInput.value = '';
        setBusy(true);
        showTyping();
        const t0 = Date.now();

        chrome.runtime.sendMessage(
            { action: "SEND_PROMPT_TO_GEMINI", prompt, apiKey, tabId },
            (response) => {
                hideTyping();
                setBusy(false);
                const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

                if (chrome.runtime.lastError) {
                    appendMessage('ai', 'Service worker error: ' + chrome.runtime.lastError.message, null, true);
                    return;
                }
                if (!response) {
                    appendMessage('ai', 'No response from background. Check the service worker console.', null, true);
                    return;
                }
                if (response.error) {
                    appendMessage('ai', 'Error: ' + response.error, null, true);
                    return;
                }
                if (response.status === 'success') {
                    const blocks  = response.blocksPlaced || 0;
                    const tokens  = response.tokenCount   || 0;
                    const cmds    = response.commandsEmitted || 0;
                    const warnings = response.warnings || [];
                    const text = `Done — ${cmds} command(s), ${blocks} block(s) placed.` +
                        (warnings.length ? ` ⚠ ${warnings.length} field warning(s).` : '');
                    const meta = `⏱ ${elapsed}s · ${tokens.toLocaleString()} tokens · ${blocks} blocks`;
                    appendMessage('ai', text, meta);
                    if (warnings.length) {
                        appendMessage('system', warnings.slice(0, 5).join('\n'));
                    }
                } else if (response.message) {
                    appendMessage('ai', response.message, `⏱ ${elapsed}s`);
                }
            }
        );
    });

    // ── Clear Workspace button ────────────────────────────────────────────────

    clearWsBtn.addEventListener('click', async () => {
        const tabId = await requireTab();
        if (tabId == null) return;

        setBusy(true);
        chrome.runtime.sendMessage({ action: "CLEAR_WORKSPACE", tabId }, (response) => {
            setBusy(false);
            if (chrome.runtime.lastError || !response) {
                appendMessage('system', '⚠ Could not clear workspace: ' + (chrome.runtime.lastError?.message || 'no response'));
                return;
            }
            if (response.error) {
                appendMessage('system', '⚠ Clear failed: ' + response.error);
                return;
            }
            appendMessage('system', '🗑 Workspace cleared — session reset.');
        });
    });

    // ── Test panel ────────────────────────────────────────────────────────────

    const testPanel = document.getElementById('testPanel');
    const testList  = document.getElementById('testList');

    // Build the test list buttons
    if (testList) {
        TESTS.forEach((test, idx) => {
            const btn = document.createElement('button');
            btn.className = 'test-item';
            btn.dataset.idx = idx;
            btn.innerHTML = `<span class="test-num">${idx + 1}</span><span class="test-title">${test.title}</span><span class="test-cmds">${test.commands.length} cmds</span>`;
            testList.appendChild(btn);
        });

        testList.addEventListener('click', async (e) => {
            const btn = e.target.closest('.test-item');
            if (!btn || btn.disabled) return;
            const idx = parseInt(btn.dataset.idx, 10);
            const test = TESTS[idx];
            if (!test) return;

            const tabId = await requireTab();
            if (tabId == null) return;

            // Mark all items idle, mark this one running
            testList.querySelectorAll('.test-item').forEach(b => b.classList.remove('running', 'passed', 'failed'));
            btn.classList.add('running');
            testList.querySelectorAll('.test-item').forEach(b => { b.disabled = true; });

            appendMessage('user', `[Test ${idx + 1}: ${test.title} — ${test.commands.length} commands]`);
            setBusy(true);
            showTyping();
            const t0 = Date.now();

            chrome.runtime.sendMessage(
                { action: "RUN_DIRECT_SCRIPT", script: test.commands, tabId },
                (response) => {
                    hideTyping();
                    setBusy(false);
                    testList.querySelectorAll('.test-item').forEach(b => { b.disabled = false; });
                    btn.classList.remove('running');

                    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
                    if (chrome.runtime.lastError || !response) {
                        btn.classList.add('failed');
                        appendMessage('ai', 'Error: ' + (chrome.runtime.lastError?.message || 'no response'), null, true);
                        return;
                    }
                    if (response.error) {
                        btn.classList.add('failed');
                        appendMessage('ai', 'Error: ' + response.error, null, true);
                        return;
                    }
                    if (response.status === 'success') {
                        btn.classList.add('passed');
                        const blocks = response.blocksPlaced || 0;
                        appendMessage('ai',
                            `Test ${idx + 1} done — ${response.commandsEmitted || 0} commands, ${blocks} blocks placed.`,
                            `⏱ ${elapsed}s · ${blocks} blocks`
                        );
                    }
                }
            );
        });
    }

    if (testBtn) {
        testBtn.textContent = 'Tests ▾';
        testBtn.addEventListener('click', () => {
            if (!testPanel) return;
            const isHidden = testPanel.classList.contains('hidden');
            testPanel.classList.toggle('hidden', !isHidden);
            testBtn.textContent = isHidden ? 'Tests ▴' : 'Tests ▾';
            testBtn.classList.toggle('test-btn-active', isHidden);
        });
    }

    // ── Extract Schemas button (dev tool — gear panel) ────────────────────────

    const extractSchemasBtn = document.getElementById('extractSchemasBtn');
    const schemaStatus      = document.getElementById('schemaStatus');

    // All type names to probe — tries both lowercase (standard Blockly) and
    // original-case (some robophone custom blocks). Failed types get {error:...}
    // entries in the output so the user can see what's available.
    const SCHEMA_BLOCK_TYPES = [
        // Standard Blockly
        'controls_for', 'controls_if', 'controls_whileuntilforever', 'controls_repeat_ext',
        'math_arithmetic', 'math_trig', 'math_advanced', 'math_number', 'math_single',
        'math_constant', 'math_round', 'math_random_int', 'math_random_float', 'math_constrain',
        'math_atan2', 'logic_compare', 'logic_operation', 'logic_negate', 'logic_boolean',
        'variables_get', 'variables_set',
        'text', 'text_join', 'text_length', 'text_trim',
        'lists_create_with', 'lists_length', 'lists_getindex', 'lists_setindex',
        'lists_sort', 'lists_split',
        // Robophone custom — try both casing variants
        'initiate', 'INITIATE', 'start_block', 'START_BLOCK',
        'graph', 'GRAPH', 'reset_graph', 'RESET_GRAPH',
        'graph_da', 'GRAPH_DA', 'graph_trendline', 'GRAPH_TRENDLINE',
        'lcd_message', 'LCD_MESSAGE', 'lcd_text', 'LCD_TEXT',
        'ssegment', 'SSEGMENT', 'bar', 'BAR',
        'led', 'LED', 'led_bit', 'LED_BIT',
        'wait', 'WAIT', 'controls_flow_statements',
        'sensor_measure', 'SENSOR_MEASURE',
        'virtual_sensor_measure', 'VIRTUAL_SENSOR_MEASURE',
        'texttovoice', 'TEXTTOVOICE',
        'sendsms', 'SENDSMS',
        'write_to_file', 'WRITE_TO_FILE', 'read_file', 'READ_FILE',
        'math_in_range', 'MATH_IN_RANGE',
        'var_get', 'VAR_GET', 'var_set', 'VAR_SET', 'var_change', 'VAR_CHANGE',
    ];

    if (extractSchemasBtn) {
        extractSchemasBtn.addEventListener('click', async () => {
            const tabId = await requireTab();
            if (tabId == null) return;

            extractSchemasBtn.disabled = true;
            schemaStatus.textContent = 'Extracting…';
            schemaStatus.style.color = '#0ea5e9';

            chrome.runtime.sendMessage(
                { action: "EXTRACT_BLOCK_SCHEMAS", blockTypes: SCHEMA_BLOCK_TYPES, tabId },
                (response) => {
                    extractSchemasBtn.disabled = false;
                    if (chrome.runtime.lastError || !response) {
                        schemaStatus.textContent = 'Error: ' + (chrome.runtime.lastError?.message || 'no response');
                        schemaStatus.style.color = '#ef4444';
                        return;
                    }
                    if (response.error) {
                        schemaStatus.textContent = 'Error: ' + response.error;
                        schemaStatus.style.color = '#ef4444';
                        return;
                    }
                    const schemas = response.schemas || {};
                    const ok = Object.entries(schemas).filter(([, v]) => !v.error).length;
                    const fail = Object.entries(schemas).filter(([, v]) => v.error).length;
                    // Download as JSON file
                    const json = JSON.stringify(schemas, null, 2);
                    const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
                    chrome.downloads.download({ url, filename: 'block_schema.json', saveAs: false });
                    schemaStatus.textContent = `✓ ${ok} ok, ${fail} failed — saved block_schema.json`;
                    schemaStatus.style.color = '#22c55e';
                }
            );
        });
    }

    // ── Mic / STT button ──────────────────────────────────────────────────────

    let mediaRecorder = null;
    let audioChunks   = [];

    const setSttStatus = (msg, color) => {
        sttStatus.textContent = msg;
        sttStatus.style.color = color || '#64748b';
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        micBtn.classList.remove('recording');
        micBtn.title = 'Record voice prompt';
    };

    micBtn.addEventListener('click', async () => {
        if (micBtn.classList.contains('recording')) {
            stopRecording();
            return;
        }

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            setSttStatus('Enter a Gemini API key first.', '#ef4444');
            apiPanel.classList.remove('hidden');
            return;
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            setSttStatus('Mic access denied: ' + e.message, '#ef4444');
            return;
        }

        audioChunks = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus' : 'audio/webm';
        mediaRecorder = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            setSttStatus('Transcribing with Gemini…', '#0ea5e9');
            micBtn.disabled = true;
            try {
                const blob = new Blob(audioChunks, { type: mimeType });
                const hint = langSelect ? langSelect.value || null : null;
                const text = await transcribeWithGemini(blob, apiKey, hint);
                promptInput.value = text;
                applyDir(promptInput, text);
                setSttStatus('✓ Transcription done', '#22c55e');
            } catch (e) {
                setSttStatus('Transcription error: ' + e.message, '#ef4444');
            } finally {
                micBtn.disabled = false;
            }
        };

        mediaRecorder.start();
        micBtn.classList.add('recording');
        micBtn.title = 'Click to stop recording';
        setSttStatus('● Recording… click mic to stop', '#ef4444');
    });
});
