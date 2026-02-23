"""Configurable AceStepHandler for standalone checkpoint resolution."""

import gc
import math
import time as _time

from loguru import logger

from acestep.handler import AceStepHandler


# -- VAE decode throttle --
_vae_chunk_size: int = 128
_vae_sleep_ms: int = 200

# -- DiT diffusion throttle --
_dit_sleep_ms: int = 200

# -- Throttle scope --
# When True (default), throttling only applies during radio generation.
# When False, throttling applies to all generation.
_throttle_radio_only: bool = True

# Flag set by the radio service to indicate an active radio session.
_radio_active: bool = False


def set_vae_throttle(chunk_size: int, sleep_ms: int) -> None:
    """Update VAE decode throttling at runtime (called from settings API)."""
    global _vae_chunk_size, _vae_sleep_ms
    _vae_chunk_size = max(128, chunk_size)
    _vae_sleep_ms = max(0, sleep_ms)


def get_vae_throttle() -> dict:
    return {"chunk_size": _vae_chunk_size, "sleep_ms": _vae_sleep_ms}


def set_dit_throttle(sleep_ms: int) -> None:
    """Update DiT diffusion throttling at runtime."""
    global _dit_sleep_ms
    _dit_sleep_ms = max(0, sleep_ms)


def get_dit_throttle() -> dict:
    return {"sleep_ms": _dit_sleep_ms}


def set_throttle_radio_only(radio_only: bool) -> None:
    global _throttle_radio_only
    _throttle_radio_only = radio_only


def get_throttle_radio_only() -> bool:
    return _throttle_radio_only


def set_radio_active(active: bool) -> None:
    global _radio_active
    _radio_active = active


def _should_throttle() -> bool:
    """Return True if throttling should be applied right now."""
    if not _throttle_radio_only:
        return True
    return _radio_active


class BangersHandler(AceStepHandler):
    """AceStepHandler with configurable project root and GPU throttling.

    Overrides _get_project_root() for standalone checkpoint resolution,
    _mlx_run_diffusion() to inject sleeps between DiT steps, and
    _mlx_decode_single() to use smaller tile sizes with brief sleeps
    between VAE decode chunks.

    Both DiT and VAE warmups pre-compile Metal shaders on the first
    call with tiny inputs, avoiding the JIT spike that stutters audio.
    """

    def __init__(self, project_root: str):
        self._custom_project_root = project_root
        self._dit_warmed_up = False
        super().__init__()

    def _get_project_root(self) -> str:
        return self._custom_project_root

    def _warmup_dit(self, encoder_hidden_states, context_latents, src_latents):
        """Run a tiny forward pass through the DiT decoder to trigger Metal
        shader compilation without a heavy GPU burst.

        Only runs once per session — subsequent calls are no-ops.
        """
        if self._dit_warmed_up:
            return
        try:
            import mlx.core as mx

            # Infer channel dimensions from the real tensors
            D = encoder_hidden_states.shape[2]  # encoder hidden dim
            C = src_latents.shape[2]            # latent channels (64)
            C_ctx = context_latents.shape[2]    # context channels

            # Minimal tensors: 1 batch, 4 time steps
            warmup_xt = mx.zeros((1, 4, C))
            warmup_t = mx.full((1,), 1.0)
            warmup_enc = mx.zeros((1, 4, D))
            warmup_ctx = mx.zeros((1, 4, C_ctx))

            warmup_out, _ = self.mlx_decoder(
                hidden_states=warmup_xt,
                timestep=warmup_t,
                timestep_r=warmup_t,
                encoder_hidden_states=warmup_enc,
                context_latents=warmup_ctx,
                cache=None,
                use_cache=False,
            )
            mx.eval(warmup_out)
            del warmup_xt, warmup_t, warmup_enc, warmup_ctx, warmup_out
            gc.collect()
            logger.info("DiT Metal shader warmup complete")
        except Exception as e:
            logger.warning(f"DiT warmup failed (non-fatal): {e}")
        self._dit_warmed_up = True

    def _mlx_run_diffusion(self, *args, **kwargs):
        """Run diffusion with a sleep injected between each DiT step.

        Temporarily wraps self.mlx_decoder so that every forward pass
        is preceded by a brief sleep, giving the audio thread time to
        breathe between GPU bursts on unified memory.
        """
        # Warmup on first call — upstream passes kwargs, not positional args.
        if not self._dit_warmed_up:
            enc_hs = args[0] if len(args) > 0 else kwargs.get("encoder_hidden_states")
            ctx = args[2] if len(args) > 2 else kwargs.get("context_latents")
            src = args[3] if len(args) > 3 else kwargs.get("src_latents")
            if enc_hs is not None and ctx is not None and src is not None:
                self._warmup_dit(enc_hs, ctx, src)
                sleep_s = _dit_sleep_ms / 1000.0
                if sleep_s > 0:
                    _time.sleep(sleep_s * 3)

        if not _should_throttle():
            return super()._mlx_run_diffusion(*args, **kwargs)

        sleep_s = _dit_sleep_ms / 1000.0
        if sleep_s <= 0:
            return super()._mlx_run_diffusion(*args, **kwargs)

        original = self.mlx_decoder

        class _ThrottledDecoder:
            """Transparent wrapper that sleeps before each decoder call."""

            def __init__(self, decoder):
                self._decoder = decoder

            def __call__(self, *a, **kw):
                _time.sleep(sleep_s)
                return self._decoder(*a, **kw)

            def __getattr__(self, name):
                return getattr(self._decoder, name)

        self.mlx_decoder = _ThrottledDecoder(original)
        try:
            return super()._mlx_run_diffusion(*args, **kwargs)
        finally:
            self.mlx_decoder = original

    def _mlx_vae_decode(self, latents):
        """Wrap upstream MLX VAE decode to auto-disable on ZeroDivisionError.

        Some MLX VAE configurations trigger a division-by-zero in the Snake1d
        activation. When this happens, disable MLX VAE for the rest of the
        session so subsequent generations skip straight to the PyTorch path
        without the repeated error spam.
        """
        try:
            return super()._mlx_vae_decode(latents)
        except ZeroDivisionError:
            logger.warning(
                "[BangersHandler] MLX VAE decode hit ZeroDivisionError — "
                "disabling MLX VAE for this session, using PyTorch VAE instead"
            )
            self.use_mlx_vae = False
            raise

    def _mlx_decode_single(self, z_nlc, decode_fn=None):
        """Decode a single sample with throttled tiling for radio-safe playback."""
        import mlx.core as mx
        from tqdm import tqdm

        if decode_fn is None:
            decode_fn = getattr(self, '_mlx_compiled_decode', self.mlx_vae.decode)

        throttle = _should_throttle()
        T = z_nlc.shape[1]
        chunk_size = _vae_chunk_size if throttle else T
        sleep_s = _vae_sleep_ms / 1000.0 if throttle else 0.0
        overlap = 64

        if T <= chunk_size:
            if sleep_s > 0:
                mx.eval(z_nlc)
                _time.sleep(sleep_s)
            return decode_fn(z_nlc)

        stride = chunk_size - 2 * overlap
        num_steps = math.ceil(T / stride)
        decoded_parts = []
        upsample_factor = None

        # Force-evaluate input tensor so it's materialised on the GPU.
        mx.eval(z_nlc)

        # Warmup: trigger Metal shader compilation with a tiny decode.
        # Metal compute pipelines are shape-independent and cached per
        # kernel type, so a small input compiles the same shaders that
        # the real decode will use — without a heavy GPU burst.
        warmup_z = z_nlc[:, :16, :]
        warmup_out = self.mlx_vae.decode(warmup_z)
        mx.eval(warmup_out)
        del warmup_z, warmup_out
        gc.collect()

        if sleep_s > 0:
            _time.sleep(sleep_s * 3)

        for i in tqdm(range(num_steps), desc="Decoding audio chunks", disable=self.disable_tqdm):
            core_start = i * stride
            core_end = min(core_start + stride, T)
            win_start = max(0, core_start - overlap)
            win_end = min(T, core_end + overlap)

            chunk = z_nlc[:, win_start:win_end, :]
            audio_chunk = decode_fn(chunk)
            mx.eval(audio_chunk)

            if upsample_factor is None:
                upsample_factor = audio_chunk.shape[1] / chunk.shape[1]

            added_start = core_start - win_start
            trim_start = int(round(added_start * upsample_factor))
            added_end = win_end - core_end
            trim_end = int(round(added_end * upsample_factor))

            audio_len = audio_chunk.shape[1]
            end_idx = audio_len - trim_end if trim_end > 0 else audio_len
            decoded_parts.append(audio_chunk[:, trim_start:end_idx, :])

            # Brief sleep between chunks to let the audio thread breathe
            if sleep_s > 0 and i < num_steps - 1:
                _time.sleep(sleep_s)

        return mx.concatenate(decoded_parts, axis=1)
