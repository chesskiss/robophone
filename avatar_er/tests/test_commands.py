from __future__ import annotations

import unittest

from robophone.avatar_er.commands import interpret_command
from robophone.avatar_er.models import AvatarState


class CommandInterpreterTests(unittest.TestCase):
    def test_stop_responding_enables_silent_mode(self) -> None:
        result = interpret_command("stop responding", AvatarState())
        self.assertTrue(result.handled)
        self.assertEqual(result.updated_settings["responsiveness_mode"], "silent")

    def test_explain_more_simply_sets_beginner_tone(self) -> None:
        result = interpret_command("explain more simply", AvatarState())
        self.assertTrue(result.handled)
        self.assertEqual(result.updated_settings["tone"], "beginner")


if __name__ == "__main__":
    unittest.main()
