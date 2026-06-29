#!/usr/bin/env node
/**
 * run_tests.js — standalone Gemini planner test runner
 *
 * Reads tests.md, sends each test prompt to Gemini using the same
 * function-calling logic as background.js, and writes test_output.md.
 *
 * Usage:
 *   GEMINI_API_KEY=<your-key> node run_tests.js
 *   node run_tests.js --key <your-key>
 */

const fs   = require("fs");
const path = require("path");
const https = require("https");

// ── Config ────────────────────────────────────────────────────────────────────
const GEMINI_MODEL   = "gemini-2.5-flash-lite";
const MAX_TOKENS     = 16384;
const THINKING_BUDGET = 4096;
const TEMPERATURE    = 0.2;
const TIMEOUT_MS     = 120_000;

const TESTS_FILE  = path.join(__dirname, "tests.md");
const OUTPUT_FILE = path.join(__dirname, "test_output.md");

// ── Parse CLI / env for API key ───────────────────────────────────────────────
function getApiKey() {
    const idx = process.argv.indexOf("--key");
    if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1].trim();
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
    console.error("❌  No API key. Set GEMINI_API_KEY or pass --key <key>");
    process.exit(1);
}

// ── Parse tests.md into [{id, title, complexity, prompt}] ────────────────────
function parseTests(src) {
    const tests = [];
    // Split on "## Test N"
    const sections = src.split(/^## Test \d+/m).slice(1);
    const headers  = [...src.matchAll(/^## (Test \d+ — .+)/mg)].map(m => m[1]);

    for (let i = 0; i < sections.length; i++) {
        const title       = headers[i] || `Test ${i + 1}`;
        const body        = sections[i];
        const complexLine = body.match(/\*\*Complexity:\*\*\s*(.+)/);
        const complexity  = complexLine ? complexLine[1].trim() : "unknown";
        // Everything after the blank line following **Complexity** is the prompt
        const promptMatch = body.match(/\*\*Complexity:\*\*[^\n]*\n+([\s\S]+)/);
        const prompt      = promptMatch ? promptMatch[1].trim() : body.trim();
        tests.push({ id: i + 1, title, complexity, prompt });
    }
    return tests;
}

// ── Gemini function declarations — exact copy from background.js ──────────────
const FUNCTION_DECLARATIONS = [
    {
        name: "execute_blockly_script",
        description: "Executes a sequence of actions on the Blockly workspace. Use this to spawn, modify, or remove blocks and enter text.",
        parameters: {
            type: "OBJECT",
            properties: {
                script: {
                    type: "ARRAY",
                    description: "Ordered list of commands. Each command MUST include 'action' and 'block'.",
                    items: {
                        type: "OBJECT",
                        properties: {
                            action: { type: "STRING", enum: ["spawn", "input", "modify", "remove", "clear"], description: "'spawn' creates a block. 'input' fills a field. 'modify' changes a field on an existing block (use its logical id). 'remove' deletes an existing block by logical id. 'clear' (first command only) clears the workspace and starts fresh." },
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
    },
    {
        name: "load_workspace",
        description: "Replace the entire Blockly workspace with a new program defined as a Blockly serialization JSON object. Use this for ALL new programs and complete rewrites — it is more reliable than execute_blockly_script because it uses exact Blockly field names and atomic loading. The workspace is cleared first. Use execute_blockly_script only for targeted modifications of the current program.",
        parameters: {
            type: "OBJECT",
            properties: {
                workspace_json: {
                    type: "OBJECT",
                    description: "Blockly workspace serialization JSON. Top-level format: {\"blocks\": {\"languageVersion\": 0, \"blocks\": [...]}}. Each block uses lowercase \"type\" (e.g. \"controls_for\"), \"fields\" (exact internal names), and \"inputs\" (exact socket names). Field values for dropdowns use their internal string codes (e.g. OP: \"MULTIPLY\" not \"×\")."
                },
                description: {
                    type: "STRING",
                    description: "One-line description of what this program does (for debug log)."
                }
            },
            required: ["workspace_json"]
        }
    }
];

// ── System prompt — exact copy from background.js ────────────────────────────
const SYSTEM_PROMPT = `You are a Blockly automation assistant for the Robo-Phone custom Blockly UI. You have two tools: 'execute_blockly_script' (spawn/input protocol) and 'load_workspace' (Blockly JSON, preferred for new programs using standard math/loop/variable blocks).

SCRIPT RULES:
0. EVERY command MUST have BOTH 'action' AND 'block'. There are no exceptions.
   - For action='spawn', 'block' is the Block Msg Key in UPPER_SNAKE_CASE (e.g. "INITIATE", "LCD_MESSAGE", "MATH_TRIG"). Do NOT use names like "on start", "lcd msg write", "block name" — those are display labels, not keys.
   - For action='input', 'block' is the LOGICAL ID of an earlier spawn (e.g. "start", "msg1"). It is NEVER a Msg key, a field name, or another logical id.
   - Never put the Msg key in 'id' and leave 'block' empty — 'block' carries the Msg key for spawn, 'id' is your handle to refer back later.
1. Use 'id' to label your own spawns, for example "start", "graph1", "wait1". The id is lower-case and short.
2. 'parent' links to a previous 'id' (not a Msg key).
3. pos: 'nested' = drop INSIDE the parent's statement-body OR INSIDE a value socket on the parent. pos: 'next' = drop ADJACENT BELOW the parent (chained statement).
3a. CAP BLOCKS (INITIATE, START_BLOCK) have NO 'next' connector — they terminate a chain. The FIRST child of a cap MUST use pos:'nested' (into its statement-body). Subsequent siblings should chain to that first child via pos:'next', NOT back to the cap.
4. NEVER output plain JSON text to the user. ALWAYS call the tool.
5. Prefer the exact categories and block keys listed below.
6. When a task needs a runnable program, start with INITIATE unless the user explicitly asks for a value-only expression.
7. STATEMENT vs VALUE blocks:
   - STATEMENT blocks (INITIATE, CONTROLS_FOR, CONTROLS_REPEAT_EXT, CONTROLS_IF, LCD_MESSAGE, GRAPH, RESET_GRAPH, WAIT, TEXTTOVOICE, ...) form the program flow. Connect them with parent + pos:'next' or pos:'nested' (into a do/then body).
   - VALUE blocks (MATH_NUMBER, MATH_TRIG, MATH_ARITHMETIC, MATH_RANDOM_INT, LOGIC_BOOLEAN, LOGIC_COMPARE, MY_TEXT, ...) return a value. They go INSIDE another block's value socket via parent + pos:'nested'.
   - To put a value block into a value socket, use action='spawn' with parent set to the consumer block id and pos:'nested'. NEVER use action='input' with value set to a logical id — input only fills text fields and dropdowns, it cannot reference another block.
8. For an 'input' command, the 'block' property MUST be a previously spawned logical id. The 'value' is plain text or a dropdown option string.
9. If you need to fill several fields on the same spawned block, emit multiple 'input' commands all referencing that same logical id, in field order.
10. Emit 'input' commands ONLY for fields the block actually has. NEVER invent extra fields.

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

EXAMPLE — plot sin(x) on the graph (no amplitude):
- spawn INITIATE id=start
- spawn RESET_GRAPH id=reset parent=start pos=nested
- input reset value="red"
- spawn CONTROLS_FOR id=loop parent=reset pos=next
- input loop value="angleDeg" / "0" / "360" / "10"
- spawn GRAPH id=draw parent=loop pos=nested
- spawn VAR_GET id=xv parent=draw pos=nested
- input xv value="angleDeg"
- spawn MATH_TRIG id=siny parent=draw pos=nested
- input siny value="sin"
- spawn VAR_GET id=av parent=siny pos=nested
- input av value="angleDeg"
- input draw value="red"
- input draw value="false"

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

BLOCK LIBRARY:
[CATLOOPS]: INITIATE, START_BLOCK, STOP_TASK, SETTINGS, CONTROLS_REPEAT_EXT, CONTROLS_WHILEUNTILFOREVER, CONTROLS_FOR, CONTROLS_IF, CONTROLS_FLOW_STATEMENTS, READ_TIMER, COMPARE_TIMER, WAIT_TIMER, RESET_TIMER, WAIT, SMARTPHONE_GET_NAME, SMARTPHONE_COMPARE_NAME, MY_TEXT_PRINT, STOP_PROGRAM
[CATLOGIC]: LOGIC_BOOLEAN, LOGIC_NEGATE, LOGIC_OPERATION_EXTENDED, LOGIC_NEGATE_NUMBER, LOGIC_OPERATION_NUMERIC_EXTENDED, LOGIC_NULL, CONVERTERS_B2D, CONVERTERS_D2B, LOGIC_TERNARY
[CATMATH]: MATH_NUMBER, MATH_ARITHMETIC, MATH_ADVANCED, MATH_SINGLE, MATH_TRIG, MATH_CONSTANT, MATH_ROUND, MATH_ON_LIST, MATH_CONSTRAIN, MATH_RANDOM_INT, MATH_RANDOM_FLOAT, MATH_ATAN2, MATH_NUMBER_PROPERTY, LOGIC_COMPARE, MATH_IN_RANGE
[CATTEXT]: MY_TEXT, TEXT_JOIN, MY_TEXT_APPEND, TEXT_LENGTH, LOGIC_TEXT_COMPARE, TEXT_ISEMPTY, TEXT_INDEXOF, NUMBER_OCCURRENCE, TEXT_CHARAT, TEXT_GETSUBSTRING, TEXT_CHANGECASE, TEXT_TRIM, TRANSLATE, RUN_LINK
[CATLISTS]: LISTS_CREATE_EMPTY, LISTS_CREATE_WITH, LISTS_REPEAT, LISTS_LENGTH, LISTS_ISEMPTY, LISTS_INDEXOF, LISTS_GETINDEX, LISTS_SETINDEX, LISTS_GETSUBLIST, LISTS_SPLIT, LISTS_SORT
[CATVIRTUALACTION]: LCD_TEXT, LCD_MESSAGE, READ_SSEGMENT, SSEGMENT, BAR, READ_LED, LED, LED_BIT, LED_ADVANCED_INTERNAL, LED_ADVANCED_EXTERNAL, RESET_GRAPH, GRAPH, GRAPH_DA, GET_GRAPH_TRENDLINE, GRAPH_TRENDLINE, GRAPH_FILE, GRAPH_SAVE, SHOW_COMPONENT, CLEAR_COMPONENT, CLEARSCREEN
Variables: VAR_GET, VAR_SET, VAR_CHANGE, VAR_TOGGLE

MATH_ARITHMETIC operator values: +, -, ×, ÷, ^ (use × for multiply, ÷ for divide)
MATH_TRIG first input selects operation: sin, cos, tan, asin, acos, atan
COLOR DROPDOWNS: red, yellow, green, blue (only these four)`;

// ── HTTPS POST helper (no external deps) ─────────────────────────────────────
function post(url, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
        };
        const req = https.request(options, (res) => {
            let raw = "";
            res.on("data", c => raw += c);
            res.on("end", () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch (e) { reject(new Error(`JSON parse failed: ${raw.slice(0, 200)}`)); }
            });
        });
        req.on("error", reject);
        const timer = setTimeout(() => { req.destroy(); reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)); }, TIMEOUT_MS);
        req.on("close", () => clearTimeout(timer));
        req.write(data);
        req.end();
    });
}

// ── Call Gemini for one prompt ────────────────────────────────────────────────
async function callGemini(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ function_declarations: FUNCTION_DECLARATIONS }],
        tool_config: { function_calling_config: { mode: "AUTO" } }, // AUTO lets model think before calling; matches background.js
        generationConfig: {
            temperature: TEMPERATURE,
            maxOutputTokens: MAX_TOKENS,
            thinkingConfig: { thinkingBudget: THINKING_BUDGET }
        },
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] }
    };

    const { status, body: data } = await post(url, body);
    if (data.error) throw new Error(`Gemini API: ${data.error.message}`);
    if (status !== 200) throw new Error(`HTTP ${status}`);

    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) throw new Error(`No content (finishReason=${candidate?.finishReason})`);

    const tokens = data.usageMetadata?.totalTokenCount || 0;
    const calls  = candidate.content.parts.filter(p => p.functionCall);
    const text   = candidate.content.parts.filter(p => p.text).map(p => p.text).join("\n").trim();

    return { calls, text, tokens, finishReason: candidate.finishReason };
}

// ── Format a function call result for the output file ────────────────────────
function formatCall(call) {
    const { name, args } = call.functionCall;
    if (name === "load_workspace") {
        return [
            `**Tool:** \`load_workspace\``,
            `**Description:** ${args.description || "(none)"}`,
            "```json",
            JSON.stringify(args.workspace_json, null, 2),
            "```"
        ].join("\n");
    }
    if (name === "execute_blockly_script") {
        const script = args.script || [];
        return [
            `**Tool:** \`execute_blockly_script\` (${script.length} commands)`,
            "```json",
            JSON.stringify(script, null, 2),
            "```"
        ].join("\n");
    }
    return `**Tool:** \`${name}\`\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    const apiKey = getApiKey();

    if (!fs.existsSync(TESTS_FILE)) {
        console.error(`❌  tests.md not found at ${TESTS_FILE}`);
        process.exit(1);
    }

    const src   = fs.readFileSync(TESTS_FILE, "utf8");
    const tests = parseTests(src);
    console.log(`📋  Loaded ${tests.length} tests from tests.md`);

    const lines = [
        `# Blockly Test Output`,
        ``,
        `Generated: ${new Date().toISOString()}  |  Model: ${GEMINI_MODEL}`,
        ``,
        `---`,
        ``
    ];

    let totalTokens = 0;
    for (const test of tests) {
        console.log(`\n▶  Test ${test.id}: ${test.title}`);
        lines.push(`## ${test.title}`);
        lines.push(`**Complexity:** ${test.complexity}`);
        lines.push(``);
        lines.push(`**Prompt:**`);
        lines.push(`> ${test.prompt.replace(/\n/g, "\n> ")}`);
        lines.push(``);

        const t0 = Date.now();
        try {
            const result = await callGemini(test.prompt, apiKey);
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            totalTokens += result.tokens;

            console.log(`   ✓  ${result.calls.length} tool call(s), ${result.tokens} tokens, ${elapsed}s`);

            lines.push(`**Result:** ✅ ${result.calls.length} tool call(s) | ${result.tokens} tokens | ${elapsed}s | finishReason: \`${result.finishReason}\``);
            lines.push(``);

            if (result.calls.length === 0) {
                lines.push(`⚠️  Model returned text instead of a tool call:`);
                lines.push(`> ${result.text}`);
            } else {
                for (const call of result.calls) {
                    lines.push(formatCall(call));
                }
            }
        } catch (err) {
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            console.error(`   ✗  ${err.message}`);
            lines.push(`**Result:** ❌ ERROR after ${elapsed}s`);
            lines.push(``);
            lines.push(`\`\`\``);
            lines.push(err.message);
            lines.push(`\`\`\``);
        }

        lines.push(``);
        lines.push(`---`);
        lines.push(``);
    }

    lines.push(`**Total tokens used:** ${totalTokens}`);

    fs.writeFileSync(OUTPUT_FILE, lines.join("\n"), "utf8");
    console.log(`\n✅  Done. Output written to test_output.md (${totalTokens} total tokens)`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
