(function initPlannerSchema(globalScope) {
    function isNonEmptyString(value) {
        return typeof value === "string" && value.trim().length > 0;
    }

    function hasUsableFieldSelector(selector) {
        if (!selector || typeof selector !== "object") return false;
        const hasRole = isNonEmptyString(selector.role);
        const hasIndex = Number.isInteger(selector.index) && selector.index >= 0;
        const hasLabel = isNonEmptyString(selector.label);
        const hasKind = ["text", "dropdown", "checkbox", "unknown"].includes(selector.kind);
        return hasRole || hasIndex || hasLabel || hasKind;
    }

    function validateCanonicalScript(script) {
        const errors = [];
        const knownIds = new Set();

        if (!Array.isArray(script)) {
            return { ok: false, errors: ["Script must be an array."] };
        }

        script.forEach((command, index) => {
            if (!command || typeof command !== "object") {
                errors.push(`command[${index}] must be an object`);
                return;
            }
            if (command.action === "spawn") {
                if (!isNonEmptyString(command.block)) {
                    errors.push(`command[${index}] spawn missing block`);
                }
                if (!Array.isArray(command.cat) || command.cat.length === 0 || command.cat.some((part) => !isNonEmptyString(part))) {
                    errors.push(`command[${index}] spawn missing category path`);
                }
                if (!isNonEmptyString(command.id)) {
                    errors.push(`command[${index}] spawn missing logical id`);
                } else {
                    knownIds.add(command.id);
                }
                if (command.parent !== undefined && command.parent !== null && !isNonEmptyString(command.parent)) {
                    errors.push(`command[${index}] spawn parent must be a non-empty string`);
                }
                if (command.parent && !knownIds.has(command.parent)) {
                    errors.push(`command[${index}] spawn parent references unknown id '${command.parent}'`);
                }
                if (command.pos !== undefined && command.pos !== null && !["nested", "next"].includes(command.pos)) {
                    errors.push(`command[${index}] spawn pos must be 'nested' or 'next'`);
                }
                return;
            }
            if (command.action === "input") {
                if (!isNonEmptyString(command.block)) {
                    errors.push(`command[${index}] input missing target block`);
                } else if (!knownIds.has(command.block)) {
                    errors.push(`command[${index}] input target '${command.block}' has not been spawned`);
                }
                if (!hasUsableFieldSelector(command.field_selector)) {
                    errors.push(`command[${index}] input missing usable field selector`);
                }
                if (!isNonEmptyString(command.value)) {
                    errors.push(`command[${index}] input missing value`);
                }
                if (command.target_block_key !== undefined && command.target_block_key !== null && !isNonEmptyString(command.target_block_key)) {
                    errors.push(`command[${index}] input target_block_key must be a non-empty string`);
                }
                return;
            }
            errors.push(`command[${index}] action must be 'spawn' or 'input'`);
        });

        return { ok: errors.length === 0, errors };
    }

    globalScope.BlocklyPlannerSchema = {
        validateCanonicalScript,
    };
})(self);
