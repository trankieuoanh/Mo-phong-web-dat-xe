"""Keo toan bo collection `events` tu Firestore -> output/events.csv.

Chay tach biet voi Next.js app. Xem setup.md muc "Phan phan tich".

    cd analysis
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python fetch_events.py

KHONG CAN CAU HINH GI THEM neu .env.local da co credential: xem load_credential().
"""

from __future__ import annotations

import os
from pathlib import Path

import firebase_admin
import pandas as pd
from firebase_admin import credentials, firestore

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

OUTPUT_DIR = HERE / "output"
EVENTS_CSV = OUTPUT_DIR / "events.csv"

ANALYSIS_ENV = HERE / ".env"
API_ENV = ROOT / ".env.local"

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
    # Field thu 10, CHI co o document do scripts/seed-events.js sinh ra.
    # Event do nguoi that click khong co no, nen cot nay rong (NaN) chinh la
    # cach tach du lieu that khoi du lieu gia lap. Xem db-design.md.
    "seed_batch",
]


def read_env_file(path: Path) -> dict[str, str]:
    """Parser .env TOI THIEU — du cho dinh dang ma du an nay dung, khong hon.

    Bo dong trong va dong `#`, tach o dau `=`, boc ngoac kep/don neu co.

    GIOI HAN CO Y: khong xu ly gia tri trai nhieu DONG VAT LY. Da kiem tra
    .env.local: dong FIREBASE_PRIVATE_KEY nam tron mot dong (1755 ky tu), boc
    ngoac kep, xuong dong o dang literal `\\n` — dung dinh dang ma ham nay doc
    duoc. Ai doi cach luu key sang dang nhieu dong that thi phai sua ham nay,
    hoac them python-dotenv vao requirements.txt.
    """
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value

    return values


def load_credential() -> credentials.Base:
    """Credential Firestore — thu BA duong, theo thu tu.

    1. GOOGLE_APPLICATION_CREDENTIALS co san trong moi truong.
    2. analysis/.env -> GOOGLE_APPLICATION_CREDENTIALS.
    3. .env.local -> ba bien FIREBASE_*, tuc DUNG NGUON MA app DANG DUNG.

    Duong 2 truoc day duoc TAI LIEU HUA nhung khong ton tai trong code: ham nay
    doc thang os.environ, ma khong cho nao nap analysis/.env ca. Lam dung y
    huong dan van hong.

    Duong 3 de ai chay duoc `npm run dev` thi chay duoc luon script nay — bat ho
    tai them mot service account key nua la tao ra file bi mat thu hai phai quan
    ly, cho cung mot quyen truy cap.
    """
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    if not cred_path:
        cred_path = read_env_file(ANALYSIS_ENV).get("GOOGLE_APPLICATION_CREDENTIALS")

    if cred_path:
        if not Path(cred_path).exists():
            raise SystemExit(f"GOOGLE_APPLICATION_CREDENTIALS tro toi file khong ton tai: {cred_path}")
        return credentials.Certificate(cred_path)

    env = read_env_file(API_ENV)
    needed = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]
    missing = [key for key in needed if not env.get(key)]

    if missing:
        raise SystemExit(
            "Khong tim thay credential Firebase o cả ba nơi:\n"
            "  1. bien moi truong GOOGLE_APPLICATION_CREDENTIALS\n"
            f"  2. {ANALYSIS_ENV}  (GOOGLE_APPLICATION_CREDENTIALS=...)\n"
            f"  3. {API_ENV}  (thieu: {', '.join(missing) or 'ca 3 bien'})\n\n"
            "Cach nhanh nhat: chep .env.example thanh .env.local roi dien\n"
            "gia tri (setup.md Phase 1) — cung file ma `npm run dev` dang dung."
        )

    # Bo khoa toi thieu, doc tu source cua firebase_admin + google-auth:
    # Certificate() kiem `type`, from_service_account_info() doi `client_email` +
    # `token_uri`, signer doi `private_key`, con `project_id` de Firestore biet
    # noi can ket noi.
    return credentials.Certificate(
        {
            "type": "service_account",
            "project_id": env["FIREBASE_PROJECT_ID"],
            "client_email": env["FIREBASE_CLIENT_EMAIL"],
            # Cung dong replace voi lib/server/db/firebase-admin.ts va
            # scripts/seed-events.js: file .env luu xuong dong o dang literal `\n`.
            # Thieu no se loi: error:1E08010C:DECODER routines::unsupported
            "private_key": env["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    )


def get_client() -> firestore.Client:
    if not firebase_admin._apps:
        firebase_admin.initialize_app(load_credential())
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
