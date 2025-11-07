from __future__ import annotations

from flask import Blueprint, jsonify, session

from stats_service import fetch_user_stats

stats_bp = Blueprint("stats", __name__)


@stats_bp.get("/api/stats")
def get_stats():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Não autenticado."}), 401
    data = fetch_user_stats(user_id)
    return jsonify({"stats": data})
