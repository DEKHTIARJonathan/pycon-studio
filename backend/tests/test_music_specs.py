import pytest


def test_genre_profiles_resolve_create_aliases():
    from bangers.services.music_profiles import resolve_genre_profile

    assert resolve_genre_profile("countries").name == "Country"
    assert resolve_genre_profile("dirty blues guitar").name == "Blues"
    assert resolve_genre_profile("roots reggae dub").name == "Reggae"
    assert resolve_genre_profile("make rock").name == "Rock 'n' Roll"
    assert resolve_genre_profile("melodic house edm").name == "EDM"


@pytest.mark.asyncio
async def test_quality_spec_expands_short_create_prompt_without_chat_llm():
    from bangers.services.music_specs import build_music_spec

    spec = await build_music_spec(prompt="make rock", instrumental=False)

    assert spec["success"] is True
    assert spec["quality_profile"] == "Rock 'n' Roll"
    assert spec["spec_source"].endswith("fallback-lyrics")
    assert "simple memorable electric guitar riff" in spec["caption"]
    assert "Avoid modern EDM synthesis" in spec["caption"]
    assert spec["lyrics"].startswith("[verse]")
    assert spec["bpm"] is not None


@pytest.mark.asyncio
async def test_quality_spec_keeps_instrumental_profiles_lyricless():
    from bangers.services.music_specs import build_music_spec

    spec = await build_music_spec(prompt="edm", instrumental=True)

    assert spec["quality_profile"] == "EDM"
    assert spec["lyrics"] == ""
    assert "sidechained bass groove" in spec["caption"]
    assert "Avoid vague festival hype" in spec["caption"]
    assert 124 <= spec["bpm"] <= 130
