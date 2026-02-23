"""
Radio station auto-generation service.

Inspired by:
- nalexand/ACE-Step-1.5-OPTIMIZED (MusicBox jukebox)
- PasiKoodaa/ACE-Step-RADIO (radio station mode with memory optimization)
"""

import json
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from loguru import logger

from bangers.db.connection import get_db
from bangers.models.radio import StationResponse
from bangers.services.duration_settings import get_default_duration
from bangers.services.generation import generation_service
from bangers.services.generation_request_builder import build_text_to_music_params
from bangers.services.gpu_lock import gpu_lock
from bangers.services.llm_provider import (
    ChatRuntime,
    get_chat_runtime,
    installed_chat_models,
)
from bangers.services.title_generator import clean_title

RADIO_DEFAULT_SYSTEM_PROMPT = """You are a music caption generator. Given station parameters, write a creative, \
detailed caption for an AI music generator. Describe instrumentation, texture, \
atmosphere, and sonic qualities. Be specific and varied — each caption should \
feel unique. Output ONLY the caption text, nothing else."""


def _json_from_llm_text(raw: str) -> dict[str, Any]:
    """Parse a JSON object from an LLM response that may include fences."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


def _row_to_station(row) -> StationResponse:
    return StationResponse(
        id=row["id"],
        name=row["name"],
        description=row["description"] or "",
        is_preset=bool(row["is_preset"]),
        caption_template=row["caption_template"] or "",
        genre=row["genre"] or "",
        mood=row["mood"] or "",
        instrumental=bool(row["instrumental"]),
        vocal_language=row["vocal_language"] or "unknown",
        bpm_min=row["bpm_min"],
        bpm_max=row["bpm_max"],
        keyscale=row["keyscale"] or "",
        timesignature=row["timesignature"] or "",
        advanced_params_json=row["advanced_params_json"] or "{}",
        total_plays=row["total_plays"] or 0,
        last_played_at=row["last_played_at"],
        created_at=row["created_at"] or "",
        updated_at=row["updated_at"] or "",
    )


class RadioService:
    """Manages radio stations and auto-generation of tracks."""

    async def list_stations(self) -> list[StationResponse]:
        db = await get_db()
        cursor = await db.execute(
            "SELECT * FROM radio_stations ORDER BY is_preset DESC, name ASC"
        )
        rows = await cursor.fetchall()
        return [_row_to_station(row) for row in rows]

    async def get_station(self, station_id: str) -> Optional[StationResponse]:
        db = await get_db()
        cursor = await db.execute(
            "SELECT * FROM radio_stations WHERE id = ?", (station_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_station(row)

    async def create_station(self, data: dict[str, Any]) -> StationResponse:
        db = await get_db()
        station_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        default_duration = await get_default_duration()

        await db.execute(
            """INSERT INTO radio_stations (
                id, name, description, is_preset, caption_template,
                genre, mood, instrumental, vocal_language,
                bpm_min, bpm_max, keyscale, timesignature,
                duration_min, duration_max, advanced_params_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                station_id,
                data.get("name", "Custom Station"),
                data.get("description", ""),
                data.get("caption_template", ""),
                data.get("genre", ""),
                data.get("mood", ""),
                1 if data.get("instrumental", True) else 0,
                "en",
                data.get("bpm_min"),
                data.get("bpm_max"),
                data.get("keyscale", ""),
                data.get("timesignature", ""),
                default_duration,
                default_duration,
                data.get("advanced_params_json", "{}"),
                now,
                now,
            ),
        )
        await db.commit()

        station = await self.get_station(station_id)
        assert station is not None
        return station

    async def update_station(
        self, station_id: str, updates: dict[str, Any]
    ) -> Optional[StationResponse]:
        db = await get_db()

        # Check station exists and is not a preset (presets can't be edited)
        station = await self.get_station(station_id)
        if station is None:
            return None

        if not updates:
            return station

        # Presets are mostly read-only, but their lyrics toggle maps to the
        # existing instrumental bit and is allowed to persist.
        if station.is_preset:
            updates = {
                k: v
                for k, v in updates.items()
                if k == "instrumental"
            }
            if not updates:
                return station

        # Convert bool to int for SQLite
        if "instrumental" in updates:
            updates["instrumental"] = 1 if updates["instrumental"] else 0

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values())
        values.append(station_id)

        await db.execute(
            f"UPDATE radio_stations SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
            values,
        )
        await db.commit()

        return await self.get_station(station_id)

    async def delete_station(self, station_id: str) -> bool:
        db = await get_db()
        cursor = await db.execute(
            "SELECT is_preset FROM radio_stations WHERE id = ?", (station_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return False
        if bool(row["is_preset"]):
            return False

        await db.execute("DELETE FROM radio_stations WHERE id = ?", (station_id,))
        await db.commit()
        return True

    async def create_station_from_song(
        self, song_id: str, name: Optional[str] = None
    ) -> Optional[StationResponse]:
        db = await get_db()
        cursor = await db.execute("SELECT * FROM songs WHERE id = ?", (song_id,))
        row = await cursor.fetchone()
        if row is None:
            return None

        station_name = name or f"Station from {row['title']}"
        data = {
            "name": station_name,
            "description": f"Created from: {row['title']}",
            "genre": "",
            "mood": "",
            "instrumental": bool(row["instrumental"]),
            "vocal_language": "en",
            "bpm_min": row["bpm"] - 10 if row["bpm"] else None,
            "bpm_max": row["bpm"] + 10 if row["bpm"] else None,
            "keyscale": row["keyscale"] or "",
            "timesignature": row["timesignature"] or "",
            "caption_template": row["caption"] or "",
        }

        return await self.create_station(data)

    async def get_settings(self) -> dict[str, Any]:
        """Return current radio chat-LLM state.

        ``active_model`` is the empty string when no caption LLM is selected
        (radio falls back to template captions in that case).
        """
        db = await get_db()
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key IN ("
            "'radio_llm_model', 'radio_system_prompt')"
        )
        rows = await cursor.fetchall()
        active_model = ""
        custom_system_prompt = ""
        for r in rows:
            if r["key"] == "radio_llm_model":
                active_model = r["value"]
            elif r["key"] == "radio_system_prompt":
                custom_system_prompt = r["value"]

        return {
            "active_model": active_model,
            "installed_models": installed_chat_models(),
            "system_prompt": custom_system_prompt,
            "default_system_prompt": RADIO_DEFAULT_SYSTEM_PROMPT,
        }

    async def update_settings(
        self,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> dict[str, Any]:
        """Update radio caption-LLM settings."""
        db = await get_db()
        if model is not None:
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('radio_llm_model', ?, datetime('now'))",
                (model,),
            )
        if system_prompt is not None:
            if system_prompt.strip() == "" or system_prompt.strip() == RADIO_DEFAULT_SYSTEM_PROMPT.strip():
                await db.execute(
                    "DELETE FROM settings WHERE key = 'radio_system_prompt'"
                )
            else:
                await db.execute(
                    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('radio_system_prompt', ?, datetime('now'))",
                    (system_prompt,),
                )
        await db.commit()
        return await self.get_settings()

    async def _get_radio_llm(self) -> tuple[ChatRuntime | None, str, str]:
        """Resolve the radio caption LLM.

        Returns ``(runtime, model_name, system_prompt)``. ``runtime`` is None
        when no model is selected or the chosen model isn't loadable on
        this machine — radio then falls back to its caption template.
        """
        db = await get_db()
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key IN ("
            "'radio_llm_model', 'radio_system_prompt')"
        )
        rows = await cursor.fetchall()
        model_name = ""
        custom_prompt = ""
        for r in rows:
            if r["key"] == "radio_llm_model":
                model_name = r["value"]
            elif r["key"] == "radio_system_prompt":
                custom_prompt = r["value"]

        system_prompt = custom_prompt if custom_prompt.strip() else RADIO_DEFAULT_SYSTEM_PROMPT

        if not model_name:
            return (None, "", system_prompt)

        runtime = get_chat_runtime(model_name)
        if runtime is None or not runtime.is_model_loadable(model_name):
            logger.info(f"Radio LLM '{model_name}' not loadable on this machine; using template caption")
            return (None, model_name, system_prompt)
        return (runtime, model_name, system_prompt)

    def _station_prompt_parts(self, station: StationResponse) -> list[str]:
        parts = []
        if station.genre:
            parts.append(f"Genre: {station.genre}")
        if station.mood:
            parts.append(f"Mood: {station.mood}")
        parts.append(f"Instrumental: {'yes' if station.instrumental else 'no'}")
        parts.append("Vocal language: english (write all lyrics in English)")
        if station.bpm_min is not None and station.bpm_max is not None:
            parts.append(f"BPM range: {station.bpm_min}-{station.bpm_max}")
        if station.keyscale:
            parts.append(f"Key/scale: {station.keyscale}")
        if station.timesignature:
            parts.append(f"Time signature: {station.timesignature}")
        if station.caption_template:
            parts.append(f"Style reference: {station.caption_template}")
        return parts

    async def _generate_caption_with_llm(self, station: StationResponse) -> Optional[str]:
        """Attempt to generate a caption using the configured LLM provider.

        Returns the generated caption string, or None to fall back to template.
        """
        provider, model_name, system_prompt = await self._get_radio_llm()
        if provider is None:
            logger.info("Radio caption: no LLM provider available, using template")
            return None

        logger.info(f"Radio caption: generating via {model_name}")

        # Build user message from station parameters
        parts = self._station_prompt_parts(station)

        user_message = "Generate a unique music caption for these station parameters:\n" + "\n".join(parts)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        try:
            caption = await provider.chat(
                messages,
                model_name,
                allow_holders=frozenset({"radio"}),
            )
            caption = caption.strip()
            if caption:
                logger.info(f"Radio LLM caption generated ({len(caption)} chars) via {model_name}")
                return caption
            return None
        except Exception as e:
            logger.warning(f"Radio LLM caption generation failed ({model_name}): {e}")
            return None

    async def _generate_song_spec_with_llm(
        self, station: StationResponse
    ) -> Optional[dict[str, str]]:
        """Generate a vocal radio caption and lyrics with the configured radio LLM."""
        provider, model_name, system_prompt = await self._get_radio_llm()
        if provider is None:
            logger.info("Radio lyrics: no LLM provider available, using fallback")
            return None

        logger.info(f"Radio lyrics: generating via {model_name}")
        parts = self._station_prompt_parts(station)
        user_message = (
            "Generate a unique vocal song spec for these radio station parameters:\n"
            + "\n".join(parts)
            + "\n\nCaption style guidance:\n"
            + system_prompt
            + "\n\nReturn valid JSON only with this exact shape:\n"
            + '{"caption":"music generation caption","lyrics":"[verse]\\n...\\n[chorus]\\n..."}'
        )
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a professional songwriter and music prompt writer. "
                    "Write original lyrics for a vocal track. Use clear section "
                    "tags such as [verse], [chorus], [bridge], and [outro]. "
                    "Return only valid JSON with string fields caption and lyrics."
                ),
            },
            {"role": "user", "content": user_message},
        ]

        try:
            raw = await provider.chat(
                messages,
                model=model_name,
                max_tokens=2048,
                temperature=0.8,
                allow_holders=frozenset({"radio"}),
            )
            parsed = _json_from_llm_text(raw)
            caption = str(parsed.get("caption", "")).strip()
            lyrics = str(parsed.get("lyrics", "")).strip()
            if caption and lyrics:
                logger.info(
                    f"Radio LLM lyric spec generated ({len(caption)} caption chars, {len(lyrics)} lyric chars)"
                )
                return {"caption": caption, "lyrics": lyrics}
            logger.warning("Radio LLM lyric spec missing caption or lyrics")
            return None
        except Exception as e:
            logger.warning(f"Radio LLM lyric spec generation failed ({model_name}): {e}")
            return None

    async def _generate_song_spec_with_sample(
        self, station: StationResponse, fallback_caption: str
    ) -> Optional[dict[str, str]]:
        """Use the existing sample-generation path to produce vocal lyrics."""
        if not generation_service.lm_initialized:
            return None

        query_parts = [station.name]
        if station.genre:
            query_parts.append(station.genre)
        if station.mood:
            query_parts.append(station.mood)
        if fallback_caption:
            query_parts.append(fallback_caption)
        query = ". ".join(part for part in query_parts if part)

        try:
            sample = await generation_service.create_sample(
                query=query,
                instrumental=False,
                vocal_language="en",
                temperature=0.85,
            )
            if not sample.get("success", True):
                return None
            lyrics = str(sample.get("lyrics", "")).strip()
            if not lyrics:
                return None
            caption = str(sample.get("caption", "")).strip() or fallback_caption
            return {"caption": caption, "lyrics": lyrics}
        except Exception as e:
            logger.warning(f"Radio sample lyric generation failed: {e}")
            return None

    def _fallback_lyrics(self, station: StationResponse, caption: str) -> str:
        theme = station.genre or station.name or "the song"
        mood = station.mood or "the night"
        image = caption or station.caption_template or theme
        return (
            "[verse]\n"
            f"We step into {mood}\n"
            f"Following the sound of {theme}\n"
            f"Every shadow starts to move\n"
            f"Every heartbeat finds the groove\n\n"
            "[chorus]\n"
            f"Sing it out, {theme} in the air\n"
            f"Lift the moment everywhere\n"
            f"Hold the light and carry on\n"
            f"Turn {image[:48]} into song\n\n"
            "[bridge]\n"
            "Let the rhythm rise again\n"
            "Let the story never end"
        )

    async def _generate_title_with_llm(
        self, station: StationResponse, caption: str, recent_titles: list[str]
    ) -> Optional[str]:
        """Generate a station-themed song title using the configured radio LLM.

        Returns the generated title, or None to fall back to random titles.
        """
        provider, model_name, _prompt = await self._get_radio_llm()
        if provider is None:
            logger.info("Radio title: no LLM provider available, using random title")
            return None

        logger.info(f"Radio title: generating via {model_name}")
        avoid_str = ""
        if recent_titles:
            avoid_str = (
                "\nDo NOT reuse any of these recent titles: "
                + ", ".join(f'"{t}"' for t in recent_titles[:10])
            )

        style_hint = ""
        if station.genre:
            style_hint += f"Genre: {station.genre}. "
        if station.mood:
            style_hint += f"Mood: {station.mood}. "

        messages = [
            {
                "role": "system",
                "content": (
                    "Generate a single creative song title (1-8 words) that fits the style "
                    "of the station and song described below. The title should evoke the "
                    "genre and mood — it can be poetic, atmospheric, or thematic. "
                    "Output ONLY the title, nothing else."
                    f"{avoid_str}"
                ),
            },
            {
                "role": "user",
                "content": f"Station: {station.name}\n{style_hint}Caption: {caption}",
            },
        ]

        try:
            raw = await provider.chat(
                messages,
                model=model_name,
                max_tokens=50,
                allow_holders=frozenset({"radio"}),
            )
            cleaned = clean_title(raw)
            if cleaned and cleaned not in recent_titles:
                logger.info(f"Radio LLM title generated: '{cleaned}' via {model_name}")
                return cleaned
        except Exception as e:
            logger.warning(f"Radio LLM title generation failed ({model_name}): {e}")

        return None

    async def generate_next_track(self, station_id: str) -> dict[str, Any]:
        """Generate the next track for a radio station.

        Returns the generation result dict with song info on success,
        or an error dict on failure.
        """
        station = await self.get_station(station_id)
        if station is None:
            return {"success": False, "error": "Station not found"}

        logger.info(f"Radio: generating next track for station '{station.name}' (id={station_id})")

        if not generation_service.backend_ready:
            return {
                "success": False,
                "error": "ACE-Step backend not loaded",
            }

        # Hold the GPU lock across all MLX/ACE-Step work for this radio job:
        # caption/spec helpers, sample fallback, and music generation all use
        # Metal on Apple Silicon and cannot overlap safely.
        acquired = await gpu_lock.await_acquire("radio")
        if not acquired:
            return {
                "success": False,
                "error": "GPU lock timeout. Please try again.",
            }

        llm_caption: str | None = None
        llm_song_spec: dict[str, str] | None = None
        sample_song_spec: dict[str, str] | None = None
        history_id: str | None = None
        song_title: str | None = None
        deferred_recent_titles: list[str] | None = None
        try:
            if station.instrumental:
                llm_caption = await self._generate_caption_with_llm(station)
            else:
                llm_song_spec = await self._generate_song_spec_with_llm(station)
                if not (llm_song_spec and llm_song_spec.get("lyrics", "").strip()):
                    provisional_caption = (
                        (llm_song_spec or {}).get("caption", "").strip()
                        or station.caption_template
                        or " ".join(
                            part for part in (station.genre, station.mood) if part
                        )
                        or station.name
                    )
                    sample_song_spec = await self._generate_song_spec_with_sample(
                        station, provisional_caption,
                    )

            # Randomize within station ranges for variety
            bpm = None
            if station.bpm_min is not None and station.bpm_max is not None:
                bpm = random.randint(station.bpm_min, station.bpm_max)
            elif station.bpm_min is not None:
                bpm = station.bpm_min

            duration = await get_default_duration()

            # Build caption: prefer LLM-generated, fallback to template
            if llm_song_spec and llm_song_spec.get("caption"):
                caption = llm_song_spec["caption"]
            elif llm_caption:
                caption = llm_caption
            else:
                caption = station.caption_template
                if caption and station.mood and station.genre:
                    caption = caption.replace("{mood}", station.mood).replace(
                        "{genre}", station.genre
                    )
                elif not caption:
                    tpl_parts = []
                    if station.genre:
                        tpl_parts.append(station.genre)
                    if station.mood:
                        tpl_parts.append(f"{station.mood} mood")
                    caption = f"A {' '.join(tpl_parts)} track" if tpl_parts else "A music track"

            lyrics = ""
            if not station.instrumental:
                lyrics = (llm_song_spec or {}).get("lyrics", "").strip()
                if not lyrics and sample_song_spec:
                    caption = sample_song_spec.get("caption") or caption
                    lyrics = sample_song_spec.get("lyrics", "").strip()
                if not lyrics:
                    lyrics = self._fallback_lyrics(station, caption)

            # Parse advanced params
            advanced = {}
            if station.advanced_params_json:
                try:
                    advanced = json.loads(station.advanced_params_json)
                except json.JSONDecodeError:
                    pass

            params_dict = build_text_to_music_params(
                caption,
                lyrics=lyrics,
                instrumental=station.instrumental,
                vocal_language="en",
                duration=duration,
                batch_size=1,
                extra=advanced,
            )
            if bpm is not None:
                params_dict["bpm"] = bpm
            if station.keyscale:
                params_dict["keyscale"] = station.keyscale
            if station.timesignature:
                params_dict["timesignature"] = station.timesignature
            if generation_service.active_dit_model:
                params_dict["dit_model"] = generation_service.active_dit_model
            if generation_service.active_lm_model:
                params_dict["lm_model"] = generation_service.active_lm_model

            # Create generation history entry
            history_id = str(uuid.uuid4())
            started_at = datetime.now(timezone.utc)
            db = await get_db()
            await db.execute(
                """INSERT INTO generation_history (id, task_type, status, params_json, started_at, created_at)
                   VALUES (?, 'text2music', 'running', ?, ?, ?)""",
                (
                    history_id,
                    json.dumps(params_dict),
                    started_at.isoformat(),
                    started_at.isoformat(),
                ),
            )
            await db.commit()

            result = await generation_service.generate(params_dict)

            if result.get("success") and result.get("audios") and song_title is None:
                from bangers.services.title_generator import pick_random_title

                db = await get_db()
                recent_cursor = await db.execute(
                    """SELECT s.title FROM songs s
                       JOIN radio_station_songs rs ON s.id = rs.song_id
                       WHERE rs.station_id = ?
                       ORDER BY rs.generated_at DESC LIMIT 10""",
                    (station_id,),
                )
                recent_rows = await recent_cursor.fetchall()
                recent_titles = [r["title"] for r in recent_rows if r["title"]]
                song_title = pick_random_title(recent_titles)
                deferred_recent_titles = recent_titles
        except Exception as e:
            logger.exception(f"Radio generation failed for station {station_id}")
            if history_id is not None:
                try:
                    db = await get_db()
                    await db.execute(
                        "UPDATE generation_history SET status = 'failed', error_message = ? WHERE id = ?",
                        (str(e), history_id),
                    )
                    await db.commit()
                except Exception:
                    pass
            return {"success": False, "error": str(e)}
        finally:
            # Release after the music-critical stage. Title generation and
            # DB/file work run outside the music lock.
            await gpu_lock.release("radio")

        # --- Post-generation work (DB writes, file copies) runs WITHOUT the GPU lock ---
        try:
            if result.get("success"):
                audios = result.get("audios", [])
                if audios:
                    audio = audios[0]
                    completed_at = datetime.now(timezone.utc)
                    duration_ms = int((completed_at - started_at).total_seconds() * 1000)
                    audio_results = [
                        {
                            "path": a.get("path", ""),
                            "key": a.get("key", ""),
                            "sample_rate": a.get("sample_rate", 48000),
                            "params": {
                                k: v
                                for k, v in (a.get("params") or params_dict).items()
                                if k != "tensor" and not k.startswith("_")
                            },
                        }
                        for a in audios
                    ]
                    db = await get_db()

                    # Auto-save to library
                    from bangers.routers.songs import _row_to_song
                    from bangers.models.common import SongResponse as SongResp

                    song_id = str(uuid.uuid4())
                    now = datetime.now(timezone.utc).isoformat()
                    audio_path = audio.get("path", "")
                    file_format = audio_path.rsplit(".", 1)[-1] if "." in audio_path else "flac"

                    # Title generation happens after the music lock is released.
                    if song_title is None:
                        song_title = f"Radio Track {datetime.now(timezone.utc).strftime('%H:%M')}"

                    # Update history as completed (now includes title)
                    await db.execute(
                        """UPDATE generation_history
                           SET status = 'completed', title = ?, result_json = ?,
                               audio_count = ?, completed_at = ?, duration_ms = ?
                           WHERE id = ?""",
                        (song_title, json.dumps(audio_results), len(audios),
                         completed_at.isoformat(), duration_ms, history_id),
                    )
                    await db.commit()

                    # Copy to library
                    import shutil
                    from pathlib import Path
                    from bangers.config import settings

                    src = Path(audio_path)
                    dest_filename = f"{song_id}.{file_format}"
                    dest = settings.AUDIO_DIR / dest_filename

                    if src.exists():
                        shutil.copy2(str(src), str(dest))
                        file_size = dest.stat().st_size
                    else:
                        file_size = 0

                    db = await get_db()
                    await db.execute(
                        """INSERT INTO songs (
                            id, title, file_path, file_format, duration_seconds,
                            caption, lyrics, bpm, keyscale, timesignature,
                            vocal_language, instrumental, generation_history_id,
                            tags, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            song_id,
                            song_title,
                            dest_filename,
                            file_format,
                            duration,
                            caption,
                            lyrics,
                            bpm,
                            station.keyscale,
                            station.timesignature,
                            "en",
                            1 if station.instrumental else 0,
                            history_id,
                            "radio",
                            now,
                            now,
                        ),
                    )

                    # Link to station
                    link_id = str(uuid.uuid4())
                    await db.execute(
                        """INSERT INTO radio_station_songs (id, station_id, song_id, position, generated_at)
                           VALUES (?, ?, ?, ?, ?)""",
                        (link_id, station_id, song_id, 0, now),
                    )

                    # Update station play count
                    await db.execute(
                        """UPDATE radio_stations
                           SET total_plays = total_plays + 1, last_played_at = ?
                           WHERE id = ?""",
                        (now, station_id),
                    )
                    await db.commit()

                    if deferred_recent_titles is not None and history_id is not None:
                        from bangers.services.deferred_titles import schedule_radio_title_retry

                        schedule_radio_title_retry(
                            song_id=song_id,
                            history_id=history_id,
                            avoid_titles=deferred_recent_titles,
                        )

                    song_response = SongResp(
                        id=song_id,
                        title=song_title,
                        file_path=dest_filename,
                        file_format=file_format,
                        duration_seconds=duration,
                        caption=caption,
                        lyrics=lyrics,
                        bpm=bpm,
                        keyscale=station.keyscale,
                        timesignature=station.timesignature,
                        vocal_language="en",
                        instrumental=station.instrumental,
                        created_at=now,
                        updated_at=now,
                    )

                    return {
                        "success": True,
                        "song": song_response.model_dump(),
                    }

            error = result.get("error", "Generation failed")
            db = await get_db()
            await db.execute(
                "UPDATE generation_history SET status = 'failed', error_message = ? WHERE id = ?",
                (error, history_id),
            )
            await db.commit()
            return {"success": False, "error": error}

        except Exception as e:
            logger.exception(f"Radio post-generation failed for station {station_id}")
            return {"success": False, "error": str(e)}

    async def get_station_songs(
        self, station_id: str, limit: int = 20
    ) -> list[dict[str, Any]]:
        db = await get_db()
        cursor = await db.execute(
            """SELECT s.* FROM songs s
               JOIN radio_station_songs rs ON s.id = rs.song_id
               WHERE rs.station_id = ?
               ORDER BY rs.generated_at DESC
               LIMIT ?""",
            (station_id, limit),
        )
        rows = await cursor.fetchall()
        from bangers.routers.songs import _row_to_song

        return [_row_to_song(row).model_dump() for row in rows]


radio_service = RadioService()
