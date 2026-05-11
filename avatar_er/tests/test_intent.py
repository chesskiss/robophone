from __future__ import annotations

import unittest

from robophone.avatar_er.intent import classify_intent


class IntentClassifierTests(unittest.TestCase):
    def test_none_without_speech(self) -> None:
        result = classify_intent(None)
        self.assertEqual(result.intent, "none")

    def test_help_request(self) -> None:
        result = classify_intent("I don't understand")
        self.assertEqual(result.intent, "help_request")

    def test_manual_guidance_request(self) -> None:
        result = classify_intent("How do I graph sin and cos?")
        self.assertEqual(result.intent, "manual_block_guidance_request")


if __name__ == "__main__":
    unittest.main()
