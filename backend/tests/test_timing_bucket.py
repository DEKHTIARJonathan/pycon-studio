"""Unit tests for _timing_bucket.

The bucketing function lives inside the generation router and is responsible
for aggregating progress callback descriptions into named stages. Substring
overlap (e.g. "lm" appearing inside "calm", "caption" appearing inside both
LM and conditioning phases) used to misroute timings; these tests pin the
behavior so future tweaks don't quietly regress it.
"""

import pytest

from bangers.routers.generation import _timing_bucket


@pytest.mark.parametrize(
    "desc,expected",
    [
        # ACE 5Hz LM phase markers
        ("Generating 5Hz audio codes", "ace_5hz_lm"),
        ("LM phase 1 metadata", "ace_5hz_lm"),
        ("Generating Lyrics", "ace_5hz_lm"),
        ("Generating caption", "ace_5hz_lm"),
        ("Phase 2 audio codes", "ace_5hz_lm"),
        # Should NOT match ace_5hz_lm because "lm" is embedded in another word
        ("Calm strings playing softly", "backend_other"),
        ("Album metadata complete", "ace_5hz_lm"),  # contains "metadata"
        # Text conditioning is distinct from caption-LM
        ("Encoding text conditioning", "text_conditioning"),
        ("Encode caption embeddings", "text_conditioning"),
        # DiT
        ("Running DiT step 12 of 50", "dit"),
        ("Diffusion sampling step 7", "dit"),
        ("Denoising stage", "dit"),
        # VAE wins over generic decode
        ("Decoding VAE", "vae"),
        ("Decode_audio chunk", "vae"),
        # Normalization
        ("Normalizing loudness", "normalization"),
        ("Loudness pass", "normalization"),
        # Audio save / export
        ("Saving FLAC", "audio_save"),
        ("Writing output file", "audio_save"),
        ("Exporting MP3", "audio_save"),
        # Empty / unknown stays bucketed as backend_other
        ("", "backend_other"),
        ("Some other progress text", "backend_other"),
    ],
)
def test_timing_bucket(desc, expected):
    assert _timing_bucket(desc) == expected
