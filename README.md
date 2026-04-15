# Robophone Evaluation Harness

This module runs lightweight grounding evaluations against a Groq model. It is intended for document iteration: provide a grounding document, a set of test inputs, and save the model outputs for later manual review.

It does not execute Blockly, generate runnable code, or integrate with the rest of the Robophysics app.

## Requirements

- Python 3.10+
- `GROQ_API_KEY` environment variable
- Groq Python SDK installed if you want to call the live API:

```bash
pip install groq
```

## Files

- `runner.py`: CLI entry point
- `groq_client.py`: thin Groq wrapper
- `tests.py`: test loading and validation
- `report.py`: JSON and Markdown report generation
- `config.py`: default prompt text
- `sample_tests.json`: example test cases

## Usage

```bash
python -m robophone.runner \
  --doc path/to/doc.md \
  --tests robophone/sample_tests.json \
  --output robophone/output_report.json \
  --model some_groq_model
```

Optional flags:

- `--system-prompt "..."` to override the default prompt
- `--append` to append new results to an existing JSON report

## Output

The JSON report contains top-level metadata plus one result entry per test:

- `document_path`
- `model`
- `timestamp`
- `system_prompt`
- `results`

Each result includes:

- `id`
- `input`
- `expected`
- `generated_output`
- `raw_response`
- `basic_eval`

The Markdown summary is written beside the JSON report with the same filename stem and a `.md` extension. Each test is rendered as:

1. Input
2. Expected
3. Generated Output
