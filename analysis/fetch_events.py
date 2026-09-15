"""Keo toan bo collection `events` tu Firestore -> output/events.csv.

Chay tach biet voi Next.js app. Xem setup.md muc "Phan phan tich".

    cd analysis
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python fetch_events.py
"""

from __future__ import annotations

import os
from pathlib import Path

import firebase_admin
import pandas as pd
from firebase_admin import credentials, firestore

OUTPUT_DIR = Path(__file__).parent / "output"
EVENTS_CSV = OUTPUT_DIR / "events.csv"

# 9 field top-level cua document — xem db-design.md.
TOP_LEVEL_FIELDS = [
    "session_id",
    "user_id",
    "flow",
    "event_name",
    "screen_name",
    "previous_screen",
    "step_index",
    "platform",
    "created_at",
]


def get_client() -> firestore.Client:
    """Dung service account JSON truc tiep qua GOOGLE_APPLICATION_CREDENTIALS."""
    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if not cred_path:
            raise SystemExit(
                "Thieu GOOGLE_APPLICATION_CREDENTIALS. "
                "Copy analysis/.env.example thanh analysis/.env va tro toi file "
                "service account JSON (setup.md Phase 1)."
            )
        firebase_admin.initialize_app(credentials.Certificate(cred_path))
    return firestore.client()


def fetch_events() -> pd.DataFrame:
    docs = get_client().collection("events").stream()

    rows: list[dict] = []
    for doc in docs:
        data = doc.to_dict() or {}
        row = {"event_id": doc.id}
        row.update({field: data.get(field) for field in TOP_LEVEL_FIELDS})

        # `properties` la map long nhau — trai phang thanh cot `prop_<ten>`
        # de pandas loc duoc truc tiep. Document cu thieu field moi se thanh NaN,
        # xu ly bang .fillna() — Firestore khong can migrate (db-design.md).
        for key, value in (data.get("properties") or {}).items():
            row[f"prop_{key}"] = value

        rows.append(row)

    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.sort_values(["session_id", "created_at"]).reset_index(drop=True)
    return df


def main() -> None:
    df = fetch_events()
    OUTPUT_DIR.mkdir(exist_ok=True)
    df.to_csv(EVENTS_CSV, index=False)
    print(f"Da ghi {len(df)} event vao {EVENTS_CSV}")
    if not df.empty:
        print(f"  {df['session_id'].nunique()} session, {df['user_id'].nunique()} user")


if __name__ == "__main__":
    main()
