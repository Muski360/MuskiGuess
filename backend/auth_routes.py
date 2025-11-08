from __future__ import annotations

import re
from typing import Dict, Optional

import bcrypt
from flask import Blueprint, jsonify, request, session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from database import db
from models import User
from stats_service import ensure_default_stats


auth_bp = Blueprint("auth", __name__)

USERNAME_RE = re.compile(r"^[A-Za-z0-9]{1,12}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _extract_payload() -> Dict[str, str]:
    data = request.get_json(silent=True)
    if not data:
        data = request.form or {}
    return {key: (value or "").strip() for key, value in data.items()}


def _normalize_email(value: str) -> str:
    return value.lower()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _validate_registration(username: str, email: str, password: str) -> Optional[Dict[str, str]]:
    errors: Dict[str, str] = {}
    if not username:
        errors["username"] = "Informe um nome de usuário."
    elif not USERNAME_RE.fullmatch(username):
        errors["username"] = "Use de 1 a 12 caracteres apenas com letras e números."
    if not email:
        errors["email"] = "Informe um e-mail."
    elif not EMAIL_RE.fullmatch(email):
        errors["email"] = "E-mail inválido."
    if not password or len(password) < 8:
        errors["password"] = "A senha deve ter pelo menos 8 caracteres."
    return errors or None


@auth_bp.post("/register")
def register():
    payload = _extract_payload()
    username = payload.get("username", "")
    email = _normalize_email(payload.get("email", ""))
    password = payload.get("password", "")

    errors = _validate_registration(username, email, password)
    if errors:
        return jsonify({"errors": errors}), 400

    existing = User.query.filter(
        or_(User.email == email, User.username == username)
    ).first()
    if existing:
        dup_errors: Dict[str, str] = {}
        if existing.email == email:
            dup_errors["email"] = "Este e-mail já está registrado."
        if existing.username == username:
            dup_errors["username"] = "Este nome de usuário já está em uso."
        return jsonify({"errors": dup_errors}), 409

    new_user = User(
        username=username,
        email=email,
        password_hash=_hash_password(password),
    )
    db.session.add(new_user)
    try:
        db.session.flush()  # Ensure we have the user id before creating stats rows
    except IntegrityError:
        db.session.rollback()
        return jsonify({"errors": {"email": "Este e-mail ou nome de usuário já está em uso."}}), 409

    ensure_default_stats(new_user, commit=False)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Não foi possível concluir o cadastro. Tente novamente."}), 500

    session.clear()
    session.permanent = True
    session["user_id"] = new_user.id
    session["username"] = new_user.username
    return jsonify({"user": new_user.to_public_dict()}), 201


@auth_bp.post("/login")
def login():
    payload = _extract_payload()
    email = _normalize_email(payload.get("email", ""))
    password = payload.get("password", "")
    if not email or not password:
        return jsonify({"error": "Informe e-mail e senha."}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8")):
        return jsonify({"error": "Credenciais inválidas."}), 401

    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["username"] = user.username
    return jsonify({"user": user.to_public_dict()}), 200


@auth_bp.post("/logout")
def logout():
    session.pop("user_id", None)
    session.pop("username", None)
    session.permanent = False
    return jsonify({"success": True}), 200


@auth_bp.get("/api/me")
def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"user": None})
    user = User.query.get(user_id)
    if not user:
        session.pop("user_id", None)
        return jsonify({"user": None})
    return jsonify({"user": user.to_public_dict()})
