from pydantic import BaseModel, Field
from typing import Optional


class DJConversationResponse(BaseModel):
    id: str
    title: str = "New Conversation"
    created_at: str = ""
    updated_at: str = ""


class DJMessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str  # "user", "assistant", "system"
    content: str
    generation_params_json: Optional[str] = None
    generation_job_id: Optional[str] = None
    created_at: str = ""


class DJConversationDetailResponse(DJConversationResponse):
    messages: list[DJMessageResponse] = Field(default_factory=list)


class CreateConversationRequest(BaseModel):
    title: str = "New Conversation"


class SendMessageRequest(BaseModel):
    content: str


class DJMessageResult(BaseModel):
    message: DJMessageResponse
    generation_job_id: Optional[str] = None
    fallback_notice: Optional[str] = None


class DJInfoResponse(BaseModel):
    active_model: str = ""
    installed_models: list[str] = Field(default_factory=list)
    system_prompt: str = ""
    default_system_prompt: str = ""


class DJSettingsUpdate(BaseModel):
    model: Optional[str] = None
    system_prompt: Optional[str] = None


class RenameConversationRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
