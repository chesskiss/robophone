// TOOL DECLARATIONS FOR GEMINI
const function_declarations = [
    {
        name: "execute_blockly_script",
        description: "Executes a sequence of actions on the Blockly workspace. Use this to spawn blocks, connect them, and enter text.",
        parameters: {
            type: "OBJECT",
            properties: {
                script: {
                    type: "ARRAY",
                    description: "Ordered list of commands. Each command MUST include both 'action' and 'block'.",
                    items: {
                        type: "OBJECT",
                        properties: {
                            action: { type: "STRING", enum: ["spawn", "input"], description: "Either 'spawn' (create a new block) or 'input' (fill a field on an already-spawned block)." },
                            cat: {
                                type: "ARRAY",
                                items: { type: "STRING" },
                                description: "Required for action='spawn'. Category path as Msg keys, e.g. ['CATLOOPS'] or ['CATSMARTPHONE','CATVIRTUALACTION']. Ignored for action='input'."
                            },
                            block: { type: "STRING", description: "REQUIRED for every command. For action='spawn', this is the BLOCK MSG KEY in UPPER_SNAKE_CASE (e.g. 'INITIATE', 'LCD_MESSAGE', 'MATH_TRIG'). For action='input', this is the LOGICAL ID of a previously-spawned block (e.g. 'start', 'msg1')." },
                            id: { type: "STRING", description: "Used only with action='spawn'. Logical ID assigned to this newly-spawned block so later commands can reference it (e.g. 'start', 'msg1', 'loop1')." },
                            parent: { type: "STRING", description: "Used only with action='spawn'. Logical ID of an earlier spawn to attach this block to." },
                            pos: { type: "STRING", enum: ["nested", "next"], description: "Used only with action='spawn'. 'nested' = inside parent's statement-input or value-socket; 'next' = chained below parent." },
                            value: { type: "STRING", description: "REQUIRED for action='input'. Text to type in the field or option label to pick in the dropdown. Plain string, never another logical id." }
                        },
                        required: ["action", "block"]
                    }
                }
            },
            required: ["script"]
        }
    }
];

const tools = [{ function_declarations }];

// Robo-Phone toolbox is a tree, not flat. Leaf categories like "Virtual Display"
// only become reachable once their parent ("Smartphone Blocks") is expanded.
// Maps leaf Msg key -> parent Msg key. Used by normalizeCategoryPath to expand
// a single-leaf cat (the form the LLM emits) into a full path the agent walks.
const NESTED_CATEGORIES = {
    CATVIRTUALACTION: "CATSMARTPHONE",
    CATADVANCEDACTION: "CATSMARTPHONE",
    CATPHYSICALSENSORS: "CATSMARTPHONE",
    CATVIRTUALSENSORS: "CATSMARTPHONE",
    CATADVANCEDSENSORS: "CATSMARTPHONE",
    CATCOMMUNICATION: "CATSMARTPHONE",
    CATDATAOPERATIONS: "CATSMARTPHONE",
    CATCOMMON: "CATWHEELS"
};

const BLOCK_CATEGORY_MAP = {
    INITIATE: "CATLOOPS",
    START_BLOCK: "CATLOOPS",
    STOP_TASK: "CATLOOPS",
    SETTINGS: "CATLOOPS",
    CONTROLS_REPEAT_EXT: "CATLOOPS",
    CONTROLS_WHILEUNTILFOREVER: "CATLOOPS",
    CONTROLS_FOR: "CATLOOPS",
    CONTROLS_IF: "CATLOOPS",
    CONTROLS_FLOW_STATEMENTS: "CATLOOPS",
    READ_TIMER: "CATLOOPS",
    COMPARE_TIMER: "CATLOOPS",
    WAIT_TIMER: "CATLOOPS",
    RESET_TIMER: "CATLOOPS",
    WAIT: "CATLOOPS",
    SMARTPHONE_GET_NAME: "CATLOOPS",
    SMARTPHONE_COMPARE_NAME: "CATLOOPS",
    MY_TEXT_PRINT: "CATLOOPS",
    STOP_PROGRAM: "CATLOOPS",
    LOGIC_BOOLEAN: "CATLOGIC",
    LOGIC_NEGATE: "CATLOGIC",
    LOGIC_OPERATION_EXTENDED: "CATLOGIC",
    LOGIC_NEGATE_NUMBER: "CATLOGIC",
    LOGIC_OPERATION_NUMERIC_EXTENDED: "CATLOGIC",
    LOGIC_NULL: "CATLOGIC",
    CONVERTERS_B2D: "CATLOGIC",
    CONVERTERS_D2B: "CATLOGIC",
    LOGIC_TERNARY: "CATLOGIC",
    MATH_NUMBER: "CATMATH",
    MATH_ARITHMETIC: "CATMATH",
    MATH_ADVANCED: "CATMATH",
    MATH_SINGLE: "CATMATH",
    MATH_TRIG: "CATMATH",
    MATH_CONSTANT: "CATMATH",
    MATH_ROUND: "CATMATH",
    MATH_ON_LIST: "CATMATH",
    MATH_CONSTRAIN: "CATMATH",
    MATH_RANDOM_INT: "CATMATH",
    MATH_RANDOM_FLOAT: "CATMATH",
    MATH_ATAN2: "CATMATH",
    MATH_NUMBER_PROPERTY: "CATMATH",
    LOGIC_COMPARE: "CATMATH",
    MATH_IN_RANGE: "CATMATH",
    MY_TEXT: "CATTEXT",
    TEXT_JOIN: "CATTEXT",
    MY_TEXT_APPEND: "CATTEXT",
    TEXT_LENGTH: "CATTEXT",
    LOGIC_TEXT_COMPARE: "CATTEXT",
    TEXT_ISEMPTY: "CATTEXT",
    TEXT_INDEXOF: "CATTEXT",
    NUMBER_OCCURRENCE: "CATTEXT",
    TEXT_CHARAT: "CATTEXT",
    TEXT_GETSUBSTRING: "CATTEXT",
    TEXT_CHANGECASE: "CATTEXT",
    TEXT_TRIM: "CATTEXT",
    TRANSLATE: "CATTEXT",
    RUN_LINK: "CATTEXT",
    LISTS_CREATE_EMPTY: "CATLISTS",
    LISTS_CREATE_WITH: "CATLISTS",
    LISTS_REPEAT: "CATLISTS",
    LISTS_LENGTH: "CATLISTS",
    LISTS_ISEMPTY: "CATLISTS",
    LISTS_INDEXOF: "CATLISTS",
    LISTS_GETINDEX: "CATLISTS",
    LISTS_SETINDEX: "CATLISTS",
    LISTS_GETSUBLIST: "CATLISTS",
    LISTS_SPLIT: "CATLISTS",
    LISTS_SORT: "CATLISTS",
    LCD_TEXT: "CATVIRTUALACTION",
    LCD_MESSAGE: "CATVIRTUALACTION",
    READ_SSEGMENT: "CATVIRTUALACTION",
    SSEGMENT: "CATVIRTUALACTION",
    BAR: "CATVIRTUALACTION",
    READ_LED: "CATVIRTUALACTION",
    LED: "CATVIRTUALACTION",
    LED_BIT: "CATVIRTUALACTION",
    LED_ADVANCED_INTERNAL: "CATVIRTUALACTION",
    LED_ADVANCED_EXTERNAL: "CATVIRTUALACTION",
    RESET_GRAPH: "CATVIRTUALACTION",
    GRAPH: "CATVIRTUALACTION",
    GRAPH_DA: "CATVIRTUALACTION",
    GET_GRAPH_TRENDLINE: "CATVIRTUALACTION",
    GRAPH_TRENDLINE: "CATVIRTUALACTION",
    GRAPH_FILE: "CATVIRTUALACTION",
    GRAPH_SAVE: "CATVIRTUALACTION",
    SHOW_COMPONENT: "CATVIRTUALACTION",
    CLEAR_COMPONENT: "CATVIRTUALACTION",
    CLEARSCREEN: "CATVIRTUALACTION",
    PLAYTONE: "CATADVANCEDACTION",
    PLAYNOTE: "CATADVANCEDACTION",
    SHOWIMAGE: "CATADVANCEDACTION",
    IMAGE_CAPTURE: "CATADVANCEDACTION",
    PLAYVIDEO: "CATADVANCEDACTION",
    VIDEO: "CATADVANCEDACTION",
    PLAYAUDIO: "CATADVANCEDACTION",
    AUDIO_CAPTURE: "CATADVANCEDACTION",
    PREVIEW: "CATADVANCEDACTION",
    STOPMEDIA: "CATADVANCEDACTION",
    SENSOR_MEASURE: "CATPHYSICALSENSORS",
    SENSOR_COMPARE: "CATPHYSICALSENSORS",
    SENSOR_WAIT: "CATPHYSICALSENSORS",
    SENSOR_RESET: "CATPHYSICALSENSORS",
    RTC: "CATPHYSICALSENSORS",
    VIRTUAL_SENSOR_MEASURE: "CATVIRTUALSENSORS",
    VIRTUAL_SENSOR_COMPARE: "CATVIRTUALSENSORS",
    VIRTUAL_SENSOR_WAIT: "CATVIRTUALSENSORS",
    KEY1_BUTTON: "CATVIRTUALSENSORS",
    ADVANCED_SENSORS_MEASURE: "CATADVANCEDSENSORS",
    ADVANCED_SENSORS_COMPARE: "CATADVANCEDSENSORS",
    ADVANCED_SENSORS_WAIT: "CATADVANCEDSENSORS",
    FACES_POSITION: "CATADVANCEDSENSORS",
    FACES_POSITION_COMPARE: "CATADVANCEDSENSORS",
    FACES_POSITION_WAIT: "CATADVANCEDSENSORS",
    FACES_NAME: "CATADVANCEDSENSORS",
    COMPARE_FACES_NAME: "CATADVANCEDSENSORS",
    WAIT_FACES_NAME: "CATADVANCEDSENSORS",
    GOOGLE: "CATCOMMUNICATION",
    CHATGPT: "CATCOMMUNICATION",
    CHATGPT_COMPARE: "CATCOMMUNICATION",
    TELEPHONY_MEASURE: "CATCOMMUNICATION",
    TELEPHONY_COMPARE: "CATCOMMUNICATION",
    TELEPHONY_WAIT: "CATCOMMUNICATION",
    TEXTTOVOICE: "CATCOMMUNICATION",
    SENDSMS: "CATCOMMUNICATION",
    WRITE_TO_FILE: "CATDATAOPERATIONS",
    READ_FILE: "CATDATAOPERATIONS",
    DELETE_FILE: "CATDATAOPERATIONS",
    INIT_DB: "CATDATAOPERATIONS",
    WRITE_DB: "CATDATAOPERATIONS",
    READ_DB: "CATDATAOPERATIONS",
    KEY_EXISTS: "CATDATAOPERATIONS",
    CHANGE_DB: "CATDATAOPERATIONS",
    DELETE_KEY: "CATDATAOPERATIONS",
    DELETE_DB: "CATDATAOPERATIONS",
    INIT_STORAGE: "CATDATAOPERATIONS",
    UPLOAD_STORAGE: "CATDATAOPERATIONS",
    DOWNLOAD_STORAGE: "CATDATAOPERATIONS",
    DELETE_STORAGE: "CATDATAOPERATIONS",
    MOVE_STEERING: "CATCOMMON",
    MOVE_DIRECTION: "CATCOMMON",
    MOVE_TANK: "CATCOMMON",
    LARGE_MOTOR: "CATCOMMON",
    UNREGULATED_MOTOR: "CATCOMMON",
    MOTOR_READY: "CATCOMMON",
    MOTOR_PORTS: "CATCOMMON",
    RESET_SENSOR: "CATCOMMON",
    READ_SENSOR: "CATCOMMON",
    COMPARE_SENSOR: "CATCOMMON",
    WAIT_SENSOR: "CATCOMMON",

    // Variables — Blockly's built-in variable blocks. The toolbox category
    // label is "Variables"; we use CATVARIABLES as the synthetic key.
    VAR_GET: "CATVARIABLES",
    VAR_SET: "CATVARIABLES",
    VAR_CHANGE: "CATVARIABLES",
    VAR_TOGGLE: "CATVARIABLES",
    // Also the standard Blockly variable block types (in case the LLM emits these instead)
    VARIABLES_GET: "CATVARIABLES",
    VARIABLES_SET: "CATVARIABLES",
    MATH_CHANGE: "CATVARIABLES"
};

// Listener for prompt from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SEND_PROMPT_TO_GEMINI") {
        handleGeminiFlow(request.prompt, request.apiKey, request.tabId)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
    if (request.action === "RUN_DIRECT_SCRIPT") {
        handleDirectScript(request.script, request.tabId)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
});

// Direct-run path for testing: same normalize + execute pipeline as the
// Gemini flow, just without the LLM round-trip. Lets the popup's test button
// exercise block placement deterministically.
async function handleDirectScript(rawScript, requestTabId) {
    if (!Array.isArray(rawScript) || rawScript.length === 0) {
        throw new Error("Direct script is empty or not an array.");
    }
    const { script, dropped } = normalizeGeneratedScript(rawScript);
    console.log(`[BlocklyAgent] DIRECT script: raw=${rawScript.length}, after normalize=${script.length}, dropped=${dropped.length}`);
    console.log("📜 DIRECT SCRIPT (after normalize):\n", JSON.stringify(script, null, 2));
    if (dropped.length) console.warn("[BlocklyAgent] Dropped during normalize:", dropped);
    try {
        const out = await executeOnPage("execute_blockly_script", { script }, requestTabId);
        return {
            status: "success",
            actions: ["execute_blockly_script (direct test)"],
            commandsEmitted: script.length,
            blocksPlaced: (out && out.result) ? Number(out.result.spawnedCount || 0) : 0,
            placementMode: (out && out.result) ? out.result.placementMode : undefined,
            spawnStats: (out && out.result) ? out.result.spawnStats : undefined,
            warnings: ((out && out.result && out.result.inputFailures) || []).map(f => `field input "${f.value}" on '${f.block}' failed: ${f.why}`)
        };
    } catch (execErr) {
        const diag = {
            rawCommandCount: rawScript.length,
            afterNormalizeCount: script.length,
            droppedCount: dropped.length,
            droppedReasons: dropped.slice(0, 10).map(d => d.reason),
        };
        execErr.message += ` | diagnostics: ${JSON.stringify(diag)}`;
        throw execErr;
    }
}

// Cache the bundled manual so we read it from disk only once per service-worker
// lifetime. Service workers may be torn down and respawned, in which case the
// next call rehydrates the cache.
let cachedManual = null;
async function loadRoboPhoneManual() {
    if (cachedManual !== null) return cachedManual;
    try {
        const manualUrl = chrome.runtime.getURL("robophone_llm_instructions.md");
        console.log(`[BlocklyAgent] fetching manual from ${manualUrl}`);
        const res = await fetch(manualUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cachedManual = await res.text();
        // Sanity-print the first 200 chars so the SW console proves the manual
        // is actually being read (not just an empty fallback).
        console.log(`[BlocklyAgent] manual loaded: ${cachedManual.length} chars. Head: ${JSON.stringify(cachedManual.slice(0, 200))}`);
    } catch (e) {
        console.error("[BlocklyAgent] FAILED to load robophone_llm_instructions.md:", e);
        cachedManual = ""; // graceful fallback — system prompt still works without it
    }
    return cachedManual;
}

// ---------------- Persistent popup window ----------------
// Standard MV3 popups close on focus loss. We open popup.html as a real Chrome
// window instead, which only closes when the user clicks the Close button
// inside it (or closes the window). Track the active popup's window id so a
// second action click focuses the existing window instead of opening another.
const POPUP_WIN_KEY = "blocklyPopupWindowId";
const POPUP_WIDTH = 460;
const POPUP_HEIGHT = 640;

chrome.action.onClicked.addListener(async () => {
    try {
        const stored = await chrome.storage.session.get(POPUP_WIN_KEY);
        const existingId = stored[POPUP_WIN_KEY];
        if (typeof existingId === "number") {
            try {
                await chrome.windows.update(existingId, { focused: true });
                return; // already open — just brought to front
            } catch (_) {
                // window was closed externally; fall through and recreate
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

// Clear stored window id when the popup is closed so the next click reopens
chrome.windows.onRemoved.addListener(async (windowId) => {
    const stored = await chrome.storage.session.get(POPUP_WIN_KEY);
    if (stored[POPUP_WIN_KEY] === windowId) {
        await chrome.storage.session.remove(POPUP_WIN_KEY);
    }
});

// Gemini model that supports tool calling. Single source of truth — every
// generateContent URL in this file is built from this constant.
const GEMINI_MODEL = "gemini-3.1-flash-lite";

// Must match BlocklyAgent.VERSION in blockly_methods.js. Bump both together —
// executeOnPage re-injects the MAIN-world scripts whenever the page's loaded
// version differs (pages opened before an extension reload keep stale code).
const EXPECTED_AGENT_VERSION = "15.8";

async function handleGeminiFlow(userPrompt, apiKey, requestTabId) {
    // Use the key the popup sent — never override it. The previous hardcoded
    // override silently ignored whatever the user typed in the popup field.
    apiKey = String(apiKey || "").trim();
    if (!apiKey) {
        throw new Error("No Gemini API key provided. Paste a key in the popup and run again.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    console.log(`[BlocklyAgent] POST ${url.replace(apiKey, "<key>")}`);
    const manual = await loadRoboPhoneManual();
    console.log(`[BlocklyAgent] manual length=${manual.length} chars`);

    const requestBody = {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        tools: tools,
        // AUTO (not ANY) — the model still emits a tool call because the
        // system prompt mandates it, but it can think first. ANY forces an
        // immediate emission with no reasoning, which produced 1-block stubs
        // for multi-step requests like "draw sin graph 0..10".
        tool_config: { function_calling_config: { mode: "AUTO" } },
        generationConfig: {
            temperature: 0.2,
            // Big budget — multi-block scripts (loop + sensor reads + draws)
            // can be 30+ commands and easily blow past 4 K tokens.
            maxOutputTokens: 16384,
            // Capped thinking budget. Dynamic (-1) lets the model spend
            // 90+ seconds reasoning over the 84 KB manual on hard prompts,
            // which times out the request. 8 K thoughts is enough to plan a
            // ~20-block script and keeps total latency under ~30 s.
            thinkingConfig: { thinkingBudget: 8192 }
        },
        system_instruction: {
            parts: [
                {
                    text: `You are a Blockly automation assistant for the Robo-Phone custom Blockly UI. Use the 'execute_blockly_script' tool.

SCRIPT RULES:
0. EVERY command MUST have BOTH 'action' AND 'block'. There are no exceptions.
   - For action='spawn', 'block' is the Block Msg Key in UPPER_SNAKE_CASE (e.g. "INITIATE", "LCD_MESSAGE", "MATH_TRIG"). Do NOT use names like "on start", "lcd msg write", "block name" — those are display labels, not keys.
   - For action='input', 'block' is the LOGICAL ID of an earlier spawn (e.g. "start", "msg1"). It is NEVER a Msg key, a field name, or another logical id.
   - Never put the Msg key in 'id' and leave 'block' empty — 'block' carries the Msg key for spawn, 'id' is your handle to refer back later.
1. Use 'id' to label your own spawns, for example "start", "graph1", "wait1". The id is lower-case and short.
2. 'parent' links to a previous 'id' (not a Msg key).
3. pos: 'nested' = drop INSIDE the parent's statement-body OR INSIDE a value socket on the parent. pos: 'next' = drop ADJACENT BELOW the parent (chained statement).
3a. CAP BLOCKS (INITIATE, START_BLOCK) have NO 'next' connector — they terminate a chain. The FIRST child of a cap MUST use pos:'nested' (into its statement-body). Subsequent siblings should chain to that first child via pos:'next', NOT back to the cap. Example: spawn INITIATE id=start; spawn RESET_GRAPH parent=start pos=NESTED; spawn CONTROLS_FOR parent=reset pos=NEXT — never "parent=start pos=next" for the second statement.
4. NEVER output plain JSON text to the user. ALWAYS call the tool.
5. Prefer the exact categories and block keys listed below.
6. When a task needs a runnable program, start with INITIATE unless the user explicitly asks for a value-only expression.
7. STATEMENT vs VALUE blocks:
   - STATEMENT blocks (INITIATE, CONTROLS_FOR, CONTROLS_REPEAT_EXT, CONTROLS_IF, LCD_MESSAGE, GRAPH, RESET_GRAPH, WAIT, TEXTTOVOICE, ...) form the program flow. Connect them with parent + pos:'next' or pos:'nested' (into a do/then body).
   - VALUE blocks (MATH_NUMBER, MATH_TRIG, MATH_ARITHMETIC, MATH_RANDOM_INT, LOGIC_BOOLEAN, LOGIC_COMPARE, MY_TEXT, sensor reads like SENSOR_MEASURE/ANGLE_SCALAR, ...) return a value. They go INSIDE another block's value socket via parent + pos:'nested'.
   - To put a value block into a value socket, use action='spawn' with parent set to the consumer block id and pos:'nested'. NEVER use action='input' with value set to a logical id — input only fills text fields and dropdowns, it cannot reference another block.
8. For an 'input' command, the 'block' property MUST be a previously spawned logical id (e.g. 'msg1', 'graph1'). The 'value' is plain text or a dropdown option string. It must never be another logical id and never a field name like 'x', 'y', 'rate'.
9. If you need to fill several fields on the same spawned block, emit multiple 'input' commands all referencing that same logical id, in field order.
10. Emit 'input' commands ONLY for fields the block actually has (per the manual and the rules below). NEVER invent extra fields — e.g. LCD blocks have NO size/font field, so values like "small" or "big" are invalid and will be rejected at execution.

CORRECT SHAPES (these are the only legal command forms):
- spawn (root):     {"action":"spawn","block":"INITIATE","id":"start","cat":["CATLOOPS"]}
- spawn (child):    {"action":"spawn","block":"LCD_MESSAGE","id":"msg1","cat":["CATSMARTPHONE","CATVIRTUALACTION"],"parent":"start","pos":"nested"}
- spawn (in value): {"action":"spawn","block":"MATH_NUMBER","id":"n1","cat":["CATMATH"],"parent":"msg1","pos":"nested"}
- input field:      {"action":"input","block":"msg1","value":"Hello World"}

WRONG (will be rejected):
- {"action":"spawn","id":"start"}                          ← missing 'block'
- {"action":"spawn","block":"on start","id":"start"}       ← 'block' is the display label, must be the Msg key "INITIATE"
- {"action":"input","value":"Hello"}                       ← missing 'block' (the target id)
- {"action":"input","block":"msg1","value":"sin_val"}      ← 'value' is a logical id; use spawn pos:'nested' instead

EXAMPLE — plot sin(x) on the graph:
- spawn INITIATE id=start
- spawn RESET_GRAPH id=reset parent=start pos=NESTED   ← MUST be 'nested' because INITIATE is a CAP (no next connector). Then input reset value="red".
- spawn CONTROLS_FOR id=loop parent=reset pos=NEXT     ← 'next' chains under RESET_GRAPH (which is a regular statement). inputs in order: loop variable name "x", from "0", to "10", by "1"
- spawn GRAPH id=draw parent=loop pos=nested  (statement inside the loop's "do" body)
- spawn MATH_NUMBER id=xref parent=draw pos=nested  (occupies GRAPH's x value socket via spawn — NOT input)
- input xref value="x"  (sets the number-block's value field; for a variable reference use a variable get block instead)
- spawn MATH_TRIG id=siny parent=draw pos=nested  (occupies GRAPH's y value socket)
- input siny value="sin"  (sets the trig dropdown; second input would set the angle field)
- input draw value="red"  (graph color)
- input draw value="false"  (clear? checkbox)

POSITIONAL SOCKET RULES FOR COMMON BLOCKS

When using the execute_blockly_script command format, pos:"nested" is positional.
It fills the next available child socket in visual left-to-right order.

GRAPH:
- First nested value child fills x.
- Second nested value child fills y.
- Then use input commands on the GRAPH id for:
  1. point color
  2. clear checkbox

COLOR DROPDOWNS (GRAPH, RESET_GRAPH, LCD_MESSAGE, LCD_TEXT, LED, BAR, ...):
- The ONLY legal color values are: red, yellow, green, blue.
- Never emit any other word (no size words, no hex codes, no "black"/"white").

LCD_MESSAGE:
- Exactly TWO inputs, in this order:
  1. the message text (any string)
  2. color (red/yellow/green/blue)
- It has NO size, font, position or alignment field. Two input commands maximum.

LCD_TEXT:
- Inputs in this order: 1. text, 2. line number, 3. offset, 4. color (red/yellow/green/blue).

MATH_TRIG:
- First input command selects operation: sin, cos, tan, asin, acos, atan.
- First nested value child fills the angle/value socket.
- For sin/cos/tan, use degrees.

MATH_ADVANCED:
- First input command fills the expression string.
- Nested value sockets are positional in this order:
  1. a
  2. b
  3. c
  4. x
- If the formula only needs one variable, prefer using parameter a, because it is the first positional socket.
- For degrees-to-radians in machine-generated scripts, use:
  expression_string = "a*3.1416/180"
  first nested child = VAR_GET angleDeg
- Only use "x*3.1416/180" if you also fill a, b, and c before nesting the angleDeg variable into x.

VARIABLE BLOCKS:
- VAR_GET -> variable value block, type=value, category=["Variables"]
- VAR_SET -> set variable block, type=statement, category=["Variables"]
- VAR_CHANGE -> change integer variable block, type=statement, category=["Variables"]
- Use VAR_GET for loop variables inside math blocks. Never use MATH_NUMBER with value="angleDeg" 

CATEGORY MAP:
- Flow Control -> [CATLOOPS]
- Logic -> [CATLOGIC]
- Math -> [CATMATH]
- Text -> [CATTEXT]
- Lists -> [CATLISTS]
- Virtual Display -> [CATVIRTUALACTION]
- Advanced Media -> [CATADVANCEDACTION]
- Physical Sensors -> [CATPHYSICALSENSORS]
- Virtual Sensors -> [CATVIRTUALSENSORS]
- Advanced Sensors -> [CATADVANCEDSENSORS]
- Communication -> [CATCOMMUNICATION]
- Data Operations -> [CATDATAOPERATIONS]
- Common -> [CATCOMMON]
- Variables -> use standard variable blocks when needed
- My Blocks -> procedure blocks when needed

BLOCK LIBRARY:
[CATLOOPS] Flow Control:
- INITIATE -> "on start"
- START_BLOCK -> "run | task1"
- STOP_TASK -> "stop task | task1"
- SETTINGS -> "Component Settings"
- CONTROLS_REPEAT_EXT -> "repeat times do"
- CONTROLS_WHILEUNTILFOREVER -> "repeat forever do"
- CONTROLS_FOR -> "count with from to by do"
- CONTROLS_IF -> "if do" / "if do else"
- CONTROLS_FLOW_STATEMENTS -> "break out of loop"
- READ_TIMER -> "read timer"
- COMPARE_TIMER -> "is timer >= ?"
- WAIT_TIMER -> "wait until timer >="
- RESET_TIMER -> "reset timer"
- WAIT -> "wait sec"
- SMARTPHONE_GET_NAME -> "get Phone Name"
- SMARTPHONE_COMPARE_NAME -> "phone Name = select"
- MY_TEXT_PRINT -> "break point print"
- STOP_PROGRAM -> "stop program and exit"

[CATLOGIC] Logic:
- LOGIC_BOOLEAN -> true/false
- LOGIC_NEGATE -> not
- LOGIC_OPERATION_EXTENDED -> and/or
- LOGIC_NEGATE_NUMBER -> numeric not
- LOGIC_OPERATION_NUMERIC_EXTENDED -> numeric and/or
- LOGIC_NULL -> null
- CONVERTERS_B2D -> binary to decimal
- CONVERTERS_D2B -> decimal to binary
- LOGIC_TERNARY -> test if true if false

[CATMATH] Math:
- MATH_NUMBER
- MATH_ARITHMETIC
- MATH_ADVANCED
- MATH_SINGLE
- MATH_TRIG
- MATH_CONSTANT
- MATH_ROUND
- MATH_ON_LIST
- MATH_CONSTRAIN
- MATH_RANDOM_INT
- MATH_RANDOM_FLOAT
- MATH_ATAN2
- MATH_NUMBER_PROPERTY
- LOGIC_COMPARE
- MATH_IN_RANGE

[CATTEXT] Text:
- MY_TEXT
- TEXT_JOIN
- MY_TEXT_APPEND
- TEXT_LENGTH
- LOGIC_TEXT_COMPARE
- TEXT_ISEMPTY
- TEXT_INDEXOF
- NUMBER_OCCURRENCE
- TEXT_CHARAT
- TEXT_GETSUBSTRING
- TEXT_CHANGECASE
- TEXT_TRIM
- TRANSLATE
- RUN_LINK

[CATLISTS] Lists:
- LISTS_CREATE_WITH
- LISTS_REPEAT
- LISTS_LENGTH
- LISTS_ISEMPTY
- LISTS_INDEXOF
- LISTS_GETINDEX
- LISTS_SETINDEX
- LISTS_GETSUBLIST
- LISTS_SPLIT
- LISTS_SORT

[CATVIRTUALACTION] Virtual Display:
- LCD_TEXT -> "lcd grid write at line offset with color"
- LCD_MESSAGE -> "lcd msg write with color"
- READ_SSEGMENT -> "7segment"
- SSEGMENT -> "set 7segment to"
- BAR -> "set line bar to"
- READ_LED -> "led"
- LED -> "set led to"
- LED_BIT -> "set led bit to"
- LED_ADVANCED_INTERNAL -> "set led to current value"
- LED_ADVANCED_EXTERNAL -> "set led to [logic op]"
- RESET_GRAPH -> "reset graph color"
- GRAPH -> "draw graph point (x,y) with color clear?"
- GRAPH_DA -> "draw graph on rate Smartphone Sensor angle scalar"
- GET_GRAPH_TRENDLINE -> "trendline graph"
- GRAPH_TRENDLINE -> "draw trendline for graph"
- GRAPH_FILE -> "draw graph from file"
- GRAPH_SAVE -> "save graphs to file"
- SHOW_COMPONENT -> "load component to screen"
- CLEAR_COMPONENT -> "unload component from screen"
- CLEARSCREEN -> "clear screen"

[CATADVANCEDACTION] Advanced Media:
- PLAYTONE -> "play tone Hz duration volume"
- PLAYNOTE -> "play note duration volume"
- SHOWIMAGE -> "show image"
- IMAGE_CAPTURE -> "capture image to file"
- PLAYVIDEO -> "play video filename volume"
- VIDEO -> "record video"
- PLAYAUDIO -> "play audio volume"
- AUDIO_CAPTURE -> "capture audio duration to file"
- PREVIEW -> "init Preview with zoom"
- STOPMEDIA -> "stop all media"

[CATPHYSICALSENSORS] Physical Sensors:
- SENSOR_MEASURE -> read physical sensor value, for example angle Scalar or gps Longitude
- SENSOR_COMPARE -> compare physical sensor to threshold
- SENSOR_WAIT -> wait until physical sensor matches threshold
- SENSOR_RESET -> reset sensors
- RTC -> clock/time block if needed

[CATVIRTUALSENSORS] Virtual Sensors:
- VIRTUAL_SENSOR_MEASURE -> switches / keypad numeric
- VIRTUAL_SENSOR_COMPARE -> is virtual sensor = ?
- VIRTUAL_SENSOR_WAIT -> wait until virtual sensor changed or equals
- KEY1_BUTTON -> set trigger button message

[CATADVANCEDSENSORS] Advanced Sensors:
- ADVANCED_SENSORS_MEASURE -> color Detect
- ADVANCED_SENSORS_COMPARE -> is color Detect = ?
- ADVANCED_SENSORS_WAIT -> wait until color Detect =
- FACES_POSITION -> get face Distance by nearest
- FACES_POSITION_COMPARE -> compare face Distance by nearest
- FACES_POSITION_WAIT -> wait until face Distance by nearest =
- FACES_NAME -> get nearest face name
- COMPARE_FACES_NAME -> compare nearest face name
- WAIT_FACES_NAME -> wait until nearest face name =

[CATCOMMUNICATION] Communication:
- GOOGLE -> Ask Google
- CHATGPT -> Ask chatgpt
- CHATGPT_COMPARE -> compare chatgpt answer
- TELEPHONY_MEASURE -> voice To Text
- TELEPHONY_COMPARE -> compare voice To Text
- TELEPHONY_WAIT -> wait until voice To Text
- TEXTTOVOICE -> speak Text lang volume
- SENDSMS -> send sms phone message

[CATDATAOPERATIONS] Data Operations:
- WRITE_TO_FILE -> write Line to file
- READ_FILE -> read Line from file
- DELETE_FILE -> delete file
- INIT_DB -> initialize firebase database at url
- WRITE_DB -> write Number to key
- READ_DB -> read key
- KEY_EXISTS -> key exists?
- CHANGE_DB -> wait until value at key changed
- DELETE_KEY -> delete key
- DELETE_DB -> delete database
- INIT_STORAGE -> initialize firebase storage at url
- UPLOAD_STORAGE -> upload filename to storage
- DOWNLOAD_STORAGE -> download filename from storage
- DELETE_STORAGE -> delete filename from storage

[CATCOMMON] Common:
- MOVE_STEERING
- MOVE_DIRECTION
- MOVE_TANK
- LARGE_MOTOR
- UNREGULATED_MOTOR
- MOTOR_READY -> is motor ready?
- MOTOR_PORTS -> set motor ports
- RESET_SENSOR -> reset all
- READ_SENSOR -> optical encoder
- COMPARE_SENSOR -> compare optical encoder
- WAIT_SENSOR -> wait until optical encoder

Variables:
- change x by
- x =
- set x to
- x

My Blocks:
- define block name
- define block name return
- if return

SELECTION GUIDANCE:
- For text on the robo-phone screen, prefer LCD_TEXT or LCD_MESSAGE.
- For graph plotting, prefer GRAPH for individual points, GRAPH_TRENDLINE for a fitted line, GRAPH_DA for sensor data over time, RESET_GRAPH before starting a fresh chart, and GRAPH_SAVE or GRAPH_FILE for file-based graph workflows.
- For speech output, prefer TEXTTOVOICE.
- For phone-name checks, use SMARTPHONE_GET_NAME and SMARTPHONE_COMPARE_NAME.
- For file logging, use WRITE_TO_FILE.
- For Firebase database operations, use INIT_DB / WRITE_DB / READ_DB.
- For keypad and switches, use virtual sensor blocks.
- For motors/robot movement, use CATCOMMON motor blocks.

EXAMPLES:
- "Draw point at x=5, y=5" -> spawn GRAPH under INITIATE, then input x and y values.
- "Draw a linear graph on the screen" -> use RESET_GRAPH first, then multiple GRAPH points or GRAPH_TRENDLINE.
- "Speak hello" -> use TEXTTOVOICE.
- "Save the graph to a file" -> use GRAPH_SAVE.

IMPORTANT:
- Match the user request to the closest block names above.
- When a block clearly contains a text input or dropdown choice, use a following 'input' command targeting that block's logical id.
- Keep scripts short and practical.

REFERENCE MANUAL:
- The full Robophone block manual is provided as a separate system instruction part below (titled "ROBOPHONE BLOCK MANUAL").
- Treat that manual as authoritative for visual signatures, function summaries, when to choose each block, exact field names, and the recipe steps.
- When the user request matches a recipe (e.g. "plot sin/cos with radians"), follow the recipe's step order — but emit it as 'spawn'/'input' commands, never as prose.
- Manual block_id values are documentation handles; the 'block' field in your tool call must still be the Msg key from the BLOCK LIBRARY above (e.g. 'LCD_MESSAGE', 'GRAPH', 'INITIATE').`
                },
                ...(manual ? [{
                    text: `ROBOPHONE BLOCK MANUAL\n=======================\n\n${manual}`
                }] : [])
            ]
        }
    };

    try {
        // Bound the request so the popup never hangs forever if the network or
        // API stalls. With an 84 KB manual + dynamic thinking, gemini-3.1
        // routinely spends 60-120 s reasoning before emitting; 180 s is a safe
        // upper bound. Failures surface as a clear timeout error instead of a
        // stuck "Connecting to Gemini..." status.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180_000);

        const bodyJson = JSON.stringify(requestBody);
        console.log(`[BlocklyAgent] request body size=${bodyJson.length} bytes`);

        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: bodyJson,
                signal: controller.signal
            });
        } catch (fetchErr) {
            if (fetchErr.name === "AbortError") throw new Error("Gemini request timed out after 180s.");
            throw new Error(`Network error reaching Gemini: ${fetchErr.message}`);
        } finally {
            clearTimeout(timeoutId);
        }

        console.log(`[BlocklyAgent] HTTP ${response.status} ${response.statusText}`);

        const data = await response.json();
        if (data.error) {
            console.error("[BlocklyAgent] Gemini API error:", data.error);
            throw new Error(`Gemini API: ${data.error.message || JSON.stringify(data.error)}`);
        }
        if (!response.ok) {
            throw new Error(`Gemini HTTP ${response.status}: ${response.statusText}`);
        }
        if (!data.candidates || data.candidates.length === 0) {
            console.error("[BlocklyAgent] Gemini returned no candidates:", data);
            throw new Error("Gemini returned no candidates (possibly blocked by safety filters).");
        }

        const candidate = data.candidates[0];
        console.log(`[BlocklyAgent] finishReason=${candidate.finishReason} usageMetadata=${JSON.stringify(data.usageMetadata)}`);
        if (!candidate.content || !Array.isArray(candidate.content.parts)) {
            console.error("[BlocklyAgent] Candidate has no content.parts. Full candidate:", candidate);
            const reason = candidate.finishReason || "unknown";
            // Common causes: MAX_TOKENS (raise maxOutputTokens or disable thinking),
            // SAFETY (prompt blocked), RECITATION (output matched copyrighted text),
            // OTHER (rare model error). Surface the reason so the user can act.
            throw new Error(`Gemini returned no content (finishReason=${reason}). Check the SW console for the full candidate.`);
        }
        const parts = candidate.content.parts;
        console.log(`[BlocklyAgent] candidate parts: ${parts.length}, types: ${parts.map(p => p.functionCall ? `fnCall(${p.functionCall.name})` : p.text ? `text(${p.text.length}ch)` : 'unknown').join(", ")}`);

        // Check for function calls
        const calls = parts.filter(p => p.functionCall);

        if (calls.length === 0) {
            const textOut = parts.find(p => p.text)?.text || "";
            console.warn("[BlocklyAgent] Gemini did NOT call the tool. Returned text:", textOut);
            return { message: textOut || "Gemini didn't return any specific actions." };
        }

        // Sequence the calls
        let totalCommandsSent = 0;
        let totalSpawnedCount = 0;
        let lastPlacementMode;
        let lastSpawnStats;
        const allInputFailures = [];
        const allDropped = [];           // post-normalize dropped commands across all calls
        const rawScripts = [];           // raw LLM scripts before normalize, for diagnostics
        for (const call of calls) {
            const { name, args } = call.functionCall;
            if (name === "execute_blockly_script") {
                const raw = args.script || [];
                rawScripts.push(raw);
                const rawCount = raw.length;
                const { script: normalizedScript, dropped } = normalizeGeneratedScript(raw);
                args.script = normalizedScript;
                allDropped.push(...dropped);
                totalCommandsSent += normalizedScript.length;
                console.log(`[BlocklyAgent] script: raw=${rawCount}, after normalize=${normalizedScript.length}, dropped=${dropped.length}`);
                console.log("📜 GEMINI GENERATED SCRIPT (after normalize):\n", JSON.stringify(normalizedScript, null, 2));
                if (dropped.length) console.warn("[BlocklyAgent] Dropped during normalize:", dropped);
                if (normalizedScript.length === 0) {
                    console.warn("[BlocklyAgent] Empty script after normalization. Raw call args:", call.functionCall.args);
                } else if (normalizedScript.length === 1 && normalizedScript[0].block === "INITIATE") {
                    console.warn("[BlocklyAgent] Model only emitted INITIATE.");
                }
            }
            try {
                const out = await executeOnPage(name, args, requestTabId);
                if (out && out.result && typeof out.result.spawnedCount === "number") {
                    totalSpawnedCount += out.result.spawnedCount;
                }
                if (out && out.result && out.result.placementMode) {
                    lastPlacementMode = out.result.placementMode;
                }
                if (out && out.result && out.result.spawnStats) {
                    lastSpawnStats = out.result.spawnStats;
                }
                if (out && out.result && Array.isArray(out.result.inputFailures)) {
                    allInputFailures.push(...out.result.inputFailures);
                }
            } catch (execErr) {
                // Attach diagnostics so the popup can show WHY nothing was placed.
                const diag = {
                    rawCommandCount: rawScripts.reduce((s, r) => s + r.length, 0),
                    afterNormalizeCount: totalCommandsSent,
                    droppedCount: allDropped.length,
                    droppedReasons: allDropped.slice(0, 10).map(d => d.reason),
                };
                execErr.message += ` | diagnostics: ${JSON.stringify(diag)}`;
                throw execErr;
            }
        }

        return {
            status: "success",
            actions: calls.map(c => c.functionCall.name),
            commandsEmitted: totalCommandsSent,
            blocksPlaced: totalSpawnedCount,
            placementMode: lastPlacementMode,
            spawnStats: lastSpawnStats,
            warnings: allInputFailures.map(f => `field input "${f.value}" on '${f.block}' failed: ${f.why}`)
        };

    } catch (error) {
        console.error("Gemini Flow Error:", error);
        throw error;
    }
}

// Returns { script, dropped }. The drop log is surfaced into the popup
// when execution succeeds but produced 0 blocks, so the user sees WHICH
// LLM commands were rejected and why.
function normalizeGeneratedScript(script) {
    const knownIds = new Set();
    const dropped = [];
    const out = [];

    // Recovery heuristics: occasionally Gemini puts the block name under a
    // different field. Pull from common aliases before declaring it missing.
    const SPAWN_BLOCK_ALIASES = ["block", "block_key", "blockKey", "type", "block_type", "blockType", "target_block", "name"];
    const INPUT_TARGET_ALIASES = ["block", "target", "target_id", "targetId", "block_id", "blockId", "ref"];

    for (const command of (script || [])) {
        if (!command || typeof command !== "object") {
            dropped.push({ reason: "non-object command", command });
            continue;
        }

        const normalized = { ...command };

        if (normalized.action === "spawn") {
            // Try aliases first.
            if (!normalized.block || typeof normalized.block !== "string") {
                for (const k of SPAWN_BLOCK_ALIASES) {
                    if (typeof normalized[k] === "string" && normalized[k].trim()) {
                        if (k !== "block") {
                            console.warn(`Recovering spawn '${k}' -> 'block': ${normalized[k]}`, command);
                            normalized.block = normalized[k];
                        }
                        break;
                    }
                }
            }
            // Last-resort: if id looks like a Msg key (UPPER_SNAKE_CASE) and
            // there's no block, treat id as block. This catches the case where
            // Gemini conflates id (logical handle) with block (Msg key).
            if ((!normalized.block || typeof normalized.block !== "string") &&
                typeof normalized.id === "string" && /^[A-Z][A-Z0-9_]+$/.test(normalized.id)) {
                console.warn(`Recovering spawn: 'id' looks like a Msg key ('${normalized.id}'); using it as 'block'.`, command);
                normalized.block = normalized.id;
                // Re-generate a lower-case id so later input commands don't collide
                normalized.id = normalized.id.toLowerCase() + "_" + Math.random().toString(36).slice(2, 5);
            }
            if (!normalized.block || typeof normalized.block !== "string") {
                const why = "spawn missing 'block' key";
                console.warn(`Dropping: ${why}`, command);
                dropped.push({ reason: why, command });
                continue;
            }
            normalized.cat = normalizeCategoryPath(normalized.cat, normalized.block);
            if (!Array.isArray(normalized.cat) || normalized.cat.length === 0 || !normalized.cat[0]) {
                const why = `spawn '${normalized.block}': no category resolved (not in BLOCK_CATEGORY_MAP)`;
                console.warn(`Dropping: ${why}`, command);
                dropped.push({ reason: why, command });
                continue;
            }
            if (normalized.id) {
                knownIds.add(normalized.id);
            }
            out.push(normalized);
            continue;
        }

        if (normalized.action === "input") {
            if (normalized.value === undefined || normalized.value === null) {
                const why = "input missing 'value'";
                console.warn(`Dropping: ${why}`, command);
                dropped.push({ reason: why, command });
                continue;
            }
            normalized.value = String(normalized.value);

            // Pull target from aliases if 'block' isn't set
            if (!normalized.block || typeof normalized.block !== "string") {
                for (const k of INPUT_TARGET_ALIASES) {
                    if (typeof normalized[k] === "string" && normalized[k].trim() && knownIds.has(normalized[k])) {
                        if (k !== "block") {
                            console.warn(`Recovering input target '${k}' -> 'block': ${normalized[k]}`, command);
                            normalized.block = normalized[k];
                        }
                        break;
                    }
                }
            }
            const target = normalized.block;
            if (!target || !knownIds.has(target)) {
                // Do NOT rewrite to the last spawned id — silently applying a
                // field value to an unrelated block corrupts a correct block,
                // which is strictly worse than skipping the command.
                const why = `input targets unknown id '${target}' (no matching prior spawn)`;
                console.warn(`Dropping: ${why}`, command);
                dropped.push({ reason: why, command });
                continue;
            }
            out.push(normalized);
            continue;
        }

        // Unknown actions used to be "passed through", but execute() has no
        // branch for them — they were silently ignored. Drop with a reason so
        // they show up in the diagnostics instead of vanishing.
        const why = `unknown action '${normalized.action}'`;
        console.warn(`Dropping: ${why}`, command);
        dropped.push({ reason: why, command });
    }

    return { script: out, dropped };
}

function normalizeCategoryPath(cat, blockKey) {
    const normalizeToken = (token) => String(token || "").trim().replace(/^\[/, "").replace(/\]$/, "");

    let path;
    if (Array.isArray(cat) && cat.length > 0) {
        path = cat.map(normalizeToken).filter(Boolean);
    } else if (typeof cat === "string" && cat.trim()) {
        path = [normalizeToken(cat)];
    } else {
        path = null;
    }

    // GROUND-TRUTH OVERRIDE: BLOCK_CATEGORY_MAP knows where each block really
    // lives; the LLM-provided cat is only a hint and is sometimes wrong — e.g.
    // it emitted ["CATSMARTPHONE","CATVIRTUALACTION","CATMATH"] for GRAPH,
    // which made the agent open the MATH category (last element = leaf) and
    // fail the flyout hunt for "draw graph point (". If the provided leaf
    // disagrees with the known category, replace the path with the canonical
    // one (nested-parent expansion below re-adds CATSMARTPHONE etc.).
    const mapped = BLOCK_CATEGORY_MAP[blockKey];
    if (mapped) {
        const leaf = (path && path.length > 0) ? path[path.length - 1] : null;
        if (!leaf || leaf.toUpperCase() !== mapped.toUpperCase()) {
            if (leaf) {
                console.warn(`[BlocklyAgent] cat path for '${blockKey}' ends in '${leaf}' but the block lives in '${mapped}' — overriding with the canonical path.`);
            }
            path = [mapped];
        }
    }
    if (!path || path.length === 0) return cat;

    // Expand nested-category leaves: if the path is just the leaf, prepend its
    // parent so the agent expands "Smartphone Blocks" before clicking
    // "Virtual Display" (otherwise the leaf row isn't visible to click).
    const leaf = path[path.length - 1];
    const parent = NESTED_CATEGORIES[leaf];
    if (parent && !path.includes(parent)) {
        return [parent, ...path];
    }
    return path;
}

async function executeOnPage(method, args, preferredTabId) {
    // A tab is injectable when its URL is a normal http(s) page — not one of
    // our own chrome-extension://... pages and not chrome://... internal pages.
    // We treat URL-less tabs (host_permissions don't grant access) as not yet
    // resolvable rather than blindly using them.
    const isInjectable = (t) => t && typeof t.id === "number"
        && typeof t.url === "string"
        && !t.url.startsWith("chrome-extension://")
        && !t.url.startsWith("chrome://")
        && !t.url.startsWith("edge://")
        && !t.url.startsWith("about:");

    let tab = null;
    let why = "";

    // 1. Use the tabId the popup captured at click time, but reject it if the
    //    target turns out to be a chrome-extension:// page (which happens when
    //    the popup queried its own window).
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
    // 2. Look for a Robo-Phone tab explicitly.
    if (!tab) {
        try {
            const list = await chrome.tabs.query({
                url: [
                    "*://*.robo-phone.com/*",
                    "*://localhost/*",
                    "*://localhost:*/*",
                    "*://127.0.0.1/*",
                    "*://127.0.0.1:*/*"
                ]
            });
            const candidate = list.find(t => t.active) || list[0];
            if (isInjectable(candidate)) tab = candidate;
        } catch (_) { }
    }
    // 3. Fall back to the active tab in the last-focused window (filtered).
    if (!tab) {
        const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (isInjectable(t)) tab = t;
    }
    // 4. Final fallback: any active tab anywhere that's injectable.
    if (!tab) {
        const all = await chrome.tabs.query({ active: true });
        const t = all.find(isInjectable);
        if (t) tab = t;
    }
    if (!tab) {
        throw new Error(
            "No injectable Blockly tab found. Open https://staging.code.robo-phone.com/home in a normal browser tab and click Run again." +
            (why ? ` (Note: ${why})` : "")
        );
    }
    console.log(`[BlocklyAgent] target tab id=${tab.id} url=${tab.url}`);

    // Make sure the CURRENT BlocklyAgent build is present in the MAIN world
    // before calling execute. Checking mere existence is not enough: after an
    // extension reload, an already-open page still holds the OLD scripts, so
    // probes that only test `!!window.BlocklyAgent` skip injection and the run
    // silently executes stale code (e.g. pre-API field handling that dumps
    // every input into the block's first field). Compare versions and
    // re-inject whenever they don't match — the IIFEs simply re-assign
    // window.BlocklyAgent / window.BlocklyApiEngine.
    try {
        const probe = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
                agentVersion: (window.BlocklyAgent && window.BlocklyAgent.VERSION) || null,
                hasAgent: !!window.BlocklyAgent,
                hasEngine: !!window.BlocklyApiEngine
            }),
            world: "MAIN"
        });
        const info = (probe && probe[0] && probe[0].result) || {};
        const fresh = info.hasAgent && info.hasEngine && info.agentVersion === EXPECTED_AGENT_VERSION;
        console.log(`[BlocklyAgent] MAIN world: agent=${info.hasAgent} (v${info.agentVersion}), engine=${info.hasEngine}, expected v${EXPECTED_AGENT_VERSION} -> ${fresh ? "fresh" : "STALE, re-injecting"}`);
        if (!fresh) {
            console.log("[BlocklyAgent] injecting blockly_api_engine.js + blockly_methods.js into MAIN world...");
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["blockly_api_engine.js", "blockly_methods.js"],
                world: "MAIN"
            });
            await new Promise(r => setTimeout(r, 200));
        }
    } catch (probeErr) {
        console.error("[BlocklyAgent] Probe/inject failed:", probeErr);
        throw new Error(`Could not inject into tab ${tab.id} (${tab.url}). Refresh the Blockly page and retry. Underlying: ${probeErr.message}`);
    }

    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            // async func — return value is the resolved promise's value, errors
            // surface as exceptions caught here.
            func: async (methodName, argsObj) => {
                if (methodName === "execute_blockly_script") {
                    if (!window.BlocklyAgent) {
                        return { ok: false, error: "BlocklyAgent not loaded in MAIN world (injection failed)." };
                    }
                    try {
                        return await window.BlocklyAgent.execute(argsObj.script);
                    } catch (e) {
                        return { ok: false, error: String(e && e.message || e) };
                    }
                }
                if (typeof window[methodName] === "function") {
                    try {
                        const r = await window[methodName](...(Object.values(argsObj || {})));
                        return { ok: true, legacyResult: r };
                    } catch (e) {
                        return { ok: false, error: String(e && e.message || e) };
                    }
                }
                return { ok: false, error: `Method ${methodName} not found in MAIN world.` };
            },
            args: [method, args || {}],
            world: "MAIN"
        }, (results) => {
            if (chrome.runtime.lastError) {
                console.error("[BlocklyAgent] executeScript runtime error:", chrome.runtime.lastError);
                return reject(new Error(chrome.runtime.lastError.message));
            }
            const r = results && results[0] && results[0].result;
            console.log("[BlocklyAgent] MAIN-world result:", r);
            if (!r || typeof r !== "object") {
                return reject(new Error("MAIN-world function returned no result. Check the page console for the actual exception."));
            }
            if (r.ok === false) {
                return reject(new Error(r.error || "Blockly execution failed."));
            }
            if (
                method === "execute_blockly_script" &&
                Number(r.spawnedCount || 0) === 0
            ) {
                // Differentiate "got commands but nothing snapped" from
                // "got no commands at all". commandsExecuted is what the
                // agent actually iterated; spawnedCount is what landed.
                const commandsExecuted = Number(r.commandsExecuted || 0);
                let hint;
                if (commandsExecuted === 0) {
                    hint = "the post-normalize script was empty (every LLM command was rejected before execution)";
                } else {
                    hint = `the script had ${commandsExecuted} command(s) but they were all 'input' actions with no 'spawn' — the LLM produced field-fills with nothing to place`;
                }
                return reject(new Error(
                    `Blockly execution completed but no blocks were placed on the workspace. ` +
                    `commandsExecuted=${commandsExecuted}, spawnedCount=0. Likely cause: ${hint}. ` +
                    `Open the service-worker console for the script dump and drop log.`
                ));
            }
            resolve({ status: "success", result: r });
        });
    });
}


//Display on my phone the text "Hello Robot1" and then the text "Hello Robot2"
