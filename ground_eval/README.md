# Robophone Grounding Evaluation and Runtime QA

This module provides:

- a lightweight batch harness for evaluating whether a Groq model selects the right Robophone block or function when grounded with a document
- a runtime question-answering service that ER can call for live manual guidance

It still does not execute Blockly blocks or generate code, but it now also exposes a runtime single-question answer path.

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

## Runtime Service

The runtime service is additive and does not replace the batch evaluation flow.

Service module:

- `robophone/ground_eval/runtime.py`

FastAPI app:

- `robophone/ground_eval/app.py`

Run with:

```bash
uvicorn ground_eval.app:application --reload --port 8010
```

Endpoints:

- `GET /health`
- `POST /v1/runtime/answer`

Example request:

```json
{
  "question": "How do I display text on the LCD?",
  "current_task": "building a RoboPhone LCD demo",
  "tone": "encouraging",
  "detail_level": "step_by_step",
  "context": {
    "source": "avatar_er"
  }
}
```
