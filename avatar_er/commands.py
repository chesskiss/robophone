from __future__ import annotations

from .models import AvatarState, CommandResult


def interpret_command(text: str | None, state: AvatarState) -> CommandResult:
    normalized = _normalize(text)
    if not normalized:
        return CommandResult(handled=False)

    if _contains_any(normalized, ["stop responding", "stop talking", "be quiet"]):
        return CommandResult(
            handled=True,
            action="update_settings",
            updated_settings={"responsiveness_mode": "silent"},
            response_text="Okay, I'll stay quiet.",
            command_name="silent_mode",
        )

    if _contains_any(normalized, ["talk less", "reduce responsiveness"]):
        return CommandResult(
            handled=True,
            action="update_settings",
            updated_settings={"responsiveness_mode": "low"},
            response_text="Okay, I'll keep it brief.",
            command_name="low_responsiveness",
        )

    if _contains_any(normalized, ["talk more", "respond normally"]):
        return CommandResult(
            handled=True,
            action="update_settings",
            updated_settings={"responsiveness_mode": "normal"},
            response_text="Okay, I'm back to normal responses.",
            command_name="normal_responsiveness",
        )

    if _contains_any(normalized, ["be more encouraging"]):
        return CommandResult(
            handled=True,
            action="update_settings",
            updated_settings={"tone": "encouraging"},
            response_text="Okay, I'll be more encouraging.",
            command_name="encouraging_tone",
        )

    if _contains_any(normalized, ["explain slower", "explain more simply"]):
        return CommandResult(
            handled=True,
            action="update_settings",
            updated_settings={"tone": "beginner"},
            response_text="Okay, I'll explain more simply and step by step.",
            command_name="beginner_tone",
        )

    if _contains_any(normalized, ["be more technical", "use technical terms"]):
        return CommandResult(
            handled=True,
            action="update_settings",
            updated_settings={"tone": "technical"},
            response_text="Okay, I'll keep the explanations more technical.",
            command_name="technical_tone",
        )

    if _contains_any(normalized, ["be neutral", "stay neutral"]):
        return CommandResult(
            handled=True,
            action="update_settings",
            updated_settings={"tone": "neutral"},
            response_text="Okay, I'll keep the tone neutral.",
            command_name="neutral_tone",
        )

    return CommandResult(handled=False)


def apply_command_result(state: AvatarState, result: CommandResult) -> AvatarState:
    for key, value in result.updated_settings.items():
        setattr(state, key, value)
    return state


def _normalize(text: str | None) -> str:
    return " ".join((text or "").lower().strip().split())


def _contains_any(text: str, patterns: list[str]) -> bool:
    return any(pattern in text for pattern in patterns)
