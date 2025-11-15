"""
Utility script to assign the ADMIN tag to privileged users.

Usage:
    python scripts/set_admin_tags.py

It loads the Flask application context, updates the configured usernames,
and commits the changes.
"""

from __future__ import annotations

from backend.app import app, db
from backend.models import User

TARGET_TAG = "ADMIN"
ADMIN_USERS = ("Muski360", "risaogames")


def assign_admin_tags() -> None:
    with app.app_context():
        updated = 0
        for username in ADMIN_USERS:
            user = User.query.filter_by(username=username).first()
            if not user:
                print(f"[WARN] Usuário '{username}' não encontrado.")
                continue
            if user.tag == TARGET_TAG:
                print(f"[SKIP] Usuário '{username}' já possui tag {TARGET_TAG}.")
                continue
            user.tag = TARGET_TAG
            db.session.add(user)
            updated += 1
            print(f"[OK] Tag {TARGET_TAG} atribuída para '{username}'.")
        if updated:
            db.session.commit()
            print(f"[DONE] {updated} registro(s) atualizados.")
        else:
            db.session.rollback()
            print("[INFO] Nenhuma alteração aplicada.")


if __name__ == "__main__":
    assign_admin_tags()
