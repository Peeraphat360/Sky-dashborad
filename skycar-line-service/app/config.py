"""Application settings loaded from environment / .env file."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # LINE Messaging API
    line_channel_access_token: str = ""

    # Receipt presentation
    logo_url: str = "https://placehold.co/240x80/0369a1/ffffff/png?text=Sky+Car+Park"
    shop_phone: str = "082-325-8380"

    # Webhook security
    webhook_secret: str = "change-me"

    # Comma-separated production origins allowed to call the API from a browser
    # (e.g. the Netlify dashboard URL). localhost ports are always allowed (dev).
    cors_origins: str = ""


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (read once per process)."""
    return Settings()
