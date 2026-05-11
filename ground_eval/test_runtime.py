from __future__ import annotations

import unittest
from unittest.mock import patch

from robophone.ground_eval.runtime import GroundEvalRuntimeRequest, GroundEvalRuntimeService


class GroundEvalRuntimeTests(unittest.TestCase):
    @patch("robophone.ground_eval.runtime.generate_response")
    def test_answer_returns_runtime_shape(self, mock_generate_response) -> None:
        mock_generate_response.return_value = {"raw_text": "Use the LCD display block.", "raw_response": {}}
        service = GroundEvalRuntimeService(document_path="robophone/ground_eval/robophone_llm_instructions.md")
        response = service.answer(
            GroundEvalRuntimeRequest(
                question="How do I display text on the LCD?",
                current_task="testing LCD",
                tone="encouraging",
                detail_level="step_by_step",
                context={"source": "test"},
            )
        )
        self.assertEqual(response.answer_text, "Use the LCD display block.")
        self.assertEqual(response.backend, "robophone.ground_eval")


if __name__ == "__main__":
    unittest.main()
