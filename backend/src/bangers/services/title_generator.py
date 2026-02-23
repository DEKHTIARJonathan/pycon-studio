"""
LLM-powered title generation for songs and DJ conversations.

Uses the user-selected DJ chat model for short, creative titles.
Falls back to a random pick from a built-in list when no model is selected
or the runtime fails.
"""

import random
import re

from loguru import logger

from bangers.db.connection import get_db
from bangers.services.llm_provider import ChatRuntime, ChatRuntimeBusy, get_chat_runtime

_THINK_BLOCK_RE = re.compile(r"<think\b[^>]*>.*?</think\s*>", re.IGNORECASE | re.DOTALL)
_ORPHAN_THINK_PREFIX_RE = re.compile(r"^\s*.*?</think\s*>\s*", re.IGNORECASE | re.DOTALL)
_UNCLOSED_THINK_RE = re.compile(r"<think\b[^>]*>.*\Z", re.IGNORECASE | re.DOTALL)
_THINK_TAG_RE = re.compile(r"</?think\b[^>]*>", re.IGNORECASE)

_RANDOM_TITLE_EXAMPLES = [
    "Your Mama Likes Bananas",
    "Duckling Yellow",
    "Nightshift Boulevard",
    "MFW I Am at the Mall Picking Up Soap",
    "Cardboard Astronaut",
    "Three Cats on a Tuesday",
    "Velvet Parking Lot",
    "My Dentist Has a Pony",
    "Fog Machine Romance",
    "Leftover Spaghetti Dreams",
    "The Accountant's Mixtape",
    "Cactus in a Tuxedo",
    "Pigeons Know Something",
    "Lost My Keys in Long Beach",
    "Grandma's Turbo Engine",
    "Elevator to Nowhere",
    "Lukewarm Coffee Club",
    "Suspicious Mangoes",
    "Keynote at the Laundromat",
    "Flamingo on Line 4",
    "Raccoon Diplomacy",
    "Sunburn in December",
    "The Toaster Knows",
    "Parking Ticket Serenade",
    "Jellyfish Commute",
    "Blanket Fort Manifesto",
    "Haunted Vending Machine",
    "Squirrel with a Briefcase",
    "Terminal Lullaby",
    "Tuesday Smells Like Rain",
    "Goldfish Philosophy",
    "Shoelace Conspiracy",
    "Disco in the Basement",
    "Paper Airplane Dynasty",
    "The Moth Convention",
    "Sidewalk Astronomy",
    "Penguin on Parole",
    "Bubblewrap Symphony",
    "Llama at the Checkout",
    "Postcard from Saturn",
    "Invisible Bicycle",
    "Marmalade Emergency",
    "Twelve Spoons and a Hat",
    "Warehouse Daydream",
    "Borrowed Thunder",
    "Sloth in First Class",
    "Tambourine Verdict",
    "Half a Schedule",
    "Corduroy Moonlight",
    "Fortune Cookie Rebellion",
    "Umbrella for a Goldfish",
    "Static on Channel 9",
    "Origami Getaway Car",
    "Pockets Full of Fog",
    "Turnip Serenade",
]


async def _get_configured_llm() -> tuple[ChatRuntime | None, str]:
    """Return the runtime + model name for the user-selected chat model.

    Returns ``(None, "")`` when no chat model is selected or its runtime
    isn't available on this machine.
    """
    model_name = ""
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT value FROM settings WHERE key = 'dj_model'"
        )
        row = await cursor.fetchone()
        if row:
            model_name = row["value"]
    except Exception as e:
        logger.debug(f"Failed to read dj_model from settings: {e}")
        return (None, "")

    if not model_name:
        return (None, "")

    runtime = get_chat_runtime(model_name)
    if runtime is None or not runtime.is_model_loadable(model_name):
        return (None, model_name)
    return (runtime, model_name)


def clean_title(raw: str) -> str:
    """Strip thinking tags, quotes, and multi-line noise from LLM output."""
    cleaned = _THINK_BLOCK_RE.sub("", raw)
    cleaned = _ORPHAN_THINK_PREFIX_RE.sub("", cleaned)
    cleaned = _UNCLOSED_THINK_RE.sub("", cleaned)
    cleaned = _THINK_TAG_RE.sub("", cleaned).strip()
    # Take only the first non-empty line
    for line in cleaned.splitlines():
        line = line.strip()
        if line:
            cleaned = line
            break
    # Strip surrounding quotes
    if len(cleaned) >= 2 and cleaned[0] in ('"', "'", "\u201c") and cleaned[-1] in ('"', "'", "\u201d"):
        cleaned = cleaned[1:-1].strip()
    # Remove trailing period
    cleaned = cleaned.rstrip(".")
    # Cap length
    if len(cleaned) > 80:
        cleaned = cleaned[:77] + "..."
    return cleaned


def pick_random_title(avoid_titles: list[str] | None = None) -> str:
    pool = [t for t in _RANDOM_TITLE_EXAMPLES if t not in (avoid_titles or [])]
    return random.choice(pool) if pool else random.choice(_RANDOM_TITLE_EXAMPLES)


async def generate_song_title(
    caption: str,
    genre: str,
    mood: str,
    fallback: str,
    *,
    allow_holders: frozenset[str] | None = None,
) -> str:
    """Generate a creative song title from a caption using the built-in chat LLM.

    Falls back to caption truncation if the LLM is unavailable. Pass
    ``allow_holders`` (e.g. ``frozenset({"generation"})``) when invoking
    this from a code path that itself holds the GPU lock, so the chat
    runtime's "GPU busy" defense doesn't deadlock the caller against
    itself.
    """
    provider, model_name = await _get_configured_llm()
    if provider is None:
        logger.info("Auto-title: no LLM provider available, using random title")
        return await generate_random_title(allow_holders=allow_holders)

    logger.info(f"Auto-title: generating song title via {model_name}")

    messages = [
        {
            "role": "system",
            "content": (
                "Generate a single short, evocative song title (1-8 words). "
                "Output ONLY the title, nothing else."
            ),
        },
        {
            "role": "user",
            "content": f"Caption: {caption}\nGenre: {genre}\nMood: {mood}",
        },
    ]

    try:
        raw = await provider.chat(
            messages, model=model_name, max_tokens=50,
            allow_holders=allow_holders,
        )
        title = clean_title(raw)
        if title:
            logger.info(f"Auto-title: \"{title}\"")
            return title
    except ChatRuntimeBusy:
        raise
    except Exception as e:
        logger.debug(f"LLM title generation failed, using fallback: {e}")

    return await generate_random_title(use_llm=False)


async def generate_random_title(
    avoid_titles: list[str] | None = None,
    *,
    use_llm: bool = True,
    allow_holders: frozenset[str] | None = None,
) -> str:
    """Generate a random, creative song title unrelated to any caption.

    Used by radio to produce unique, quirky titles every time.
    Falls back to a random pick from built-in examples.
    """
    if not use_llm:
        return pick_random_title(avoid_titles)

    # Pick a few random examples to show the LLM the vibe
    examples = random.sample(_RANDOM_TITLE_EXAMPLES, min(5, len(_RANDOM_TITLE_EXAMPLES)))
    examples_str = ", ".join(f'"{e}"' for e in examples)

    avoid_str = ""
    if avoid_titles:
        avoid_str = (
            "\nDo NOT reuse any of these recent titles: "
            + ", ".join(f'"{t}"' for t in avoid_titles[:10])
        )

    provider, model_name = await _get_configured_llm()
    if provider is None:
        logger.info("Random title: no LLM provider available, picking from examples")
        return pick_random_title(avoid_titles)

    logger.info(f"Random title: generating via {model_name}")

    messages = [
        {
            "role": "system",
            "content": (
                "Invent a single quirky, fun, unexpected song title (1-8 words). "
                "It should be creative and random — NOT describe the music. "
                "Think absurd, funny, poetic, or surreal. "
                f"Examples of the vibe: {examples_str}. "
                "Do NOT copy those examples. Make up something completely new."
                f"{avoid_str}\n"
                "Output ONLY the title, nothing else."
            ),
        },
        {
            "role": "user",
            "content": "Give me a random song title.",
        },
    ]

    try:
        raw = await provider.chat(
            messages, model=model_name, max_tokens=50, temperature=1.0,
            allow_holders=allow_holders,
        )
        title = clean_title(raw)
        if title and title not in (avoid_titles or []) and title not in _RANDOM_TITLE_EXAMPLES:
            logger.info(f"Random title: \"{title}\"")
            return title
    except ChatRuntimeBusy:
        raise
    except Exception as e:
        logger.debug(f"LLM random title generation failed, using fallback: {e}")

    return pick_random_title(avoid_titles)


async def generate_conversation_title(user_message: str) -> str:
    """Generate a concise conversation title from the first user message.

    Falls back to message truncation if the LLM is unavailable.
    """
    stripped = user_message.strip()
    fallback_title = stripped[:50]
    if len(stripped) > 50:
        fallback_title += "..."

    provider, model_name = await _get_configured_llm()
    if provider is None:
        logger.info("Conversation title: no LLM provider available, using truncation")
        return fallback_title

    logger.info(f"Conversation title: generating via {model_name}")

    messages = [
        {
            "role": "system",
            "content": (
                "Generate a concise conversation title (2-6 words). "
                "Output ONLY the title, nothing else."
            ),
        },
        {
            "role": "user",
            "content": user_message,
        },
    ]

    try:
        raw = await provider.chat(messages, model=model_name, max_tokens=30)
        title = clean_title(raw)
        if title:
            logger.info(f"Conversation title: \"{title}\"")
            return title
    except ChatRuntimeBusy as e:
        logger.info(f"Conversation title deferred, using fallback: {e}")
        return fallback_title
    except Exception as e:
        logger.debug(f"LLM conversation title generation failed, using fallback: {e}")

    return fallback_title
