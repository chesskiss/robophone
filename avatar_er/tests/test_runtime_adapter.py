from __future__ import annotations

import unittest
from unittest.mock import patch

from robophone.avatar_er.adapters import GroundEvalManualQaProvider
from robophone.avatar_er.models import ManualQaRequest


class GroundEvalAdapterTests(unittest.TestCase):
    @patch("robophone.ground_eval.runtime.generate_response")
    def test_ground_eval_adapter_uses_runtime_service(self, mock_generate_response) -> None:
        mock_generate_response.return_value = {"raw_text": "Use the LCD block.", "raw_response": {}}
        provider = GroundEvalManualQaProvider(model="demo-model")
        response = provider.answer(
            ManualQaRequest(
                question="How do I display text on the LCD?",
                current_task="lcd task",
                tone="encouraging",
                detail_level="step_by_step",
                context={"source": "test"},
            )
        )
        self.assertEqual(response.answer_text, "Use the LCD block.")
        self.assertEqual(response.backend, "robophone.ground_eval")


if __name__ == "__main__":
    unittest.main()
