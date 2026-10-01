"""Keo toan bo bang `events` tu Cloudflare D1 (qua REST) -> output/events.csv.

Chay tach biet voi Next.js app. Xem setup.md muc "Phan phan tich".

    cd analysis
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python fetch_events.py

KHONG CAN CAU HINH GI THEM neu .env.local da co ba bien CLOUDFLARE_* — xem load_config().
Khong can thu vien nao ngoai pandas: goi REST bang urllib cua thu vien chuan.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

OUTPUT_DIR = HERE / "output"
EVENTS_CSV = OUTPUT_DIR / "events.csv"

ANALYSIS_ENV = HERE / ".env"
API_ENV = ROOT / ".env.local"
WRANGLER = ROOT / "wrangler.jsonc"

PAGE_SIZE = 2000  # dong moi request REST (phan hoi D1 khong gioi han cung, nhung giu nho cho an toan)
RETRIES = 5

# Cac cot top-level cua bang `events` — xem db-design.md va docs/d1-schema-design.md.
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


def load_config() -> dict[str, str]:
    """Cau hinh Cloudflare D1 — doc theo thu tu: bien moi truong, analysis/.env, .env.local.

    Can: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (quyen D1 Read tro len) va
    CLOUDFLARE_D1_DATABASE_ID (mac dinh lay `database_id` trong wrangler.jsonc). Dung CHUNG
    file `.env.local` voi `npm run dev`, nen ai chay duoc app thi chay duoc luon script nay.
    """
    merged: dict[str, str] = {}
    for source in (read_env_file(API_ENV), read_env_file(ANALYSIS_ENV), dict(os.environ)):
        merged.update({k: v for k, v in source.items() if v})

    account = merged.get("CLOUDFLARE_ACCOUNT_ID")
    token = merged.get("CLOUDFLARE_API_TOKEN")
    database = merged.get("CLOUDFLARE_D1_DATABASE_ID")
    if not database and WRANGLER.exists():
        match = re.search(r'"database_id"\s*:\s*"([0-9a-f-]{36})"', WRANGLER.read_text(encoding="utf-8"))
        database = match.group(1) if match else None

    missing = [
        name
        for name, value in (
            ("CLOUDFLARE_ACCOUNT_ID", account),
            ("CLOUDFLARE_API_TOKEN", token),
            ("CLOUDFLARE_D1_DATABASE_ID (hoac wrangler.jsonc)", database),
        )
        if not value
    ]
    if missing:
        raise SystemExit(
            "Thieu cau hinh Cloudflare D1: " + ", ".join(missing) + "\n"
            f"Dien vao {API_ENV} (xem .env.example) — cung file ma `npm run dev` dang dung."
        )

    return {
        "url": f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query",
        "token": token,  # type: ignore[dict-item]
    }


def d1_query(config: dict[str, str], sql: str, params: list) -> list[dict]:
    """Chay MOT cau lenh SELECT tham so hoa; retry co backoff cho loi tam thoi (429/5xx/mang)."""
    request = urllib.request.Request(
        config["url"],
        data=json.dumps({"sql": sql, "params": params}).encode("utf-8"),
        headers={"Authorization": f"Bearer {config['token']}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(1, RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = json.load(response)
            if not body.get("success"):
                raise SystemExit(f"D1 tu choi cau lenh: {body.get('errors')}")
            return body["result"][0]["results"]
        except urllib.error.HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt < RETRIES:
                time.sleep(2**attempt)
                continue
            # KHONG in header (chua token): chi ma trang thai + than loi.
            raise SystemExit(f"D1 tra HTTP {error.code}: {error.read().decode('utf-8', 'replace')[:300]}") from None
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt >= RETRIES:
                raise SystemExit(f"Khong goi duoc D1: {error}") from None
            time.sleep(2**attempt)
    return []


def fetch_events() -> pd.DataFrame:
    """Doc TOAN BO `events` theo keyset (created_at, id) — moi trang chi doc dung so dong cua no."""
    config = load_config()
    rows: list[dict] = []
    cursor: tuple[str, str] | None = None

    while True:
        if cursor is None:
            page = d1_query(config, "SELECT * FROM events ORDER BY created_at, id LIMIT ?", [PAGE_SIZE])
        else:
            page = d1_query(
                config,
                "SELECT * FROM events WHERE (created_at, id) > (?, ?) ORDER BY created_at, id LIMIT ?",
                [cursor[0], cursor[1], PAGE_SIZE],
            )
        for data in page:
            row = {"event_id": data["id"]}
            row.update({field: data.get(field) for field in TOP_LEVEL_FIELDS})

            # `properties` la JSON long nhau — trai phang thanh cot `prop_<ten>`
            # de pandas loc duoc truc tiep. Event cu thieu khoa moi se thanh NaN,
            # xu ly bang .fillna() (db-design.md).
            try:
                properties = json.loads(data.get("properties") or "{}")
            except json.JSONDecodeError:
                properties = {}
            for key, value in properties.items():
                row[f"prop_{key}"] = value

            rows.append(row)
        print(f"\r  da doc {len(rows)} event…", end="", flush=True)
        if len(page) < PAGE_SIZE:
            break
        last = page[-1]
        cursor = (last["created_at"], last["id"])
    print()

    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.sort_values(["session_id", "created_at"]).reset_index(drop=True)
    return df


def main() -> None:
    df = fetch_events()
    OUTPUT_DIR.mkdir(exist_ok=True)
    # utf-8-sig: co BOM thi Excel tren Windows moi doc dung tieng Viet.
    # pandas.read_csv tu bo BOM nen metrics.py khong bi anh huong.
    df.to_csv(EVENTS_CSV, index=False, encoding="utf-8-sig")
    print(f"Da ghi {len(df)} event vao {EVENTS_CSV}")
    if not df.empty:
        print(f"  {df['session_id'].nunique()} session, {df['user_id'].nunique()} user")


if __name__ == "__main__":
    main()
