(function initPlannerClient(globalScope) {
    const { BLOCK_METADATA } = globalScope.BlocklyPlannerCatalog;
    const { loadRoboPhoneManual } = globalScope.BlocklyManualLoader;
    const { buildPlannerRequest } = globalScope.BlocklyPlannerPrompt;
    const { normalizeGeneratedScript } = globalScope.BlocklyPlannerNormalizer;
    const { validateCanonicalScript } = globalScope.BlocklyPlannerSchema;
    const { getPageContext, executePlannedScript } = globalScope.BlocklyExecutorBridge;

    async function planInstruction({ prompt, apiKey, tabId }) {
        const { tab, context } = await getPageContext(tabId);
        const manualText = await loadRoboPhoneManual();
        const { url, body } = buildPlannerRequest({
            prompt,
            apiKey,
            manualText,
            pageContext: context,
        });
        console.log(`[BlocklyAgent] POST ${url.replace(apiKey, "<key>")}`);
        console.log(`[BlocklyAgent] manual length=${manualText.length} chars`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180_000);
        const bodyJson = JSON.stringify(body);
        console.log(`[BlocklyAgent] request body size=${bodyJson.length} bytes`);

        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: bodyJson,
                signal: controller.signal,
            });
        } catch (fetchErr) {
            if (fetchErr.name === "AbortError") {
                throw new Error("Gemini request timed out after 180s.");
            }
            throw new Error(`Network error reaching Gemini: ${fetchErr.message}`);
        } finally {
            clearTimeout(timeoutId);
        }

        console.log(`[BlocklyAgent] HTTP ${response.status} ${response.statusText}`);
        const data = await response.json();
        if (data.error) {
            throw new Error(`Gemini API: ${data.error.message || JSON.stringify(data.error)}`);
        }
        if (!response.ok) {
            throw new Error(`Gemini HTTP ${response.status}: ${response.statusText}`);
        }
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("Gemini returned no candidates (possibly blocked by safety filters).");
        }

        const candidate = data.candidates[0];
        if (!candidate.content || !Array.isArray(candidate.content.parts)) {
            throw new Error(`Gemini returned no content (finishReason=${candidate.finishReason || "unknown"}).`);
        }

        const calls = candidate.content.parts.filter((part) => part.functionCall);
        if (calls.length === 0) {
            const textOut = candidate.content.parts.find((part) => part.text)?.text || "";
            return {
                status: "noop",
                message: textOut || "Gemini didn't return any specific actions.",
                pageContext: context,
            };
        }

        const plans = [];
        for (const call of calls) {
            if (call.functionCall.name !== "execute_blockly_script") {
                continue;
            }
            const rawScript = call.functionCall.args?.script || [];
            const { script, dropped } = normalizeGeneratedScript(rawScript);
            const validation = validateCanonicalScript(script);
            if (!validation.ok) {
                throw new Error(`Canonical script validation failed: ${validation.errors.join("; ")}`);
            }
            plans.push({
                rawScript,
                internalPlan: buildInternalPlan(script),
                script,
                dropped,
            });
        }

        if (plans.length === 0) {
            throw new Error("Gemini returned tool calls, but none targeted execute_blockly_script.");
        }

        return {
            status: "planned",
            tabId: tab.id,
            pageContext: context,
            plans,
            usageMetadata: data.usageMetadata || null,
        };
    }

    async function executeInstruction({ prompt, apiKey, tabId }) {
        const planned = await planInstruction({ prompt, apiKey, tabId });
        if (planned.status !== "planned") {
            return planned;
        }

        let totalCommandsSent = 0;
        let totalSpawnedCount = 0;
        const executionDiagnostics = [];
        for (const plan of planned.plans) {
            totalCommandsSent += plan.script.length;
            const out = await executePlannedScript(plan.script, tabId);
            if (out && out.result && typeof out.result.spawnedCount === "number") {
                totalSpawnedCount += out.result.spawnedCount;
            }
            if (out?.result?.diagnostics) {
                executionDiagnostics.push(...out.result.diagnostics);
            }
        }

        return {
            status: "success",
            actions: ["execute_blockly_script"],
            commandsEmitted: totalCommandsSent,
            blocksPlaced: totalSpawnedCount,
            pageContext: planned.pageContext,
            plans: planned.plans,
            executionDiagnostics,
        };
    }

    function buildInternalPlan(script) {
        return script.map((command) => {
            if (command.action === "spawn") {
                return {
                    kind: "spawn_block",
                    block_key: command.block,
                    category_path: command.cat,
                    logical_id: command.id,
                    parent_id: command.parent,
                    attachment_kind: deriveAttachment(command),
                };
            }
            return {
                kind: "set_field",
                targetId: command.block,
                targetBlockKey: command.target_block_key || null,
                fieldSelector: command.field_selector,
                value: command.value,
            };
        });
    }

    function deriveAttachment(command) {
        if (!command.parent) return "root";
        if (command.pos === "next") return "statement_next";
        const metadata = BLOCK_METADATA[command.block];
        if (metadata?.kind === "value") {
            return "value_nested";
        }
        return "statement_nested";
    }

    globalScope.BlocklyPlannerClient = {
        planInstruction,
        executeInstruction,
    };
})(self);
