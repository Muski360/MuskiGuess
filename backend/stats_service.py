from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from flask import current_app
from database import db
from models import DEFAULT_GAME_MODES, GameMode, Stats, User


def _coerce_user_id(user_or_id) -> Optional[int]:
    if user_or_id is None:
        return None
    if isinstance(user_or_id, int):
        return user_or_id
    if hasattr(user_or_id, "id"):
        return getattr(user_or_id, "id")
    return None


def ensure_default_stats(user_or_id, *, commit: bool = True) -> List[Stats]:
    """Ensure that all default stats rows exist for the given user."""
    user_id = _coerce_user_id(user_or_id)
    if not user_id:
        return []

    existing_modes = {
        stats.mode
        for stats in Stats.query.filter_by(user_id=user_id).all()
    }
    created: List[Stats] = []
    for mode in DEFAULT_GAME_MODES:
        if mode in existing_modes:
            continue
        stats = Stats(user_id=user_id, mode=mode)
        if mode == GameMode.MULTIPLAYER:
            stats.num_multiplayer_games = 0
            stats.num_multiplayer_wins = 0
        db.session.add(stats)
        created.append(stats)
    if commit and created:
        try:
            db.session.commit()
        except Exception:  # noqa: BLE001 - log unexpected DB issues
            db.session.rollback()
            current_app.logger.exception(
                "Failed to create default stats rows for user_id=%s", user_id
            )
    return created


def record_singleplayer_result(
    user_id: int,
    mode: GameMode,
    won: bool,
) -> None:
    """Persist the result of a single-player match."""
    if not user_id or mode not in {
        GameMode.CLASSIC,
        GameMode.DUPLETO,
        GameMode.QUAPLETO,
    }:
        return

    ensure_default_stats(user_id, commit=True)
    try:
        stats = (
            Stats.query.filter_by(user_id=user_id, mode=mode)
            .with_for_update()
            .first()
        )
        total_stats = (
            Stats.query.filter_by(user_id=user_id, mode=GameMode.TOTAL)
            .with_for_update()
            .first()
        )
        if not stats or not total_stats:
            current_app.logger.warning(
                "Stats rows missing for user_id=%s mode=%s", user_id, mode
            )
            return
        stats.num_games = (stats.num_games or 0) + 1
        total_stats.num_games = (total_stats.num_games or 0) + 1
        if won:
            stats.num_wins = (stats.num_wins or 0) + 1
            total_stats.num_wins = (total_stats.num_wins or 0) + 1
        db.session.commit()
    except Exception:  # noqa: BLE001 - log unexpected DB issues
        db.session.rollback()
        current_app.logger.exception(
            "Failed to record single-player stats for user_id=%s mode=%s",
            user_id,
            mode.value if isinstance(mode, GameMode) else mode,
        )


def record_multiplayer_match(
    participants: Sequence[Tuple[int, bool]],
) -> None:
    """Persist the outcome of a multiplayer match.

    Args:
        participants: Sequence of tuples (user_id, is_winner).
    """
    sanitized = [(uid, bool(is_winner)) for uid, is_winner in participants if uid]
    if not sanitized:
        return

    user_ids = {uid for uid, _ in sanitized}
    for uid in user_ids:
        ensure_default_stats(uid, commit=True)

    try:
        for user_id, is_winner in sanitized:
            mp_stats = (
                Stats.query.filter_by(user_id=user_id, mode=GameMode.MULTIPLAYER)
                .with_for_update()
                .first()
            )
            total_stats = (
                Stats.query.filter_by(user_id=user_id, mode=GameMode.TOTAL)
                .with_for_update()
                .first()
            )
            if not mp_stats or not total_stats:
                current_app.logger.warning(
                    "Multiplayer stats row missing for user_id=%s", user_id
                )
                continue
            mp_stats.num_games = (mp_stats.num_games or 0) + 1
            mp_stats.num_multiplayer_games = (mp_stats.num_multiplayer_games or 0) + 1
            total_stats.num_games = (total_stats.num_games or 0) + 1
            if is_winner:
                mp_stats.num_wins = (mp_stats.num_wins or 0) + 1
                mp_stats.num_multiplayer_wins = (mp_stats.num_multiplayer_wins or 0) + 1
                total_stats.num_wins = (total_stats.num_wins or 0) + 1
        db.session.commit()
    except Exception:  # noqa: BLE001 - log unexpected DB issues
        db.session.rollback()
        current_app.logger.exception(
            "Failed to record multiplayer stats for user_ids=%s",
            ", ".join(str(uid) for uid, _ in sanitized),
        )


def fetch_user_stats(user_id: int) -> List[Dict[str, int]]:
    """Return serialized stats for the given user."""
    if not user_id:
        return []
    ensure_default_stats(user_id, commit=True)
    stats = Stats.query.filter_by(user_id=user_id).all()
    order = {mode: index for index, mode in enumerate(DEFAULT_GAME_MODES)}
    stats.sort(key=lambda item: order.get(item.mode, len(order)))
    return [item.to_dict() for item in stats]


LEADERBOARD_MODES: Tuple[GameMode, ...] = (
    GameMode.TOTAL,
    GameMode.CLASSIC,
    GameMode.DUPLETO,
    GameMode.QUAPLETO,
)


def fetch_leaderboard(limit: Optional[int] = None) -> Dict[str, object]:
    """Return leaderboard rows (top players by wins) for the configured modes."""
    sanitized_limit = 30
    if isinstance(limit, int) and limit > 0:
        sanitized_limit = max(1, min(limit, 200))

    leaderboard: Dict[str, object] = {}
    for mode in LEADERBOARD_MODES:
        query = (
            db.session.query(Stats, User.username)
            .join(User, Stats.user_id == User.id)
            .filter(Stats.mode == mode, Stats.num_wins > 0)
            .order_by(Stats.num_wins.desc(), Stats.num_games.asc(), User.username.asc())
            .limit(sanitized_limit)
        )
        rows = query.all()
        serialized: List[Dict[str, object]] = []
        for rank, (stats, username) in enumerate(rows, start=1):
            num_games = stats.num_games or 0
            num_wins = stats.num_wins or 0
            win_rate = (num_wins / num_games * 100) if num_games else 0.0
            serialized.append(
                {
                    "rank": rank,
                    "username": username,
                    "wins": num_wins,
                    "games": num_games,
                    "winRate": round(win_rate, 1) if num_games else 0.0,
                }
            )
        leaderboard[mode.value] = serialized
    return leaderboard
