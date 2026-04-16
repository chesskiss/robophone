"""CLI shim for the grounding evaluation harness."""

try:
    from .ground_eval.runner import main
except ImportError:  # Support `python -m runner` from inside `robophone/`.
    from ground_eval.runner import main


if __name__ == "__main__":
    raise SystemExit(main())
