(function initPlannerNormalizer(globalScope) {
    const { BLOCK_CATEGORY_MAP, NESTED_CATEGORIES, BLOCK_METADATA } = globalScope.BlocklyPlannerCatalog;

    function normalizeCategoryPath(cat, blockKey) {
        const normalizeToken = (token) => String(token || "").trim().replace(/^\[/, "").replace(/\]$/, "");

        let path;
        if (Array.isArray(cat) && cat.length > 0) {
            path = cat.map(normalizeToken).filter(Boolean);
        } else if (typeof cat === "string" && cat.trim()) {
            path = [normalizeToken(cat)];
        } else {
            const mapped = BLOCK_CATEGORY_MAP[blockKey];
            path = mapped ? [mapped] : null;
        }
        if (!path || path.length === 0) {
            return cat;
        }

        const leaf = path[path.length - 1];
        const parent = NESTED_CATEGORIES[leaf];
        if (parent && !path.includes(parent)) {
            return [parent, ...path];
        }
        return path;
    }

    function normalizeFieldSelector(fieldSelector, legacyField) {
        const out = {};
        if (fieldSelector && typeof fieldSelector === "object") {
            if (typeof fieldSelector.role === "string" && fieldSelector.role.trim()) {
                out.role = fieldSelector.role.trim();
            }
            if (Number.isInteger(fieldSelector.index) && fieldSelector.index >= 0) {
                out.index = fieldSelector.index;
            }
            if (typeof fieldSelector.label === "string" && fieldSelector.label.trim()) {
                out.label = fieldSelector.label.trim();
            }
            if (["text", "dropdown", "checkbox", "unknown"].includes(fieldSelector.kind)) {
                out.kind = fieldSelector.kind;
            }
        }
        if (!Number.isInteger(out.index) && Number.isInteger(legacyField) && legacyField >= 0) {
            out.index = legacyField;
        }
        return out;
    }

    function buildFallbackFieldSelector(metadata, index) {
        const fieldSpecs = Array.isArray(metadata?.field_specs) ? metadata.field_specs : [];
        const valueInputs = Array.isArray(metadata?.valueInputs) ? metadata.valueInputs : [];
        const ordered = [
            ...valueInputs.map((input) => ({
                role: input.role,
                kind: input.literalKind === "number"
                    ? "text"
                    : (input.literalKind === "boolean" ? "checkbox" : "text"),
                label: input.inputName,
            })),
            ...fieldSpecs.map((field) => ({
                role: field.role,
                kind: field.kind,
                label: field.fieldName || (Array.isArray(field.labels) ? field.labels[0] : undefined),
            })),
        ];
        const spec = ordered[index] || null;
        const selector = {};
        if (spec?.role) selector.role = spec.role;
        if (spec?.kind) selector.kind = spec.kind;
        if (Number.isInteger(index) && index >= 0) selector.index = index;
        if (spec?.label) selector.label = spec.label;
        return selector;
    }

    function normalizeGeneratedScript(script) {
        const knownIds = new Set();
        const idToBlockKey = new Map();
        const inputFieldCursorByTarget = new Map();
        let lastSpawnId = null;
        const dropped = [];
        const out = [];

        const SPAWN_BLOCK_ALIASES = ["block", "block_key", "blockKey", "type", "block_type", "blockType", "target_block", "name"];
        const INPUT_TARGET_ALIASES = ["block", "target", "target_id", "targetId", "block_id", "blockId", "ref"];

        for (const command of script || []) {
            if (!command || typeof command !== "object") {
                dropped.push({ reason: "non-object command", command });
                continue;
            }

            const normalized = { ...command };

            if (normalized.action === "spawn") {
                if (!normalized.block || typeof normalized.block !== "string") {
                    for (const key of SPAWN_BLOCK_ALIASES) {
                        if (typeof normalized[key] === "string" && normalized[key].trim()) {
                            normalized.block = normalized[key];
                            break;
                        }
                    }
                }
                if ((!normalized.block || typeof normalized.block !== "string")
                    && typeof normalized.id === "string"
                    && /^[A-Z][A-Z0-9_]+$/.test(normalized.id)) {
                    normalized.block = normalized.id;
                    normalized.id = `${normalized.id.toLowerCase()}_${Math.random().toString(36).slice(2, 5)}`;
                }
                if (!normalized.block || typeof normalized.block !== "string") {
                    dropped.push({ reason: "spawn missing 'block' key", command });
                    continue;
                }
                normalized.cat = normalizeCategoryPath(normalized.cat, normalized.block);
                if (!Array.isArray(normalized.cat) || normalized.cat.length === 0 || !normalized.cat[0]) {
                    dropped.push({ reason: `spawn '${normalized.block}': no category resolved`, command });
                    continue;
                }
                if (!normalized.id || typeof normalized.id !== "string") {
                    normalized.id = `${normalized.block.toLowerCase()}_${out.length + 1}`;
                }
                knownIds.add(normalized.id);
                idToBlockKey.set(normalized.id, normalized.block);
                lastSpawnId = normalized.id;
                out.push({
                    action: "spawn",
                    block: normalized.block,
                    cat: normalized.cat,
                    id: normalized.id,
                    parent: normalized.parent,
                    pos: normalized.pos,
                });
                continue;
            }

            if (normalized.action === "input") {
                if (normalized.value === undefined || normalized.value === null) {
                    dropped.push({ reason: "input missing 'value'", command });
                    continue;
                }
                normalized.value = String(normalized.value);

                if (!normalized.block || typeof normalized.block !== "string") {
                    for (const key of INPUT_TARGET_ALIASES) {
                        if (typeof normalized[key] === "string" && normalized[key].trim() && knownIds.has(normalized[key])) {
                            normalized.block = normalized[key];
                            break;
                        }
                    }
                }
                const target = normalized.block;
                if (!target || !knownIds.has(target)) {
                    if (lastSpawnId) {
                        normalized.block = lastSpawnId;
                    } else {
                        dropped.push({ reason: "input has no spawn target", command });
                        continue;
                    }
                }
                const targetBlockKey = idToBlockKey.get(normalized.block);
                const metadata = targetBlockKey ? BLOCK_METADATA[targetBlockKey] : null;
                const currentCursor = inputFieldCursorByTarget.get(normalized.block) || 0;
                let fieldSelector = normalizeFieldSelector(normalized.field_selector, normalized.field);
                if ((!Number.isInteger(fieldSelector.index) || fieldSelector.index < 0)
                    && (!fieldSelector.role && !fieldSelector.label && !fieldSelector.kind)) {
                    fieldSelector = buildFallbackFieldSelector(metadata, currentCursor);
                } else if ((!fieldSelector.role && !fieldSelector.kind && !fieldSelector.label)
                    && Number.isInteger(fieldSelector.index)
                    && metadata) {
                    const inferred = buildFallbackFieldSelector(metadata, fieldSelector.index);
                    fieldSelector = {
                        ...fieldSelector,
                        ...inferred,
                        index: fieldSelector.index,
                    };
                }
                if (!Number.isInteger(fieldSelector.index) || fieldSelector.index < 0) {
                    fieldSelector = buildFallbackFieldSelector(metadata, currentCursor);
                }
                inputFieldCursorByTarget.set(normalized.block, Number(fieldSelector.index || currentCursor) + 1);
                out.push({
                    action: "input",
                    block: normalized.block,
                    target_block_key: targetBlockKey || undefined,
                    field_selector: fieldSelector,
                    value: normalized.value,
                });
                continue;
            }

            dropped.push({ reason: `unknown action '${normalized.action}'`, command });
        }

        return { script: out, dropped };
    }

    globalScope.BlocklyPlannerNormalizer = {
        normalizeCategoryPath,
        normalizeGeneratedScript,
    };
})(self);
