(function initPlannerPrompt(globalScope) {
    const { tools, BLOCK_CATEGORY_MAP, BLOCK_METADATA, GEMINI_MODEL } = globalScope.BlocklyPlannerCatalog;

    function buildPlannerRequest({ prompt, apiKey, manualText, pageContext }) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
        return {
            url,
            body: {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                tools,
                tool_config: { function_calling_config: { mode: "AUTO" } },
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 16384,
                    thinkingConfig: { thinkingBudget: 8192 },
                },
                system_instruction: {
                    parts: [
                        {
                            text: buildSystemPrompt(pageContext),
                        },
                        ...(manualText ? [{ text: `ROBOPHONE BLOCK MANUAL\n=======================\n\n${manualText}` }] : []),
                    ],
                },
            },
        };
    }

    function buildSystemPrompt(pageContext) {
        return `You are a Blockly automation assistant for the Robo-Phone custom Blockly UI. Use the 'execute_blockly_script' tool.

You are the planner only. Produce a canonical block plan that a deterministic executor will run.

SCRIPT RULES:
1. ALWAYS call the tool. Never answer in prose.
2. Every command must have action and block.
3. action='spawn':
- block is the Robo-Phone Blockly Msg key in UPPER_SNAKE_CASE.
- id is a short logical id for later references.
- cat is the full category path.
- parent references a prior logical id when nesting or chaining.
- pos is only 'nested' or 'next'.
4. action='input':
- block is a previously spawned logical id.
- Prefer field_selector over field.
- field_selector.role is the semantic field role like text, color, size, from, to, by, variable, operation.
- field_selector.kind should be one of text, dropdown, checkbox, unknown when you can infer it.
- field_selector.index is a fallback editable field index.
- value is plain text or dropdown text.
- Never use logical ids as input values.
5. Use INITIATE for runnable programs unless the user explicitly asks for a value-only expression.
6. Treat statement blocks and value blocks differently:
- statement blocks build the flow
- value blocks go into parent value sockets via spawn + parent + pos:'nested'
7. Cap blocks like INITIATE do not accept pos:'next' as their first child. The first child must be nested.
8. If you need multiple fields on the same block, emit multiple input commands with explicit field_selector values.
9. Prefer exact block keys and category paths from the catalog below.

PAGE CONTEXT:
${JSON.stringify(pageContext, null, 2)}

AVAILABLE BLOCK CATEGORY MAP:
${renderCategoryCatalog(BLOCK_CATEGORY_MAP)}

COMMON BLOCK METADATA:
${renderBlockMetadata(BLOCK_METADATA)}

Return only a tool call for execute_blockly_script.`;
    }

    function renderCategoryCatalog(blockCategoryMap) {
        const groups = new Map();
        for (const [blockKey, category] of Object.entries(blockCategoryMap)) {
            if (!groups.has(category)) {
                groups.set(category, []);
            }
            groups.get(category).push(blockKey);
        }
        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, keys]) => `- ${category}: ${keys.sort().join(", ")}`)
            .join("\n");
    }

    globalScope.BlocklyPlannerPrompt = {
        buildPlannerRequest,
    };

    function renderBlockMetadata(metadata) {
        return Object.entries(metadata)
            .map(([blockKey, info]) => {
                const fieldSpecs = Array.isArray(info.field_specs) && info.field_specs.length > 0
                    ? `field_specs=${info.field_specs.map((field, index) => `${index}:${field.role}/${field.kind}/${field.fieldName || "?"}`).join(", ")}`
                    : "field_specs=none";
                const valueInputs = Array.isArray(info.valueInputs) && info.valueInputs.length > 0
                    ? `value_inputs=${info.valueInputs.map((input) => `${input.role}/${input.inputName}/${input.literalKind}`).join(", ")}`
                    : "value_inputs=none";
                return `- ${blockKey}: type=${info.blockType || "?"}, kind=${info.kind}, attachment=${info.attachment_default}, cat=${JSON.stringify(info.categoryPath)}, ${fieldSpecs}, ${valueInputs}`;
            })
            .join("\n");
    }
})(self);
