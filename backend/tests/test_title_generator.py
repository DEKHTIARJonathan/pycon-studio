import pytest


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("<think>reasoning</think>\nNeon Delay", "Neon Delay"),
        ("<THINK>\nreasoning\n</THINK>\n\"Neon Delay.\"", "Neon Delay"),
        ("reasoning that started earlier</think>\nNeon Delay", "Neon Delay"),
        ("Neon Delay\n<think>trailing reasoning that was cut off", "Neon Delay"),
        ("<think>\nreasoning that was cut off", ""),
    ],
)
def test_clean_title_strips_thinking_tags(raw, expected):
    from bangers.services.title_generator import clean_title

    assert clean_title(raw) == expected


@pytest.mark.asyncio
async def test_generate_song_title_falls_back_when_thinking_never_closes(monkeypatch):
    from bangers.services import title_generator

    class ThinkingProvider:
        async def chat(self, *_args, **_kwargs):
            return "<think>\nI need to invent a title but the response was truncated"

    async def configured_llm():
        return ThinkingProvider(), "thinking-model"

    monkeypatch.setattr(title_generator, "_get_configured_llm", configured_llm)
    monkeypatch.setattr(title_generator, "pick_random_title", lambda *_args: "Fallback Title")

    title = await title_generator.generate_song_title(
        caption="bright synth pop",
        genre="pop",
        mood="bright",
        fallback="Untitled",
    )

    assert title == "Fallback Title"
