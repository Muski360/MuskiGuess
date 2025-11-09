from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, session

from stats_service import fetch_leaderboard, fetch_user_stats

stats_bp = Blueprint("stats", __name__)


@stats_bp.get("/api/stats")
def get_stats():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Nǜo autenticado."}), 401
    data = fetch_user_stats(user_id)
    return jsonify({"stats": data})


@stats_bp.get("/api/leaderboard")
def get_leaderboard():
    limit = request.args.get("limit", type=int)
    leaderboard = fetch_leaderboard(limit=limit)
    generated_at = datetime.now(timezone.utc).isoformat()
    return jsonify(
        {
            "leaderboard": leaderboard,
            "generatedAt": generated_at,
            "limit": limit or 30,
        }
    )
