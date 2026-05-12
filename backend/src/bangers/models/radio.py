from pydantic import BaseModel, Field
from typing import Optional

from bangers.models.common import SongResponse


class StationResponse(BaseModel):
    id: str
    name: str
    description: str = ""
    is_preset: bool = False
    caption_template: str = ""
    genre: str = ""
    mood: str = ""
    instrumental: bool = True
    vocal_language: str = "en"
    bpm_min: Optional[int] = None
    bpm_max: Optional[int] = None
    keyscale: str = ""
    timesignature: str = ""
    advanced_params_json: str = "{}"
    total_plays: int = 0
    last_played_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


class CreateStationRequest(BaseModel):
    name: str
    description: str = ""
    caption_template: str = ""
    genre: str = ""
    mood: str = ""
    instrumental: bool = True
    vocal_language: str = "en"
    bpm_min: Optional[int] = None
    bpm_max: Optional[int] = None
    keyscale: str = ""
    timesignature: str = ""
    advanced_params_json: str = "{}"


class UpdateStationRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    caption_template: Optional[str] = None
    genre: Optional[str] = None
    mood: Optional[str] = None
    instrumental: Optional[bool] = None
    vocal_language: Optional[str] = None
    bpm_min: Optional[int] = None
    bpm_max: Optional[int] = None
    keyscale: Optional[str] = None
    timesignature: Optional[str] = None
    advanced_params_json: Optional[str] = None


class CreateStationFromSongRequest(BaseModel):
    song_id: str
    name: Optional[str] = None


class StationDetailResponse(StationResponse):
    recent_songs: list[SongResponse] = Field(default_factory=list)


class RadioStatusResponse(BaseModel):
    active_station_id: Optional[str] = None
    is_generating: bool = False
    songs_generated: int = 0


class RadioSettingsResponse(BaseModel):
    active_model: str = ""
    loaded_model: str = ""
    installed_models: list[str] = Field(default_factory=list)
    system_prompt: str = ""
    default_system_prompt: str = ""


class RadioSettingsUpdate(BaseModel):
    model: Optional[str] = None
    system_prompt: Optional[str] = None
