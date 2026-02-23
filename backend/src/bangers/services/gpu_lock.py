import asyncio

from loguru import logger


class GpuLock:
    """Prevents concurrent GPU operations."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._holder: str | None = None

    async def acquire(self, holder: str) -> bool:
        """Try to acquire the GPU lock. Returns True if acquired."""
        if self._lock.locked():
            logger.warning(f"GPU lock denied for '{holder}' — held by '{self._holder}'")
            return False
        await self._lock.acquire()
        self._holder = holder
        logger.info(f"GPU lock acquired by '{holder}'")
        return True

    async def await_acquire(self, holder: str) -> bool:
        """Wait indefinitely to acquire the GPU lock."""
        previous_holder = self._holder
        await self._lock.acquire()
        self._holder = holder
        if previous_holder is not None and previous_holder != holder:
            logger.info(
                f"GPU lock acquired by '{holder}' (waited for '{previous_holder}')"
            )
        else:
            logger.info(f"GPU lock acquired by '{holder}'")
        return True

    async def release(self, holder: str) -> None:
        """Release the GPU lock."""
        if self._holder == holder and self._lock.locked():
            self._holder = None
            self._lock.release()
            logger.info(f"GPU lock released by '{holder}'")

    @property
    def is_locked(self) -> bool:
        return self._lock.locked()

    @property
    def holder(self) -> str | None:
        return self._holder


gpu_lock = GpuLock()
