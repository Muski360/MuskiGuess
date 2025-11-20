"""
Smoke test for the Supabase-based multiplayer flow.

Usage:
  SUPABASE_URL=https://tkjkjelgecpviwhwvxbq.supabase.co \
  SUPABASE_SERVICE_KEY=... \
  SMOKE_PROFILE_ID=uuid-of-existing-profile \
  python scripts/smoke_multiplayer.py
"""

from __future__ import annotations

import os
import random
import string
import sys
from typing import Any, Dict

import requests

class SmokeFailure(RuntimeError):
    pass


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SmokeFailure(f"Missing required environment variable: {name}")
    return value


def supabase_headers(service_key: str) -> Dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def create_room(base_url: str, headers: Dict[str, str], host_id: str) -> Dict[str, Any]:
    code = "".join(random.choices(string.ascii_uppercase, k=6))
    payload = {
        "code": code,
        "host_id": host_id,
        "host_name": "SmokeBot",
        "language": "pt",
        "rounds_target": 1,
        "attempt_limit": 6,
    }
    response = requests.post(f"{base_url}/multiplayer_rooms", json=payload, headers=headers)
    if response.status_code >= 300:
        raise SmokeFailure(f"Failed to create room: {response.status_code} {response.text}")
    data = response.json()
    if isinstance(data, list):
        data = data[0]
    print(f"[ok] Sala criada com código {data['code']}")
    return data


def add_player(base_url: str, headers: Dict[str, str], room_id: str, user_id: str) -> Dict[str, Any]:
    payload = {
        "room_id": room_id,
        "user_id": user_id,
        "name": "SmokeBot",
        "is_host": True,
    }
    response = requests.post(f"{base_url}/multiplayer_players", json=payload, headers=headers)
    if response.status_code >= 300:
        raise SmokeFailure(f"Failed to insert host as player: {response.status_code} {response.text}")
    data = response.json()
    if isinstance(data, list):
        data = data[0]
    print(f"[ok] Player registrado (id={data['id']})")
    return data


def insert_guess(base_url: str, headers: Dict[str, str], room_id: str, player_id: str) -> Dict[str, Any]:
    payload = {
        "room_id": room_id,
        "player_id": player_id,
        "round_number": 1,
        "attempt_number": 1,
        "guess": "SMOKE",
        "feedback": None,
        "is_correct": False,
    }
    response = requests.post(f"{base_url}/multiplayer_guesses", json=payload, headers=headers)
    if response.status_code >= 300:
        raise SmokeFailure(f"Failed to insert guess: {response.status_code} {response.text}")
    data = response.json()
    if isinstance(data, list):
        data = data[0]
    print(f"[ok] Palpite salvo (id={data['id']})")
    return data


def fetch_guesses(base_url: str, headers: Dict[str, str], room_id: str) -> None:
    params = {
        "room_id": f"eq.{room_id}",
        "select": "id,guess,created_at",
    }
    response = requests.get(f"{base_url}/multiplayer_guesses", headers=headers, params=params)
    if response.status_code >= 300:
        raise SmokeFailure(f"Failed to fetch guesses: {response.status_code} {response.text}")
    rows = response.json()
    if not rows:
        raise SmokeFailure("Expected at least one guess, but none were returned.")
    print(f"[ok] Leitura funcionou ({len(rows)} palpites encontrados)")


def cleanup_room(base_url: str, headers: Dict[str, str], room_id: str) -> None:
    response = requests.delete(f"{base_url}/multiplayer_rooms", headers=headers, params={"id": f"eq.{room_id}"})
    if response.status_code >= 300:
        raise SmokeFailure(f"Failed to clean up room {room_id}: {response.status_code} {response.text}")
    print("[ok] Sala temporária removida")


def main() -> int:
    try:
        supabase_url = env("SUPABASE_URL").rstrip("/")
        service_key = env("SUPABASE_SERVICE_KEY")
        profile_id = env("SMOKE_PROFILE_ID")
        base_url = f"{supabase_url}/rest/v1"
        headers = supabase_headers(service_key)

        print("Iniciando smoke test do multiplayer...")
        room = create_room(base_url, headers, profile_id)
        player = add_player(base_url, headers, room["id"], profile_id)
        insert_guess(base_url, headers, room["id"], player["id"])
        fetch_guesses(base_url, headers, room["id"])
        print("Smoke test finalizado com sucesso!")
        cleanup_room(base_url, headers, room["id"])
        return 0
    except SmokeFailure as failure:
        print(f"[erro] {failure}", file=sys.stderr)
    except Exception as exc:  # noqa: BLE001
        print(f"[erro inesperado] {exc}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
