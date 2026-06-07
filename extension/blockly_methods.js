// ----------------------------------------------------------------------------
// UNIVERSAL BLOCKLY AGENT V15 (Hybrid Structured Executor)
// ----------------------------------------------------------------------------
(function installUniversalAgent() {
    console.log("🤖 Installing Universal Blockly Agent V15 (Hybrid Structured Executor)...");

    // ------------------------------------------------------------------------
    // BLOCK_FRAGMENTS — canonical text-fragment fingerprint per Msg key.
    //
    // Each entry maps a Blockly Msg key (the same key the LLM emits in its
    // command list) to an array of strings. To resolve a key to a flyout
    // block, the matcher finds the first VISIBLE flyout block whose
    // text.blocklyText set contains EVERY fragment as an exact match
    // (case-insensitive). Each fragment is one whole text-node's content
    // ("lcd msg write"), not a substring.
    //
    // Why not just use Blockly.Msg[key] and word-peel? Because on this build:
    //   1. Many Msg keys are missing entirely.
    //   2. When present, the stripped Msg often doesn't equal any single
    //      text element (Blockly renders %1 / %2 / labels as separate
    //      text nodes; the resulting visible text spans multiple nodes).
    //   3. Single-word peels match cross-category blocks (e.g. "reset"
    //      hitting Flow Control's "reset timer" while we wanted Virtual
    //      Display's "reset graph color").
    //
    // Fragments below were captured from the LIVE flyout on
    // staging.code.robo-phone.com/home and chosen to be:
    //   - exact-string members of the block's text.blocklyText set, and
    //   - sufficient to disambiguate from neighbours in the same category.
    // When two flyout blocks share a candidate fragment, we list multiple
    // fragments so all must match (set-intersection match).
    // ------------------------------------------------------------------------
    const BLOCK_FRAGMENTS = {
        // ===== Flow Control (CATLOOPS) =====
        INITIATE:                       ["on start"],
        START_BLOCK:                    ["run"],
        STOP_TASK:                      ["stop task"],
        SETTINGS:                       ["Component Settings"],
        CONTROLS_REPEAT_EXT:            ["times"],
        CONTROLS_WHILEUNTILFOREVER:     ["forever"],
        CONTROLS_FOR:                   ["count with"],
        CONTROLS_IF:                    ["if", "do"],          // matches basic; else-variant also matches "if"+"do"+"else" — first DOM match wins
        CONTROLS_FLOW_STATEMENTS:       ["break out"],
        READ_TIMER:                     ["read", "timer 0"],
        COMPARE_TIMER:                  ["is", "timer 0"],
        WAIT_TIMER:                     ["wait until", "timer 0"],
        RESET_TIMER:                    ["reset", "timer"],
        WAIT:                           ["wait", "sec"],       // single-element "wait" — distinct from "wait until"
        SMARTPHONE_GET_NAME:            ["get Phone Name"],
        SMARTPHONE_COMPARE_NAME:        ["phone Name"],
        MY_TEXT_PRINT:                  ["break point ➤ print"],
        STOP_PROGRAM:                   ["stop program and exit"],

        // ===== Logic (CATLOGIC) =====
        LOGIC_BOOLEAN:                  ["true"],              // first flyout block is the lone "true"
        LOGIC_NEGATE:                   ["false", "not"],      // boolean NOT
        LOGIC_OPERATION_EXTENDED:       ["true", "and"],       // boolean AND/OR
        LOGIC_NEGATE_NUMBER:            ["255", "not"],        // numeric NOT
        LOGIC_OPERATION_NUMERIC_EXTENDED:["128"],              // numeric AND/OR uniquely has "128"
        LOGIC_NULL:                     ["null"],
        CONVERTERS_B2D:                 ["to decimal"],
        CONVERTERS_D2B:                 ["to binary"],
        LOGIC_TERNARY:                  ["test"],

        // ===== Math (CATMATH) =====
        MATH_NUMBER:                    ["123"],
        MATH_ARITHMETIC:                ["+"],
        MATH_ADVANCED:                  ["a*x^2+b*x+c"],
        MATH_SINGLE:                    ["square root"],
        MATH_TRIG:                      ["sin"],
        MATH_CONSTANT:                  ["π"],
        MATH_ROUND:                     ["round"],
        MATH_ON_LIST:                   ["sum"],
        MATH_CONSTRAIN:                 ["constrain"],
        MATH_RANDOM_INT:                ["random integer from"],
        MATH_RANDOM_FLOAT:              ["random fraction"],
        MATH_ATAN2:                     ["atan2 of X:"],
        MATH_NUMBER_PROPERTY:           ["even"],
        LOGIC_COMPARE:                  ["="],                 // category-bound: within Math the only "=" is the compare block
        MATH_IN_RANGE:                  ["inside"],

        // ===== Text (CATTEXT) =====
        // MY_TEXT has zero text fragments (empty string constant). Marked with
        // ordinal-zero so the spawn code can pick it positionally.
        MY_TEXT:                        ["__POSITIONAL_0__"],
        TEXT_JOIN:                      ["create text with"],   // variadic join — visible label on this build is "create text with", not "join"
        MY_TEXT_APPEND:                 ["append text"],
        TEXT_LENGTH:                    ["abc", "length of"],  // disambiguate from LISTS_LENGTH which uses {listVariable}
        LOGIC_TEXT_COMPARE:             ["="],                 // category-bound to Text
        TEXT_ISEMPTY:                   ["is empty"],          // category-bound; LISTS_ISEMPTY uses same fragment in its category
        TEXT_INDEXOF:                   ["occurrence of text"],
        NUMBER_OCCURRENCE:              ["occurrence of number"],
        TEXT_CHARAT:                    ["get", "letter #"],
        TEXT_GETSUBSTRING:              ["get substring from"],
        TEXT_CHANGECASE:                ["UPPER CASE"],
        TEXT_TRIM:                      ["trim spaces from"],
        TRANSLATE:                      ["translate"],
        RUN_LINK:                       ["run link at url"],

        // ===== Lists (CATLISTS) =====
        LISTS_CREATE_EMPTY:             ["create empty list"],
        LISTS_CREATE_WITH:              ["create list with"],
        LISTS_REPEAT:                   ["create list with item"],
        LISTS_LENGTH:                   ["{listVariable}", "length of"],
        LISTS_ISEMPTY:                  ["is empty"],
        LISTS_INDEXOF:                  ["occurrence of item"],
        LISTS_GETINDEX:                 ["get", "#"],          // basic getter; disambiguate from sublist by absence of "get sub-list from"
        LISTS_SETINDEX:                 ["set", "as"],
        LISTS_GETSUBLIST:               ["get sub-list from"],
        LISTS_SPLIT:                    ["list from text"],
        LISTS_SORT:                     ["sort"],

        // ===== Virtual Display (CATVIRTUALACTION) =====
        LCD_TEXT:                       ["lcd grid write"],
        LCD_MESSAGE:                    ["lcd msg write"],
        READ_SSEGMENT:                  ["7segment"],          // first 7segment block is the reader
        SSEGMENT:                       ["all", "7segment"],
        BAR:                            ["set line bar"],
        READ_LED:                       ["led"],               // single-element "led" block (reader)
        LED:                            ["set led", "to"],
        LED_BIT:                        ["set led bit"],
        LED_ADVANCED_INTERNAL:          ["to current value"],
        LED_ADVANCED_EXTERNAL:          ["15", "and (&)"],
        RESET_GRAPH:                    ["reset graph color"],
        GRAPH:                          ["draw graph point ("],
        GRAPH_DA:                       ["draw graph"],
        GET_GRAPH_TRENDLINE:            ["trendline graph"],
        GRAPH_TRENDLINE:                ["draw trendline for graph"],
        GRAPH_FILE:                     ["draw graph from"],
        GRAPH_SAVE:                     ["save graphs"],
        SHOW_COMPONENT:                 ["load component"],
        CLEAR_COMPONENT:                ["unload component"],
        CLEARSCREEN:                    ["clear screen"],

        // ===== Advanced Media (CATADVANCEDACTION) =====
        PLAYTONE:                       ["play tone Hz"],
        PLAYNOTE:                       ["play note"],
        SHOWIMAGE:                      ["show image"],
        IMAGE_CAPTURE:                  ["capture image"],
        PLAYVIDEO:                      ["play video filename"],
        VIDEO:                          ["record video"],
        PLAYAUDIO:                      ["play audio"],
        AUDIO_CAPTURE:                  ["capture audio duration"],
        PREVIEW:                        ["init Preview with zoom"],
        STOPMEDIA:                      ["stop all media"],

        // ===== Physical Sensors (CATPHYSICALSENSORS) =====
        SENSOR_MEASURE:                 ["angle Scalar"],      // first read-sensor block; sensor type is a dropdown
        SENSOR_COMPARE:                 ["is", "angle Scalar"],
        SENSOR_WAIT:                    ["wait until", "angle Scalar"],
        SENSOR_RESET:                   ["reset", "all"],
        // RTC: not present in current flyout

        // ===== Virtual Sensors (CATVIRTUALSENSORS) =====
        VIRTUAL_SENSOR_MEASURE:         ["switches"],          // first virtual-sensor block; type via dropdown
        VIRTUAL_SENSOR_COMPARE:         ["is", "switches"],
        VIRTUAL_SENSOR_WAIT:            ["wait until", "switches"],
        KEY1_BUTTON:                    ["set trigger button message"],

        // ===== Advanced Sensors (CATADVANCEDSENSORS) =====
        ADVANCED_SENSORS_MEASURE:       ["color Detect"],
        ADVANCED_SENSORS_COMPARE:       ["is", "color Detect"],
        ADVANCED_SENSORS_WAIT:          ["wait until", "color Detect"],
        FACES_POSITION:                 ["get face"],
        FACES_POSITION_COMPARE:         ["is face"],
        FACES_POSITION_WAIT:            ["wait until face"],
        FACES_NAME:                     ["nearest face name"],
        COMPARE_FACES_NAME:             ["name", "is", "nearest face"],
        WAIT_FACES_NAME:                ["name", "wait until", "nearest face"],

        // ===== Communication (CATCOMMUNICATION) =====
        GOOGLE:                         ["Ask Google"],
        CHATGPT:                        ["Ask", "chatgpt"],
        CHATGPT_COMPARE:                ["chatgpt", "Answer"],
        TELEPHONY_MEASURE:              ["voice To Text"],
        TELEPHONY_COMPARE:              ["is", "voice To Text"],
        TELEPHONY_WAIT:                 ["wait until", "voice To Text"],
        TEXTTOVOICE:                    ["speak Text"],
        SENDSMS:                        ["send sms phone"],

        // ===== Data Operations (CATDATAOPERATIONS) =====
        WRITE_TO_FILE:                  ["write Line"],
        READ_FILE:                      ["read Line from"],
        DELETE_FILE:                    ["File", "delete"],    // first "File … delete" block in Data Operations is delete_file
        INIT_DB:                        ["initialize firebase database at url"],
        WRITE_DB:                       ["Key", "write", "Number"],
        READ_DB:                        ["Key", "read"],
        KEY_EXISTS:                     ["exists?"],
        CHANGE_DB:                      ["wait until value at key"],
        DELETE_KEY:                     ["Key", "delete"],
        DELETE_DB:                      ["delete database"],
        INIT_STORAGE:                   ["initialize firebase storage at url"],
        UPLOAD_STORAGE:                 ["upload"],
        DOWNLOAD_STORAGE:               ["download"],
        DELETE_STORAGE:                 ["delete", "filename", "from storage"],  // distinguish from DOWNLOAD_STORAGE which also has "filename"+"from storage"

        // ===== Common / Wheels Robots (CATCOMMON) =====
        MOVE_STEERING:                  ["move steering"],
        MOVE_DIRECTION:                 ["move direction"],
        MOVE_TANK:                      ["move tank"],
        LARGE_MOTOR:                    ["large motor"],
        UNREGULATED_MOTOR:              ["unregulated motor"],
        MOTOR_READY:                    ["wait until motors stop"],
        MOTOR_PORTS:                    ["set motor ports"],
        RESET_SENSOR:                   ["reset", "All"],
        READ_SENSOR:                    ["optical encoder"],
        COMPARE_SENSOR:                 ["is", "optical encoder"],
        WAIT_SENSOR:                    ["wait until", "optical encoder"],

        // ===== Variables (CATVARIABLES) =====
        // Default flyout shows blocks operating on variable "x":
        //   "1 change x by"   → VAR_CHANGE
        //   "1 ⁣ x ="          → VAR_TOGGLE (sets x to expression with invisible char)
        //   "0 set x to"       → VAR_SET
        //   "x"                → VAR_GET (lone variable getter)
        VAR_GET:                        ["x"],
        VAR_SET:                        ["set", "to"],
        VAR_CHANGE:                     ["change", "by"],
        VAR_TOGGLE:                     ["="],
        // Standard Blockly variable type aliases (LLM may emit these instead)
        VARIABLES_GET:                  ["x"],
        VARIABLES_SET:                  ["set", "to"],
        MATH_CHANGE:                    ["change", "by"],
    };

    // ------------------------------------------------------------------------
    // VALUE_BLOCKS — block keys that return a value (round/inline shape).
    // These plug into value sockets on their parent (inline at mid-Y), NOT
    // into statement-input slots (bottom-left interior). Knowing the child's
    // type lets us pick the right drop coordinates for `pos: 'nested'`.
    // ------------------------------------------------------------------------
    const VALUE_BLOCKS = new Set([
        // Math values
        "MATH_NUMBER", "MATH_ARITHMETIC", "MATH_TRIG", "MATH_SINGLE",
        "MATH_CONSTANT", "MATH_ROUND", "MATH_ON_LIST", "MATH_CONSTRAIN",
        "MATH_RANDOM_INT", "MATH_RANDOM_FLOAT", "MATH_ATAN2",
        "MATH_NUMBER_PROPERTY", "MATH_IN_RANGE", "MATH_ADVANCED",
        // Logic values
        "LOGIC_BOOLEAN", "LOGIC_NEGATE", "LOGIC_NEGATE_NUMBER",
        "LOGIC_OPERATION_EXTENDED", "LOGIC_OPERATION_NUMERIC_EXTENDED",
        "LOGIC_NULL", "LOGIC_TERNARY", "LOGIC_COMPARE",
        "CONVERTERS_B2D", "CONVERTERS_D2B",
        // Text values
        "MY_TEXT", "TEXT_JOIN", "TEXT_LENGTH", "TEXT_ISEMPTY",
        "TEXT_CHARAT", "TEXT_INDEXOF", "NUMBER_OCCURRENCE",
        "TEXT_GETSUBSTRING", "TEXT_CHANGECASE", "TEXT_TRIM",
        "TRANSLATE", "LOGIC_TEXT_COMPARE",
        // List values
        "LISTS_CREATE_EMPTY", "LISTS_CREATE_WITH", "LISTS_REPEAT",
        "LISTS_LENGTH", "LISTS_ISEMPTY", "LISTS_INDEXOF",
        "LISTS_GETINDEX", "LISTS_GETSUBLIST", "LISTS_SPLIT",
        // Variable getters
        "VAR_GET", "VARIABLES_GET",
        // Sensor reads / compares (return values)
        "SMARTPHONE_GET_NAME", "SMARTPHONE_COMPARE_NAME",
        "READ_TIMER", "COMPARE_TIMER",
        "SENSOR_MEASURE", "SENSOR_COMPARE",
        "VIRTUAL_SENSOR_MEASURE", "VIRTUAL_SENSOR_COMPARE",
        "ADVANCED_SENSORS_MEASURE", "ADVANCED_SENSORS_COMPARE",
        "FACES_POSITION", "FACES_POSITION_COMPARE",
        "FACES_NAME", "COMPARE_FACES_NAME",
        "TELEPHONY_MEASURE", "TELEPHONY_COMPARE",
        "CHATGPT_COMPARE",
        // Display readers
        "READ_LED", "READ_SSEGMENT",
        // Storage / file getters
        "READ_FILE", "READ_DB", "KEY_EXISTS",
        // Graph helpers
        "GET_GRAPH_TRENDLINE"
    ]);

    // ------------------------------------------------------------------------
    // CAP_BLOCKS — block keys that have a STATEMENT-INPUT slot at the top of
    // their body but NO "next" connector at the bottom (i.e. they terminate
    // a vertical chain). Children attach via `pos: 'nested'` into the body —
    // never via `pos: 'next'` (no notch to chain onto).
    //
    // When the LLM emits `pos: 'next'` with one of these as the parent, the
    // agent silently rewrites it to `pos: 'nested'` so the child actually
    // snaps instead of free-floating below the cap.
    // ------------------------------------------------------------------------
    const CAP_BLOCKS = new Set([
        "INITIATE",          // on start
        "START_BLOCK",       // run task1 — also a cap on this build
    ]);

    // Derived from Robo-Phone GUI block definitions:
    // - blocks-ui/virtual_actions.js
    // - blocks-ui/text.js
    // - blocks-ui/extra_blocks.js
    // - my-blockly/extensions.js
    const EXTENDED_LED_COLOR_MAP = {
        red: "0",
        yellow: "1",
        green: "2",
        blue: "3",
        plug: "-1",
    };

    const BLOCK_TYPE_ALIASES = {
        INITIATE: "initiate_block",
        START_BLOCK: "start_block",
        VAR_GET: "variables_get",
        VAR_SET: "variables_set",
        VARIABLES_GET: "variables_get",
        VARIABLES_SET: "variables_set",
        VAR_CHANGE: "math_change",
        MY_TEXT: "my_text",
        LOGIC_TEXT_COMPARE: "logic_text_compare",
    };

    const GUI_BLOCK_METADATA = {
        INITIATE: {
            blockType: "initiate_block",
            kind: "statement",
            categoryPath: ["CATLOOPS"],
            statementInput: "DO",
        },
        START_BLOCK: {
            blockType: "start_block",
            kind: "statement",
            categoryPath: ["CATLOOPS"],
            statementInput: "DO",
            fields: {
                task_name: { fieldName: "task_name", kind: "dropdown", role: "task_name" },
            },
        },
        LCD_MESSAGE: {
            blockType: "lcd_message",
            kind: "statement",
            categoryPath: ["CATSMARTPHONE", "CATVIRTUALACTION"],
            valueInputs: {
                text: { inputName: "TextInput", literalKind: "text", role: "text" },
            },
            valueInputOrder: ["TextInput"],
            fields: {
                color: {
                    fieldName: "Color",
                    kind: "dropdown",
                    role: "color",
                    optionMap: EXTENDED_LED_COLOR_MAP,
                },
            },
        },
        KEY1_BUTTON: {
            blockType: "key1_button",
            kind: "statement",
            categoryPath: ["CATSMARTPHONE", "CATVIRTUALSENSORS"],
            valueInputs: {
                text: { inputName: "TextInput", literalKind: "text", role: "text" },
            },
            valueInputOrder: ["TextInput"],
        },
        RESET_GRAPH: {
            blockType: "reset_graph",
            kind: "statement",
            categoryPath: ["CATSMARTPHONE", "CATVIRTUALACTION"],
            fields: {
                color: {
                    fieldName: "Color",
                    kind: "dropdown",
                    role: "color",
                    optionMap: EXTENDED_LED_COLOR_MAP,
                },
            },
        },
        GRAPH: {
            blockType: "graph",
            kind: "statement",
            categoryPath: ["CATSMARTPHONE", "CATVIRTUALACTION"],
            valueInputs: {
                x: { inputName: "x", literalKind: "number", role: "x" },
                y: { inputName: "y", literalKind: "number", role: "y" },
            },
            valueInputOrder: ["x", "y"],
            fields: {
                color: {
                    fieldName: "Color",
                    kind: "dropdown",
                    role: "color",
                    optionMap: EXTENDED_LED_COLOR_MAP,
                },
                clear: {
                    fieldName: "Clear",
                    kind: "checkbox",
                    role: "clear",
                },
            },
        },
        CONTROLS_FOR: {
            blockType: "controls_for",
            kind: "statement",
            categoryPath: ["CATLOOPS"],
            statementInput: "DO",
            valueInputs: {
                from: { inputName: "FROM", literalKind: "number", role: "from" },
                to: { inputName: "TO", literalKind: "number", role: "to" },
                by: { inputName: "BY", literalKind: "number", role: "by" },
            },
            valueInputOrder: ["FROM", "TO", "BY"],
            fields: {
                loop_var: { fieldName: "VAR", kind: "dropdown", role: "loop_var" },
                variable: { fieldName: "VAR", kind: "dropdown", role: "variable" },
            },
        },
        MATH_TRIG: {
            blockType: "math_trig",
            kind: "value",
            categoryPath: ["CATMATH"],
            valueInputs: {
                value: { inputName: "NUM", literalKind: "number", role: "value" },
            },
            valueInputOrder: ["NUM"],
            fields: {
                operation: { fieldName: "OP", kind: "dropdown", role: "operation" },
            },
        },
        MATH_NUMBER: {
            blockType: "math_number",
            kind: "value",
            categoryPath: ["CATMATH"],
            fields: {
                value: { fieldName: "NUM", kind: "text", role: "value" },
            },
        },
        MY_TEXT: {
            blockType: "my_text",
            kind: "value",
            categoryPath: ["CATTEXT"],
            fields: {
                text: { fieldName: "TEXT", kind: "text", role: "text" },
                value: { fieldName: "TEXT", kind: "text", role: "value" },
            },
        },
        LOGIC_BOOLEAN: {
            blockType: "logic_boolean",
            kind: "value",
            categoryPath: ["CATLOGIC"],
            fields: {
                value: {
                    fieldName: "BOOL",
                    kind: "dropdown",
                    role: "value",
                    optionMap: { true: "TRUE", false: "FALSE" },
                },
            },
        },
        VAR_GET: {
            blockType: "variables_get",
            kind: "value",
            categoryPath: ["CATVARIABLES"],
            fields: {
                variable: { fieldName: "VAR", kind: "dropdown", role: "variable" },
            },
        },
        VARIABLES_GET: {
            blockType: "variables_get",
            kind: "value",
            categoryPath: ["CATVARIABLES"],
            fields: {
                variable: { fieldName: "VAR", kind: "dropdown", role: "variable" },
            },
        },
        VAR_SET: {
            blockType: "variables_set",
            kind: "statement",
            categoryPath: ["CATVARIABLES"],
            valueInputs: {
                value: { inputName: "VALUE", literalKind: "unknown", role: "value" },
            },
            valueInputOrder: ["VALUE"],
            fields: {
                variable: { fieldName: "VAR", kind: "dropdown", role: "variable" },
            },
        },
        VARIABLES_SET: {
            blockType: "variables_set",
            kind: "statement",
            categoryPath: ["CATVARIABLES"],
            valueInputs: {
                value: { inputName: "VALUE", literalKind: "unknown", role: "value" },
            },
            valueInputOrder: ["VALUE"],
            fields: {
                variable: { fieldName: "VAR", kind: "dropdown", role: "variable" },
            },
        },
    };

    const BLOCK_RUNTIME_METADATA = {
        RESET_GRAPH: {
            field_specs: [
                { role: "color", kind: "dropdown", priority: 0 },
            ],
        },
        CONTROLS_FOR: {
            field_specs: [
                { role: "loop_var", kind: "dropdown", priority: 0 },
            ],
        },
        LCD_MESSAGE: {
            field_specs: [
                { role: "color", kind: "dropdown", priority: 0 },
            ],
        },
        GRAPH: {
            field_specs: [
                { role: "color", kind: "dropdown", priority: 0 },
                { role: "clear", kind: "checkbox", priority: 1 },
            ],
        },
        MATH_TRIG: {
            field_specs: [
                { role: "operation", kind: "dropdown", priority: 0 },
            ],
        },
        MATH_NUMBER: {
            field_specs: [
                { role: "value", kind: "text", priority: 0 },
            ],
        },
        MY_TEXT: {
            field_specs: [
                { role: "text", kind: "text", priority: 0 },
            ],
        },
        VAR_GET: {
            field_specs: [
                { role: "variable", kind: "dropdown", priority: 0 },
            ],
        },
        VARIABLES_GET: {
            field_specs: [
                { role: "variable", kind: "dropdown", priority: 0 },
            ],
        },
        VAR_SET: {
            field_specs: [
                { role: "variable", kind: "dropdown", priority: 0 },
            ],
        },
        VARIABLES_SET: {
            field_specs: [
                { role: "variable", kind: "dropdown", priority: 0 },
            ],
        },
    };

    window.BlocklyAgent = {
        BLOCK_FRAGMENTS: BLOCK_FRAGMENTS,
        VALUE_BLOCKS: VALUE_BLOCKS,
        CAP_BLOCKS: CAP_BLOCKS,
        BLOCK_TYPE_ALIASES: BLOCK_TYPE_ALIASES,
        GUI_BLOCK_METADATA: GUI_BLOCK_METADATA,
        BLOCK_RUNTIME_METADATA: BLOCK_RUNTIME_METADATA,

        // --- PUBLIC API ---

        /**
         * Clears the workspace and then executes the list of commands.
         * @param {Array} commandList - The JSON script from the LLM.
         */
        execute: async function (commandList) {
            console.log("🧹 Clearing Workspace...");
            await this.clearPage();

            console.log("📜 RECEIVED SCRIPT PAYLOAD:");
            console.log(JSON.stringify(commandList, null, 2));

            const compiled = this._compileStructuredPlan(commandList);
            if (compiled.ok) {
                console.log("🧠 Structured Blockly plan:");
                console.log(JSON.stringify(compiled.plan, null, 2));
                try {
                    return await this.executeStructured(compiled.plan, { sourceScript: commandList });
                } catch (structuredError) {
                    console.warn(`⚠️ Structured executor failed: ${structuredError.message}`);
                    console.warn("↩️ Falling back to legacy DOM executor after clearing the workspace again.");
                    await this.clearPage();
                    return await this.executeLegacy(commandList, {
                        clearBefore: false,
                        fallbackReason: structuredError.message,
                        structuredPlan: compiled.plan,
                    });
                }
            }

            console.warn(`⚠️ Structured compiler could not cover this script: ${compiled.error}`);
            console.warn("↩️ Falling back to legacy DOM executor.");
            return await this.executeLegacy(commandList, {
                clearBefore: false,
                fallbackReason: compiled.error,
                structuredPlan: compiled.plan || null,
            });
        },

        executeLegacy: async function (commandList, options = {}) {
            if (options.clearBefore) {
                console.log("🧹 Clearing Workspace for legacy executor...");
                await this.clearPage();
            }
            if (options.fallbackReason) {
                console.log(`🪂 Legacy fallback reason: ${options.fallbackReason}`);
            }

            console.log("📜 Executing Legacy DOM Script...", commandList);
            const idMap = new Map();
            // Track each logical id's BLOCK KEY so we can detect cap parents
            // and override `pos: 'next'` to `pos: 'nested'` (caps have no
            // 'next' connector — children chain into the body via 'nested').
            const idToBlockKey = new Map();
            let commandsExecuted = 0;
            let spawnedCount = 0;
            const diagnostics = [];

            const totalSteps = commandList.length;
            for (let stepIdx = 0; stepIdx < commandList.length; stepIdx++) {
                const cmd = commandList[stepIdx];
                const stepLabel = `STEP ${stepIdx + 1}/${totalSteps}`;
                // High-visibility separator + structured summary of THIS command.
                // The grouped log makes the page console scannable when stepping
                // through scripts of 20+ commands.
                console.log(`\n══════════════════════════════════════════════════════════════════════`);
                if (cmd.action === "spawn") {
                    console.log(`▶️  ${stepLabel}  SPAWN '${cmd.block}'  id='${cmd.id || "<none>"}'  parent='${cmd.parent || "<root>"}'  pos='${cmd.pos || "nested"}'  cat=${JSON.stringify(cmd.cat || [])}`);
                } else if (cmd.action === "input") {
                    console.log(`▶️  ${stepLabel}  INPUT into '${cmd.block}'  selector=${this._formatFieldSelector(cmd.field_selector, cmd.field)}  value=${JSON.stringify(cmd.value)}`);
                } else {
                    console.log(`▶️  ${stepLabel}  ${cmd.action} ${JSON.stringify(cmd)}`);
                }
                console.log(`══════════════════════════════════════════════════════════════════════`);
                try {
                    if (cmd.action === "spawn") {
                        const commandDiagnostic = {
                            step: stepIdx + 1,
                            action: "spawn",
                            block: cmd.block,
                            logicalId: cmd.id || null,
                            parentLogicalId: cmd.parent || null,
                            requestedPos: cmd.pos || "nested",
                            categoryPath: Array.isArray(cmd.cat) ? cmd.cat : [cmd.cat],
                        };
                        let parentRuntimeId = null;
                        let pos = cmd.pos || "nested";
                        if (cmd.parent) {
                            parentRuntimeId = idMap.get(cmd.parent);
                            if (!parentRuntimeId) throw new Error(`Parent '${cmd.parent}' not found.`);
                            console.log(`   resolved parent logical '${cmd.parent}' -> runtime '${parentRuntimeId}'`);
                            // Cap-block override: caps have NO 'next' connector
                            // — children can only attach via 'nested'. The LLM
                            // sometimes emits pos:'next' here anyway; rewrite
                            // so the agent uses the correct drop strategy.
                            const parentBlockKey = idToBlockKey.get(cmd.parent);
                            if (parentBlockKey && this.CAP_BLOCKS.has(parentBlockKey) && pos === "next") {
                                console.warn(`   ⚠️  parent '${cmd.parent}' is a CAP block ('${parentBlockKey}') which has no 'next' connector. Rewriting pos: 'next' → 'nested'.`);
                                pos = "nested";
                            }
                        }
                        const catPath = Array.isArray(cmd.cat) ? cmd.cat : [cmd.cat];

                        const newId = await this._spawnPhysical(
                            catPath, cmd.block, parentRuntimeId, pos, commandDiagnostic
                        );

                        if (cmd.id) {
                            idMap.set(cmd.id, newId);
                            idToBlockKey.set(cmd.id, cmd.block);
                        }
                        diagnostics.push({
                            ...commandDiagnostic,
                            status: "success",
                            runtimeId: newId,
                            finalPos: pos,
                        });
                        spawnedCount += 1;
                        commandsExecuted += 1;
                        console.log(`✅ ${stepLabel} DONE — spawned '${cmd.block}' as logical '${cmd.id || "(no id)"}' runtime='${newId}' (pos='${pos}')`);

                    } else if (cmd.action === "input") {
                        const fieldSelector = this._normalizeFieldSelector(cmd.field_selector, cmd.field);
                        const commandDiagnostic = {
                            step: stepIdx + 1,
                            action: "input",
                            logicalId: cmd.block,
                            fieldSelector,
                            targetBlockKey: cmd.target_block_key || null,
                            value: cmd.value,
                        };
                        const runtimeId = idMap.get(cmd.block);
                        if (!runtimeId) throw new Error(`Target '${cmd.block}' not found.`);
                        console.log(`   resolved target logical '${cmd.block}' -> runtime '${runtimeId}'`);
                        await this._handleInput(runtimeId, fieldSelector, cmd.value, cmd.target_block_key || idToBlockKey.get(cmd.block) || null, commandDiagnostic);
                        diagnostics.push({
                            ...commandDiagnostic,
                            status: "success",
                            runtimeId,
                        });
                        commandsExecuted += 1;
                        console.log(`✅ ${stepLabel} DONE — input '${cmd.value}' applied to '${cmd.block}'`);
                    }
                } catch (e) {
                    console.error(`❌ ${stepLabel} FAILED: ${e.message}`);
                    diagnostics.push({
                        step: stepIdx + 1,
                        action: cmd.action,
                        block: cmd.block || null,
                        logicalId: cmd.id || cmd.block || null,
                        fieldSelector: this._normalizeFieldSelector(cmd.field_selector, cmd.field),
                        status: "error",
                        errorClass: this._classifyExecutionError(e.message),
                        error: e.message,
                    });
                    return {
                        ok: false,
                        error: e.message,
                        commandsExecuted,
                        spawnedCount,
                        diagnostics,
                    };
                }
            }
            console.log("🎉 Script Complete.");
            return {
                ok: true,
                commandsExecuted,
                spawnedCount,
                diagnostics,
            };
        },

        _compileStructuredPlan: function (commandList) {
            const plan = {
                blocks: [],
                connections: [],
                field_sets: [],
                literal_inputs: [],
                visual_actions: [],
                operations: [],
            };
            const knownIds = new Set();
            const idToBlockKey = new Map();

            for (const cmd of commandList || []) {
                if (!cmd || typeof cmd !== "object") {
                    return { ok: false, error: "Script contains a non-object command.", plan };
                }

                if (cmd.action === "spawn") {
                    const blockKey = String(cmd.block || "").trim();
                    const logicalId = String(cmd.id || "").trim();
                    if (!blockKey || !logicalId) {
                        return { ok: false, error: "Structured compiler requires each spawn to have block and id.", plan };
                    }
                    const blockType = this._resolveBlocklyTypeForKey(blockKey);
                    if (!blockType) {
                        return { ok: false, error: `No Blockly type mapping found for '${blockKey}'.`, plan };
                    }
                    let requestedPos = cmd.pos || "nested";
                    if (cmd.parent && this.CAP_BLOCKS.has(idToBlockKey.get(cmd.parent)) && requestedPos === "next") {
                        requestedPos = "nested";
                    }
                    const attachmentKind = !cmd.parent
                        ? "root"
                        : (this.VALUE_BLOCKS.has(blockKey)
                            ? "value_nested"
                            : (requestedPos === "next" ? "statement_next" : "statement_nested"));
                    const categoryPath = Array.isArray(cmd.cat) ? cmd.cat : [cmd.cat].filter(Boolean);

                    plan.blocks.push({
                        logical_id: logicalId,
                        block_key: blockKey,
                        block_type: blockType,
                        category_path: categoryPath,
                    });
                    plan.operations.push({
                        kind: "create_block",
                        logical_id: logicalId,
                        block_key: blockKey,
                        block_type: blockType,
                        category_path: categoryPath,
                        attachment_kind: attachmentKind,
                        parent_id: cmd.parent || null,
                        requested_pos: requestedPos,
                    });
                    plan.visual_actions.push({
                        kind: "open_category",
                        category_path: categoryPath,
                        block_key: blockKey,
                        logical_id: logicalId,
                    });

                    if (cmd.parent) {
                        const parentKey = idToBlockKey.get(cmd.parent) || null;
                        const parentMeta = this._getStructuredBlockMeta(parentKey);
                        const connectionKind = attachmentKind === "value_nested"
                            ? "value"
                            : (attachmentKind === "statement_next" ? "next" : "statement");
                        const connection = {
                            parent_id: cmd.parent,
                            child_id: logicalId,
                            connection_kind: connectionKind,
                        };
                        if (connectionKind === "statement" && parentMeta?.statementInput) {
                            connection.input_name = parentMeta.statementInput;
                        }
                        plan.connections.push(connection);
                        plan.operations.push({
                            kind: "connect_block",
                            ...connection,
                        });
                    }

                    knownIds.add(logicalId);
                    idToBlockKey.set(logicalId, blockKey);
                    continue;
                }

                if (cmd.action === "input") {
                    const targetId = String(cmd.block || "").trim();
                    if (!targetId || !knownIds.has(targetId)) {
                        return { ok: false, error: `Input target '${cmd.block}' has not been spawned yet.`, plan };
                    }
                    const selector = this._normalizeFieldSelector(cmd.field_selector, cmd.field);
                    if (!selector) {
                        return { ok: false, error: `Input for '${targetId}' is missing a usable field selector.`, plan };
                    }
                    const targetBlockKey = cmd.target_block_key || idToBlockKey.get(targetId) || null;
                    const staticBinding = this._resolveStaticStructuredInputBinding(targetBlockKey, selector);
                    if (staticBinding?.kind === "field") {
                        plan.field_sets.push({
                            target_id: targetId,
                            field_name: staticBinding.fieldName,
                            value: String(cmd.value ?? ""),
                        });
                    } else if (staticBinding?.kind === "literal_input") {
                        plan.literal_inputs.push({
                            target_id: targetId,
                            input_name: staticBinding.inputName,
                            literal_kind: staticBinding.literalKind,
                            value: String(cmd.value ?? ""),
                        });
                    }
                    plan.operations.push({
                        kind: "apply_input",
                        target_id: targetId,
                        target_block_key: targetBlockKey,
                        field_selector: selector,
                        value: String(cmd.value ?? ""),
                    });
                    plan.visual_actions.push({
                        kind: "show_field_update",
                        logical_id: targetId,
                        target_block_key: targetBlockKey,
                        field_selector: selector,
                        value: String(cmd.value ?? ""),
                    });
                    continue;
                }

                return { ok: false, error: `Unsupported action '${cmd.action}' in structured compiler.`, plan };
            }

            return { ok: true, plan };
        },

        _resolveBlocklyTypeForKey: function (blockKey) {
            const Blockly = window.Blockly;
            if (!Blockly?.Blocks) return null;
            const alias = this.BLOCK_TYPE_ALIASES?.[blockKey];
            if (alias && Blockly.Blocks[alias]) return alias;
            const lowered = String(blockKey || "").trim().toLowerCase();
            if (lowered && Blockly.Blocks[lowered]) return lowered;
            return alias || (lowered && Blockly.Blocks?.[lowered] ? lowered : null);
        },

        _getStructuredBlockMeta: function (blockKey) {
            if (!blockKey) return null;
            return this.GUI_BLOCK_METADATA?.[blockKey] || null;
        },

        _resolveStaticStructuredInputBinding: function (blockKey, selector) {
            const meta = this._getStructuredBlockMeta(blockKey);
            if (!meta || !selector) return null;
            if (selector.role && meta.valueInputs?.[selector.role]) {
                const entry = meta.valueInputs[selector.role];
                return {
                    kind: "literal_input",
                    inputName: entry.inputName,
                    literalKind: entry.literalKind,
                };
            }
            if (selector.role && meta.fields?.[selector.role]) {
                const entry = meta.fields[selector.role];
                return {
                    kind: "field",
                    fieldName: entry.fieldName,
                    fieldKind: entry.kind,
                    optionMap: entry.optionMap || null,
                };
            }
            if (selector.kind === "text") {
                const firstValueInput = Object.values(meta.valueInputs || {})[0];
                if (firstValueInput) {
                    return {
                        kind: "literal_input",
                        inputName: firstValueInput.inputName,
                        literalKind: firstValueInput.literalKind,
                    };
                }
            }
            const firstField = Object.values(meta.fields || {}).find((field) => !selector.kind || field.kind === selector.kind);
            if (firstField) {
                return {
                    kind: "field",
                    fieldName: firstField.fieldName,
                    fieldKind: firstField.kind,
                    optionMap: firstField.optionMap || null,
                };
            }
            return null;
        },

        executeStructured: async function (plan, options = {}) {
            const workspace = this._resolveBlocklyWorkspace();
            if (!workspace) {
                throw new Error("Could not locate a Blockly workspace for structured execution.");
            }

            const logicalBlocks = new Map();
            const diagnostics = [];
            let commandsExecuted = 0;
            let spawnedCount = 0;
            let rootIndex = 0;

            for (let index = 0; index < (plan.operations || []).length; index++) {
                const op = plan.operations[index];
                try {
                    if (op.kind === "create_block") {
                        await this._playTeachingCreateVisual(op, logicalBlocks);
                        const block = workspace.newBlock(op.block_type);
                        logicalBlocks.set(op.logical_id, block);
                        if (op.attachment_kind === "root") {
                            this._ensureBlocklyBlockRendered(block);
                            this._positionRootBlock(block, workspace, rootIndex++);
                            await this._wait(60);
                            await this._flashBlockDomById(block.id);
                        }
                        spawnedCount += 1;
                        diagnostics.push({
                            step: index + 1,
                            operation: op.kind,
                            logicalId: op.logical_id,
                            blockType: op.block_type,
                            categoryPath: op.category_path,
                            status: "success",
                        });
                        continue;
                    }

                    if (op.kind === "connect_block") {
                        const parentBlock = logicalBlocks.get(op.parent_id);
                        const childBlock = logicalBlocks.get(op.child_id);
                        if (!parentBlock || !childBlock) {
                            throw new Error(`Structured connect references missing block(s): parent=${op.parent_id} child=${op.child_id}`);
                        }
                        this._connectStructuredBlocks(parentBlock, childBlock, op);
                        this._ensureBlocklyBlockRendered(parentBlock);
                        this._ensureBlocklyBlockRendered(childBlock);
                        parentBlock.render?.();
                        childBlock.render?.();
                        await this._wait(80);
                        await this._flashBlockDomById(childBlock.id);
                        diagnostics.push({
                            step: index + 1,
                            operation: op.kind,
                            parentId: op.parent_id,
                            childId: op.child_id,
                            connectionKind: op.connection_kind,
                            inputName: op.input_name || null,
                            status: "success",
                        });
                        commandsExecuted += 1;
                        continue;
                    }

                    if (op.kind === "apply_input") {
                        const targetBlock = logicalBlocks.get(op.target_id);
                        if (!targetBlock) {
                            throw new Error(`Structured input target '${op.target_id}' not found.`);
                        }
                        const resolved = this._resolveStructuredInputAction(targetBlock, op.target_block_key, op.field_selector, op.value);
                        if (!resolved) {
                            throw new Error(`Could not resolve structured input for '${op.target_id}' with selector ${this._formatFieldSelector(op.field_selector)}.`);
                        }
                        if (resolved.kind === "field") {
                            this._setStructuredField(targetBlock, resolved, op.value);
                        } else if (resolved.kind === "literal_input") {
                            await this._setStructuredLiteralInput(targetBlock, op.target_block_key, resolved, op.value);
                        } else {
                            throw new Error(`Unsupported structured input resolution kind '${resolved.kind}'.`);
                        }
                        await this._showStructuredFieldUpdateVisual(targetBlock, resolved, op.value);
                        diagnostics.push({
                            step: index + 1,
                            operation: op.kind,
                            targetId: op.target_id,
                            targetBlockKey: op.target_block_key || null,
                            resolvedKind: resolved.kind,
                            fieldName: resolved.fieldName || null,
                            inputName: resolved.inputName || null,
                            value: op.value,
                            status: "success",
                        });
                        commandsExecuted += 1;
                        continue;
                    }

                    throw new Error(`Unknown structured operation '${op.kind}'.`);
                } catch (error) {
                    diagnostics.push({
                        step: index + 1,
                        operation: op.kind,
                        status: "error",
                        errorClass: this._classifyExecutionError(error.message),
                        error: error.message,
                    });
                    error.structuredDiagnostics = diagnostics;
                    throw error;
                }
            }

            console.log("🎉 Structured Blockly execution complete.");
            return {
                ok: true,
                commandsExecuted: commandsExecuted || Number(options.sourceScript?.length || 0),
                spawnedCount,
                diagnostics,
                executionMode: "structured",
            };
        },

        _resolveBlocklyWorkspace: function () {
            return window.Blockly?.getMainWorkspace?.() || window.foundWorkspace || null;
        },

        _ensureBlocklyBlockRendered: function (block) {
            if (!block) return;
            if (typeof block.initSvg === "function" && !block.getSvgRoot?.()) {
                block.initSvg();
            }
            if (typeof block.render === "function") {
                block.render();
            }
        },

        _positionRootBlock: function (block, workspace, rootIndex) {
            const metrics = workspace.getMetrics?.() || {};
            const baseX = Number.isFinite(metrics.viewLeft) ? metrics.viewLeft + 80 : 80;
            const baseY = Number.isFinite(metrics.viewTop) ? metrics.viewTop + 80 : 80;
            const targetX = baseX;
            const targetY = baseY + (rootIndex * 160);
            const currentXY = block.getRelativeToSurfaceXY?.() || { x: 0, y: 0 };
            if (typeof block.moveBy === "function") {
                block.moveBy(targetX - currentXY.x, targetY - currentXY.y);
            }
        },

        _connectStructuredBlocks: function (parentBlock, childBlock, op) {
            if (op.connection_kind === "next") {
                let tail = parentBlock;
                while (typeof tail.getNextBlock === "function" && tail.getNextBlock()) {
                    tail = tail.getNextBlock();
                }
                if (!tail.nextConnection || !childBlock.previousConnection) {
                    throw new Error(`Cannot chain '${childBlock.type}' after '${tail.type}'.`);
                }
                tail.nextConnection.connect(childBlock.previousConnection);
                return;
            }

            if (op.connection_kind === "statement") {
                const inputName = op.input_name || this._resolveStatementInputName(parentBlock);
                if (!inputName) {
                    throw new Error(`No statement input found on parent '${parentBlock.type}'.`);
                }
                const input = parentBlock.getInput(inputName);
                if (!input?.connection || !childBlock.previousConnection) {
                    throw new Error(`Statement connection '${inputName}' is unavailable on '${parentBlock.type}'.`);
                }
                const existing = input.connection.targetBlock?.();
                if (existing) {
                    let tail = existing;
                    while (typeof tail.getNextBlock === "function" && tail.getNextBlock()) {
                        tail = tail.getNextBlock();
                    }
                    if (!tail.nextConnection) {
                        throw new Error(`Statement input '${inputName}' on '${parentBlock.type}' is already occupied and cannot chain further.`);
                    }
                    tail.nextConnection.connect(childBlock.previousConnection);
                } else {
                    input.connection.connect(childBlock.previousConnection);
                }
                return;
            }

            if (op.connection_kind === "value") {
                const inputName = op.input_name || this._resolveAvailableValueInputName(parentBlock, op.child_id);
                if (!inputName) {
                    throw new Error(`No value input found on parent '${parentBlock.type}' for child '${childBlock.type}'.`);
                }
                const input = parentBlock.getInput(inputName);
                if (!input?.connection || !childBlock.outputConnection) {
                    throw new Error(`Value connection '${inputName}' is unavailable on '${parentBlock.type}'.`);
                }
                this._clearExistingValueInputConnection(input.connection);
                input.connection.connect(childBlock.outputConnection);
                return;
            }

            throw new Error(`Unsupported structured connection kind '${op.connection_kind}'.`);
        },

        _resolveStatementInputName: function (block) {
            const inputList = Array.isArray(block?.inputList) ? block.inputList : [];
            const statementType = window.Blockly?.NEXT_STATEMENT;
            const candidate = inputList.find((input) => input?.type === statementType && input?.connection);
            return candidate?.name || null;
        },

        _resolveAvailableValueInputName: function (block, childLogicalId = null) {
            const blockKey = this._getBlockKeyFromBlocklyType(block.type);
            const meta = this._getStructuredBlockMeta(blockKey);
            const preferredNames = Array.isArray(meta?.valueInputOrder) ? meta.valueInputOrder : [];
            for (const inputName of preferredNames) {
                const input = block.getInput?.(inputName);
                if (input?.connection) {
                    const existing = input.connection.targetBlock?.();
                    if (!existing || existing.isShadow?.()) {
                        return inputName;
                    }
                }
            }
            const valueType = window.Blockly?.INPUT_VALUE;
            const inputList = Array.isArray(block?.inputList) ? block.inputList : [];
            const candidates = inputList.filter((input) => input?.type === valueType && input?.connection);
            const empty = candidates.find((input) => {
                const existing = input.connection.targetBlock?.();
                return !existing || existing.isShadow?.();
            });
            return empty?.name || candidates[0]?.name || null;
        },

        _clearExistingValueInputConnection: function (connection) {
            const existing = connection?.targetBlock?.();
            if (!existing) return;
            try {
                existing.dispose(false, true);
            } catch (_) {
                try {
                    existing.unplug?.(true);
                } catch (_) {}
            }
        },

        _resolveStructuredInputAction: function (targetBlock, targetBlockKey, selector, value) {
            const meta = this._getStructuredBlockMeta(targetBlockKey);
            if (meta && selector?.role && meta.valueInputs?.[selector.role]) {
                const entry = meta.valueInputs[selector.role];
                return {
                    kind: "literal_input",
                    inputName: entry.inputName,
                    literalKind: entry.literalKind,
                    role: selector.role,
                };
            }
            if (meta && selector?.role && meta.fields?.[selector.role]) {
                const entry = meta.fields[selector.role];
                return {
                    kind: "field",
                    fieldName: entry.fieldName,
                    fieldKind: entry.kind,
                    optionMap: entry.optionMap || null,
                    role: selector.role,
                };
            }

            const targetDom = this._findBlocklyBlockDomById(targetBlock.id);
            if (targetDom) {
                const runtimeFields = this._resolveRuntimeFields(targetDom, targetBlockKey);
                const chosenField = this._chooseResolvedField(runtimeFields, selector);
                if (chosenField?.label) {
                    return {
                        kind: "field",
                        fieldName: chosenField.label,
                        fieldKind: chosenField.kind,
                        role: chosenField.role || selector?.role || null,
                    };
                }
            }

            const inputName = this._resolveStructuredLiteralInputName(targetBlock, meta, selector);
            if (inputName) {
                return {
                    kind: "literal_input",
                    inputName,
                    literalKind: this._inferLiteralKind(selector, value, meta, inputName),
                    role: selector?.role || null,
                };
            }
            return null;
        },

        _resolveStructuredLiteralInputName: function (targetBlock, meta, selector) {
            if (meta && selector?.role && meta.valueInputs?.[selector.role]) {
                return meta.valueInputs[selector.role].inputName;
            }
            const roleAliases = {
                text: ["TextInput", "TEXT", "VALUE", "URLInput"],
                from: ["FROM"],
                to: ["TO"],
                by: ["BY"],
                x: ["x"],
                y: ["y"],
                value: ["VALUE", "NUM"],
                threshold: ["threshold"],
            };
            const preferredNames = selector?.role ? (roleAliases[selector.role] || []) : [];
            for (const inputName of preferredNames) {
                const input = targetBlock.getInput?.(inputName);
                if (input?.connection) return inputName;
            }
            return this._resolveAvailableValueInputName(targetBlock);
        },

        _inferLiteralKind: function (selector, value, meta, inputName) {
            if (meta) {
                const valueInput = Object.values(meta.valueInputs || {}).find((entry) => entry.inputName === inputName);
                if (valueInput?.literalKind && valueInput.literalKind !== "unknown") {
                    return valueInput.literalKind;
                }
            }
            const normalized = String(value || "").trim().toLowerCase();
            if (selector?.kind === "checkbox" || normalized === "true" || normalized === "false") {
                return "boolean";
            }
            if (selector?.role && ["from", "to", "by", "x", "y", "threshold", "min", "max", "rate", "seconds", "offset", "line", "row", "column"].includes(selector.role)) {
                return "number";
            }
            if (/^-?\d+(\.\d+)?$/.test(normalized)) {
                return "number";
            }
            return "text";
        },

        _setStructuredField: function (targetBlock, resolved, rawValue) {
            const field = targetBlock.getField?.(resolved.fieldName);
            if (!field) {
                throw new Error(`Field '${resolved.fieldName}' not found on '${targetBlock.type}'.`);
            }
            const finalValue = this._resolveBlocklyFieldValue(field, rawValue, resolved.optionMap, resolved.fieldKind);
            targetBlock.setFieldValue(String(finalValue), resolved.fieldName);
            this._ensureBlocklyBlockRendered(targetBlock);
            targetBlock.render?.();
        },

        _resolveBlocklyFieldValue: function (field, rawValue, optionMap = null, fieldKind = null) {
            const normalized = String(rawValue ?? "").trim();
            const normalizedLower = normalized.toLowerCase();
            if (optionMap && optionMap[normalizedLower] !== undefined) {
                return optionMap[normalizedLower];
            }
            if (fieldKind === "checkbox" || /checkbox/i.test(field?.constructor?.name || "")) {
                return ["true", "1", "yes", "checked", "on"].includes(normalizedLower) ? "TRUE" : "FALSE";
            }
            if (typeof field?.getOptions === "function") {
                try {
                    const options = field.getOptions();
                    for (const option of options || []) {
                        const label = option?.[0];
                        const value = option?.[1];
                        const normalizedLabel = this._normalizeBlocklyOptionLabel(label);
                        if (normalizedLabel && normalizedLabel === normalizedLower) return value;
                        if (String(value).toLowerCase() === normalizedLower) return value;
                    }
                } catch (_) {}
            }
            return normalized;
        },

        _normalizeBlocklyOptionLabel: function (label) {
            if (typeof label === "string") {
                return this._normalizePaletteValue(label) || label.toLowerCase().trim();
            }
            if (label && typeof label === "object") {
                if (typeof label.alt === "string") {
                    const byAlt = this._normalizePaletteValue(label.alt);
                    if (byAlt) return byAlt;
                }
                if (typeof label.src === "string") {
                    const bySrc = this._normalizePaletteValueFromImageSource(label.src);
                    if (bySrc) return bySrc;
                }
            }
            return null;
        },

        _setStructuredLiteralInput: async function (targetBlock, targetBlockKey, resolved, rawValue) {
            await this._playTeachingLiteralVisual(targetBlock, resolved, rawValue);
            const input = targetBlock.getInput?.(resolved.inputName);
            if (!input?.connection) {
                throw new Error(`Input '${resolved.inputName}' not found on '${targetBlock.type}'.`);
            }
            this._clearExistingValueInputConnection(input.connection);
            const literalBlock = this._createLiteralBlock(targetBlock.workspace, resolved.literalKind, rawValue);
            this._ensureBlocklyBlockRendered(literalBlock);
            if (!literalBlock.outputConnection) {
                throw new Error(`Literal block '${literalBlock.type}' has no output connection.`);
            }
            input.connection.connect(literalBlock.outputConnection);
            this._ensureBlocklyBlockRendered(targetBlock);
            targetBlock.render?.();
            literalBlock.render?.();
            await this._wait(60);
            await this._flashBlockDomById(literalBlock.id);
        },

        _createLiteralBlock: function (workspace, literalKind, rawValue) {
            const kind = literalKind || "text";
            let type = "my_text";
            let fieldName = "TEXT";
            let fieldValue = String(rawValue ?? "");

            if (kind === "number") {
                type = "math_number";
                fieldName = "NUM";
            } else if (kind === "boolean") {
                type = "logic_boolean";
                fieldName = "BOOL";
                fieldValue = ["true", "1", "yes", "checked", "on"].includes(fieldValue.trim().toLowerCase()) ? "TRUE" : "FALSE";
            } else if (kind === "variable") {
                type = "variables_get";
                fieldName = "VAR";
            }

            const block = workspace.newBlock(type);
            try {
                block.setShadow?.(false);
            } catch (_) {}
            if (fieldName && typeof block.setFieldValue === "function") {
                block.setFieldValue(String(fieldValue), fieldName);
            }
            return block;
        },

        _getBlockKeyFromBlocklyType: function (blockType) {
            if (!blockType) return null;
            for (const [blockKey, aliasType] of Object.entries(this.BLOCK_TYPE_ALIASES || {})) {
                if (aliasType === blockType) return blockKey;
            }
            const direct = String(blockType).toUpperCase();
            if (this.GUI_BLOCK_METADATA?.[direct]) return direct;
            return null;
        },

        _findBlocklyBlockDomById: function (blockId) {
            if (!blockId) return null;
            const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function"
                ? CSS.escape(blockId)
                : String(blockId).replace(/"/g, '\\"');
            return document.querySelector(`g[data-id="${escaped}"], g[data-llm-id="${escaped}"]`);
        },

        _playTeachingCreateVisual: async function (op, logicalBlocks) {
            try {
                if (Array.isArray(op.category_path) && op.category_path.length > 0) {
                    await this._navigatePath(op.category_path);
                }
                const source = this._findVisualSourceBlock(op.block_key);
                const target = this._resolveTeachingTargetPoint(op, logicalBlocks);
                if (source && target) {
                    await this._animateTeachingGhost(source, target, op.block_key);
                }
            } catch (e) {
                console.warn("[BlocklyAgent] visual create mirror skipped:", e.message);
            }
        },

        _playTeachingLiteralVisual: async function (targetBlock, resolved, rawValue) {
            try {
                const sourceKey = resolved.literalKind === "number"
                    ? "MATH_NUMBER"
                    : (resolved.literalKind === "boolean" ? "LOGIC_BOOLEAN" : "MY_TEXT");
                const meta = this._getStructuredBlockMeta(sourceKey);
                if (meta?.categoryPath) {
                    await this._navigatePath(meta.categoryPath);
                }
                const source = this._findVisualSourceBlock(sourceKey);
                const target = this._resolveLiteralTeachingTargetPoint(targetBlock, resolved.inputName);
                if (source && target) {
                    await this._animateTeachingGhost(source, target, `${sourceKey}:${rawValue}`);
                }
            } catch (e) {
                console.warn("[BlocklyAgent] literal visual mirror skipped:", e.message);
            }
        },

        _showStructuredFieldUpdateVisual: async function (targetBlock, resolved, value) {
            const dom = this._findBlocklyBlockDomById(targetBlock.id);
            if (!dom) return;
            await this._flashVisualElement(dom.querySelector("path.blocklyPath") || dom, value);
        },

        _findVisualSourceBlock: function (blockKey) {
            const fragments = this.BLOCK_FRAGMENTS?.[blockKey];
            if (Array.isArray(fragments) && fragments.length > 0) {
                return this._huntForBlock(fragments);
            }
            const label = this._getLabel(blockKey);
            return this._huntForBlock(label);
        },

        _resolveTeachingTargetPoint: function (op, logicalBlocks) {
            if (op.attachment_kind === "root") {
                const workspaceSvg = document.querySelector(".blocklySvg:not(.blocklyFlyout)");
                const rect = workspaceSvg?.getBoundingClientRect?.();
                if (rect) {
                    return { x: rect.left + 140, y: rect.top + 120 };
                }
                return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            }
            const parentBlock = logicalBlocks.get(op.parent_id);
            const parentDom = parentBlock ? this._findBlocklyBlockDomById(parentBlock.id) : null;
            if (!parentDom) return null;
            const parentRect = this._getParentVisualRect(parentDom);
            if (!parentRect) return null;
            if (op.attachment_kind === "statement_next") {
                return { x: parentRect.left + 40, y: parentRect.bottom + 18 };
            }
            if (op.attachment_kind === "value_nested") {
                const shadows = this._findValueSocketShadows(parentDom, parentRect);
                if (shadows[0]) {
                    return {
                        x: shadows[0].left + shadows[0].width / 2,
                        y: shadows[0].top + shadows[0].height / 2,
                    };
                }
                return { x: parentRect.left + 120, y: parentRect.top + parentRect.height / 2 };
            }
            return { x: parentRect.left + 40, y: parentRect.top + parentRect.height / 2 };
        },

        _resolveLiteralTeachingTargetPoint: function (targetBlock, inputName) {
            const targetDom = this._findBlocklyBlockDomById(targetBlock.id);
            if (!targetDom) return null;
            const targetRect = this._getParentVisualRect(targetDom) || targetDom.getBoundingClientRect();
            const shadows = this._findValueSocketShadows(targetDom, targetRect);
            const preferredInput = targetBlock.getInput?.(inputName);
            if (preferredInput?.connection?.targetBlock?.()) {
                const childDom = this._findBlocklyBlockDomById(preferredInput.connection.targetBlock().id);
                const childRect = childDom?.getBoundingClientRect?.();
                if (childRect) {
                    return {
                        x: childRect.left + childRect.width / 2,
                        y: childRect.top + childRect.height / 2,
                    };
                }
            }
            if (shadows[0]) {
                return {
                    x: shadows[0].left + shadows[0].width / 2,
                    y: shadows[0].top + shadows[0].height / 2,
                };
            }
            return { x: targetRect.left + 110, y: targetRect.top + targetRect.height / 2 };
        },

        _animateTeachingGhost: async function (sourceElement, targetPoint, label) {
            const sourceRect = sourceElement.getBoundingClientRect();
            const ghost = document.createElement("div");
            ghost.textContent = this._extractVisualGhostLabel(sourceElement) || label || "";
            ghost.style.position = "fixed";
            ghost.style.left = `${Math.round(sourceRect.left)}px`;
            ghost.style.top = `${Math.round(sourceRect.top)}px`;
            ghost.style.width = `${Math.max(48, Math.round(sourceRect.width))}px`;
            ghost.style.height = `${Math.max(26, Math.round(sourceRect.height))}px`;
            ghost.style.padding = "4px 8px";
            ghost.style.borderRadius = "10px";
            ghost.style.background = "rgba(59, 130, 246, 0.12)";
            ghost.style.border = "2px solid rgba(59, 130, 246, 0.55)";
            ghost.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.18)";
            ghost.style.color = "#0f172a";
            ghost.style.font = "600 12px/1.2 system-ui, sans-serif";
            ghost.style.display = "flex";
            ghost.style.alignItems = "center";
            ghost.style.justifyContent = "center";
            ghost.style.pointerEvents = "none";
            ghost.style.zIndex = "2147483647";
            ghost.style.transformOrigin = "center center";
            document.body.appendChild(ghost);

            const startX = sourceRect.left;
            const startY = sourceRect.top;
            const endX = targetPoint.x - (sourceRect.width / 2);
            const endY = targetPoint.y - (sourceRect.height / 2);
            const durationMs = 420;
            const startedAt = performance.now();

            await new Promise((resolve) => {
                const step = (now) => {
                    const t = Math.min(1, (now - startedAt) / durationMs);
                    const eased = 1 - Math.pow(1 - t, 3);
                    const currentX = startX + ((endX - startX) * eased);
                    const currentY = startY + ((endY - startY) * eased);
                    ghost.style.transform = `translate(${Math.round(currentX - startX)}px, ${Math.round(currentY - startY)}px) scale(${1 - (0.08 * t)})`;
                    ghost.style.opacity = String(1 - (0.22 * t));
                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        resolve();
                    }
                };
                requestAnimationFrame(step);
            });

            ghost.remove();
            await this._wait(40);
        },

        _extractVisualGhostLabel: function (element) {
            const texts = Array.from(element.querySelectorAll("text.blocklyText"))
                .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
                .filter(Boolean);
            return texts.join(" ").trim();
        },

        _flashBlockDomById: async function (blockId) {
            const dom = this._findBlocklyBlockDomById(blockId);
            if (!dom) return;
            await this._flashVisualElement(dom.querySelector("path.blocklyPath") || dom);
        },

        _flashVisualElement: async function (element, label = "") {
            if (!element) return;
            const previousTransition = element.style.transition;
            const previousFilter = element.style.filter;
            const previousStroke = element.style.stroke;
            const previousStrokeWidth = element.style.strokeWidth;
            element.style.transition = "filter 120ms ease, stroke 120ms ease, stroke-width 120ms ease";
            element.style.filter = "drop-shadow(0 0 10px rgba(59, 130, 246, 0.55)) brightness(1.05)";
            element.style.stroke = "#3b82f6";
            element.style.strokeWidth = "3px";
            if (label) console.log(`✨ Visual update: ${label}`);
            await this._wait(220);
            element.style.filter = previousFilter;
            element.style.stroke = previousStroke;
            element.style.strokeWidth = previousStrokeWidth;
            element.style.transition = previousTransition;
        },

        // --- UTILITIES ---

        clearPage: async function () {
            try {
                // 1. Click Trash Icon
                const clearBtn = document.querySelector('[aria-label="Clear Workspace"]');
                if (clearBtn) {
                    clearBtn.click();
                    await this._wait(500); // Wait for modal

                    // 2. Click Confirm (SweetAlert2)
                    const confirmBtn = document.querySelector(".swal2-confirm.swal2-styled");
                    if (confirmBtn) {
                        confirmBtn.click();
                        await this._wait(1200); // Wait for deletion animation
                    }
                }
            } catch (e) {
                console.warn("Clear Page failed or was unnecessary:", e);
            }
            // After a clear, the toolbox can be left with a stale "selected" state
            // where the flyout is empty/hidden but the row still reports selected.
            // Force the next category open so the flyout is guaranteed populated.
            this._postClearForceFirst = true;
            console.log("✓ Page Cleared.");
        },

        // --- PHYSICS ENGINE ---

        _spawnPhysical: async function (catPath, blockKey, parentId, positionType, diagnostic = null) {
            try {
                return await this._spawnPhysicalImpl(catPath, blockKey, parentId, positionType, diagnostic);
            } catch (e) {
                // Append the underlying JS stack trace so the user can see
                // exactly which expression triggered the error (e.g. which
                // property access on null). The original error message was
                // being surfaced without the trace, leaving the source line
                // ambiguous.
                const stack = (e && e.stack) ? e.stack.split('\n').slice(0, 8).join(' | ') : "(no stack)";
                const wrapped = new Error(`${e.message || e} @ stack: ${stack}`);
                wrapped.stack = e.stack;
                throw wrapped;
            }
        },
        _spawnPhysicalImpl: async function (catPath, blockKey, parentId, positionType, diagnostic = null) {
            // 1. SNAPSHOT
            const preScan = this._scanInternal();
            const preIds = new Set(preScan.map(b => b.id));
            console.log(`🤖 Before placing '${blockKey}', I can see ${preScan.length} block(s) already on the workspace.`);

            // 2. NAVIGATE
            console.log(`📂 Opening category path: ${catPath.join(" > ")}`);
            await this._navigatePath(catPath);

            // 3. SEARCH
            // Prefer the canonical fragment fingerprint when we have one — it
            // resolves to a unique flyout block in one exact match. Fall back
            // to Msg-derived search phrase only for keys not in the table.
            const fragments = this.BLOCK_FRAGMENTS[blockKey];
            let searchCanonical, logLabel;
            if (Array.isArray(fragments) && fragments.length > 0) {
                searchCanonical = fragments;
                logLabel = JSON.stringify(fragments);
            } else {
                let rawLabel = this._getLabel(blockKey);
                let searchPhrase = rawLabel.split(/%[0-9]/)[0].trim();
                if (!searchPhrase) searchPhrase = rawLabel.replace(/%[0-9]/g, ' ').replace(/\s+/g, ' ').trim();
                searchCanonical = searchPhrase;
                logLabel = `'${searchPhrase}'`;
            }
            console.log(`🔎 Looking for ${logLabel} (block key: '${blockKey}').`);

            let blockNode = this._huntForBlock(searchCanonical);
            console.log(blockNode
                ? `✅ Found ${logLabel} in the flyout.`
                : `⚠️ Could not find ${logLabel} in the flyout on the first try.`);

            // RETRY MECHANISM — _openCategoryTab matches by visible TREE LABEL,
            // not Msg key, so we must resolve the leaf cat key first. Passing
            // 'CATVIRTUALACTION' directly fails because no toolbox label
            // contains that string.
            if (!blockNode) {
                const lastCatKey = catPath[catPath.length - 1];
                const lastCatLabel = this._getLabel(lastCatKey) || lastCatKey;
                console.warn(`🔁 Retrying by reopening the category '${lastCatLabel}' (key '${lastCatKey}').`);
                await this._openCategoryTab(lastCatLabel, true); // Force Click
                blockNode = this._huntForBlock(searchCanonical);
            }

            // RUNTIME DISCOVERY FALLBACK — if BLOCK_FRAGMENTS doesn't match
            // anything in the live flyout (label drift, language change, new
            // block variant), try to find a visible flyout block by matching
            // tokens derived from the block key itself. This is best-effort:
            // it prefers blocks whose text.blocklyText set covers the most
            // tokens, with a minimum threshold to avoid wrong matches.
            if (!blockNode) {
                console.warn(`🔁 Falling back to runtime discovery for blockKey='${blockKey}'.`);
                blockNode = this._discoverBlockByKey(blockKey);
            }

            if (!blockNode) throw new Error(`Visual block ${logLabel} not found.`);

            // 4. COORDINATES
            const rect = blockNode.getBoundingClientRect();
            const startX = rect.left + 20;
            const startY = rect.top + 15;

            // ----- Compute candidate drop points -----
            // We pick drop coordinates based on BOTH the child's shape (value
            // vs statement block) AND the parent's geometry / unfilled sockets.
            //
            //  - VALUE BLOCKS plug into VALUE SOCKETS — inline puzzle-piece
            //    holes that render at mid-height across the parent's body.
            //    On this build, unfilled value sockets are shown as inline
            //    shadow blocks (text "0", "true", "{textVariable}", etc.).
            //    The best drop point is the centre of an unfilled shadow.
            //
            //  - STATEMENT BLOCKS plug into STATEMENT-INPUT slots — the C-shape
            //    body of caps/containers, at the BOTTOM-LEFT INTERIOR of the
            //    parent. The Zelos statement-input connector snap-radius
            //    centres around (left+20, slot-top).
            //
            //  - pos: 'next' chains a statement BELOW its parent.
            const childIsValue = this.VALUE_BLOCKS.has(blockKey);
            // dropStrategies: array of FUNCTIONS taking the current pRect and
            // returning {x, y, label}. We recompute coordinates per iteration
            // because the workspace can scroll between attempts (flyout reopens
            // after undo etc.). Pre-computed absolute coords go stale fast.
            const dropStrategies = [];
            let parentNode = null, pRect = null;
            if (parentId) {
                parentNode = document.querySelector(`g[data-llm-id="${parentId}"]`);
                if (!parentNode) throw new Error(`Parent DOM node ${parentId} missing.`);
                pRect = this._getParentVisualRect(parentNode);
                const fullRect = parentNode.getBoundingClientRect();
                console.log(`   parent visual bbox (path-based): x=${Math.round(pRect.left)} y=${Math.round(pRect.top)} w=${Math.round(pRect.width)} h=${Math.round(pRect.height)}`);
                if (Math.abs(fullRect.height - pRect.height) > 10) {
                    console.log(`   (full <g> bbox was h=${Math.round(fullRect.height)} — descendants/orphans inflated it; using path-based instead)`);
                }

                if (positionType === "nested") {
                    if (childIsValue) {
                        // Re-detect shadow value sockets on each attempt so we
                        // adapt to layout shifts.
                        dropStrategies.push((cur) => {
                            const shadows = this._findValueSocketShadows(parentNode, cur);
                            return shadows.map((sr, idx) => ({
                                x: sr.left + sr.width / 2,
                                y: sr.top + sr.height / 2,
                                label: `shadow socket #${idx} @ (${Math.round(sr.left)},${Math.round(sr.top)})`,
                            }));
                        });
                        // Dense absolute-pixel X sweep. Step every ~35 px from
                        // (left + 30) to (right - 20), at the parent's mid-Y.
                        // Absolute steps cover the actual value-socket positions
                        // far better than percentage fractions on wide parents.
                        dropStrategies.push((cur) => {
                            const midY = cur.top + cur.height / 2;
                            const candidates = [];
                            for (let dx = 30; dx < cur.width - 20; dx += 35) {
                                candidates.push({
                                    x: cur.left + dx,
                                    y: midY,
                                    label: `value sweep x=left+${dx}`,
                                });
                            }
                            return candidates;
                        });
                    } else {
                        // STATEMENT-BLOCK NESTED INTO STATEMENT-INPUT SLOT
                        // ════════════════════════════════════════════════════
                        // EXACT LOGIC (per user spec):
                        //   1. Read parent's current bounding rect: left, top, height
                        //   2. Primary drop point = (left + 30, top + height/2)
                        //      — i.e. a few pixels right of the parent's top-left,
                        //        vertically centred inside the parent.
                        //   3. If that miss-snaps, try a small set of variations
                        //      around the same point (±10 px in Y, ±20 px in X).
                        //
                        // The bounding rect comes from the parent's <g> element
                        // (parentNode.getBoundingClientRect()) — which IS what the
                        // user means by "measure the start's height and top left":
                        // the visible block as you see it on screen, including any
                        // child blocks already attached.
                        //
                        // For an EMPTY parent (first nested child), the bbox is
                        // just the cap, and the midpoint sits inside the C-shape
                        // body where the statement-input connector lives.
                        //
                        // For a parent with ONE child already nested, the bbox
                        // extends downward to wrap that child. The midpoint shifts
                        // accordingly — landing below the existing child, which is
                        // where the NEW child snaps as "next" in the body chain.
                        // ════════════════════════════════════════════════════
                        dropStrategies.push((cur) => {
                            // Read FRESH bbox from the <g> at the moment of this
                            // attempt — captures any growth from prior children.
                            const r = parentNode.getBoundingClientRect();
                            const midY = r.top + r.height / 2;
                            const px = r.left + 30;
                            console.log(`   📐 USER FORMULA → parent left=${Math.round(r.left)} top=${Math.round(r.top)} height=${Math.round(r.height)}  →  drop at (${Math.round(px)}, ${Math.round(midY)})  i.e. (left+30, top+height/2)`);
                            return [
                                { x: px,      y: midY,      label: "USER FORMULA: (left+30, top+h/2)" },
                                { x: px,      y: midY - 10, label: "USER FORMULA: y - 10" },
                                { x: px,      y: midY + 10, label: "USER FORMULA: y + 10" },
                                { x: px,      y: midY - 20, label: "USER FORMULA: y - 20" },
                                { x: px,      y: midY + 20, label: "USER FORMULA: y + 20" },
                                { x: px + 10, y: midY,      label: "USER FORMULA: x + 10" },
                                { x: px - 5,  y: midY,      label: "USER FORMULA: x - 5" },
                                { x: r.left + 50, y: midY,  label: "USER FORMULA: left+50" },
                            ];
                        });
                    }
                } else if (positionType === "next") {
                    dropStrategies.push((cur) => [
                        { x: cur.left + 20, y: cur.bottom + 10, label: "just below parent" },
                        { x: cur.left + 20, y: cur.bottom + 20, label: "lower below parent" },
                    ]);
                }
            } else {
                dropStrategies.push(() => {
                    const ws = document.querySelector(".blocklySvg:not(.blocklyFlyout)");
                    if (!ws) {
                        console.warn("workspace SVG (.blocklySvg:not(.blocklyFlyout)) not found — falling back to viewport center.");
                        return [{
                            x: Math.round(window.innerWidth / 2),
                            y: Math.round(window.innerHeight / 2),
                            label: "viewport center (workspace SVG missing)"
                        }];
                    }
                    const wsRect = ws.getBoundingClientRect();
                    return [{ x: wsRect.left + wsRect.width / 2, y: wsRect.top + wsRect.height / 2, label: "workspace center" }];
                });
            }
            // Resolve total candidate count for the log (one-time, using current pRect)
            const previewCount = dropStrategies.reduce((s, fn) => s + fn(pRect || { left: 0, top: 0, width: 0, height: 0, bottom: 0, right: 0 }).length, 0);
            console.log(`   childIsValue=${childIsValue}, up to ${previewCount} drop candidate(s) (recomputed per attempt).`);

            // Flatten strategies into a sequential list of "candidate generators",
            // each returning ONE candidate when called with current pRect.
            // We re-invoke the generator before each drag so coords are fresh.
            const dropCandidates = [];
            for (const strategy of dropStrategies) {
                const initialCands = strategy(pRect);
                for (let i = 0; i < initialCands.length; i++) {
                    // Each closure captures (strategy, i) to re-extract its
                    // candidate from a fresh pRect at drag time.
                    dropCandidates.push({
                        generate: (cur) => {
                            const list = strategy(cur);
                            return list[i] || null;
                        },
                    });
                }
            }

            // ----- Attempt drops, verify nesting/next, retry with next candidate on miss -----
            let newBlock = null;
            let usedDrop = null;
            let attempt = 0;
            for (const candGen of dropCandidates) {
                attempt++;
                // Health-check the source flyout block. Blockly sometimes
                // collapses the flyout after an undo, leaving the block
                // reference with a (0,0,0,0) bbox. When that happens we
                // re-open the leaf category and re-find the block before
                // dragging — otherwise the drag starts from the screen corner.
                let freshRect = blockNode.getBoundingClientRect();
                if (freshRect.width === 0 || freshRect.height === 0) {
                    console.warn(`   flyout block has zero bbox — re-opening category and re-finding it.`);
                    if (catPath && catPath.length > 0) {
                        const leafKey = catPath[catPath.length - 1];
                        const leafLabel = this._getLabel(leafKey) || leafKey;
                        await this._openCategoryTab(leafLabel, true);
                        await this._wait(600);
                    }
                    const refreshed = this._huntForBlock(searchCanonical);
                    if (!refreshed) {
                        console.warn(`   could not re-find flyout block after category reopen — aborting retry loop.`);
                        break;
                    }
                    blockNode = refreshed;
                    freshRect = blockNode.getBoundingClientRect();
                }
                // Refresh pRect AGAIN here (after any category reopen above)
                // so the strategy gets the CURRENT parent position.
                if (parentNode) {
                    pRect = this._getParentVisualRect(parentNode);
                }
                // Compute this attempt's target from the lazy generator using
                // the current pRect. If the generator returns null (e.g.
                // out-of-range shadow index) skip the attempt.
                const cand = candGen.generate(pRect);
                if (!cand) {
                    console.log(`   strategy generator returned null; skipping this slot.`);
                    continue;
                }
                const sx = freshRect.left + 20, sy = freshRect.top + 15;
                // Verbose pre-drag log so failed attempts are diagnosable
                // without guessing what the live geometry was at the time.
                // Guarded — pRect is null for root-level spawns (no parent).
                console.log(`🖱️ Drag attempt ${attempt}/${dropCandidates.length} of ${logLabel}`);
                if (pRect) {
                    console.log(`     parent: top=${Math.round(pRect.top)} bottom=${Math.round(pRect.bottom)} left=${Math.round(pRect.left)} right=${Math.round(pRect.right)} (h=${Math.round(pRect.height)})`);
                    console.log(`     drop:   (${Math.round(cand.x)}, ${Math.round(cand.y)}) [${cand.label}]    relative: x=parent.left+${Math.round(cand.x - pRect.left)}  y=parent.top+${Math.round(cand.y - pRect.top)}  y=parent.bottom${cand.y - pRect.bottom >= 0 ? '+' : ''}${Math.round(cand.y - pRect.bottom)}`);
                } else {
                    console.log(`     parent: <root-level spawn — no parent>`);
                    console.log(`     drop:   (${Math.round(cand.x)}, ${Math.round(cand.y)}) [${cand.label}]`);
                }
                console.log(`     source: (${Math.round(sx)}, ${Math.round(sy)})  (flyout block top-left + 20,15)`);
                if (diagnostic) {
                    diagnostic.dropAttempt = attempt;
                    diagnostic.dropTarget = {
                        x: Math.round(cand.x),
                        y: Math.round(cand.y),
                        label: cand.label,
                    };
                }
                await this._visualizeDrag(sx, sy, cand.x, cand.y, blockNode);

                // Detect new block
                let postScan = [];
                let cand_newBlock = null;
                for (let t = 0; t < 4 && !cand_newBlock; t++) {
                    if (t > 0) await this._wait(250);
                    postScan = this._scanInternal();
                    cand_newBlock = postScan.find(b => !preIds.has(b.id));
                }
                if (!cand_newBlock) {
                    console.warn(`   no new block detected with this drop; retrying with next candidate if any.`);
                    continue;
                }
                // Log where the new block actually landed so the user can see
                // whether the cursor coords mapped to a sensible block position.
                const cand_newDom = document.querySelector(`g[data-llm-id="${cand_newBlock.id}"]`);
                if (cand_newDom) {
                    const r = cand_newDom.getBoundingClientRect();
                    console.log(`     ↳ new block landed at top=${Math.round(r.top)} left=${Math.round(r.left)} (h=${Math.round(r.height)}, w=${Math.round(r.width)})`);
                }

                // Verify proper attachment via parent-bbox-grew check.
                //
                // When a child block SNAPS to a parent (nested into a
                // statement-input slot OR chained as 'next'), Blockly grows
                // the parent's outer <g> to wrap the child. The parent's
                // getBoundingClientRect() height increases by at least the
                // child's height. When the child FREE-FLOATS (snap missed),
                // the parent bbox is unchanged and the child sits as a
                // separate sibling block, typically BELOW the parent.
                //
                // This is more reliable than checking parentNode.contains(newDom)
                // because some Blockly builds keep all blocks as siblings
                // under .blocklyBlockCanvas regardless of attachment state.
                // Give Blockly's re-render a moment to finish before measuring.
                // A snap fires its layout update asynchronously; checking the
                // parent's bbox immediately after pointerup can race the redraw
                // and miss the growth signal entirely.
                await this._wait(500);
                const newDom = document.querySelector(`g[data-llm-id="${cand_newBlock.id}"]`);
                const pRectAfter = parentNode ? this._getParentVisualRect(parentNode) : null;
                const cRect = newDom ? newDom.getBoundingClientRect() : null;
                let attachmentOk = true;
                let attachmentNote = "";
                if (parentId && parentNode && newDom && pRectAfter && cRect) {
                    const dHeight = pRectAfter.height - pRect.height;
                    const dWidth  = pRectAfter.right - pRect.right;
                    const relation = this._getBlocklyAttachmentRelation(parentNode, newDom);
                    const apiAttached = relation.kind !== "unknown" && relation.attached;
                    // STRICT verification — only accept the snap when the parent's
                    // own path geometry has grown to wrap the new child. Free-
                    // floating drops produce ZERO growth even when the child
                    // happens to land touching the parent's bottom edge.
                    // Previously a position-based fallback let those false
                    // positives through, which is why the user kept seeing the
                    // block placed BELOW the cap with verification reporting
                    // "attached" and skipping the retry.
                    const parentGrew = dHeight >= 2 || dWidth >= 2;
                    if (positionType === "nested") {
                        attachmentOk = apiAttached || parentGrew;
                        attachmentNote = attachmentOk
                            ? `✅ attached — ${apiAttached ? `Blockly API relation=${relation.kind}` : `parent path grew (Δh=${Math.round(dHeight)}, Δw=${Math.round(dWidth)})`}`
                            : `⚠️ NOT attached — parent path unchanged (Δh=${Math.round(dHeight)}), relation=${relation.kind}. Child at top=${Math.round(cRect.top)} vs parentOrigBottom=${Math.round(pRect.bottom)}. Will retry.`;
                    } else if (positionType === "next") {
                        // Strict — a chained 'next' MUST cause the parent's
                        // path to grow. The old `closeBelow` fallback (child
                        // touching parent's bottom edge) was accepting drops
                        // onto cap blocks (which have no 'next' connector) as
                        // success, leading to the "block floats below cap" bug.
                        attachmentOk = (apiAttached && relation.kind === "next") || parentGrew;
                        attachmentNote = attachmentOk
                            ? `✅ child is chained next to parent (${apiAttached ? `Blockly API relation=${relation.kind}` : `Δh=${Math.round(dHeight)}`})`
                            : `⚠️ child NOT chained — parent path unchanged (Δh=${Math.round(dHeight)}), relation=${relation.kind}. Will retry.`;
                    }
                    if (diagnostic) {
                        diagnostic.attachmentCheck = {
                            parentGrew,
                            relation: relation.kind,
                            relationAttached: relation.attached,
                            deltaHeight: Math.round(dHeight),
                            deltaWidth: Math.round(dWidth),
                            accepted: attachmentOk,
                        };
                    }
                }
                console.log(`   ${attachmentNote || "no attachment check"}; new block id=${cand_newBlock.id}.`);
                if (attachmentOk) {
                    newBlock = cand_newBlock;
                    usedDrop = cand;
                    break;
                }
                // Attachment failed: free-floating block was placed at the wrong
                // position. We CAN'T just delete the DOM — Blockly still has
                // internal state pointing at the block, and the next click on
                // the workspace throws "Cannot read properties of null (reading 'id')"
                // from BlockSvg.select. Instead, simulate Ctrl/Cmd+Z so Blockly
                // properly undoes its own action AND we get a fresh flyout block
                // for the next attempt.
                console.warn(`   attempting targeted cleanup for detached block before undo.`);
                const cleaned = await this._cleanupDetachedBlock(newDom);
                if (!cleaned) {
                    console.warn(`   targeted cleanup unavailable; undoing free-float via Blockly undo (Ctrl/Cmd+Z).`);
                    await this._undoLastBlocklyAction();
                }
                // Ctrl+Z on this build often hides/rebuilds the flyout — the
                // flyout block we had a reference to becomes zero-bbox. Force-
                // reopen the leaf category so the flyout is freshly rendered
                // and the next iteration can re-find a usable source block.
                if (catPath && catPath.length > 0) {
                    const leafKey = catPath[catPath.length - 1];
                    const leafLabel = this._getLabel(leafKey) || leafKey;
                    await this._openCategoryTab(leafLabel, true);
                    await this._wait(500);
                }
                const refreshed = this._huntForBlock(searchCanonical);
                if (refreshed) blockNode = refreshed;
                // Re-snapshot preIds so the next attempt's diff is correct.
                const recheck = this._scanInternal();
                preIds.clear();
                recheck.forEach(b => preIds.add(b.id));
                // Refresh parent bbox: undo may have shrunk the parent back
                // to its pre-drop size. We need an accurate baseline for the
                // next attempt's grew-vs-unchanged check. Use path-based
                // geometry so orphan free-floats don't inflate the size.
                if (parentNode) {
                    pRect = this._getParentVisualRect(parentNode);
                    console.log(`   parent visual bbox AFTER undo+flyout-reopen: h=${Math.round(pRect.height)}`);
                }
            }

            if (!newBlock) {
                throw new Error(`Drag of '${blockKey}' produced no properly-attached workspace block after ${dropCandidates.length} drop attempt(s).`);
            }
            console.log(`✅ New block placed via drop '${usedDrop?.label}'. runtime id='${newBlock.id}'.`);
            return newBlock.id;
        },

        _handleInput: async function (blockId, fieldSelector, value, targetBlockKey = null, diagnostic = null) {
            // Coerce to string up-front. Without this, a missing `value` from
            // the LLM crashes deep inside dropdown matching ("Cannot read
            // properties of undefined (reading 'toLowerCase')").
            if (value === undefined || value === null) {
                throw new Error(`Input command for block '${blockId}' has no value.`);
            }
            value = String(value);

            const block = document.querySelector(`g[data-llm-id="${blockId}"]`);
            if (!block) throw new Error("Block element missing.");

            const normalizedSelector = this._normalizeFieldSelector(fieldSelector);
            if (!normalizedSelector) {
                throw new Error(`Input for '${blockId}' is missing a usable field selector.`);
            }
            const resolvedFields = this._resolveRuntimeFields(block, targetBlockKey);
            const chosenField = this._chooseResolvedField(resolvedFields, normalizedSelector);
            if (!chosenField) {
                throw new Error(`Could not resolve a field on '${blockId}' for selector ${this._formatFieldSelector(normalizedSelector)}.`);
            }
            if (diagnostic) {
                diagnostic.availableFields = resolvedFields.map((field) => ({
                    index: field.index,
                    kind: field.kind,
                    text: field.text,
                    role: field.role || null,
                }));
                diagnostic.resolvedField = {
                    index: chosenField.index,
                    kind: chosenField.kind,
                    text: chosenField.text,
                    role: chosenField.role || null,
                };
            }
            console.log(`   resolved selector ${this._formatFieldSelector(normalizedSelector)} -> field index=${chosenField.index} kind=${chosenField.kind} role=${chosenField.role || "<none>"} text=${JSON.stringify(chosenField.text)}`);

            // 2. Click to Open Widget
            const fieldRect = chosenField.rect;
            const clickX = fieldRect.left + (fieldRect.width / 2);
            const clickY = fieldRect.top + (fieldRect.height / 2);

            console.log(`🖱️ Clicking field at ${Math.round(clickX)},${Math.round(clickY)}`);
            this._fire('pointerdown', clickX, clickY, chosenField.group);
            this._fire('pointerup', clickX, clickY, chosenField.group);
            await this._wait(600);

            // 3. Detect Widget Type
            const inputWidget = document.querySelector('.blocklyHtmlInput');
            const dropdownWidget = document.querySelector('.blocklyDropDownContent, .blocklyDropdownMenu');
            const visibleMenuItems = this._getVisibleDropdownItems();

            if (inputWidget) {
                // --- CASE A: TEXT INPUT ---
                console.log(`⌨️ Typing "${value}" into text field...`);
                inputWidget.value = value;
                inputWidget.dispatchEvent(new Event('input', { bubbles: true }));
                await this._wait(100);
                inputWidget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                await this._wait(300);

            } else if (dropdownWidget || visibleMenuItems.length > 0) {
                // --- CASE B: DROPDOWN MENU ---
                console.log(`🔽 Selecting "${value}" from dropdown...`);

                // Find all menu items
                const items = visibleMenuItems;
                let targetItem = items.find(item => {
                    const textContent = item.textContent.toLowerCase().trim();
                    return textContent === value.toLowerCase().trim();
                });

                // If not found by text, try Image Alt Text (e.g. for icons)
                if (!targetItem) {
                    targetItem = items.find(item => {
                        const img = item.querySelector('img');
                        return img && img.alt && img.alt.toLowerCase() === value.toLowerCase();
                    });
                }

                if (!targetItem) {
                    const requestedValue = String(value).toLowerCase().trim();
                    targetItem = items.find((item) => {
                        const img = item.querySelector('img');
                        const normalizedFromSrc = this._normalizePaletteValueFromImageSource(img?.src);
                        return normalizedFromSrc === requestedValue;
                    });
                }

                if (targetItem) {
                    targetItem.click();
                    await this._wait(300);
                } else {
                    const paletteCandidates = this._resolvePaletteCandidates(dropdownWidget, items);
                    const requestedValue = String(value).toLowerCase().trim();
                    const paletteMatch = paletteCandidates.find((candidate) => candidate.kind === "value_cell" && candidate.value === requestedValue);
                    if (paletteMatch) {
                        console.log(`🎨 Selecting palette value "${value}" via inferred candidate ${paletteMatch.debugLabel}`);
                        if (diagnostic) {
                            diagnostic.dropdownWidgetType = "palette_dropdown";
                            diagnostic.paletteCandidates = paletteCandidates.map((candidate) => ({
                                kind: candidate.kind,
                                value: candidate.value || null,
                                debugLabel: candidate.debugLabel,
                            }));
                            diagnostic.paletteSelection = {
                                value: paletteMatch.value,
                                debugLabel: paletteMatch.debugLabel,
                            };
                        }
                        paletteMatch.element.click();
                        await this._wait(300);
                    } else {
                        console.warn(`⚠️ Option '${value}' not found in dropdown. Available: ${items.map(i => i.textContent.trim()).join(", ")}`);
                        if (diagnostic) {
                            diagnostic.dropdownWidgetType = paletteCandidates.length > 0 ? "palette_dropdown" : "text_dropdown";
                            diagnostic.dropdownOptions = items.map((i) => i.textContent.trim());
                            diagnostic.paletteCandidates = paletteCandidates.map((candidate) => ({
                                kind: candidate.kind,
                                value: candidate.value || null,
                                debugLabel: candidate.debugLabel,
                            }));
                        }
                        // Close menu by clicking elsewhere
                        this._fire('pointerdown', 0, 0, document.body);
                        this._fire('pointerup', 0, 0, document.body);
                        if (paletteCandidates.length > 0) {
                            throw new Error(`Palette option '${value}' not found.`);
                        }
                        throw new Error(`Dropdown option '${value}' not found.`);
                    }
                }

            } else {
                throw new Error("Input widget failed to open (No Input or Dropdown detected).");
            }
        },
        _normalizeFieldSelector: function (fieldSelector, legacyField = null) {
            const out = {};
            if (fieldSelector && typeof fieldSelector === "object") {
                if (typeof fieldSelector.role === "string" && fieldSelector.role.trim()) out.role = fieldSelector.role.trim();
                if (Number.isInteger(fieldSelector.index) && fieldSelector.index >= 0) out.index = fieldSelector.index;
                if (typeof fieldSelector.label === "string" && fieldSelector.label.trim()) out.label = fieldSelector.label.trim();
                if (["text", "dropdown", "checkbox", "unknown"].includes(fieldSelector.kind)) out.kind = fieldSelector.kind;
            }
            if (!Number.isInteger(out.index) && Number.isInteger(legacyField) && legacyField >= 0) {
                out.index = legacyField;
            }
            return Object.keys(out).length > 0 ? out : null;
        },
        _formatFieldSelector: function (fieldSelector, legacyField = null) {
            const selector = this._normalizeFieldSelector(fieldSelector, legacyField);
            if (!selector) return "<missing>";
            return JSON.stringify(selector);
        },
        _resolveRuntimeFields: function (block, blockKey = null) {
            const runtimeFields = [];
            const blocklyBlock = this._getBlocklyBlockFromDom(block);
            if (blocklyBlock && Array.isArray(blocklyBlock.inputList)) {
                let apiIndex = 0;
                for (const input of blocklyBlock.inputList) {
                    const fieldRow = Array.isArray(input?.fieldRow) ? input.fieldRow : [];
                    for (const field of fieldRow) {
                        if (!this._isEditableBlocklyField(field)) continue;
                        const group = this._getFieldGroupFromBlocklyField(field, block);
                        if (!group) continue;
                        const rect = group.getBoundingClientRect();
                        if (rect.width <= 0 || rect.height <= 0) continue;
                        runtimeFields.push({
                            index: apiIndex,
                            group,
                            rect,
                            text: this._getBlocklyFieldText(field, group),
                            kind: this._detectRuntimeFieldKind(field, group),
                            label: field?.name || null,
                        });
                        apiIndex += 1;
                    }
                }
            }
            if (runtimeFields.length === 0) {
                const fallbackGroups = this._resolveEditableFields(block);
                fallbackGroups.forEach((group, index) => {
                    const rect = group.getBoundingClientRect();
                    runtimeFields.push({
                        index,
                        group,
                        rect,
                        text: (group.textContent || "").trim(),
                        kind: this._detectRuntimeFieldKind(null, group),
                        label: null,
                    });
                });
            }
            this._assignMetadataRoles(runtimeFields, blockKey);
            return runtimeFields;
        },
        _assignMetadataRoles: function (runtimeFields, blockKey) {
            const fieldSpecs = Array.isArray(this.BLOCK_RUNTIME_METADATA?.[blockKey]?.field_specs)
                ? [...this.BLOCK_RUNTIME_METADATA[blockKey].field_specs].sort((a, b) => (a.priority || 0) - (b.priority || 0))
                : [];
            if (fieldSpecs.length === 0) return runtimeFields;
            const unassigned = new Set(runtimeFields.map((field) => field.index));
            for (const spec of fieldSpecs) {
                let chosen = runtimeFields.find((field) => unassigned.has(field.index) && spec.kind && field.kind === spec.kind);
                if (!chosen && Array.isArray(spec.labels) && spec.labels.length > 0) {
                    const wanted = spec.labels.map((label) => label.toLowerCase());
                    chosen = runtimeFields.find((field) => unassigned.has(field.index) && wanted.includes((field.text || "").toLowerCase()));
                }
                if (!chosen) {
                    chosen = runtimeFields.find((field) => unassigned.has(field.index));
                }
                if (!chosen) continue;
                chosen.role = spec.role;
                chosen.metadataKind = spec.kind || null;
                unassigned.delete(chosen.index);
            }
            return runtimeFields;
        },
        _chooseResolvedField: function (runtimeFields, selector) {
            if (!Array.isArray(runtimeFields) || runtimeFields.length === 0) return null;
            const scored = runtimeFields.map((field) => ({
                field,
                score: this._scoreResolvedField(field, selector),
            })).sort((a, b) => b.score - a.score || a.field.index - b.field.index);
            if (scored[0] && scored[0].score > 0) {
                return scored[0].field;
            }
            if (Number.isInteger(selector?.index)) {
                const byIndex = runtimeFields.find((field) => field.index === selector.index);
                if (byIndex) return byIndex;
            }
            return null;
        },
        _scoreResolvedField: function (field, selector) {
            if (!selector) return -1;
            let score = 0;
            if (selector.role) {
                if (field.role === selector.role) score += 8;
                else score -= 4;
            }
            if (selector.kind) {
                if (field.kind === selector.kind) score += 4;
                else score -= 2;
            }
            if (selector.label) {
                const candidateText = `${field.text || ""} ${field.label || ""}`.toLowerCase();
                const wanted = selector.label.toLowerCase();
                if (candidateText === wanted) score += 3;
                else if (candidateText.includes(wanted)) score += 1;
                else score -= 1;
            }
            if (Number.isInteger(selector.index) && field.index === selector.index) {
                score += 1;
            }
            return score;
        },
        _resolveEditableFields: function (block) {
            const sortable = [];
            for (const group of Array.from(block.querySelectorAll('g'))) {
                const owner = group.closest('g.blocklyDraggable');
                if (owner !== block) continue;
                const rect = group.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) continue;
                const hasText = group.querySelector('text') != null;
                const isEditable = group.classList.contains('blocklyEditableText')
                    || group.classList.contains('blocklyEditableField')
                    || group.getAttribute('role') === 'button';
                const hasDropdownArrow = group.querySelector(':scope > image') != null
                    || (group.getAttribute('class') || '').toLowerCase().includes('dropdown');
                if (!hasText && !hasDropdownArrow && !isEditable) continue;
                sortable.push({ group, rect });
            }
            sortable.sort((a, b) => {
                const yDiff = Math.abs(a.rect.top - b.rect.top);
                if (yDiff > 8) return a.rect.top - b.rect.top;
                return a.rect.left - b.rect.left;
            });
            const unique = [];
            const seen = new Set();
            for (const item of sortable) {
                const key = `${Math.round(item.rect.left)}_${Math.round(item.rect.top)}_${Math.round(item.rect.width)}_${Math.round(item.rect.height)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                unique.push(item.group);
            }
            return unique;
        },
        _isEditableBlocklyField: function (field) {
            if (!field || typeof field !== "object") return false;
            if (field.EDITABLE === true) return true;
            if (typeof field.showEditor_ === "function") return true;
            const ctorName = field.constructor?.name || "";
            return /Dropdown|TextInput|NumberInput|Checkbox/i.test(ctorName);
        },
        _getFieldGroupFromBlocklyField: function (field, fallbackBlock) {
            const direct = field?.fieldGroup_ || field?.getClickTarget_?.() || field?.getSvgRoot?.();
            if (direct instanceof SVGGElement) return direct;
            if (direct instanceof SVGElement) return direct.closest('g') || direct;
            const targetNode = direct && direct.nodeType === 1 ? direct : null;
            if (targetNode) return targetNode.closest('g') || targetNode;
            if (typeof field?.name === "string" && field.name) {
                const attrMatch = fallbackBlock.querySelector(`[data-name="${CSS.escape(field.name)}"]`);
                if (attrMatch) return attrMatch.closest('g') || attrMatch;
            }
            return null;
        },
        _getBlocklyFieldText: function (field, group) {
            if (typeof field?.getText === "function") {
                try {
                    return String(field.getText() || "").trim();
                } catch (_) {}
            }
            return (group?.textContent || "").trim();
        },
        _detectRuntimeFieldKind: function (field, group) {
            const ctorName = field?.constructor?.name || "";
            const className = String(group?.getAttribute?.("class") || "").toLowerCase();
            if (/dropdown/i.test(ctorName) || className.includes("dropdown") || group?.querySelector(':scope > image')) {
                return "dropdown";
            }
            if (/checkbox/i.test(ctorName)) {
                return "checkbox";
            }
            if (/textinput|numberinput/i.test(ctorName)) {
                return "text";
            }
            if (group?.classList?.contains('blocklyEditableText') || group?.classList?.contains('blocklyEditableField')) {
                return "text";
            }
            return "unknown";
        },
        _getVisibleDropdownItems: function () {
            return Array.from(document.querySelectorAll('.blocklyMenuItem, .goog-menuitem')).filter((element) => {
                const rect = element.getBoundingClientRect?.();
                if (!rect) return false;
                if (rect.width < 8 || rect.height < 8) return false;
                const style = window.getComputedStyle(element);
                if (style.visibility === 'hidden' || style.display === 'none') return false;
                return true;
            });
        },
        _resolvePaletteCandidates: function (dropdownWidget, visibleMenuItems = null) {
            const raw = [
                ...(Array.isArray(visibleMenuItems) ? visibleMenuItems : []),
                ...Array.from((dropdownWidget || document).querySelectorAll([
                    '[role="button"]',
                    '.goog-menuitem',
                    '.blocklyMenuItem',
                    'g',
                    'button',
                    'td',
                    'div',
                ].join(', '))),
            ];
            const candidates = [];
            const seen = new Set();
            for (const element of raw) {
                if (!element || element === dropdownWidget) continue;
                const rect = element.getBoundingClientRect();
                if (rect.width < 12 || rect.height < 12) continue;
                if (!this._isPaletteLeafCandidate(element, dropdownWidget)) continue;
                const inference = this._inferPaletteCandidate(element);
                if (!inference) continue;
                const key = `${Math.round(rect.left)}_${Math.round(rect.top)}_${Math.round(rect.width)}_${Math.round(rect.height)}_${inference.kind}_${inference.value || "none"}`;
                if (seen.has(key)) continue;
                seen.add(key);
                candidates.push({
                    element,
                    rect,
                    ...inference,
                });
            }
            candidates.sort((a, b) => {
                const yDiff = Math.abs(a.rect.top - b.rect.top);
                if (yDiff > 8) return a.rect.top - b.rect.top;
                return a.rect.left - b.rect.left;
            });
            return candidates;
        },
        _isPaletteLeafCandidate: function (element, dropdownWidget) {
            const rect = element.getBoundingClientRect();
            if (rect.width < 12 || rect.height < 12) return false;
            const tagName = String(element.tagName || "").toLowerCase();
            if (element.matches?.('.blocklyMenuItem, .goog-menuitem')) return true;
            const hasDirectVisual = !!(
                element.querySelector(':scope > svg, :scope > img, :scope > rect, :scope > path, :scope > circle')
                || element.style?.backgroundColor
                || element.getAttribute?.('fill')
            );
            const directChildren = Array.from(element.children || []);
            const hasLargeNestedCandidate = directChildren.some((child) => {
                const childRect = child.getBoundingClientRect?.();
                if (!childRect) return false;
                return childRect.width >= rect.width - 6 && childRect.height >= rect.height - 6;
            });
            if (tagName === "g" && !hasDirectVisual) return false;
            if (hasLargeNestedCandidate && !hasDirectVisual) return false;
            if (dropdownWidget && !dropdownWidget.contains(element) && !element.matches?.('.blocklyMenuItem, .goog-menuitem')) return false;
            return true;
        },
        _inferPaletteCandidate: function (element) {
            const explicitText = (element.textContent || "").trim().toLowerCase();
            if (explicitText) {
                const normalizedText = this._normalizePaletteValue(explicitText);
                if (normalizedText) {
                    return {
                        kind: "value_cell",
                        value: normalizedText,
                        debugLabel: `text:${normalizedText}`,
                    };
                }
            }
            const img = element.querySelector('img');
            const imgAlt = (img?.alt || "").trim().toLowerCase();
            if (imgAlt) {
                const normalizedAlt = this._normalizePaletteValue(imgAlt);
                if (normalizedAlt) {
                    return {
                        kind: "value_cell",
                        value: normalizedAlt,
                        debugLabel: `alt:${normalizedAlt}`,
                    };
                }
                if (/(custom|edit|picker|tool|more)/i.test(imgAlt)) {
                    return {
                        kind: "launcher_cell",
                        value: null,
                        debugLabel: `launcher-alt:${imgAlt}`,
                    };
                }
            }
            const normalizedImageSource = this._normalizePaletteValueFromImageSource(img?.src);
            if (normalizedImageSource) {
                return {
                    kind: "value_cell",
                    value: normalizedImageSource,
                    debugLabel: `img-src:${normalizedImageSource}`,
                };
            }
            if (img?.src && /(?:^|\/)(plug|custom|picker|tool|edit)\.png(?:$|\?)/i.test(img.src)) {
                return {
                    kind: "launcher_cell",
                    value: null,
                    debugLabel: `launcher-src:${img.src.split('/').pop()}`,
                };
            }
            const dominantColor = this._extractDominantColor(element);
            const normalizedColor = dominantColor ? this._normalizePaletteColor(dominantColor) : null;
            if (normalizedColor) {
                return {
                    kind: "value_cell",
                    value: normalizedColor,
                    debugLabel: `swatch:${normalizedColor}`,
                };
            }
            return {
                kind: "launcher_cell",
                value: null,
                debugLabel: "launcher-or-unknown",
            };
        },
        _extractDominantColor: function (element) {
            const samples = [];
            const pushColor = (rawColor, areaWeight = 1) => {
                const parsed = this._parseCssColor(rawColor);
                if (!parsed) return;
                if (parsed.alpha < 0.5) return;
                if (Math.max(parsed.r, parsed.g, parsed.b) < 24) return;
                const saturation = this._computeColorSaturation(parsed);
                const brightness = Math.max(parsed.r, parsed.g, parsed.b);
                const isNeutral = saturation < 0.18;
                if (isNeutral && brightness > 230) return;
                if (isNeutral && brightness < 70) return;
                samples.push({
                    ...parsed,
                    weight: areaWeight,
                    saturation,
                });
            };

            const rootStyle = window.getComputedStyle(element);
            pushColor(rootStyle.backgroundColor, 1);
            pushColor(rootStyle.color, 0.5);

            for (const node of Array.from(element.querySelectorAll('*'))) {
                const rect = node.getBoundingClientRect?.();
                const area = rect ? Math.max(1, rect.width * rect.height) : 1;
                const style = window.getComputedStyle(node);
                pushColor(style.backgroundColor, area);
                pushColor(style.color, area * 0.5);
                if (node instanceof SVGElement) {
                    pushColor(node.getAttribute('fill'), area);
                    pushColor(node.getAttribute('stroke'), area * 0.5);
                }
            }
            if (samples.length === 0) return null;
            samples.sort((a, b) => {
                const aScore = a.weight * (1 + a.saturation);
                const bScore = b.weight * (1 + b.saturation);
                return bScore - aScore;
            });
            return samples[0];
        },
        _normalizePaletteColor: function (color) {
            if (!color) return null;
            const parsed = typeof color === "string" ? this._parseCssColor(color) : color;
            if (!parsed) return null;
            const distances = [
                { value: "red", rgb: [220, 38, 38] },
                { value: "yellow", rgb: [234, 179, 8] },
                { value: "green", rgb: [101, 163, 13] },
                { value: "blue", rgb: [37, 99, 235] },
            ].map((candidate) => ({
                ...candidate,
                distance: Math.sqrt(
                    Math.pow(parsed.r - candidate.rgb[0], 2) +
                    Math.pow(parsed.g - candidate.rgb[1], 2) +
                    Math.pow(parsed.b - candidate.rgb[2], 2)
                ),
            })).sort((a, b) => a.distance - b.distance);
            if (distances[0] && distances[0].distance <= 140) {
                return distances[0].value;
            }
            return null;
        },
        _normalizePaletteValue: function (value) {
            const normalized = String(value || "").toLowerCase().trim();
            if (!normalized) return null;
            if (normalized.includes("red")) return "red";
            if (normalized.includes("yellow")) return "yellow";
            if (normalized.includes("green")) return "green";
            if (normalized.includes("blue")) return "blue";
            if (normalized.includes("small")) return "small";
            if (normalized.includes("large")) return "large";
            return null;
        },
        _normalizePaletteValueFromImageSource: function (imageSource) {
            if (!imageSource || typeof imageSource !== "string") return null;
            const cleaned = imageSource.split('?')[0].split('#')[0];
            const filename = cleaned.split('/').pop()?.toLowerCase() || "";
            return this._normalizePaletteValue(filename.replace(/\.(png|jpg|jpeg|gif|svg)$/i, ""));
        },
        _parseCssColor: function (rawColor) {
            if (!rawColor || typeof rawColor !== "string") return null;
            const value = rawColor.trim().toLowerCase();
            if (!value || value === "none" || value === "transparent") return null;
            const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/);
            if (rgbMatch) {
                const parts = rgbMatch[1].split(',').map((part) => Number(part.trim()));
                if (parts.length < 3 || parts.some((part, idx) => idx < 3 && Number.isNaN(part))) return null;
                return {
                    r: parts[0],
                    g: parts[1],
                    b: parts[2],
                    alpha: Number.isFinite(parts[3]) ? parts[3] : 1,
                };
            }
            const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
            if (hexMatch) {
                const hex = hexMatch[1];
                if (hex.length === 3) {
                    return {
                        r: parseInt(hex[0] + hex[0], 16),
                        g: parseInt(hex[1] + hex[1], 16),
                        b: parseInt(hex[2] + hex[2], 16),
                        alpha: 1,
                    };
                }
                return {
                    r: parseInt(hex.slice(0, 2), 16),
                    g: parseInt(hex.slice(2, 4), 16),
                    b: parseInt(hex.slice(4, 6), 16),
                    alpha: 1,
                };
            }
            return null;
        },
        _computeColorSaturation: function (color) {
            const max = Math.max(color.r, color.g, color.b);
            const min = Math.min(color.r, color.g, color.b);
            if (max === 0) return 0;
            return (max - min) / max;
        },
        _getBlocklyBlockFromDom: function (node) {
            const dataId = node?.getAttribute?.('data-id');
            if (!dataId) return null;
            const ws = window.Blockly?.getMainWorkspace?.() || window.foundWorkspace;
            if (!ws || typeof ws.getBlockById !== 'function') return null;
            try {
                return ws.getBlockById(dataId) || null;
            } catch (_) {
                return null;
            }
        },
        _getBlocklyAttachmentRelation: function (parentNode, childNode) {
            const parentBlock = this._getBlocklyBlockFromDom(parentNode);
            const childBlock = this._getBlocklyBlockFromDom(childNode);
            if (!parentBlock || !childBlock) {
                return { kind: "unknown", attached: false };
            }
            try {
                if (typeof parentBlock.getNextBlock === 'function' && parentBlock.getNextBlock()?.id === childBlock.id) {
                    return { kind: "next", attached: true };
                }
                if (typeof childBlock.getPreviousBlock === 'function' && childBlock.getPreviousBlock()?.id === parentBlock.id) {
                    return { kind: "next", attached: true };
                }
                if (typeof childBlock.getParent === 'function' && childBlock.getParent()?.id === parentBlock.id) {
                    return { kind: "nested", attached: true };
                }
                if (typeof parentBlock.getChildren === 'function' && parentBlock.getChildren(false).some((block) => block.id === childBlock.id)) {
                    return { kind: "nested", attached: true };
                }
            } catch (_) {
                return { kind: "unknown", attached: false };
            }
            return { kind: "detached", attached: false };
        },
        _cleanupDetachedBlock: async function (detachedNode) {
            const block = this._getBlocklyBlockFromDom(detachedNode);
            if (!block || typeof block.dispose !== 'function') {
                return false;
            }
            try {
                block.dispose(false, true);
                await this._wait(250);
                return true;
            } catch (_) {
                return false;
            }
        },
        _classifyExecutionError: function (message) {
            const msg = String(message || "").toLowerCase();
            if (msg.includes("field selector")) return "planner_missing_field_selector";
            if (msg.includes("no blockly type mapping")) return "planner_unknown_block_metadata";
            if (msg.includes("could not resolve a field")) return "executor_field_role_unresolved";
            if (msg.includes("could not resolve structured input")) return "executor_field_role_unresolved";
            if (msg.includes("field index") || msg.includes("editable field")) return "executor_field_not_found";
            if (msg.includes("palette option")) return "executor_palette_value_unresolved";
            if (msg.includes("dropdown option")) return "executor_dropdown_option_missing";
            if (msg.includes("structured connect")) return "executor_attachment_target_unresolved";
            if (msg.includes("no statement input found")) return "executor_attachment_target_unresolved";
            if (msg.includes("no value input found")) return "executor_attachment_target_unresolved";
            if (msg.includes("visual block") || msg.includes("not found")) return "executor_block_not_found";
            if (msg.includes("properly-attached") || msg.includes("not attached") || msg.includes("not chained")) return "executor_wrong_attachment";
            if (msg.includes("free-float") || msg.includes("detached")) return "executor_detached_drop";
            return "executor_unknown";
        },

        // --- HELPERS ---

        _navigatePath: async function (catPath) {
            const normalizedPath = (Array.isArray(catPath) ? catPath : [catPath])
                .map(key => String(key || '').replace(/^\[/, '').replace(/\]$/, ''))
                .filter(Boolean);

            console.log(`🧭 Navigating path: ${normalizedPath.join(" > ")}`);

            for (let i = 0; i < normalizedPath.length; i++) {
                const catKey = normalizedPath[i];
                const catLabel = this._getLabel(catKey);
                if (!catLabel) {
                    console.warn(`   skipping segment ${i}: cat key '${catKey}' has no resolved label`);
                    continue;
                }
                const isLeaf = i === normalizedPath.length - 1;
                const beforeState = this._categoryRowState(catLabel);
                console.log(`   step ${i}: '${catLabel}' state=${JSON.stringify(beforeState)}, isLeaf=${isLeaf}`);

                if (!beforeState.visible) {
                    // Row isn't visible yet → its parent must still be collapsed.
                    // Try to expand whichever ancestor is collapsed before clicking.
                    console.warn(`   row '${catLabel}' not currently visible; ensuring ancestor categories are expanded.`);
                    for (let j = 0; j < i; j++) {
                        const ancestorLabel = this._getLabel(normalizedPath[j]);
                        const aState = this._categoryRowState(ancestorLabel);
                        if (ancestorLabel && (!aState.expanded || !aState.visible)) {
                            console.log(`   expanding ancestor '${ancestorLabel}' first.`);
                            await this._openCategoryTab(ancestorLabel, true);
                            await this._wait(600);
                        }
                    }
                }

                if (isLeaf) {
                    // For the leaf: we need the flyout to actually show its blocks.
                    // If the leaf is already selected AND the flyout has content
                    // matching this category, skip the click (avoids toggle-off).
                    // Otherwise click. Then verify.
                    const after = this._categoryRowState(catLabel);
                    if (!after.selected) {
                        console.log(`   clicking leaf '${catLabel}'.`);
                        await this._openCategoryTab(catLabel, true);
                        await this._wait(700);
                    } else {
                        console.log(`   leaf '${catLabel}' already selected — skipping click to avoid toggle-off.`);
                    }
                } else {
                    // For parents (non-leaf): we just need them EXPANDED so
                    // their children are visible. Don't toggle if already
                    // expanded — that would collapse them.
                    if (!beforeState.expanded) {
                        console.log(`   expanding parent '${catLabel}'.`);
                        await this._openCategoryTab(catLabel, true);
                        await this._wait(700);
                    } else {
                        console.log(`   parent '${catLabel}' already expanded — leaving it alone.`);
                    }
                }
            }
            this._postClearForceFirst = false;

            // Final verification: leaf must be the active selection.
            if (normalizedPath.length > 0) {
                const leafKey = normalizedPath[normalizedPath.length - 1];
                const leafLabel = this._getLabel(leafKey);
                if (leafLabel && !this._isCategoryActive(leafLabel)) {
                    console.warn(`🔁 Leaf '${leafLabel}' is not the active category after navigation. Re-trying with full expansion chain.`);
                    // One more aggressive try: expand every ancestor explicitly
                    // then force-click the leaf.
                    for (let i = 0; i < normalizedPath.length - 1; i++) {
                        const lab = this._getLabel(normalizedPath[i]);
                        if (lab) {
                            const s = this._categoryRowState(lab);
                            if (!s.expanded) {
                                await this._openCategoryTab(lab, true);
                                await this._wait(600);
                            }
                        }
                    }
                    await this._openCategoryTab(leafLabel, true);
                    await this._wait(800);
                }
                const finallyActive = this._isCategoryActive(leafLabel);
                console.log(`📍 Final state: leaf '${leafLabel}' active=${finallyActive}.`);
            }
        },
        _categoryRowState: function (label) {
            if (!label) return { visible: false, expanded: false, selected: false };
            const labels = Array.from(document.querySelectorAll('.blocklyTreeLabel'));
            const target = labels.find(el => el.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === label.toLowerCase());
            if (!target) return { visible: false, expanded: false, selected: false };
            const row = target.closest('.blocklyTreeRow') || target;
            const treeItem = target.closest('[role="treeitem"]');
            const rect = row.getBoundingClientRect();
            return {
                visible: rect.width > 0 && rect.height > 0,
                expanded: treeItem ? treeItem.getAttribute('aria-expanded') === 'true' : false,
                selected: row.classList.contains('blocklyTreeSelected'),
            };
        },
        _isCategoryActive: function (label) {
            if (!label) return false;
            return this._categoryRowState(label).selected;
        },

        _openCategoryTab: async function (label, force = false) {
            if (!label || typeof label !== 'string') {
                console.warn(`_openCategoryTab called with invalid label: ${JSON.stringify(label)}`);
                return;
            }
            const labels = Array.from(document.querySelectorAll('.blocklyTreeLabel'));
            const targetLabel = labels.find(el => el.textContent.replace(/\s+/g, ' ').trim().toLowerCase().includes(label.toLowerCase()));
            console.log(`🧭 Searching toolbox labels for '${label}'. Available labels: ${labels.map(el => `'${el.textContent.replace(/\s+/g, ' ').trim()}'`).join(", ")}`);
            if (!targetLabel) return;

            const row = targetLabel.closest('.blocklyTreeRow') || targetLabel;
            const treeItem = targetLabel.closest('[role="treeitem"]');

            if (!force) {
                const isSelected = row.classList.contains('blocklyTreeSelected');
                const isExpanded = treeItem && treeItem.getAttribute('aria-expanded') === 'true';
                // Only short-circuit when row is selected/expanded AND the flyout is
                // visibly populated. Otherwise the post-clear "selected but empty"
                // state would silently skip the click and cause block lookup to fail.
                const flyout = document.querySelector('.blocklyFlyout');
                const flyoutVisible = flyout && flyout.style && flyout.style.display !== 'none';
                const flyoutHasBlocks = flyout && flyout.querySelector('g.blocklyDraggable');
                if ((isSelected || isExpanded) && flyoutVisible && flyoutHasBlocks) return;
            }

            console.log(`📂 Clicking category '${label}'.`);
            row.click();
            await this._wait(600);
        },

        _huntForBlock: function (canonical) {
            // Dispatch on input type:
            //   - array of fragments → exact set-match (preferred, deterministic)
            //   - single positional sentinel like "__POSITIONAL_0__" → ordinal pick
            //   - plain string → legacy word-peel + substring fallback
            if (Array.isArray(canonical)) {
                if (canonical.length === 1 && /^__POSITIONAL_\d+__$/.test(canonical[0])) {
                    const idx = parseInt(canonical[0].match(/__POSITIONAL_(\d+)__/)[1], 10);
                    const visible = this._visibleFlyoutBlocks();
                    return visible[idx] || null;
                }
                return this._findFlyoutBlockByFragmentSet(canonical);
            }

            const searchPhrase = canonical;
            // Empty/whitespace phrase would make `_findFlyoutBlockBySubstring`
            // match the FIRST flyout block (because "".includes("") is true),
            // returning a wrong-category match silently. Refuse to search.
            if (!searchPhrase || !searchPhrase.trim()) {
                console.warn("_huntForBlock called with empty phrase; refusing to guess.");
                return null;
            }
            // Try exact-match peeling from the right. Cap the peel so a
            // multi-word phrase can't decay to a single common word like
            // "reset" or "color", which then matches a wrong-category block
            // (e.g. searching for "reset graph color" peeled to "reset" hits
            // Flow Control's "reset timer" block). Rule: keep at least 2 words
            // for any phrase that started with 2+ words; if the original was
            // a single word, allow that single match.
            const words = searchPhrase.split(/\s+/).filter(Boolean);
            const minWords = words.length === 1 ? 1 : 2;
            let cur = words.slice();
            while (cur.length >= minWords) {
                const tryPhrase = cur.join(" ");
                const node = this._findFlyoutBlock(tryPhrase);
                if (node) return node;
                cur.pop();
            }
            // Fallback: substring match on the FULL phrase against any single
            // text fragment. Handles multi-fragment labels (e.g. LCD_MESSAGE
            // renders as separate text elements "hello world", "lcd msg write",
            // "with color") where the discriminating fragment isn't a prefix.
            return this._findFlyoutBlockBySubstring(searchPhrase);
        },
        _scanInternal: function () {
            // Only count blocks on the actual workspace, never blocks inside the flyout.
            // Without this filter the pre/post diff is polluted by 20+ flyout draggables
            // and "no new block detected" misfires on builds where the flyout shares
            // .blocklyBlockCanvas (matched broadly by querySelector).
            const wsCanvases = Array.from(document.querySelectorAll('.blocklyBlockCanvas'))
                .filter(c => !c.closest('.blocklyFlyout'));
            const domBlocks = wsCanvases.flatMap(canvas =>
                Array.from(canvas.querySelectorAll('g.blocklyDraggable'))
                    .filter(el => !el.closest('.blocklyFlyout'))
                    .map((el, index) => {
                        if (!el.dataset.llmId) el.dataset.llmId = `blk_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
                        const r = el.getBoundingClientRect();
                        return { id: el.dataset.llmId, x: r.left, y: r.top };
                    })
            );

            if (domBlocks.length > 0) return domBlocks;

            // Fallback to Blockly workspace API for custom builds where DOM classes differ.
            const ws = window.Blockly?.getMainWorkspace?.() || window.foundWorkspace;
            if (!ws || typeof ws.getAllBlocks !== 'function') return [];

            return ws.getAllBlocks(false).map((block) => {
                let x = 0;
                let y = 0;
                try {
                    const xy = typeof block.getRelativeToSurfaceXY === 'function'
                        ? block.getRelativeToSurfaceXY()
                        : null;
                    x = xy?.x || 0;
                    y = xy?.y || 0;
                } catch (e) {
                    // ignore position lookup failures; ID detection is the important part
                }
                return { id: block.id, x, y };
            });
        },
        _getLabel: function (key) {
            const VISUAL_ALIASES = {
                MATH_NUMBER: "123",            // Standard Blockly default for number block
                MATH_ARITHMETIC: "+",          // Often just shows the operator
                LOGIC_BOOLEAN: "true",         // Often shows 'true'
                SHOWIMAGE: "Show Image",       // Fix for SHOWIMAGE discovery
                CONTROLS_FOR: "count with",    // Standard Blockly Loop
                TEXT_JOIN: "create text with", // Standard Text Join

                // Toolbox category labels (used by _openCategoryTab to locate
                // the toolbox row). Most CAT* keys are in Blockly.Msg but
                // Variables is missing on this build.
                CATVARIABLES: "Variables",
                CATPROCEDURES: "My Blocks",

                // Math blocks whose Msg key is missing/empty on this build —
                // their flyout labels are the dropdown's first option.
                MATH_TRIG: "sin",              // Trigonometric default
                MATH_SINGLE: "square root",    // Single-arg math first option
                MATH_CONSTANT: "π",            // Constant default
                MATH_ROUND: "round",           // Rounding default
                MATH_ON_LIST: "sum",           // Stat on list default
                MATH_NUMBER_PROPERTY: "even",  // Property check default
                MATH_RANDOM_FLOAT: "random fraction"
            };

            if (VISUAL_ALIASES[key]) return VISUAL_ALIASES[key];

            // Try standard msg (remove percent vars)
            const msg = window.Blockly?.Msg?.[key];
            if (msg) {
                const stripped = msg.replace(/%[0-9]/g, '').replace(/\s+/g, ' ').trim();
                if (stripped) return stripped;
            }

            // Fallback to key itself — _huntForBlock will likely fail and the
            // caller's retry/force-reopen path will surface a clear error.
            console.warn(`_getLabel: no Msg or alias for '${key}', returning key as-is.`);
            return key;
        },
        _wait: (ms) => new Promise(r => setTimeout(r, ms)),
        _fire: function (type, x, y, target) {
            const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, buttons: type.includes('down') ? 1 : 0 };
            target.dispatchEvent(new PointerEvent(type, opts));
        },
        // Blockly's flyout keeps every previously-rendered category's
        // blocks in the DOM and only HIDES them when switching categories.
        // A naive querySelector match can land on a block from the wrong
        // category whose bbox is zero, producing a phantom 'found' with
        // source-coords (0,0) that drags nothing. Filter to blocks that
        // are actually visible right now.
        _visibleFlyoutBlocks: function () {
            const flyout = document.querySelector(".blocklyFlyout");
            if (!flyout) return [];
            return Array.from(flyout.querySelectorAll('g.blocklyDraggable')).filter(b => {
                const r = b.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) return false;
                if (r.right < 0 || r.bottom < 0) return false;
                return true;
            });
        },
        _findFlyoutBlock: function (searchPhrase) {
            const visibleBlocks = this._visibleFlyoutBlocks();
            if (visibleBlocks.length === 0) return null;
            const lc = searchPhrase.toLowerCase();
            console.log(`🗂️ Flyout currently shows ${visibleBlocks.length} visible block(s). Texts: ${visibleBlocks.flatMap(b => Array.from(b.querySelectorAll('text.blocklyText')).map(t => `'${t.textContent.replace(/\u00A0/g, " ").replace(/\s+/g, ' ').trim()}'`)).join(", ")}`);
            for (const b of visibleBlocks) {
                const texts = Array.from(b.querySelectorAll('text.blocklyText'));
                if (texts.some(t => t.textContent.replace(/\u00A0/g, " ").replace(/\s+/g, ' ').trim().toLowerCase() === lc)) {
                    return b;
                }
            }
            return null;
        },
        _findFlyoutBlockBySubstring: function (needle) {
            const visibleBlocks = this._visibleFlyoutBlocks();
            if (visibleBlocks.length === 0) return null;
            const lc = needle.toLowerCase();
            return visibleBlocks.find(b => Array.from(b.querySelectorAll('text.blocklyText'))
                .some(t => t.textContent.replace(/\u00A0/g, " ").replace(/\s+/g, ' ').trim().toLowerCase().includes(lc))) || null;
        },
        // Returns the first visible flyout block whose text.blocklyText set
        // contains EVERY required fragment as an exact (case-insensitive)
        // match. This is the canonical resolver used by BLOCK_FRAGMENTS \u2014 it's
        // deterministic and never cross-matches into a wrong-category block,
        // because the visibility filter already restricts us to the active
        // category and exact-match prevents substring drift.
        _findFlyoutBlockByFragmentSet: function (requiredFragments) {
            const visibleBlocks = this._visibleFlyoutBlocks();
            if (visibleBlocks.length === 0) return null;
            const reqLower = requiredFragments.map(f => String(f).toLowerCase());
            const normalize = s => s.replace(/\u00A0/g, " ").replace(/\s+/g, ' ').trim().toLowerCase();
            console.log(`\uD83D\uDDC2\uFE0F Set-match against ${visibleBlocks.length} visible flyout block(s) for fragments: ${JSON.stringify(requiredFragments)}`);
            for (const b of visibleBlocks) {
                const fragments = Array.from(b.querySelectorAll('text.blocklyText')).map(t => normalize(t.textContent));
                const fragmentSet = new Set(fragments);
                const joined = fragments.join(" ");
                if (reqLower.every(f => fragmentSet.has(f) || fragments.some(t => t.includes(f)) || joined.includes(f))) {
                    return b;
                }
            }
            console.warn(`No fragment-set match for ${JSON.stringify(requiredFragments)}. Visible flyout fragments: ${visibleBlocks.map(b => {
                const fragments = Array.from(b.querySelectorAll('text.blocklyText')).map(t => normalize(t.textContent)).filter(Boolean);
                return `[${fragments.join(" | ")}]`;
            }).join(" ; ")}`);
            return null;
        },
        // Live-fetch a block by reading the currently-visible flyout and
        // scoring each block against tokens derived from the Msg key. Used as
        // a last-resort fallback when BLOCK_FRAGMENTS doesn't match anything
        // (label drift, locale change, new variant). Best match must clear a
        // minimum-score threshold so we don't blindly pick the first block.
        _discoverBlockByKey: function (blockKey) {
            const visibleBlocks = this._visibleFlyoutBlocks();
            if (visibleBlocks.length === 0) return null;
            const normalize = s => s.replace(/ /g, " ").replace(/\s+/g, ' ').trim().toLowerCase();
            // Derive search tokens from the Msg key: LCD_MESSAGE -> ["lcd","message"].
            // Also include known shortenings for common Blockly suffixes.
            const SYNONYMS = {
                "message": ["msg", "message"],
                "operation": ["op", "operation"],
                "boolean": ["bool", "boolean"],
                "expression": ["expr", "expression"],
                "compare": ["compare", "is", "="],
                "wait": ["wait", "wait until"],
                "advanced": ["adv", "advanced"],
                "control": ["control", "ctrl"],
            };
            const tokens = blockKey.toLowerCase().split(/[_\s]+/).filter(Boolean);
            const expandedTokens = tokens.flatMap(t => SYNONYMS[t] || [t]);

            const blockTexts = visibleBlocks.map(b => Array.from(b.querySelectorAll('text.blocklyText')).map(t => normalize(t.textContent)).filter(Boolean));

            console.log(`🔬 Runtime discovery for '${blockKey}'. Tokens: ${JSON.stringify(expandedTokens)}.`);
            console.log(`   Visible flyout (${visibleBlocks.length} blocks):`);
            blockTexts.forEach((frags, i) => console.log(`   [${i}] ${JSON.stringify(frags)}`));

            // Score each visible block: count how many tokens (or synonyms)
            // appear as a substring of any text fragment of that block.
            let bestIdx = -1, bestScore = 0;
            for (let i = 0; i < blockTexts.length; i++) {
                const joined = blockTexts[i].join(" ");
                let score = 0;
                for (const tok of tokens) {
                    if (!tok) continue;
                    const synonyms = SYNONYMS[tok] || [tok];
                    if (synonyms.some(s => joined.includes(s))) score++;
                }
                if (score > bestScore) { bestScore = score; bestIdx = i; }
            }
            // Threshold: require at least half of the original tokens to be present
            // (rounded up). This prevents 1/3 token matches from picking a wrong block.
            const minScore = Math.max(1, Math.ceil(tokens.length / 2));
            if (bestIdx >= 0 && bestScore >= minScore) {
                console.log(`✅ Discovery picked block[${bestIdx}] (score ${bestScore}/${tokens.length}, threshold ${minScore}). Texts: ${JSON.stringify(blockTexts[bestIdx])}`);
                return visibleBlocks[bestIdx];
            }
            console.warn(`❌ Discovery failed. Best score ${bestScore}/${tokens.length} < threshold ${minScore}.`);
            return null;
        },
        // Use Blockly's own undo to reverse a misplaced free-floating drop.
        // Removing the SVG node directly corrupts Blockly's internal block
        // registry (causes "Cannot read properties of null (reading 'id')"
        // from BlockSvg.select when the next click happens). Ctrl+Z lets
        // Blockly clean up its own state.
        // Return the parent block's OWN visible bounding rect — only its
        // path outline, NOT its descendants or orphaned free-floats that
        // happen to overlap. Blockly's `<g>.getBoundingClientRect()` returns
        // the union of the parent and every descendant, which on this build
        // means a cap with free-float orphans below it reports h≈300 instead
        // of its real h≈60, throwing off all our `top + h/2` calculations.
        // The `<path class="blocklyPath">` element draws only the block's
        // own outline so its bbox is the right reference.
        _getParentVisualRect: function (parentNode) {
            if (!parentNode) return null;
            // Direct-child <path.blocklyPath> first — this is the block's own
            // shape. Descendant children have their own path elements but we
            // want only the parent's first-level one.
            let path = Array.from(parentNode.children).find(el => el.tagName.toLowerCase() === 'path' && el.classList.contains('blocklyPath'));
            // Some Zelos themes wrap the parent's path one level deeper inside
            // a <g.blocklyBlockBackground> or similar. The FIRST descendant
            // path.blocklyPath in document order is still the parent's own
            // (descendant blocks' paths come later in the SVG tree).
            if (!path) {
                path = parentNode.querySelector('path.blocklyPath');
            }
            if (path) {
                const r = path.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return r;
            }
            // Fall back to the full <g> rect when path detection fails.
            return parentNode.getBoundingClientRect();
        },
        // Detect inline shadow value blocks on a parent — these mark unfilled
        // value-input sockets and are the best drop targets for VALUE child
        // blocks. Multi-strategy because Blockly builds vary in markup.
        // Returns an array of DOMRects (the centre of each is a drop target).
        // Excludes pure DROPDOWN fields (they show a menu on click, can't
        // accept a value-block snap).
        _findValueSocketShadows: function (parentNode, pRect) {
            if (!parentNode || !pRect) return [];
            const ownLlmId = parentNode.dataset.llmId;
            const ownDataId = parentNode.getAttribute('data-id');
            const seen = new Map();
            for (const g of parentNode.querySelectorAll('g')) {
                if (g === parentNode) continue;
                if (g.dataset.llmId === ownLlmId && ownLlmId) continue;
                if (g.getAttribute('data-id') === ownDataId && ownDataId) continue;
                const r = g.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) continue;
                if (r.height >= pRect.height) continue;
                // Skip dropdown fields — they show a menu on click, you can't
                // snap a value block to them. Markers: <image> child (the
                // arrow icon) or class containing 'Dropdown'.
                const hasDropdownArrow = g.querySelector(':scope > image') != null
                    || (g.getAttribute('class') || '').toLowerCase().includes('dropdown');
                if (hasDropdownArrow) continue;
                const isDraggable = g.classList.contains('blocklyDraggable');
                const isField = g.classList.contains('blocklyEditableField')
                    || g.classList.contains('blocklyNonEditableField');
                const innerTexts = g.querySelectorAll('text.blocklyText');
                const isSmallInlineValue = innerTexts.length === 1 && r.height < 50 && r.width < 100;
                if (isDraggable || isField || isSmallInlineValue) {
                    const key = `${Math.round(r.left)}_${Math.round(r.top)}`;
                    if (!seen.has(key)) seen.set(key, r);
                }
            }
            return Array.from(seen.values());
        },
        // Find the best Y for a statement-input drop on the parent by reading
        // its rendered header text. The statement-input slot opens just below
        // the row of header labels in Zelos cap/container blocks. We look at
        // all text.blocklyText elements that are NOT inside a nested child
        // block, take the LOWEST bottom edge, and add a small insert.
        _findStatementInputAnchor: function (parentNode, pRect) {
            if (!parentNode || !pRect) return null;
            // Direct text children of the parent's <g> represent the header.
            // Text inside nested child blocks (other g.blocklyDraggable groups)
            // is excluded to avoid the anchor drifting downward when blocks
            // are already nested.
            const ownLlmId = parentNode.dataset.llmId;
            const headerTexts = Array.from(parentNode.querySelectorAll('text.blocklyText'))
                .filter(t => {
                    // Exclude text inside a nested child block
                    const childBlock = t.closest('g.blocklyDraggable');
                    return childBlock === parentNode || childBlock?.dataset.llmId === ownLlmId;
                });
            if (headerTexts.length === 0) return null;
            // Use the LOWEST bottom across header texts as the slot top.
            let maxBottom = -Infinity;
            for (const t of headerTexts) {
                const r = t.getBoundingClientRect();
                if (r.bottom > maxBottom && r.bottom < pRect.bottom) {
                    maxBottom = r.bottom;
                }
            }
            if (!isFinite(maxBottom)) return null;
            return {
                x: pRect.left + 25,         // small left inset for the notch
                y: maxBottom + 1            // empirically: drop should land at the
                                            // header-text bottom on this build's
                                            // Zelos cap. Previously +10 overshot by
                                            // ~9px, leaving the child free-floating
                                            // below the statement-input connector.
            };
        },
        _undoLastBlocklyAction: async function () {
            const isMac = navigator.platform && navigator.platform.toLowerCase().includes('mac');
            const modKey = isMac ? { metaKey: true } : { ctrlKey: true };
            const ws = document.querySelector('.blocklySvg:not(.blocklyFlyout)');
            const target = ws || document;
            // Make sure the workspace gets the key. Some Blockly builds bind
            // the shortcut on document, others on the SVG.
            for (const evtTarget of [target, document]) {
                evtTarget.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'z', code: 'KeyZ', keyCode: 90, which: 90,
                    ...modKey, bubbles: true, cancelable: true
                }));
                evtTarget.dispatchEvent(new KeyboardEvent('keyup', {
                    key: 'z', code: 'KeyZ', keyCode: 90, which: 90,
                    ...modKey, bubbles: true, cancelable: true
                }));
            }
            await this._wait(350);
        },
        _visualizeDrag: async function (startX, startY, endX, endY, targetElement) {
            console.log("🚚 Starting drag gesture.");
            this._fire("pointerdown", startX, startY, targetElement);
            await this._wait(100);
            this._fire("pointermove", startX + 10, startY + 10, targetElement);
            await this._wait(100);
            const steps = 12;
            for (let i = 1; i <= steps; i++) {
                const curX = startX + ((endX - startX) * (i / steps));
                const curY = startY + ((endY - startY) * (i / steps));
                this._fire("pointermove", curX, curY, document);
                await this._wait(35);
            }
            // Dwell at the destination so Blockly's connection highlighter has time
            // to register the nearest snap target before pointerup. Without this,
            // nested drops sometimes land "near but not connected" and the block
            // either free-floats or gets cancelled by the renderer.
            for (let i = 0; i < 4; i++) {
                this._fire("pointermove", endX, endY, document);
                await this._wait(50);
            }
            this._fire("pointerup", endX, endY, document);
            await this._wait(500);
            console.log("🏁 Drag gesture complete.");
        }
    };
    console.log("✅ Universal Blockly Agent V15 Loaded.");
})();
