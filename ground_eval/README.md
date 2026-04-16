# Robophone Grounding Evaluation

This module provides a lightweight harness for evaluating whether a Groq model
selects the right Robophone block or function when grounded with a document.

It is intended for document-quality evaluation only. It does not execute Blockly
blocks, generate code, or integrate with the UI.

## Requirements

- Python 3.11+
- `GROQ_API_KEY` in the environment

You can install dependencies with `uv` from inside `robophone/`:

```bash
uv sync
```

## Environment

Create a local environment file if needed in `robophone/.env`:

```bash
cp .env.example .env
```

Required variable:

```env
GROQ_API_KEY=your_api_key_here
```

## Run

From inside `robophone/ground_eval`:

```bash
python -m runner \
  --doc robophone_llm_instructions.md \
  --tests sample_tests.json \
  --output output_report.json \
  --model llama-3.3-70b-versatile
```

Optional flags:

- `--system-prompt "..."` to override the default prompt
- `--append` to append to an existing JSON report instead of overwriting it

## Output

The JSON report includes:

- document path
- model
- run type
- timestamp
- one result per test with input, expected output, generated output, raw response,
  and a basic string-based evaluation

The run also writes a comparison report using `robophone_llm_baseline_instructions.md`:

- `output_report.json`: grounded run
- `output_report_baseline.json`: same tests, same model, baseline instructions
- `output_report.md`: side-by-side manual review summary

The Markdown summary shows each test as:

- Input
- Expected
- Generated Output With Document
- Generated Output With Baseline Document
