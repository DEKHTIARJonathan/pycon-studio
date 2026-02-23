import uuid

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from bangers.config import settings

router = APIRouter(tags=["uploads"])

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".opus"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
CHUNK_SIZE = 1024 * 1024  # 1MB


class UploadResponse(BaseModel):
    file_path: str


@router.post("/upload", response_model=UploadResponse)
async def upload_audio(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    filename = f"{uuid.uuid4()}{ext}"
    dest = settings.UPLOADS_DIR / filename
    total_size = 0

    try:
        with open(dest, "wb") as f:
            while chunk := await file.read(CHUNK_SIZE):
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    f.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(status_code=400, detail="File exceeds 100MB limit")
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    return UploadResponse(file_path=str(dest))
