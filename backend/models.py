from __future__ import annotations

import enum
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from sqlalchemy import CheckConstraint, Computed, DateTime, Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import db


class GameMode(str, enum.Enum):
    """Enumeration of the supported game modes for statistics tracking."""

    CLASSIC = "classic"
    DUPLETO = "dupleto"
    QUAPLETO = "quapleto"
    MULTIPLAYER = "multiplayer"
    TOTAL = "total"


class User(db.Model):
    """Registered MuskiGuess user."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(12), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    reset_token: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    stats: Mapped[List["Stats"]] = relationship(
        "Stats", back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "username ~ '^[A-Za-z0-9]+$'", name="chk_username_valid"
        ),
        CheckConstraint(
            "(reset_token IS NULL) OR (reset_token ~ '^[A-Za-z0-9]{6}$')",
            name="chk_reset_token_length",
        ),
    )

    def to_public_dict(self) -> Dict[str, str]:
        """Return a sanitized representation safe for API responses."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Stats(db.Model):
    """Per-user statistics for each supported game mode."""

    __tablename__ = "stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    mode: Mapped[GameMode] = mapped_column(
        SAEnum(GameMode, name="game_mode"), nullable=False
    )
    num_games: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    num_wins: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    num_losses: Mapped[int] = mapped_column(
        Integer,
        Computed("num_games - num_wins", persisted=True),
        nullable=False,
    )
    num_multiplayer_games: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    num_multiplayer_wins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    num_multiplayer_losses: Mapped[Optional[int]] = mapped_column(
        Integer,
        Computed(
            "num_multiplayer_games - num_multiplayer_wins",
            persisted=True,
        ),
        nullable=True,
    )

    user: Mapped[User] = relationship("User", back_populates="stats")

    __table_args__ = (
        UniqueConstraint("user_id", "mode", name="uq_stats_user_mode"),
        CheckConstraint("num_wins <= num_games", name="chk_wins_not_exceed_games"),
        CheckConstraint(
            "("
            "  (mode = 'multiplayer' AND num_multiplayer_games IS NOT NULL "
            "   AND num_multiplayer_wins IS NOT NULL)"
            "  OR "
            "  (mode <> 'multiplayer' AND num_multiplayer_games IS NULL "
            "   AND num_multiplayer_wins IS NULL)"
            ")",
            name="chk_multiplayer_fields",
        ),
    )

    def to_dict(self) -> Dict[str, int]:
        """Serialize statistics for API responses."""
        num_games = self.num_games or 0
        num_wins = self.num_wins or 0
        num_losses = num_games - num_wins
        multi_games = self.num_multiplayer_games or 0
        multi_wins = self.num_multiplayer_wins or 0
        multi_losses = multi_games - multi_wins
        return {
            "id": self.id,
            "mode": self.mode.value if self.mode else None,
            "num_games": num_games,
            "num_wins": num_wins,
            "num_losses": max(num_losses, 0),
            "num_multiplayer_games": multi_games if self.mode == GameMode.MULTIPLAYER else None,
            "num_multiplayer_wins": multi_wins if self.mode == GameMode.MULTIPLAYER else None,
            "num_multiplayer_losses": max(multi_losses, 0)
            if self.mode == GameMode.MULTIPLAYER
            else None,
        }


DEFAULT_GAME_MODES: Iterable[GameMode] = (
    GameMode.CLASSIC,
    GameMode.DUPLETO,
    GameMode.QUAPLETO,
    GameMode.MULTIPLAYER,
    GameMode.TOTAL,
)


__all__ = [
    "db",
    "User",
    "Stats",
    "GameMode",
    "DEFAULT_GAME_MODES",
]
