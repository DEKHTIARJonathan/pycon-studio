#!/usr/bin/env python3
"""conda install bangers Launcher — starts backend + frontend in one command."""

import os
import argparse
import signal
import subprocess
import sys
import shutil
import threading
import time
import webbrowser
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
DEFAULT_DATA_DIR = BACKEND_DIR / "data"
DEFAULT_MODEL_CACHE_DIR = ROOT / ".pip-install-bangers-cache" / "models"

# Self-signed cert + key shared by both Next.js and uvicorn. Generated once
# and reused on every restart (regenerated only if missing or expired). Lives
# under .pip-install-bangers-cache so it's gitignored alongside other runtime
# artifacts and survives `mise run clean`'s narrower data-dir wipe.
CERT_DIR = ROOT / ".pip-install-bangers-cache" / "tls"
CERT_FILE = CERT_DIR / "dev.pem"
KEY_FILE = CERT_DIR / "dev-key.pem"
FRONTEND_PORT = 3000
BACKEND_PORT = 8000

# Colors for terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def log(msg: str, color: str = GREEN) -> None:
    print(f"{color}{BOLD}[conda install bangers]{RESET} {msg}")


def ensure_data_dirs() -> None:
    """Create data directories if they don't exist."""
    data_dir = Path(os.getenv("BANGERS_DATA_DIR", str(DEFAULT_DATA_DIR))).expanduser()
    model_cache_dir = Path(
        os.getenv("BANGERS_MODEL_CACHE_DIR", str(DEFAULT_MODEL_CACHE_DIR))
    ).expanduser()

    (data_dir / "audio").mkdir(parents=True, exist_ok=True)
    (data_dir / "uploads").mkdir(parents=True, exist_ok=True)

    checkpoints_dir = model_cache_dir / "checkpoints"
    (model_cache_dir / "checkpoints").mkdir(parents=True, exist_ok=True)
    (model_cache_dir / "chat-llm").mkdir(parents=True, exist_ok=True)
    (model_cache_dir / "huggingface" / "hub").mkdir(parents=True, exist_ok=True)
    has_models = any(checkpoints_dir.iterdir()) if checkpoints_dir.exists() else False
    if not has_models:
        log("No model checkpoints found.", YELLOW)
        log("Open the Models page once the app starts to download and select a model.", YELLOW)
        log(f"Checkpoint directory: {checkpoints_dir}", YELLOW)
        print()


def build_runtime_env() -> dict[str, str]:
    model_cache_dir = os.environ.get("BANGERS_MODEL_CACHE_DIR", str(DEFAULT_MODEL_CACHE_DIR))
    data_dir = os.environ.get("BANGERS_DATA_DIR", str(DEFAULT_DATA_DIR))
    env = {
        **os.environ,
        "PYTHONUNBUFFERED": "1",
        "BANGERS_DATA_DIR": data_dir,
        "BANGERS_MODEL_CACHE_DIR": model_cache_dir,
        "ACESTEP_PROJECT_ROOT": os.environ.get("ACESTEP_PROJECT_ROOT", model_cache_dir),
        "HF_HOME": os.environ.get("HF_HOME", str(Path(model_cache_dir) / "huggingface")),
        "HF_HUB_CACHE": os.environ.get("HF_HUB_CACHE", str(Path(model_cache_dir) / "huggingface" / "hub")),
    }
    return env


def check_prerequisites() -> bool:
    ok = True

    # Python version
    if sys.version_info < (3, 11):
        log(f"Python 3.11+ required, found {sys.version}", RED)
        ok = False

    # uv
    if not shutil.which("uv"):
        log("'uv' not found. Install: https://docs.astral.sh/uv/getting-started/installation/", RED)
        ok = False

    # Node.js
    if not shutil.which("node"):
        log("'node' not found. Install: https://nodejs.org/", RED)
        ok = False

    # pnpm
    if not shutil.which("pnpm"):
        log("'pnpm' not found. Install: https://pnpm.io/installation", RED)
        ok = False

    # openssl: used to mint a self-signed cert for the dev TLS stack so
    # browsers expose AudioWorklet (and other secure-context APIs) when the
    # app is reached over a LAN IP. Ships with macOS and almost every Linux
    # distro out of the box; only flag if it's genuinely missing.
    if not shutil.which("openssl"):
        log(
            "'openssl' not found — required to generate the dev TLS cert. "
            "Install via your package manager (e.g. `apt install openssl`).",
            RED,
        )
        ok = False

    return ok


def open_browser_when_ready(url: str, timeout: int = 60) -> None:
    """Poll the frontend URL and open the browser once it responds.

    Next.js serves HTTPS with our self-signed dev cert, so we can't let
    urlopen verify it — we only need a 2xx/3xx response to know the dev
    server is up.
    """
    import ssl

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            # Generous per-request timeout so the very first hit doesn't
            # time out while Next.js is cold-compiling the route.
            urlopen(url, timeout=30, context=ctx)
            log(f"Opening {CYAN}{BOLD}{url}{RESET} in your browser...")
            webbrowser.open(url)
            return
        except (URLError, OSError):
            time.sleep(1)
    log(f"Frontend didn't respond in time — open {url} manually.", YELLOW)


def _run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command, using shell=True on Windows so .cmd wrappers are found."""
    if sys.platform == "win32":
        return subprocess.run(cmd, shell=True, **kwargs)
    return subprocess.run(cmd, **kwargs)


def _popen(cmd: list[str], **kwargs) -> subprocess.Popen:
    """Open a subprocess, using shell=True on Windows so .cmd wrappers are found."""
    if sys.platform == "win32":
        return subprocess.Popen(cmd, shell=True, **kwargs)
    return subprocess.Popen(cmd, **kwargs)


def _cert_is_fresh(cert_path: Path, sans: list[str]) -> bool:
    """True iff the cert exists, is valid for >7 days, and covers every SAN.

    We regenerate proactively when the LAN IP changes (laptop moved networks)
    so the browser doesn't reject the cert with NET::ERR_CERT_COMMON_NAME_INVALID.
    """
    if not cert_path.exists():
        return False
    try:
        result = subprocess.run(
            ["openssl", "x509", "-in", str(cert_path), "-noout",
             "-checkend", str(7 * 24 * 3600), "-text"],
            capture_output=True, text=True, timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    if result.returncode != 0:
        return False
    text = result.stdout
    for san in sans:
        # openssl prints SANs as "DNS:foo" or "IP Address:1.2.3.4"
        token = f"IP Address:{san}" if san.replace(".", "").isdigit() else f"DNS:{san}"
        if token not in text:
            return False
    return True


def ensure_dev_cert(extra_hosts: list[str]) -> tuple[Path, Path]:
    """Mint (or reuse) a self-signed cert covering localhost + LAN IP(s).

    The same cert/key pair is fed to both Next.js (`--experimental-https-cert`)
    and uvicorn (`--ssl-certfile`) so the frontend and backend share an origin
    scheme — without that the browser blocks the cross-origin fetch as
    mixed content.

    No CA install, no system trust store, no sudo. The browser will warn
    once about the self-signed cert; click through it.
    """
    sans = ["localhost", "127.0.0.1", *extra_hosts]
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    if _cert_is_fresh(CERT_FILE, sans) and KEY_FILE.exists():
        return CERT_FILE, KEY_FILE

    log("Generating self-signed dev TLS cert...")
    dns_idx = 0
    ip_idx = 0
    san_entries: list[str] = []
    for h in sans:
        if h.replace(".", "").isdigit():
            ip_idx += 1
            san_entries.append(f"IP.{ip_idx} = {h}")
        else:
            dns_idx += 1
            san_entries.append(f"DNS.{dns_idx} = {h}")
    san_lines = "\n".join(san_entries)
    config = f"""
[req]
distinguished_name = dn
x509_extensions = v3_req
prompt = no

[dn]
CN = conda install bangers dev

[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt

[alt]
{san_lines}
""".strip()

    config_path = CERT_DIR / "openssl.cnf"
    config_path.write_text(config)
    subprocess.run(
        [
            "openssl", "req", "-x509", "-nodes",
            "-newkey", "rsa:2048",
            "-keyout", str(KEY_FILE),
            "-out", str(CERT_FILE),
            "-days", "365",
            "-config", str(config_path),
        ],
        check=True, capture_output=True,
    )
    KEY_FILE.chmod(0o600)
    return CERT_FILE, KEY_FILE


def _detect_lan_ip() -> str | None:
    """Best-effort guess at the LAN/VPN IP others would use to reach this box.

    Opens a UDP socket to a non-routable address; the kernel then picks the
    interface it would use, and getsockname() reveals the local IP without
    actually sending a packet.
    """
    import socket

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("10.255.255.255", 1))
        ip = sock.getsockname()[0]
        return ip if ip and not ip.startswith("127.") else None
    except OSError:
        return None
    finally:
        sock.close()


def _has_nvidia_gpu() -> bool:
    """Check if an NVIDIA GPU is available (Windows/Linux)."""
    if shutil.which("nvidia-smi") is None:
        return False
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0 and bool(result.stdout.strip())
    except Exception:
        return False


def _torch_has_cuda() -> bool:
    """Check if the installed torch build has CUDA support."""
    venv_python = BACKEND_DIR / ".venv" / ("Scripts" if sys.platform == "win32" else "bin") / "python"
    if not venv_python.exists():
        return False
    try:
        result = subprocess.run(
            [str(venv_python), "-c", "import torch; print(torch.cuda.is_available())"],
            capture_output=True, text=True, timeout=30,
        )
        return "True" in result.stdout
    except Exception:
        return False


def _install_cuda_torch() -> None:
    """Replace CPU-only torch with the CUDA build for NVIDIA GPUs."""
    log("NVIDIA GPU detected but torch has no CUDA support.", YELLOW)
    log("Installing PyTorch with CUDA (this may take a few minutes)...")
    _run(
        ["uv", "pip", "install",
         "--reinstall-package", "torch",
         "--reinstall-package", "torchvision",
         "--reinstall-package", "torchaudio",
         "torch", "torchvision", "torchaudio",
         "--index-url", "https://download.pytorch.org/whl/cu128"],
        cwd=BACKEND_DIR, check=True,
    )
    log("PyTorch with CUDA installed successfully.")


def _deps_changed() -> bool:
    """Check if lockfiles are newer than the last successful install."""
    backend_stamp = BACKEND_DIR / ".venv" / ".deps-stamp"
    frontend_stamp = FRONTEND_DIR / "node_modules" / ".deps-stamp"
    backend_lock = BACKEND_DIR / "uv.lock"
    frontend_lock = FRONTEND_DIR / "pnpm-lock.yaml"

    if backend_lock.exists() and (
        not backend_stamp.exists()
        or backend_lock.stat().st_mtime > backend_stamp.stat().st_mtime
    ):
        return True

    if frontend_lock.exists() and (
        not frontend_stamp.exists()
        or frontend_lock.stat().st_mtime > frontend_stamp.stat().st_mtime
    ):
        return True

    return False


def _touch_dep_stamps() -> None:
    """Record a successful install so we can detect future lockfile changes."""
    backend_stamp = BACKEND_DIR / ".venv" / ".deps-stamp"
    frontend_stamp = FRONTEND_DIR / "node_modules" / ".deps-stamp"
    backend_stamp.touch()
    frontend_stamp.touch()


def install_dependencies() -> None:
    log("Installing backend dependencies...")
    _run(["uv", "sync"], cwd=BACKEND_DIR, check=True)

    # On Windows/Linux with NVIDIA GPU, ensure torch has CUDA support
    if sys.platform != "darwin" and _has_nvidia_gpu() and not _torch_has_cuda():
        _install_cuda_torch()

    log("Installing frontend dependencies...")
    _run(["pnpm", "install", "--frozen-lockfile"], cwd=FRONTEND_DIR, check=True)

    _touch_dep_stamps()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run conda install bangers locally")
    parser.add_argument("--install", action="store_true", help="Force reinstall all dependencies")
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically")
    args = parser.parse_args()

    print(f"\n{CYAN}{BOLD}  conda install bangers  {RESET}")
    print(f"  {CYAN}Local AI Music Generation{RESET}\n")

    if not check_prerequisites():
        log("Missing prerequisites. See above.", RED)
        sys.exit(1)

    ensure_data_dirs()

    # Install deps if needed
    if not (BACKEND_DIR / ".venv").exists() or not (FRONTEND_DIR / "node_modules").exists():
        install_dependencies()
    elif _deps_changed():
        log("Dependencies changed — updating...", YELLOW)
        install_dependencies()
    elif not args.install:
        log("Dependencies up to date.", YELLOW)

    if args.install:
        install_dependencies()

    runtime_env = build_runtime_env()
    lan_ip = _detect_lan_ip()
    extra_sans = [lan_ip] if lan_ip else []
    cert_path, key_path = ensure_dev_cert(extra_sans)

    local_url = f"https://localhost:{FRONTEND_PORT}"
    lan_url = f"https://{lan_ip}:{FRONTEND_PORT}" if lan_ip else None

    log(f"Backend  HTTPS on {CYAN}https://localhost:{BACKEND_PORT}{RESET}")
    log(f"Frontend HTTPS on {CYAN}{local_url}{RESET}")
    if lan_url:
        log(f"Frontend HTTPS on {CYAN}{lan_url}{RESET} (for other devices on the LAN)")
    log(
        f"TLS cert is self-signed — your browser will warn once, click through it.",
        YELLOW,
    )
    print()

    procs: list[subprocess.Popen] = []

    def shutdown(sig=None, frame=None):
        print()
        log("Shutting down...")
        for p in procs:
            if sys.platform == "win32":
                # shell=True means p.terminate() only kills cmd.exe, not the
                # child process tree.  taskkill /T /F kills the entire tree.
                subprocess.run(
                    ["taskkill", "/T", "/F", "/PID", str(p.pid)],
                    capture_output=True,
                )
            else:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Start backend with TLS — uvicorn loads the same self-signed cert that
    # we feed to Next.js below, so the frontend's cross-origin fetch to the
    # API doesn't get blocked as mixed content.
    backend_env = {
        **runtime_env,
        "BANGERS_SSL_CERTFILE": str(cert_path),
        "BANGERS_SSL_KEYFILE": str(key_path),
    }
    backend_cmd = ["uv", "run", "--no-sync", "pip-install-bangers"]
    backend = _popen(
        backend_cmd,
        cwd=BACKEND_DIR,
        env=backend_env,
    )
    procs.append(backend)

    # Start frontend. We pass the pre-generated cert via `--experimental-https-*`
    # so Next.js skips its mkcert step entirely — that's important on headless
    # boxes where mkcert would block on a sudo password prompt trying to
    # install its CA into the system trust store.
    #
    # We call `pnpm exec next` rather than `pnpm dev` because pnpm forwards
    # the `--` separator itself as a literal arg to the `next dev` script,
    # which then misreads `--experimental-https` as a project directory.
    frontend_cmd = [
        "pnpm", "exec", "next", "dev",
        "--experimental-https",
        "--experimental-https-cert", str(cert_path),
        "--experimental-https-key", str(key_path),
    ]
    frontend = _popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        env={
            **runtime_env,
            "NEXT_TELEMETRY_DISABLED": "1",
            # SSR/RSC code paths in Next.js dial the backend with Node's
            # built-in fetch, which by default rejects our self-signed cert.
            # Disable the check inside the dev process only — never ship this
            # to production.
            "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        },
    )
    procs.append(frontend)

    if not args.no_open:
        opener = threading.Thread(
            target=open_browser_when_ready,
            args=(local_url,),
            daemon=True,
        )
        opener.start()

    log("Press Ctrl+C to stop.\n")

    # Wait for either process to exit
    try:
        while True:
            for p in procs:
                ret = p.poll()
                if ret is not None:
                    name = "Backend" if p == backend else "Frontend"
                    log(f"{name} exited with code {ret}", RED if ret != 0 else YELLOW)
                    shutdown()
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
