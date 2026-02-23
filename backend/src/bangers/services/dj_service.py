"""
AI DJ chat service — translates natural language into music generation.

Inspired by:
- clockworksquirrel/ace-step-apple-silicon (conversational AI DJ interface)
"""

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from loguru import logger

from bangers.db.connection import get_db
from bangers.config import settings
from bangers.services.duration_settings import get_default_duration
from bangers.services.generation_request_builder import build_text_to_music_params
from bangers.services.llm_provider import get_chat_runtime, installed_chat_models

DEFAULT_SYSTEM_PROMPT_TEMPLATE = """You are an AI DJ assistant for conda install bangers, a local music generation app.

Your job is to help users create music through natural conversation. When a user describes music they want to hear, you should:

1. Respond conversationally and enthusiastically about their music request
2. Include a JSON code block with generation parameters when you want to generate music

The JSON block should use this format:
```json
{{
  "caption": "A description of the music to generate",
  "lyrics": "",
  "instrumental": true,
  "bpm": 120,
  "keyscale": "",
  "timesignature": "4/4",
  "vocal_language": "en"
}}
```

Parameter guidelines:
- caption: Descriptive text about the music style, mood, instruments (be detailed and vivid)
- lyrics: Song lyrics with standard structure. For vocal tracks, write at least 2 verses and a chorus (12+ lines). Use [verse], [chorus], [bridge] tags. Example:
  "[verse]\\nFirst verse lines here\\n[chorus]\\nChorus lines here\\n[verse]\\nSecond verse lines here\\n[chorus]\\nChorus lines here"
- instrumental: true for no vocals, false for vocal tracks
- bpm: Beats per minute (60-200 typical range)
- keyscale: Musical key (e.g., "C major", "A minor", leave empty if unsure)
- timesignature: Time signature (e.g., "4/4", "3/4", "6/8")
- duration: Do not choose duration. The app Settings page controls song length.
- vocal_language: Always set to "en". Lyrics MUST be written in English; do not use any other language.

You can also handle these commands:
- "skip" or "next" → respond with: [ACTION:SKIP]
- "replay" or "play again" → respond with: [ACTION:REPLAY]
- "save" or "save to library" → respond with: [ACTION:SAVE]
- "create a radio station like this" → respond with: [ACTION:CREATE_STATION]

Be creative, knowledgeable about music genres, and enthusiastic. Keep responses concise but engaging."""


def _build_default_system_prompt(default_duration: float) -> str:
    return DEFAULT_SYSTEM_PROMPT_TEMPLATE.format(
        default_duration=int(default_duration)
    )


DEFAULT_SYSTEM_PROMPT = _build_default_system_prompt(settings.DEFAULT_DURATION)


async def _get_default_system_prompt() -> str:
    return _build_default_system_prompt(await get_default_duration())


def _extract_json_block(text: str) -> Optional[dict[str, Any]]:
    """Extract the first JSON code block from LLM response text."""
    pattern = r"```json\s*\n?(.*?)\n?\s*```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            logger.warning("Failed to parse JSON block from DJ response")
    return None


def _extract_action(text: str) -> Optional[str]:
    """Extract an action command from the response."""
    pattern = r"\[ACTION:(\w+)\]"
    match = re.search(pattern, text)
    if match:
        return match.group(1).lower()
    return None


class DJService:
    """Manages AI DJ conversations and music generation from chat."""

    async def list_conversations(self) -> list[dict[str, Any]]:
        db = await get_db()
        cursor = await db.execute(
            "SELECT * FROM dj_conversations ORDER BY updated_at DESC"
        )
        rows = await cursor.fetchall()
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "created_at": row["created_at"] or "",
                "updated_at": row["updated_at"] or "",
            }
            for row in rows
        ]

    async def create_conversation(self, title: str = "New Conversation") -> dict[str, Any]:
        db = await get_db()
        conv_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        await db.execute(
            "INSERT INTO dj_conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (conv_id, title, now, now),
        )
        await db.commit()

        return {
            "id": conv_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
        }

    async def get_conversation(self, conv_id: str) -> Optional[dict[str, Any]]:
        db = await get_db()
        cursor = await db.execute(
            "SELECT * FROM dj_conversations WHERE id = ?", (conv_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None

        msg_cursor = await db.execute(
            "SELECT * FROM dj_messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_id,),
        )
        msg_rows = await msg_cursor.fetchall()

        messages = [
            {
                "id": m["id"],
                "conversation_id": m["conversation_id"],
                "role": m["role"],
                "content": m["content"],
                "generation_params_json": m["generation_params_json"],
                "generation_job_id": m["generation_job_id"],
                "created_at": m["created_at"] or "",
            }
            for m in msg_rows
        ]

        return {
            "id": row["id"],
            "title": row["title"],
            "created_at": row["created_at"] or "",
            "updated_at": row["updated_at"] or "",
            "messages": messages,
        }

    async def delete_conversation(self, conv_id: str) -> bool:
        db = await get_db()
        cursor = await db.execute(
            "SELECT id FROM dj_conversations WHERE id = ?", (conv_id,)
        )
        if await cursor.fetchone() is None:
            return False

        await db.execute("DELETE FROM dj_conversations WHERE id = ?", (conv_id,))
        await db.commit()
        return True

    async def send_message(
        self, conv_id: str, user_content: str
    ) -> dict[str, Any]:
        """Process a user message through the LLM and optionally trigger generation."""
        db = await get_db()

        # Verify conversation exists
        cursor = await db.execute(
            "SELECT id FROM dj_conversations WHERE id = ?", (conv_id,)
        )
        if await cursor.fetchone() is None:
            return {"error": "Conversation not found"}

        # Save user message
        user_msg_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """INSERT INTO dj_messages (id, conversation_id, role, content, created_at)
               VALUES (?, ?, 'user', ?, ?)""",
            (user_msg_id, conv_id, user_content, now),
        )

        # Load conversation history
        msg_cursor = await db.execute(
            """SELECT role, content FROM dj_messages
               WHERE conversation_id = ?
               ORDER BY created_at ASC""",
            (conv_id,),
        )
        msg_rows = await msg_cursor.fetchall()

        # Read custom system prompt from settings
        prompt_cursor = await db.execute(
            "SELECT value FROM settings WHERE key = 'dj_system_prompt'"
        )
        prompt_row = await prompt_cursor.fetchone()
        default_system_prompt = await _get_default_system_prompt()
        system_prompt = prompt_row["value"] if prompt_row else default_system_prompt

        # Build messages for LLM
        llm_messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt}
        ]
        for m in msg_rows:
            llm_messages.append({"role": m["role"], "content": m["content"]})

        # Resolve the user-selected chat model and pick its runtime.
        settings_cursor = await db.execute(
            "SELECT value FROM settings WHERE key = 'dj_model'"
        )
        row = await settings_cursor.fetchone()
        model_name = row["value"] if row else ""

        if not model_name:
            return {
                "error": {
                    "error": "no_chat_model_selected",
                    "message": "No chat model selected. Pick one on the Models page.",
                    "missing": ["dj_model"],
                },
            }

        runtime = get_chat_runtime(model_name)
        if runtime is None:
            return {
                "error": {
                    "error": "chat_runtime_unavailable",
                    "message": (
                        f"Selected chat model '{model_name}' requires a runtime that is not "
                        "available on this machine. Pick a different model on the Models page."
                    ),
                },
            }

        if not runtime.is_model_loadable(model_name):
            return {
                "error": {
                    "error": "chat_model_not_installed",
                    "message": (
                        f"Chat model '{model_name}' is selected but its files are not on disk. "
                        "Download it on the Models page."
                    ),
                    "missing": ["dj_model"],
                },
            }

        fallback_notice: str | None = None

        try:
            response_text = await runtime.chat(llm_messages, model_name)
        except Exception as e:
            logger.exception("DJ LLM call failed")
            return {
                "error": {
                    "error": "chat_runtime_error",
                    "message": f"LLM error: {e}",
                },
            }

        # Strip <think>...</think> blocks from models like Qwen3
        response_text = re.sub(
            r"<think>.*?</think>", "", response_text, flags=re.DOTALL
        ).strip()

        # Parse response for generation params or actions
        gen_params = _extract_json_block(response_text)
        action = _extract_action(response_text)
        if gen_params:
            default_duration = await get_default_duration()
            gen_params["duration"] = default_duration

        # Clean action tags and JSON code blocks from the display text
        display_text = re.sub(r"\[ACTION:\w+\]", "", response_text)
        display_text = re.sub(r"```json\s*\n?.*?\n?\s*```", "", display_text, flags=re.DOTALL)
        display_text = display_text.strip()

        # Save assistant message
        assistant_msg_id = str(uuid.uuid4())
        assistant_now = datetime.now(timezone.utc).isoformat()
        gen_params_json = json.dumps(gen_params) if gen_params else None
        generation_job_id = None

        # Generate conversation title BEFORE firing generation task to avoid
        # concurrent MLX usage (chat model + ACE-Step LM) which causes a segfault
        title_cursor = await db.execute(
            "SELECT title FROM dj_conversations WHERE id = ?", (conv_id,)
        )
        title_row = await title_cursor.fetchone()
        auto_title = None
        if title_row and title_row["title"] == "New Conversation":
            from bangers.services.title_generator import generate_conversation_title
            auto_title = await generate_conversation_title(user_content)

        # Trigger generation if params were provided
        if gen_params:
            try:
                from bangers.services.generation import generation_service

                if generation_service.backend_ready:
                    job_id = generation_service.create_job()
                    generation_job_id = job_id

                    # Fire and forget generation
                    import asyncio
                    asyncio.create_task(
                        self._run_dj_generation(job_id, gen_params, model_name)
                    )
                else:
                    fallback_notice = (
                        "ACE-Step backend is not ready for DJ generation."
                    )
            except Exception as e:
                logger.warning(f"Failed to start DJ generation: {e}")

        await db.execute(
            """INSERT INTO dj_messages
               (id, conversation_id, role, content, generation_params_json, generation_job_id, created_at)
               VALUES (?, ?, 'assistant', ?, ?, ?, ?)""",
            (assistant_msg_id, conv_id, display_text, gen_params_json, generation_job_id, assistant_now),
        )

        # Apply the pre-generated title or just update timestamp
        if auto_title is not None:
            await db.execute(
                "UPDATE dj_conversations SET title = ?, updated_at = ? WHERE id = ?",
                (auto_title, assistant_now, conv_id),
            )
        else:
            await db.execute(
                "UPDATE dj_conversations SET updated_at = ? WHERE id = ?",
                (assistant_now, conv_id),
            )
        await db.commit()

        return {
            "message": {
                "id": assistant_msg_id,
                "conversation_id": conv_id,
                "role": "assistant",
                "content": display_text,
                "generation_params_json": gen_params_json,
                "generation_job_id": generation_job_id,
                "created_at": assistant_now,
            },
            "action": action,
            "generation_job_id": generation_job_id,
            "fallback_notice": fallback_notice,
        }

    async def _run_dj_generation(
        self, job_id: str, params: dict[str, Any],
        dj_model: str = "",
    ) -> None:
        """Run generation triggered by DJ chat."""
        from bangers.services.generation import generation_service
        from bangers.services.gpu_lock import gpu_lock
        from bangers.ws.manager import generation_ws_manager

        if gpu_lock.is_locked:
            await generation_ws_manager.broadcast({
                "type": "progress",
                "job_id": job_id,
                "progress": 0.0,
                "stage": f"Waiting for GPU (in use by {gpu_lock.holder})...",
            })
        await gpu_lock.await_acquire("dj")

        started_at = datetime.now(timezone.utc)
        history_id = job_id  # Same ID so DJ messages can link to history
        deferred_title_caption: str | None = None

        try:
            generation_service.update_job(job_id, status="running", stage="preparing")

            prompt = str(params.get("caption") or "").strip()
            if not prompt:
                prompt = "A music track"
            raw_lyrics = str(params.get("lyrics") or "")
            default_duration = await get_default_duration()
            params = build_text_to_music_params(
                prompt,
                lyrics=raw_lyrics,
                instrumental=bool(params.get("instrumental", not raw_lyrics.strip())),
                vocal_language="en",
                duration=float(params.get("duration") or default_duration),
                batch_size=1,
                extra=params,
            )

            if generation_service.active_dit_model:
                params["dit_model"] = generation_service.active_dit_model
            if generation_service.active_lm_model:
                params["lm_model"] = generation_service.active_lm_model
            if dj_model:
                params["dj_model"] = dj_model

            # Insert generation history record
            db = await get_db()
            await db.execute(
                """INSERT INTO generation_history (id, task_type, status, params_json, started_at, created_at)
                   VALUES (?, ?, 'running', ?, ?, ?)""",
                (history_id, params.get("task_type", "text2music"),
                 json.dumps(params), started_at.isoformat(), started_at.isoformat()),
            )
            await db.commit()

            result = await generation_service.generate(params)

            if result.get("success"):
                audios = result.get("audios", [])
                results = [
                    {
                        "path": a.get("path", ""),
                        "key": a.get("key", ""),
                        "sample_rate": a.get("sample_rate", 48000),
                        "params": {
                            k: v
                            for k, v in (a.get("params") or {}).items()
                            if k != "tensor" and not k.startswith("_")
                        },
                    }
                    for a in audios
                ]

                title_caption = params.get("caption") or None
                generated_title: str | None = None
                if title_caption:
                    try:
                        from bangers.services.title_generator import generate_song_title
                        generated_title = await generate_song_title(
                            title_caption, "", "", "DJ Generation",
                            allow_holders=frozenset({"dj"}),
                        )
                    except Exception as e:
                        logger.debug(f"DJ title generation failed: {e}")

                generation_service.update_job(
                    job_id, status="completed", progress=1.0, results=results
                )

                # Update history as completed (title included if generated).
                completed_at = datetime.now(timezone.utc)
                duration_ms = int((completed_at - started_at).total_seconds() * 1000)
                db = await get_db()
                if generated_title is not None:
                    await db.execute(
                        """UPDATE generation_history
                           SET status = 'completed', result_json = ?, audio_count = ?,
                               completed_at = ?, duration_ms = ?, title = ?
                           WHERE id = ?""",
                        (json.dumps(results), len(results),
                         completed_at.isoformat(), duration_ms,
                         generated_title, history_id),
                    )
                else:
                    await db.execute(
                        """UPDATE generation_history
                           SET status = 'completed', result_json = ?, audio_count = ?,
                               completed_at = ?, duration_ms = ?
                           WHERE id = ?""",
                        (json.dumps(results), len(results),
                         completed_at.isoformat(), duration_ms, history_id),
                    )
                await db.commit()

                if generated_title is not None:
                    await generation_ws_manager.broadcast({
                        "type": "title",
                        "job_id": job_id,
                        "history_id": history_id,
                        "title": generated_title,
                    })

                await generation_ws_manager.broadcast({
                    "type": "completed",
                    "job_id": job_id,
                    "history_id": history_id,
                    "results": results,
                })
            else:
                error = result.get("error", "Generation failed")
                generation_service.update_job(job_id, status="failed", error=error)
                await generation_ws_manager.broadcast({
                    "type": "failed",
                    "job_id": job_id,
                    "error": error,
                })

                db = await get_db()
                await db.execute(
                    """UPDATE generation_history SET status = 'failed', error_message = ? WHERE id = ?""",
                    (error, history_id),
                )
                await db.commit()
        except Exception as e:
            logger.exception(f"DJ generation {job_id} failed")
            generation_service.update_job(job_id, status="failed", error=str(e))
            await generation_ws_manager.broadcast({
                "type": "failed",
                "job_id": job_id,
                "error": str(e),
            })

            try:
                db = await get_db()
                await db.execute(
                    """UPDATE generation_history SET status = 'failed', error_message = ? WHERE id = ?""",
                    (str(e), history_id),
                )
                await db.commit()
            except Exception:
                pass
        finally:
            await gpu_lock.release("dj")

        if deferred_title_caption:
            from bangers.services.deferred_titles import schedule_history_title_retry

            schedule_history_title_retry(
                job_id=job_id,
                history_id=history_id,
                caption=deferred_title_caption,
                fallback="DJ Generation",
            )

    async def get_dj_info(self) -> dict[str, Any]:
        """Return current DJ chat-LLM state.

        The user picks a chat model on the Models page; this endpoint
        reports which one is currently selected, what other models are
        installed, and the system prompt customization (if any).
        """
        db = await get_db()
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key IN ('dj_model', 'dj_system_prompt')"
        )
        rows = await cursor.fetchall()
        active_model = ""
        custom_system_prompt = ""
        for r in rows:
            if r["key"] == "dj_model":
                active_model = r["value"]
            elif r["key"] == "dj_system_prompt":
                custom_system_prompt = r["value"]

        return {
            "active_model": active_model,
            "installed_models": installed_chat_models(),
            "system_prompt": custom_system_prompt,
            "default_system_prompt": await _get_default_system_prompt(),
        }

    async def update_settings(
        self,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> dict[str, Any]:
        db = await get_db()
        if model is not None:
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('dj_model', ?, datetime('now'))",
                (model,),
            )
        if system_prompt is not None:
            default_system_prompt = await _get_default_system_prompt()
            if system_prompt.strip() == "" or system_prompt.strip() == default_system_prompt.strip():
                await db.execute(
                    "DELETE FROM settings WHERE key = 'dj_system_prompt'"
                )
            else:
                await db.execute(
                    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('dj_system_prompt', ?, datetime('now'))",
                    (system_prompt,),
                )
        await db.commit()
        return await self.get_dj_info()

    async def rename_conversation(self, conv_id: str, title: str) -> bool:
        db = await get_db()
        cursor = await db.execute(
            "SELECT id FROM dj_conversations WHERE id = ?", (conv_id,)
        )
        if await cursor.fetchone() is None:
            return False
        await db.execute(
            "UPDATE dj_conversations SET title = ? WHERE id = ?",
            (title, conv_id),
        )
        await db.commit()
        return True


dj_service = DJService()
