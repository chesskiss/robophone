// ----------------------------------------------------------------------------
// BLOCKLY API ENGINE V1 — programmatic placement layer
// ----------------------------------------------------------------------------
// Loaded BEFORE blockly_methods.js (see manifest.json content_scripts order).
// Exposes window.BlocklyApiEngine.
//
// The Universal Agent prefers this engine over pointer-drag simulation:
//   spawn   — serialize the flyout's own block, append it to the main workspace
//   connect — Connection.connect() on the real model objects
//   fields  — Field.setValue() with dropdown/checkbox/variable handling and a
//             per-block cursor so successive 'input' commands hit successive
//             fields ("field order" — the contract the LLM prompt promises)
//   verify  — child.getParent() chain walk: ground truth, no bbox heuristics
//
// If the Blockly workspace object can't be found on this build, every entry
// point reports unavailable and the agent falls back to the legacy drag engine
// in blockly_methods.js. The drag engine also consults this engine for
// attachment verification (verifyAttachedDom) when it IS available.
(function installBlocklyApiEngine() {
    console.log("🔌 Installing Blockly API Engine V1...");

    // Numeric fallbacks match Blockly's stable ConnectionType values
    // (unchanged across every Blockly major since the beginning).
    const CONN_FALLBACK = { INPUT_VALUE: 1, OUTPUT_VALUE: 2, NEXT_STATEMENT: 3, PREVIOUS_STATEMENT: 4 };
    function connType(name) {
        const B = window.Blockly;
        const v = (B && B.ConnectionType && B.ConnectionType[name]) ?? (B && B[name]);
        return (typeof v === "number") ? v : CONN_FALLBACK[name];
    }

    function isWorkspace(o) {
        return !!o && typeof o === "object"
            && typeof o.newBlock === "function"
            && typeof o.getAllBlocks === "function"
            && typeof o.getBlockById === "function";
    }

    window.BlocklyApiEngine = {
        VERSION: "1.2",
        _ws: null,
        _scanDone: false,
        _stateCache: new Map(),   // blockKey -> {kind, state} serialized flyout block
        _fieldCursor: new Map(),  // workspace block id -> next editable-field index
        blocksById: new Map(),    // runtime id -> Blockly block object (this run)

        // Called once per execute() run: forget per-run state and allow a
        // fresh workspace discovery (the page may have re-rendered).
        resetRun: function () {
            this._fieldCursor.clear();
            this.blocksById.clear();
            this._ws = null;
            this._scanDone = false;
        },

        available: function () { return !!this.getWorkspace(); },

        getWorkspace: function () {
            if (this._ws && !this._ws.disposed) return this._ws;
            // 1) the official accessor
            try {
                const w = window.Blockly && window.Blockly.getMainWorkspace && window.Blockly.getMainWorkspace();
                if (isWorkspace(w)) return (this._ws = w);
            } catch (_) { }
            // 2) a workspace exposed earlier by discovery_helper.js
            if (isWorkspace(window.foundWorkspace)) return (this._ws = window.foundWorkspace);
            // 3) cheap DOM scan of likely hosts (custom builds sometimes hang
            //    the workspace off the injection div instead of a global)
            if (!this._scanDone) {
                this._scanDone = true; // pay the scan at most once per run
                const hosts = document.querySelectorAll('.injectionDiv, .blocklySvg, [class*="blockly"]');
                for (const el of hosts) {
                    if (isWorkspace(el.workspace)) return (this._ws = el.workspace);
                    if (isWorkspace(el.blockly_workspace)) return (this._ws = el.blockly_workspace);
                }
            }
            return null;
        },

        // ---- spawn ---------------------------------------------------------

        getCachedState: function (blockKey) { return this._stateCache.get(blockKey) || null; },
        cacheState: function (blockKey, ser) { this._stateCache.set(blockKey, ser); },

        // Map a flyout DOM node (g.blocklyDraggable) to the flyout WORKSPACE
        // block behind it via its data-id attribute.
        resolveFlyoutBlock: function (domNode) {
            if (!domNode) return null;
            const dataId = domNode.getAttribute("data-id");
            if (!dataId) return null;
            const ws = this.getWorkspace();
            // The flyout is owned by the workspace or by its toolbox, depending on build.
            const flyouts = [];
            try { const f = ws && ws.getFlyout && ws.getFlyout(); if (f) flyouts.push(f); } catch (_) { }
            try {
                const tb = ws && ws.getToolbox && ws.getToolbox();
                const f = tb && tb.getFlyout && tb.getFlyout();
                if (f) flyouts.push(f);
            } catch (_) { }
            for (const f of flyouts) {
                try {
                    const fws = f.getWorkspace && f.getWorkspace();
                    const b = fws && fws.getBlockById && fws.getBlockById(dataId);
                    if (b) return b;
                } catch (_) { }
            }
            // Last resort: every registered workspace.
            try {
                const all = (window.Blockly && window.Blockly.Workspace && window.Blockly.Workspace.getAll && window.Blockly.Workspace.getAll()) || [];
                for (const cand of all) {
                    const b = cand.getBlockById && cand.getBlockById(dataId);
                    if (b) return b;
                }
            } catch (_) { }
            return null;
        },

        // Serialize with the richest mechanism this build offers. JSON keeps
        // shadows/mutations/field defaults; XML likewise; the bare-type
        // fallback at least copies visible field values across.
        serializeFlyoutBlock: function (block) {
            const B = window.Blockly;
            try {
                if (B && B.serialization && B.serialization.blocks && B.serialization.blocks.save) {
                    const state = B.serialization.blocks.save(block, { addCoordinates: false, addNextBlocks: false });
                    if (state) return { kind: "json", state };
                }
            } catch (e) { console.warn("[ApiEngine] JSON serialization failed:", e.message); }
            try {
                if (B && B.Xml && B.Xml.blockToDom) {
                    const dom = B.Xml.blockToDom(block, true /* opt_noId */);
                    if (dom) return { kind: "xml", state: dom };
                }
            } catch (e) { console.warn("[ApiEngine] XML serialization failed:", e.message); }
            try {
                const fields = [];
                for (const input of block.inputList || []) {
                    for (const f of input.fieldRow || []) {
                        if (f && f.name && typeof f.getValue === "function") {
                            fields.push({ name: f.name, value: f.getValue() });
                        }
                    }
                }
                return { kind: "type", state: { type: block.type, fields } };
            } catch (e) {
                console.warn("[ApiEngine] type-level serialization failed:", e.message);
                return null;
            }
        },

        // Appending the same cached state twice with the original ids would
        // collide in the target workspace — ids must be regenerated by Blockly.
        _stripIds: function (state) {
            if (!state || typeof state !== "object") return state;
            if (Array.isArray(state)) { state.forEach(s => this._stripIds(s)); return state; }
            delete state.id;
            for (const k of Object.keys(state)) this._stripIds(state[k]);
            return state;
        },

        appendSerialized: function (ser) {
            const ws = this.getWorkspace();
            const B = window.Blockly;
            if (!ws || !ser) return null;
            if (ser.kind === "json" && B && B.serialization && B.serialization.blocks && B.serialization.blocks.append) {
                const state = this._stripIds(JSON.parse(JSON.stringify(ser.state)));
                return B.serialization.blocks.append(state, ws);
            }
            if (ser.kind === "xml" && B && B.Xml && B.Xml.domToBlock) {
                return B.Xml.domToBlock(ser.state.cloneNode(true), ws);
            }
            if (ser.kind === "type") {
                const block = ws.newBlock(ser.state.type);
                try {
                    if (block.initSvg) block.initSvg();
                    if (block.render) block.render();
                } catch (_) { }
                for (const f of ser.state.fields || []) {
                    try {
                        const field = block.getField && block.getField(f.name);
                        if (field && field.setValue) field.setValue(f.value);
                    } catch (_) { }
                }
                return block;
            }
            return null;
        },

        // ---- connect --------------------------------------------------------

        // Returns {ok, mode?, why?}. The CHILD'S OWN SHAPE decides the socket
        // type (outputConnection => value), not a static lookup table — the
        // model is always right about itself.
        connect: function (parentBlock, childBlock, positionType) {
            if (!parentBlock || !childBlock) return { ok: false, why: "missing parent or child block" };
            const isValueChild = !!childBlock.outputConnection;
            if (isValueChild) {
                // Value blocks can only live in value sockets, whatever pos says.
                return this._connectValue(parentBlock, childBlock);
            }
            if (positionType === "next") {
                if (parentBlock.nextConnection) return this._connectNextChain(parentBlock, childBlock);
                console.warn(`[ApiEngine] parent '${parentBlock.type}' has no next connection (cap block) — nesting into its body instead.`);
            }
            return this._connectStatement(parentBlock, childBlock);
        },

        _connectNextChain: function (fromBlock, childBlock) {
            if (!childBlock.previousConnection) return { ok: false, why: `child '${childBlock.type}' has no previous connection` };
            let tail = fromBlock, guard = 0;
            while (tail.nextConnection && tail.nextConnection.targetBlock() && guard++ < 500) {
                tail = tail.nextConnection.targetBlock();
            }
            if (!tail.nextConnection) return { ok: false, why: `chain tail '${tail.type}' has no next connection` };
            try { tail.nextConnection.connect(childBlock.previousConnection); }
            catch (e) { return { ok: false, why: `next-connect threw: ${e.message}` }; }
            return childBlock.getParent()
                ? { ok: true, mode: tail === fromBlock ? "next" : `next (after chain tail '${tail.type}')` }
                : { ok: false, why: "next-connect did not take" };
        },

        // Attempt to put childBlock into one specific value socket.
        // Strategy: try a DIRECT connect first (most Blockly builds replace a
        // shadow occupant automatically). If that didn't take and the occupant
        // is replaceable, dispose it and retry once. Returns true on success.
        _tryValueSocket: function (conn, childBlock, replaceableTarget) {
            try { conn.connect(childBlock.outputConnection); } catch (_) { }
            if (childBlock.getParent()) return true;
            if (!replaceableTarget) return false;
            try { replaceableTarget.dispose(); } catch (_) { return false; }
            try { conn.connect(childBlock.outputConnection); } catch (_) { return false; }
            return !!childBlock.getParent();
        },

        _connectValue: function (parentBlock, childBlock) {
            const INPUT_VALUE = connType("INPUT_VALUE");
            if (!childBlock.outputConnection) return { ok: false, why: `child '${childBlock.type}' has no output connection` };
            // Two passes over the value sockets in visual order:
            //   pass 1 — empty or shadow-occupied sockets (normal positional fill)
            //   pass 2 — sockets holding REAL default blocks that we did NOT
            //            place (toolbox presets like MATH_ADVANCED's a/b/c/x
            //            "0" blocks). Those are semantically defaults, so
            //            replace them. Blocks WE placed are never touched —
            //            this is what keeps positional fill correct: the
            //            first nested child must land in 'a', not skip to 'x'
            //            just because 'a' ships with a preset occupant.
            for (const pass of [1, 2]) {
                for (const input of parentBlock.inputList || []) {
                    const conn = input.connection;
                    if (!conn || conn.type !== INPUT_VALUE) continue;
                    const target = conn.targetBlock();
                    const isShadow = !!(target && typeof target.isShadow === "function" && target.isShadow());
                    if (pass === 1) {
                        if (target && !isShadow) continue; // real occupant: pass 2's business
                    } else {
                        if (!target || isShadow) continue;          // pass 1 already tried these
                        if (this.blocksById.has(target.id)) continue; // we placed it — keep it
                    }
                    if (this._tryValueSocket(conn, childBlock, target)) {
                        return { ok: true, mode: `value socket '${input.name || "?"}'${pass === 2 ? " (replaced preset)" : ""}` };
                    }
                }
            }
            return { ok: false, why: `no free/compatible value socket on '${parentBlock.type}'` };
        },

        _connectStatement: function (parentBlock, childBlock) {
            if (!childBlock.previousConnection) return { ok: false, why: `child '${childBlock.type}' has no previous connection` };
            const NEXT_STATEMENT = connType("NEXT_STATEMENT");
            for (const input of parentBlock.inputList || []) {
                const conn = input.connection;
                if (!conn || conn.type !== NEXT_STATEMENT) continue;
                const head = conn.targetBlock();
                if (!head) {
                    try { conn.connect(childBlock.previousConnection); } catch (_) { continue; }
                    if (childBlock.getParent()) return { ok: true, mode: `statement input '${input.name || "?"}'` };
                    continue;
                }
                // Body already has statements: append after its tail — matches
                // the LLM contract "second nested child lands below the first
                // inside the body".
                const res = this._connectNextChain(head, childBlock);
                if (res.ok) return { ok: true, mode: `statement input '${input.name || "?"}' (appended after existing body)` };
            }
            return { ok: false, why: `no statement input available on '${parentBlock.type}'` };
        },

        // Roots cascade BELOW existing top blocks instead of stacking at one
        // point (the drag engine drops every root at workspace centre, where a
        // second root can overlap or accidentally snap to the first).
        positionAsRoot: function (block) {
            const ws = this.getWorkspace();
            if (!ws || !block) return;
            try {
                let maxBottom = -Infinity;
                const tops = (ws.getTopBlocks ? ws.getTopBlocks(false) : []);
                for (const t of tops) {
                    if (t.id === block.id) continue;
                    let bottom = null;
                    try {
                        const r = t.getBoundingRectangle && t.getBoundingRectangle();
                        if (r) bottom = (typeof r.bottom === "number") ? r.bottom : (r.bottomRight && r.bottomRight.y);
                    } catch (_) { }
                    if (bottom != null && bottom > maxBottom) maxBottom = bottom;
                }
                const targetX = 40;
                const targetY = isFinite(maxBottom) ? maxBottom + 40 : 40;
                const cur = block.getRelativeToSurfaceXY && block.getRelativeToSurfaceXY();
                if (cur && typeof block.moveBy === "function") {
                    block.moveBy(targetX - cur.x, targetY - cur.y);
                }
            } catch (e) {
                console.warn("[ApiEngine] positionAsRoot failed (block stays where it rendered):", e.message);
            }
        },

        // ---- fields -----------------------------------------------------------

        // Enumerate the block's editable "slots" in visual left-to-right order:
        // its own fields PLUS the fields of SHADOW blocks occupying its value
        // sockets. Shadows are visually part of the parent's row — e.g.
        // controls_for renders as "count with [var] from [-360] to [360] by
        // [10]" where from/to/by are shadow math_number blocks, not fields.
        // Without descending into shadows, the block appears to have a single
        // field (the variable) and every successive input lands on it.
        // Returns [{field, owner}] where owner is the block the field lives on.
        // Each slot carries a stable IDENTITY derived from Blockly's own
        // definition names — e.g. controls_for yields:
        //   f:VAR, in:FROM>f:NUM, in:TO>f:NUM, in:BY>f:NUM
        // Identities are how applyInput remembers which inputs were already
        // written; unlike a numeric cursor they survive slot-list shifts
        // (shadow regeneration, socket replacement between commands).
        editableFields: function (block, _depth, _prefix) {
            const depth = _depth || 0;
            const prefix = _prefix || "";
            const out = [];
            if (!block || depth > 3) return out; // shadow trees are shallow; guard anyway
            let autoIdx = 0;
            for (const input of block.inputList || []) {
                for (const f of input.fieldRow || []) {
                    autoIdx++;
                    if (!f || typeof f.setValue !== "function") continue;
                    // Field.EDITABLE is the class contract (labels/images are false).
                    const editable = (f.EDITABLE !== undefined) ? !!f.EDITABLE : (typeof f.showEditor_ === "function");
                    if (editable) out.push({ field: f, owner: block, slotId: `${prefix}f:${f.name || autoIdx}` });
                }
                const conn = input.connection;
                const target = conn && conn.targetBlock && conn.targetBlock();
                if (target) {
                    const isShadow = typeof target.isShadow === "function" && target.isShadow();
                    // Descend into shadows AND toolbox-preset occupants (real
                    // blocks we did not place) — both render as part of the
                    // parent's row. Blocks WE placed have their own logical id
                    // and are addressed by their own 'input' commands.
                    if (isShadow || !this.blocksById.has(target.id)) {
                        out.push(...this.editableFields(target, depth + 1, `${prefix}in:${input.name || autoIdx}>`));
                    }
                }
            }
            return out;
        },

        fieldKind: function (field) {
            const ctor = (field && field.constructor && field.constructor.name) || "";
            // Order matters: FieldVariable extends FieldDropdown, so test it first.
            if (typeof field.getVariable === "function" || ctor.indexOf("Variable") >= 0) return "variable";
            if (typeof field.getOptions === "function" || ctor.indexOf("Dropdown") >= 0) return "dropdown";
            let v = null;
            try { v = field.getValue(); } catch (_) { }
            if (ctor.indexOf("Checkbox") >= 0 || v === "TRUE" || v === "FALSE") return "checkbox";
            if (ctor.indexOf("Number") >= 0 || typeof v === "number") return "number";
            return "text";
        },

        _dropdownOptions: function (field) {
            try {
                const opts = field.getOptions(false);
                return Array.isArray(opts) ? opts : null;
            } catch (_) {
                try {
                    const opts = field.getOptions();
                    return Array.isArray(opts) ? opts : null;
                } catch (_) { return null; }
            }
        },

        _optionLabel: function (label) {
            return (typeof label === "string") ? label : ((label && (label.alt || label.text)) || "");
        },

        _matchOption: function (options, raw) {
            const OPERATOR_ALIASES = { '*': '×', 'x': '×', '/': '÷', '**': '^' };
            const trimmed = raw.trim();
            const want = (OPERATOR_ALIASES[trimmed] || trimmed).toLowerCase();
            const wantRaw = trimmed.toLowerCase();
            for (const opt of options) {
                if (!Array.isArray(opt) || opt.length < 2) continue;
                const label = this._optionLabel(opt[0]).trim().toLowerCase();
                const val = String(opt[1]).trim().toLowerCase();
                if (label === want || label === wantRaw) return opt[1];
                if (val === want || val === wantRaw) return opt[1];
            }
            return undefined;
        },

        _truthy: function (raw) {
            return ["true", "1", "yes", "on", "checked"].indexOf(raw.trim().toLowerCase()) >= 0;
        },

        // Can this field plausibly take this value? Used to route a value to
        // the right field when the positional cursor points at one that can't
        // accept it (e.g. "red" arriving while the cursor sits on a number field).
        fieldAccepts: function (field, raw) {
            const kind = this.fieldKind(field);
            // Variable fields take any NAME, but a purely numeric value is
            // almost certainly meant for a number socket further right —
            // reject it here so forward-routing skips past the variable.
            if (kind === "variable") return isNaN(Number(raw.trim())) || raw.trim() === "";
            if (kind === "dropdown") {
                const opts = this._dropdownOptions(field);
                return !!opts && this._matchOption(opts, raw) !== undefined;
            }
            if (kind === "checkbox") {
                return ["true", "false", "1", "0", "yes", "no", "on", "off", "checked", "unchecked"]
                    .indexOf(raw.trim().toLowerCase()) >= 0;
            }
            if (kind === "number") return raw.trim() !== "" && !isNaN(Number(raw));
            return true; // text takes anything
        },

        setFieldValue: function (block, field, raw) {
            const kind = this.fieldKind(field);
            try {
                if (kind === "variable") {
                    const ws = block.workspace || this.getWorkspace();
                    let v = null;
                    try { v = (ws.getVariableMap && ws.getVariableMap().getVariable(raw)) || null; } catch (_) { }
                    if (!v) { try { v = (ws.getVariable && ws.getVariable(raw)) || null; } catch (_) { } }
                    if (!v) { try { v = (ws.createVariable && ws.createVariable(raw)) || null; } catch (_) { } }
                    if (!v) return { ok: false, kind, why: `could not find or create variable '${raw}'` };
                    field.setValue(typeof v.getId === "function" ? v.getId() : v.id_);
                    return { ok: true, kind };
                }
                if (kind === "dropdown") {
                    const opts = this._dropdownOptions(field) || [];
                    const value = this._matchOption(opts, raw);
                    if (value === undefined) {
                        const labels = opts.map(o => this._optionLabel(o[0]) || "?");
                        return { ok: false, kind, why: `'${raw}' is not a dropdown option. Available: ${labels.join(", ")}` };
                    }
                    field.setValue(value);
                    return { ok: true, kind };
                }
                if (kind === "checkbox") {
                    field.setValue(this._truthy(raw) ? "TRUE" : "FALSE");
                    return { ok: true, kind };
                }
                if (kind === "number") {
                    const n = Number(raw);
                    if (raw.trim() === "" || isNaN(n)) return { ok: false, kind, why: `'${raw}' is not numeric` };
                    field.setValue(n);
                    return { ok: true, kind };
                }
                field.setValue(raw);
                return { ok: true, kind };
            } catch (e) {
                return { ok: false, kind, why: `setValue threw: ${e.message}` };
            }
        },

        // Per-block positional fill, honouring the prompt contract "emit
        // multiple 'input' commands in field order". The cursor remembers the
        // last field written per block; the next command targets the next one.
        // If the cursor field can't take the value but a later one can, route
        // forward (e.g. a color string skipping a number field).
        applyInput: function (block, raw, cursorKey) {
            // Written-slot memory is keyed by the CALLER's stable runtime id
            // when given — block.id could differ between calls if resolution
            // ever returns a different object for the same logical block.
            const key = cursorKey || block.id;
            const slots = this.editableFields(block);
            if (slots.length === 0) {
                return { ok: false, why: `block '${block.type}' has no editable fields (value sockets need a nested spawn, not an input)` };
            }
            let written = this._fieldCursor.get(key);
            if (!(written instanceof Set)) {
                written = new Set();
                this._fieldCursor.set(key, written);
            }
            // Diagnostic: what the engine SEES on this block, every time.
            console.log(`🎰 [API] input "${raw}" on '${block.type}' (key=${key}): slots=[${slots.map(s =>
                `${s.slotId}/${this.fieldKind(s.field)}${s.owner !== block ? `@${s.owner.type}${(typeof s.owner.isShadow === "function" && s.owner.isShadow()) ? "(shadow)" : "(preset)"}` : ""}${written.has(s.slotId) ? "✔" : ""}`
            ).join(", ")}]`);
            // Positional fill over slots NOT yet written: first one that
            // accepts the value wins; if none accepts, take the first
            // unwritten (so setFieldValue surfaces the real error); if all
            // are written, re-target the last slot.
            const unwritten = slots.filter(s => !written.has(s.slotId));
            const slot = unwritten.find(s => this.fieldAccepts(s.field, raw))
                || unwritten[0]
                || slots[slots.length - 1];
            const res = this.setFieldValue(slot.owner, slot.field, raw);
            if (res.ok) written.add(slot.slotId);
            console.log(`   → wrote slot '${slot.slotId}', ok=${res.ok}${res.ok ? "" : `, why=${res.why}`}`);
            const ownerNote = (slot.owner !== block) ? ` on ${(typeof slot.owner.isShadow === "function" && slot.owner.isShadow()) ? "shadow" : "preset"} '${slot.owner.type}'` : "";
            return { ok: res.ok, kind: res.kind, why: res.why, fieldName: (slot.field.name || slot.slotId) + ownerNote };
        },

        // ---- verification (also used by the drag engine) ----------------------

        // true  => model confirms the child is connected under the parent
        // false => model confirms the child is loose / attached elsewhere
        // null  => can't judge on this build (caller falls back to geometry)
        verifyAttachedDom: function (childDom, parentDom) {
            const ws = this.getWorkspace();
            if (!ws || !childDom) return null;
            const cid = childDom.getAttribute("data-id");
            const child = cid ? ws.getBlockById(cid) : null;
            if (!child) return null;
            const direct = (typeof child.getParent === "function") ? child.getParent() : undefined;
            if (direct === undefined) return null;
            if (!direct) return false;
            const pid = parentDom ? parentDom.getAttribute("data-id") : null;
            if (!pid) return true; // attached to SOMETHING; can't name the parent
            let cur = direct, guard = 0;
            while (cur && guard++ < 500) {
                if (cur.id === pid) return true;
                cur = cur.getParent ? cur.getParent() : null;
            }
            return false;
        },
    };

    console.log("✅ Blockly API Engine V1 loaded.");
})();
