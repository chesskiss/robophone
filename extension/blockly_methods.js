// ----------------------------------------------------------------------------
// UNIVERSAL BLOCKLY AGENT V14 (Production Release)
// ----------------------------------------------------------------------------
(function installUniversalAgent() {
    console.log("🤖 Installing Universal Blockly Agent V14 (Production Release)...");

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

    window.BlocklyAgent = {
        BLOCK_FRAGMENTS: BLOCK_FRAGMENTS,
        VALUE_BLOCKS: VALUE_BLOCKS,
        CAP_BLOCKS: CAP_BLOCKS,

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

            console.log("📜 Executing Script...", commandList);
            const idMap = new Map();
            // Track each logical id's BLOCK KEY so we can detect cap parents
            // and override `pos: 'next'` to `pos: 'nested'` (caps have no
            // 'next' connector — children chain into the body via 'nested').
            const idToBlockKey = new Map();
            let commandsExecuted = 0;
            let spawnedCount = 0;

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
                    console.log(`▶️  ${stepLabel}  INPUT into '${cmd.block}'  value=${JSON.stringify(cmd.value)}`);
                } else {
                    console.log(`▶️  ${stepLabel}  ${cmd.action} ${JSON.stringify(cmd)}`);
                }
                console.log(`══════════════════════════════════════════════════════════════════════`);
                try {
                    if (cmd.action === "spawn") {
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
                            catPath, cmd.block, parentRuntimeId, pos
                        );

                        if (cmd.id) {
                            idMap.set(cmd.id, newId);
                            idToBlockKey.set(cmd.id, cmd.block);
                        }
                        spawnedCount += 1;
                        commandsExecuted += 1;
                        console.log(`✅ ${stepLabel} DONE — spawned '${cmd.block}' as logical '${cmd.id || "(no id)"}' runtime='${newId}' (pos='${pos}')`);

                    } else if (cmd.action === "input") {
                        const runtimeId = idMap.get(cmd.block);
                        if (!runtimeId) throw new Error(`Target '${cmd.block}' not found.`);
                        console.log(`   resolved target logical '${cmd.block}' -> runtime '${runtimeId}'`);
                        await this._handleInput(runtimeId, cmd.value);
                        commandsExecuted += 1;
                        console.log(`✅ ${stepLabel} DONE — input '${cmd.value}' applied to '${cmd.block}'`);
                    }
                } catch (e) {
                    console.error(`❌ ${stepLabel} FAILED: ${e.message}`);
                    return {
                        ok: false,
                        error: e.message,
                        commandsExecuted,
                        spawnedCount
                    };
                }
            }
            console.log("🎉 Script Complete.");
            return {
                ok: true,
                commandsExecuted,
                spawnedCount
            };
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

        _spawnPhysical: async function (catPath, blockKey, parentId, positionType) {
            try {
                return await this._spawnPhysicalImpl(catPath, blockKey, parentId, positionType);
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
        _spawnPhysicalImpl: async function (catPath, blockKey, parentId, positionType) {
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
                const initialParentState = await this._refreshParentVisualState(parentId, "initial parent resolution");
                parentNode = initialParentState.parentNode;
                pRect = initialParentState.rect;
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
                        { x: cur.left + 28, y: cur.bottom + 10, label: "right of primary below parent" },
                        { x: cur.left + 12, y: cur.bottom + 10, label: "left of primary below parent" },
                        { x: cur.left + 20, y: cur.bottom + 4, label: "closer to parent bottom edge" },
                        { x: cur.left + 20, y: cur.bottom + 28, label: "further below parent" },
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
                if (parentId) {
                    const liveParentState = await this._refreshParentVisualState(parentId, `before drag attempt ${attempt}`);
                    parentNode = liveParentState.parentNode;
                    pRect = liveParentState.rect;
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
                        attachmentOk = parentGrew;
                        attachmentNote = attachmentOk
                            ? `✅ attached — parent path grew (Δh=${Math.round(dHeight)}, Δw=${Math.round(dWidth)})`
                            : `⚠️ NOT attached — parent path unchanged (Δh=${Math.round(dHeight)}). Child at top=${Math.round(cRect.top)} vs parentOrigBottom=${Math.round(pRect.bottom)}. Will undo & retry.`;
                    } else if (positionType === "next") {
                        // Prefer the strict growth signal, but on this RoboPhone
                        // build some valid "next" snaps do not expand the parent
                        // path reliably. Fall back to a tight visual-chain check:
                        // the child should land immediately under the parent and
                        // remain roughly left-aligned with it.
                        const closeBelow = cRect.top <= pRect.bottom + 14 && cRect.top >= pRect.bottom - 18;
                        const leftAligned = Math.abs(cRect.left - pRect.left) <= 18;
                        const visuallyChained = closeBelow && leftAligned;
                        attachmentOk = parentGrew || visuallyChained;
                        attachmentNote = attachmentOk
                            ? (parentGrew
                                ? `✅ child is chained next to parent (Δh=${Math.round(dHeight)})`
                                : `✅ child accepted as visually chained next to parent (Δh=${Math.round(dHeight)}, child.top=${Math.round(cRect.top)}, parent.bottom=${Math.round(pRect.bottom)}, Δleft=${Math.round(cRect.left - pRect.left)})`)
                            : `⚠️ child NOT chained — parent path unchanged (Δh=${Math.round(dHeight)}), child.top=${Math.round(cRect.top)}, parent.bottom=${Math.round(pRect.bottom)}, Δleft=${Math.round(cRect.left - pRect.left)}. Will undo & retry.`;
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
                console.warn(`   undoing free-float via Blockly undo (Ctrl/Cmd+Z).`);
                await this._undoLastBlocklyAction();
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
                if (parentId) {
                    const recoveredParentState = await this._refreshParentVisualState(parentId, "after undo+flyout-reopen");
                    parentNode = recoveredParentState.parentNode;
                    pRect = recoveredParentState.rect;
                    console.log(`   parent visual bbox AFTER undo+flyout-reopen: x=${Math.round(pRect.left)} y=${Math.round(pRect.top)} w=${Math.round(pRect.width)} h=${Math.round(pRect.height)}`);
                }
            }

            if (!newBlock) {
                throw new Error(`Drag of '${blockKey}' produced no properly-attached workspace block after ${dropCandidates.length} drop attempt(s).`);
            }
            console.log(`✅ New block placed via drop '${usedDrop?.label}'. runtime id='${newBlock.id}'.`);
            return newBlock.id;
        },

        _handleInput: async function (blockId, value) {
            // Coerce to string up-front. Without this, a missing `value` from
            // the LLM crashes deep inside dropdown matching ("Cannot read
            // properties of undefined (reading 'toLowerCase')").
            if (value === undefined || value === null) {
                throw new Error(`Input command for block '${blockId}' has no value.`);
            }
            value = String(value);

            const block = document.querySelector(`g[data-llm-id="${blockId}"]`);
            if (!block) throw new Error("Block element missing.");

            // 1. Find Editable Field (Text OR Dropdown)
            const allGroups = Array.from(block.querySelectorAll('g'));
            let targetGroup = allGroups.find(g => g.classList.contains('blocklyEditableText'));

            // Fallback: Group with text but NO rect (often dropdown labels) or correct structure
            if (!targetGroup) {
                targetGroup = allGroups.find(g => {
                    // Standard Dropdown often has text and an internal image (arrow) or just text
                    const txt = g.querySelector('text');
                    const img = g.querySelector('image');
                    // We allow image now because Dropdowns often contain arrows or icons
                    return txt && (g.classList.contains('blocklyEditableText') || g.getAttribute('role') === 'button' || !g.getAttribute('role'));
                });
            }
            if (!targetGroup) throw new Error("Could not locate editable field.");

            // 2. Click to Open Widget
            const fieldRect = targetGroup.getBoundingClientRect();
            const clickX = fieldRect.left + (fieldRect.width / 2);
            const clickY = fieldRect.top + (fieldRect.height / 2);

            console.log(`🖱️ Clicking field at ${Math.round(clickX)},${Math.round(clickY)}`);
            this._fire('pointerdown', clickX, clickY, targetGroup);
            this._fire('pointerup', clickX, clickY, targetGroup);
            await this._wait(600);

            // 3. Detect Widget Type
            const inputWidget = document.querySelector('.blocklyHtmlInput');
            const dropdownWidget = document.querySelector('.blocklyDropDownContent, .blocklyDropdownMenu');

            if (inputWidget) {
                // --- CASE A: TEXT INPUT ---
                console.log(`⌨️ Typing "${value}" into text field...`);
                inputWidget.value = value;
                inputWidget.dispatchEvent(new Event('input', { bubbles: true }));
                await this._wait(100);
                inputWidget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                await this._wait(300);

            } else if (dropdownWidget) {
                // --- CASE B: DROPDOWN MENU ---
                console.log(`🔽 Selecting "${value}" from dropdown...`);

                // On RoboPhone, the visible menu items are sometimes rendered
                // outside the nominal dropdown container. Query visible menu
                // items globally instead of relying on .blocklyDropDownContent
                // being the true parent of the options.
                const items = this._getVisibleDropdownItems();
                let targetItem = items.find(item => {
                    const textContent = (item.textContent || "").toLowerCase().trim();
                    return textContent === value.toLowerCase().trim();
                });

                // If not found by text, try Image Alt Text (e.g. for icons)
                if (!targetItem) {
                    targetItem = items.find(item => {
                        const img = item.querySelector('img');
                        return img && img.alt && img.alt.toLowerCase() === value.toLowerCase();
                    });
                }

                // Icon/palette fallback: derive semantic value from the image
                // filename, e.g. /static/images/red.png -> "red".
                if (!targetItem) {
                    targetItem = items.find(item => {
                        const img = item.querySelector('img');
                        if (!img || !img.src) return false;
                        const normalized = this._normalizePaletteValueFromImageSource(img.src);
                        if (!normalized) return false;
                        if (normalized === "plug") return false; // launcher / special-case, not a normal color value
                        return normalized === value.toLowerCase().trim();
                    });
                }

                if (targetItem) {
                    targetItem.click();
                    await this._wait(300);
                } else {
                    const available = items.map(i => {
                        const text = (i.textContent || "").trim();
                        const img = i.querySelector('img');
                        const normalized = img?.src ? this._normalizePaletteValueFromImageSource(img.src) : "";
                        return normalized || text;
                    }).join(", ");
                    console.warn(`⚠️ Option '${value}' not found in dropdown. Available: ${available}`);
                    // Close menu by clicking elsewhere
                    this._fire('pointerdown', 0, 0, document.body);
                    this._fire('pointerup', 0, 0, document.body);
                    throw new Error(`Dropdown option '${value}' not found.`);
                }

            } else {
                throw new Error("Input widget failed to open (No Input or Dropdown detected).");
            }
        },

        _getVisibleDropdownItems: function () {
            return Array.from(document.querySelectorAll('.blocklyMenuItem, .goog-menuitem'))
                .filter(item => {
                    const rect = item.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                });
        },

        _normalizePaletteValueFromImageSource: function (src) {
            if (!src || typeof src !== "string") return null;
            const match = src.toLowerCase().match(/\/([^\/?#]+)\.(png|svg|jpg|jpeg|gif)(?:[?#].*)?$/);
            if (!match) return null;
            const base = match[1];
            const paletteMap = {
                red: "red",
                yellow: "yellow",
                green: "green",
                blue: "blue",
                plug: "plug",
            };
            return paletteMap[base] || base || null;
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
                    // On RoboPhone, selected=true is not enough to trust that
                    // the flyout is fresh and draggable. Always refresh the
                    // leaf category so the visible flyout blocks are rebuilt
                    // before we try to drag.
                    console.log(`   clicking leaf '${catLabel}'.`);
                    await this._openCategoryTab(catLabel, true);
                    await this._wait(700);
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
        _refreshParentVisualState: async function (parentId, context) {
            const label = context || "parent refresh";
            for (let attempt = 1; attempt <= 4; attempt++) {
                const candidateNode = document.querySelector(`g[data-llm-id="${parentId}"]`);
                if (!candidateNode) {
                    console.warn(`   parent DOM missing during ${label} (attempt ${attempt}/4).`);
                    await this._wait(150);
                    continue;
                }
                const rect = this._getParentVisualRect(candidateNode);
                if (rect && rect.width > 0 && rect.height > 0) {
                    return { parentNode: candidateNode, rect };
                }
                console.warn(`   parent visual rect invalid during ${label} (attempt ${attempt}/4): w=${Math.round(rect?.width || 0)} h=${Math.round(rect?.height || 0)}.`);
                await this._wait(150);
            }
            const finalNode = document.querySelector(`g[data-llm-id="${parentId}"]`);
            if (!finalNode) {
                throw new Error(`Parent DOM node '${parentId}' missing during ${label}.`);
            }
            const finalRect = this._getParentVisualRect(finalNode);
            throw new Error(`Parent visual rect invalid during ${label} (w=${Math.round(finalRect?.width || 0)}, h=${Math.round(finalRect?.height || 0)}).`);
        },

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
    console.log("✅ Universal Blockly Agent V14 Loaded.");
})();
