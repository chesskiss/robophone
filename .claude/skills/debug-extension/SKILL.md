---
name: debug-extension
description: After the user runs the Blockly extension, reads ~/Downloads/blockly_debug.json, validates the generated Python code against the prompt, identifies whether the bug is in the planner (LLM instructions) or executor (JS source), and fixes the root cause in the right file.
---

# Debug Extension

The user has already reloaded and run the extension. The extension saves a structured log to `~/Downloads/blockly_debug.json` after every run.

---

## Step 1 — Read the log

Use the `Read` tool on `/Users/arnoldcheskis/Downloads/blockly_debug.json`.

If `ts` is more than 5 minutes old, warn the user and ask them to run again.

Key fields:
- `prompt` — what the user asked
- `geminiScript` — raw Gemini function call (what the LLM decided to build)
- `normalizedScript` — after normalization (what was actually sent to Blockly)
- `dropped` — commands the normalizer rejected, each with a `reason`
- `spawnStats` — `{ api, drag }` block placement counts
- `inputFailures` — `[{ block, value, why }]` per failed field
- `generatedCode` — Python code extracted from the Robo-Phone code panel after the run
- `error` — top-level error if the run threw

---

## Step 2 — Validate the output

Compare `generatedCode` against `prompt`. Check:
- Is the mathematical intent correct? (right formula, right constants, right structure)
- Are the right blocks used? (e.g. `MATH_CONSTANT` for π, not `MATH_NUMBER` with `3.14159`)
- Are parameter values correct? (amplitude, frequency, range, step)
- Is the loop structure right?

If `generatedCode` is null, fall back to reasoning from `geminiScript` alone.

---

## Step 3 — Diagnose: planner bug or executor bug?

**Check `geminiScript` first.** It is the raw LLM output before any processing.

### If `geminiScript` already contains the wrong choice (wrong block, wrong value, wrong structure):
→ **Planner bug.** The LLM didn't know about the right block or rule.
→ Fix in: `blockly-automation/extension/robophone_llm_instructions.md`
→ Add or correct the block entry, add an explicit rule or example showing the correct approach.

### If `geminiScript` looks correct but `normalizedScript` differs:
→ **Normalizer bug.** The normalizer in `background.js` is dropping or mangling valid commands.
→ Fix in: `blockly-automation/extension/background.js` — `normalizeGeneratedScript()`

### If `normalizedScript` is correct but `inputFailures` or `spawnStats` show problems:
→ **Executor bug.** The block placement or field injection failed.
→ Fix in: `blockly-automation/extension/blockly_methods.js` or `blockly_api_engine.js`

### If `error` is non-null:
→ Find which stage threw — message will indicate whether it's normalization, page injection, or Gemini API.

State the diagnosis explicitly before touching any file.

---

## Step 4 — Fix the root cause

### For planner bugs (`robophone_llm_instructions.md`):
- Find the relevant block section (search by block name or category)
- If the block is missing entirely, add a new entry following the existing format
- Add an explicit usage rule if needed (e.g. "Use MATH_CONSTANT for π, e, φ — never MATH_NUMBER with a hardcoded approximation")
- Add a concrete example showing the correct `geminiScript` pattern

### For normalizer bugs (`background.js`):
- Fix `normalizeGeneratedScript()` — the logic that drops or rewrites commands

### For executor bugs (`blockly_methods.js` / `blockly_api_engine.js`):
- Fix the underlying placement or field logic — not a per-command guard

After editing, briefly explain: what was wrong, why the fix addresses all future occurrences of this class of bug, not just this one instance.

---

## All-clear condition

If `generatedCode` correctly implements `prompt`, `dropped` is empty, `inputFailures` is empty, and `error` is null — say: **"All clear — last run completed successfully."**

---

## File map

| File | Role |
|------|------|
| `robophone_llm_instructions.md` | Planner: tells Gemini which blocks exist and when to use them |
| `background.js` | Normalizer + orchestrator: validates and dispatches LLM output |
| `blockly_api_engine.js` | Executor: programmatic Blockly field/block API |
| `blockly_methods.js` | Executor: drag-based fallback, DOM field injection |
| `content_script.js` | Bridge: popup ↔ page messaging |
