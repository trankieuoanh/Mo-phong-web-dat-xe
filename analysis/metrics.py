"""Tinh 6 nhom chi so tu output/events.csv — dinh nghia o analysis-spec.md.

Doc CSV, KHONG cham mang: sua cong thuc khong phai goi lai Firestore.

    python fetch_events.py && python metrics.py
    python metrics.py --replay <session_id>    # Nhom 6, in dong thoi gian 1 phien
    python metrics.py --replay last            # phien moi nhat

Dau ra trong output/: funnel_ride.csv, funnel_food.csv, summary.csv va 4 file .png.
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

# Bat buoc dat TRUOC khi import pyplot: script chay trong terminal, khong co GUI.
matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

OUTPUT_DIR = Path(__file__).parent / "output"
EVENTS_CSV = OUTPUT_DIR / "events.csv"

# Mau primary-dark cua app — analysis-spec.md muc "Dau ra".
# Dung MOT mau cho toan bo cot, khong dung bang mau mac dinh cua matplotlib.
PRIMARY_DARK = "#048589"

# Event ket thuc funnel cua tung luong — event-taxonomy.md muc 1.
COMPLETION_EVENT = {"ride": "confirm_ride", "food": "place_order"}

# Nhan cho tung step_index. Doi chieu bang o event-taxonomy.md muc 2
# (ban goc la SCREENS trong lib/shared/screens.ts).
#
# THEM MOT MAN THI PHAI SUA HAI BAN SAO NGOAI TYPESCRIPT: bang duoi day, va bang
# SCREENS chep trong scripts/seed-events.js. Quen mot trong hai khong lam gi do
# vo — man `finding_driver` da tung bi quen o day, va hau qua chi la funnel in
# sai TEN hai buoc cuoi, khong co dong bao loi nao.
STEP_LABELS: dict[str, dict[int, str]] = {
    "ride": {
        # Buoc 0 la EVENT `select_flow`, khong phai mot man hinh: no ban o
        # `home`, `address_selection` hay `food_menu` deu mang step 0.
        0: "select_flow",
        1: "address_selection",
        2: "pickup_confirm",
        3: "vehicle_selection",
        4: "promo_selection",
        5: "ride_confirm",
        6: "finding_driver",
        7: "ride_success",
    },
    "food": {
        0: "select_flow",
        1: "food_menu",
        2: "food_item_detail",
        3: "add_to_cart",  # hanh dong, khong phai man hinh
        4: "food_cart",
        5: "food_offer_selection",
        6: "food_confirm",
        7: "food_success",
    },
}

# Ngoai nguong nay coi la tab bo quen, khong phai thoi gian can nhac that.
DWELL_CAP_SEC = 300


# ─────────────────────────────────────────────────────────────
# Nap va lam sach
# ─────────────────────────────────────────────────────────────


def load_events() -> pd.DataFrame:
    if not EVENTS_CSV.exists():
        raise SystemExit(f"Chua co {EVENTS_CSV}. Chay `python fetch_events.py` truoc.")

    df = pd.read_csv(EVENTS_CSV)
    if df.empty:
        raise SystemExit(f"{EVENTS_CSV} rong — chua co event nao.")

    df["created_at"] = pd.to_datetime(df["created_at"], utc=True, format="mixed").dt.tz_convert(
        "Asia/Ho_Chi_Minh"
    )
    return df.sort_values(["session_id", "created_at"]).reset_index(drop=True)


def drop_junk_sessions(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Bo session rac TRUOC khi tinh — analysis-spec.md muc "Nap du lieu".

    Hai loai: chi co dung 1 event (mo trang roi dong ngay), va khong co event
    nao voi step_index >= 1 (vao Home roi thoat, chua chon luong nao).
    """
    before = df["session_id"].nunique()

    size = df.groupby("session_id").size()
    single = set(size[size <= 1].index)

    deepest = df.groupby("session_id")["step_index"].max()
    shallow = set(deepest[deepest < 1].index)

    junk = single | shallow
    cleaned = df[~df["session_id"].isin(junk)].reset_index(drop=True)

    return cleaned, {
        "session_truoc_loc": before,
        "session_chi_1_event": len(single),
        "session_khong_vao_luong": len(shallow - single),
        "session_con_lai": cleaned["session_id"].nunique(),
    }


def has_events(df: pd.DataFrame, flow: str) -> bool:
    return not df[df["flow"] == flow].empty


def column(df: pd.DataFrame, name: str) -> pd.Series:
    """Cot prop_* co the CHUA ton tai (chua ai bat event do lan nao).

    Firestore khong can migrate — document cu thieu field moi la chuyen binh thuong
    (db-design.md). Tra ve Series rong thay vi nem KeyError.
    """
    if name not in df.columns:
        return pd.Series(dtype="object")
    return df[name].dropna()


# ─────────────────────────────────────────────────────────────
# Nhom 1 — Funnel
# ─────────────────────────────────────────────────────────────


def funnel(df: pd.DataFrame, flow: str) -> pd.DataFrame:
    """So session duy nhat cham toi tung buoc, kem 3 ti le dan xuat.

    Nho thiet ke `step_index` la SO CO DINH gan cho tung man (khong phai bo dem),
    ca funnel chi la mot phep groupby — xem event-taxonomy.md muc 1.

    Luu y ve buoc 0: man `home` mang flow 'none', nen o day buoc 0 chinh la
    event `select_flow` — tuc "so nguoi CHON luong nay", dung lam mau so.
    `select_flow` luon mang step 0 du ban o man nao (event-taxonomy.md muc 1),
    ke ca khi nguoi dung nhay luong bang tab o sidebar giua chung.

    `base` lay iloc[0] — HANG DAU TIEN TON TAI, khong phai step 0. Neu mot ngay
    nao do `select_flow` khong con mang step 0 nua thi funnel se lang le lay
    buoc 1 lam mau so va moi ti le deu sai ma khong bao loi.
    """
    reach = (
        df[df["flow"] == flow]
        .groupby("step_index")["session_id"]
        .nunique()
        .sort_index()
        .rename("reach")
    )
    if reach.empty:
        return pd.DataFrame(columns=["step_index", "screen", "reach"])

    out = reach.reset_index()
    out["screen"] = out["step_index"].map(STEP_LABELS[flow]).fillna("?")

    base = out["reach"].iloc[0]
    out["step_conversion"] = (out["reach"] / out["reach"].shift(1)).round(4)
    out["overall_conversion"] = (out["reach"] / base).round(4)
    out["drop_off"] = (1 - out["step_conversion"]).round(4)

    return out[
        ["step_index", "screen", "reach", "step_conversion", "overall_conversion", "drop_off"]
    ]


def worst_step(funnel_df: pd.DataFrame) -> tuple[str, float] | None:
    """Buoc tut manh nhat — cau tra loi UX dang gia nhat cua ca bang."""
    candidates = funnel_df.dropna(subset=["step_conversion"])
    if candidates.empty:
        return None
    row = candidates.loc[candidates["step_conversion"].idxmin()]
    return str(row["screen"]), float(row["step_conversion"])


# ─────────────────────────────────────────────────────────────
# Nhom 2 — Hoan thanh & bo do
# ─────────────────────────────────────────────────────────────


def completed_sessions(df: pd.DataFrame, flow: str) -> set[str]:
    flow_df = df[df["flow"] == flow]
    return set(flow_df.loc[flow_df["event_name"] == COMPLETION_EVENT[flow], "session_id"])


def is_flow_switch(row: pd.Series) -> bool:
    if row["event_name"] != "select_flow" or row["screen_name"] == "home":
        return False
    entry_source = row.get("prop_entry_source")
    if pd.isna(entry_source) and isinstance(row.get("properties"), dict):
        entry_source = row["properties"].get("entry_source")
    return pd.isna(entry_source) or entry_source != "direct_url"


def flow_switch_sessions(df: pd.DataFrame, flow: str) -> set[str]:
    rows = df[(df["flow"] == flow) & (df["event_name"] == "select_flow")]
    if rows.empty:
        return set()
    return set(rows.loc[rows.apply(is_flow_switch, axis=1), "session_id"])


def completion_rate(df: pd.DataFrame, flow: str) -> tuple[int, int, float]:
    """Mau so = moi session CO CHAM toi luong nay, ke ca cham mot cai roi ra.

    Session co `select_flow` o man khac `home` la flow switch cu, tru truong hop
    `prop_entry_source == 'direct_url'`. Event cu khong co property nay dung
    quy tac man hinh cu; entry truc tiep van la step 0 hop le.
    """
    flow_df = df[df["flow"] == flow]
    switch_sessions = flow_switch_sessions(df, flow)
    flow_df = flow_df[~flow_df["session_id"].isin(switch_sessions)]
    total = flow_df["session_id"].nunique()
    done = len(completed_sessions(flow_df, flow))
    return done, total, (done / total if total else 0.0)


def abandon_points(df: pd.DataFrame, flow: str) -> pd.Series:
    """Diem bo do = max(step_index) cua cac session KHONG co event ket thuc.

    Khong co event `abandon` rieng — mot session bo do duoc suy ra bang cach
    thieu `confirm_ride` / `place_order` (event-taxonomy.md muc 1).
    """
    flow_df = df[df["flow"] == flow]
    done = completed_sessions(df, flow)
    dropped = flow_df[~flow_df["session_id"].isin(done)]
    if dropped.empty:
        return pd.Series(dtype="int64")
    return dropped.groupby("session_id")["step_index"].max().value_counts().sort_index()


# ─────────────────────────────────────────────────────────────
# Nhom 3 — Thoi gian
# ─────────────────────────────────────────────────────────────


def dwell_per_screen(df: pd.DataFrame) -> pd.DataFrame:
    """Thoi gian dung o moi man = khoang cach toi `screen_view` KE TIEP.

    Dung MEDIAN chu khong phai mean: vai phien bo mo tab se keo mean lech han
    (analysis-spec.md Nhom 3). Man cuoi moi phien khong co man ke tiep -> NaN.
    """
    sv = df[df["event_name"] == "screen_view"].sort_values(["session_id", "created_at"]).copy()
    if sv.empty:
        return pd.DataFrame(columns=["screen_name", "median_dwell_sec", "n"])

    sv["dwell_sec"] = (
        sv.groupby("session_id")["created_at"].diff().shift(-1).dt.total_seconds()
    )
    # Dong cuoi cua moi session lay nham hieu cua session KE TIEP -> bo di.
    sv.loc[sv["session_id"] != sv["session_id"].shift(-1), "dwell_sec"] = pd.NA
    sv["dwell_sec"] = pd.to_numeric(sv["dwell_sec"], errors="coerce")

    usable = sv[sv["dwell_sec"].notna() & (sv["dwell_sec"] <= DWELL_CAP_SEC)]
    if usable.empty:
        return pd.DataFrame(columns=["screen_name", "median_dwell_sec", "n"])

    return (
        usable.groupby("screen_name")["dwell_sec"]
        .agg(median_dwell_sec="median", n="size")
        .round(1)
        .reset_index()
        .sort_values("median_dwell_sec", ascending=False)
    )


def flow_duration(df: pd.DataFrame, flow: str) -> float | None:
    """Tong thoi gian cua cac session HOAN THANH (median, giay)."""
    done = completed_sessions(df, flow)
    if not done:
        return None
    span = df[df["session_id"].isin(done)].groupby("session_id")["created_at"]
    seconds = (span.max() - span.min()).dt.total_seconds()
    return round(float(seconds.median()), 1)


# ─────────────────────────────────────────────────────────────
# Nhom 4 — Quay lai & sua doi
# ─────────────────────────────────────────────────────────────


def back_rate_per_screen(df: pd.DataFrame) -> pd.DataFrame:
    """So event `back` tren moi man / so `screen_view` cua chinh man do.

    `back` mang `screen_name` cua man DANG DUNG khi bam (event-taxonomy.md muc 1),
    nen hai ve cua phep chia cung noi ve mot man.
    """
    views = df[df["event_name"] == "screen_view"].groupby("screen_name").size()
    backs = df[df["event_name"] == "back"].groupby("screen_name").size()
    if views.empty:
        return pd.DataFrame(columns=["screen_name", "back", "screen_view", "back_rate"])

    out = pd.DataFrame({"screen_view": views, "back": backs}).fillna(0)
    out["back_rate"] = (out["back"] / out["screen_view"]).round(4)
    return out.reset_index().sort_values("back_rate", ascending=False)


def revisit_count(df: pd.DataFrame) -> pd.DataFrame:
    """So lan mot man duoc xem LAI trong cung mot phien — dau hieu do du.

    Quay lai man cu bang Back se ban `screen_view` moi (day la mot luot xem moi),
    nen dem >1 screen_view cua cung (session, man) la dem duoc so lan quay lai.
    """
    sv = df[df["event_name"] == "screen_view"]
    if sv.empty:
        return pd.DataFrame(columns=["screen_name", "so_phien_xem_lai"])

    per = sv.groupby(["session_id", "screen_name"]).size().rename("lan_xem").reset_index()
    revisited = per[per["lan_xem"] > 1]
    if revisited.empty:
        return pd.DataFrame(columns=["screen_name", "so_phien_xem_lai"])

    return (
        revisited.groupby("screen_name")
        .size()
        .rename("so_phien_xem_lai")
        .reset_index()
        .sort_values("so_phien_xem_lai", ascending=False)
    )


def edit_rates(df: pd.DataFrame) -> dict[str, float]:
    """change_address_rate (ride) va cart_edit_rate (food)."""
    out: dict[str, float] = {}

    pickup_views = len(df[(df["event_name"] == "screen_view") & (df["screen_name"] == "pickup_confirm")])
    if pickup_views:
        changes = len(df[df["event_name"] == "change_address"])
        out["change_address_rate"] = round(changes / pickup_views, 4)

    cart_sessions = df[df["screen_name"] == "food_cart"]["session_id"].nunique()
    if cart_sessions:
        edits = len(
            df[
                (df["screen_name"] == "food_cart")
                & (df["event_name"].isin(["remove_from_cart", "change_quantity"]))
            ]
        )
        out["cart_edit_rate"] = round(edits / cart_sessions, 4)

    return out


# ─────────────────────────────────────────────────────────────
# Nhom 5 — Lua chon noi dung
# ─────────────────────────────────────────────────────────────


def last_choice_per_session(df: pd.DataFrame, event_name: str, prop: str) -> pd.Series:
    """Lay lua chon CUOI CUNG cua moi phien.

    Man chon xe cho phep bam nhieu lan roi moi bam "Tiep tuc", nen mot phien
    co the co nhieu `select_vehicle` — do la du lieu tot (do duoc su phan van),
    nhung khi dem "da chon gi" thi phai lay cai cuoi (analysis-spec.md Nhom 5).
    """
    rows = df[df["event_name"] == event_name]
    if rows.empty or prop not in rows.columns:
        return pd.Series(dtype="object")
    return rows.sort_values("created_at").groupby("session_id")[prop].last().dropna()


def content_choices(df: pd.DataFrame) -> dict[str, pd.Series | float | int]:
    out: dict[str, pd.Series | float | int] = {}

    # Gom theo vehicle_type (2 nhom) chu khong theo vehicle_id (6 hang xe):
    # vai chuc session ma chia 6 thi moi nhom khong con noi duoc gi.
    vehicles = last_choice_per_session(df, "select_vehicle", "prop_vehicle_type")
    if not vehicles.empty:
        out["vehicle_split"] = vehicles.value_counts()

    vehicle_ids = last_choice_per_session(df, "select_vehicle", "prop_vehicle_id")
    if not vehicle_ids.empty:
        out["vehicle_id_split"] = vehicle_ids.value_counts()

    # `address_id` o day la DIEM DEN — diem don la hang so, khong ghi event.
    addresses = last_choice_per_session(df, "select_address", "prop_address_id")
    if not addresses.empty:
        out["address_popularity"] = addresses.value_counts()

    for chosen, skipped, label in (
        ("select_promo", "skip_promo", "promo"),
        ("select_offer", "skip_offer", "offer"),
    ):
        picked = df[df["event_name"] == chosen]["session_id"].nunique()
        passed = df[df["event_name"] == skipped]["session_id"].nunique()
        if picked or passed:
            out[f"{label}_usage"] = picked
            out[f"{label}_skip"] = passed
            out[f"{label}_usage_rate"] = round(picked / (picked + passed), 4)

    adds = df[df["event_name"] == "add_to_cart"]
    if not adds.empty and {"prop_item_id", "prop_quantity"} <= set(adds.columns):
        out["top_items"] = (
            adds.groupby("prop_item_id")["prop_quantity"].sum().sort_values(ascending=False)
        )

    for prop, key in (("prop_cart_size", "avg_cart_size"), ("prop_cart_total", "avg_cart_total")):
        values = column(df[df["event_name"] == "proceed_to_offer"], prop)
        if not values.empty:
            out[key] = round(float(pd.to_numeric(values).mean()), 1)

    # Chi tinh tren don DA HOAN THANH — don bo do khong phai mot giao dich.
    done = df[df["event_name"].isin(COMPLETION_EVENT.values())]
    discounts = column(done, "prop_discount_amount")
    if not discounts.empty:
        out["avg_discount"] = round(float(pd.to_numeric(discounts).mean()), 1)

    for flow, prop in (("ride", "prop_final_price"), ("food", "prop_final_total")):
        values = column(done[done["flow"] == flow], prop)
        if not values.empty:
            out[f"avg_final_{flow}"] = round(float(pd.to_numeric(values).mean()), 1)

    return out


# ─────────────────────────────────────────────────────────────
# Nhom 6 — Replay mot phien
# ─────────────────────────────────────────────────────────────


def replay(df: pd.DataFrame, session_id: str) -> None:
    """In dong thoi gian day du cua mot phien.

    Vua la cong cu trinh bay cho mentor, vua la cach KIEM CHUNG taxonomy:
    neu dong thoi gian doc khong khop voi thao tac vua lam, tracking dang sai.
    """
    if session_id == "last":
        session_id = str(df.sort_values("created_at")["session_id"].iloc[-1])

    rows = df[df["session_id"] == session_id].sort_values("created_at")
    if rows.empty:
        raise SystemExit(f"Khong tim thay session_id: {session_id}")

    start = rows["created_at"].iloc[0]
    prop_cols = [c for c in rows.columns if c.startswith("prop_")]

    print(f"\n── Replay phien {session_id} ──")
    print(f"   {len(rows)} event · bat dau {start:%Y-%m-%d %H:%M:%S}\n")

    def show(value: object) -> str:
        # pandas doc cot co NaN thanh float, nen tien nguyen ra "145000.0".
        # Tien LUON la so nguyen VND (mock-data.md) — hien dung nhu the.
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)

    for _, row in rows.iterrows():
        offset = (row["created_at"] - start).total_seconds()
        props = {
            c[5:]: row[c] for c in prop_cols if pd.notna(row[c]) and str(row[c]).strip() != ""
        }
        props_text = (
            "{" + ", ".join(f"{k}: {show(v)}" for k, v in props.items()) + "}" if props else ""
        )
        print(
            f"{offset:6.1f}s  step {int(row['step_index'])}  "
            f"{str(row['screen_name']):<22}{str(row['event_name']):<18}{props_text}"
        )


# ─────────────────────────────────────────────────────────────
# Bieu do
# ─────────────────────────────────────────────────────────────


def _save(fig: plt.Figure, name: str) -> None:
    path = OUTPUT_DIR / name
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  -> {path.name}")


def chart_funnel(funnel_df: pd.DataFrame, flow: str) -> None:
    if funnel_df.empty:
        return
    fig, ax = plt.subplots(figsize=(8, 0.6 * len(funnel_df) + 1.5))

    labels = [f"{r.step_index}. {r.screen}" for r in funnel_df.itertuples()]
    # Dao nguoc de buoc 0 nam tren cung — funnel doc tu tren xuong.
    ax.barh(labels[::-1], funnel_df["reach"][::-1], color=PRIMARY_DARK)

    for i, (value, pct) in enumerate(
        zip(funnel_df["reach"][::-1], funnel_df["overall_conversion"][::-1])
    ):
        ax.text(value, i, f"  {int(value)}  ({pct:.0%})", va="center", fontsize=9)

    ax.set_title(f"Funnel luong {flow} — so session cham toi tung buoc")
    ax.set_xlabel("so session")
    ax.set_xlim(0, funnel_df["reach"].max() * 1.25)
    ax.spines[["top", "right"]].set_visible(False)
    _save(fig, f"funnel_{flow}.png")


def chart_abandon(series_by_flow: dict[str, pd.Series]) -> None:
    usable = {f: s for f, s in series_by_flow.items() if not s.empty}
    if not usable:
        return

    fig, ax = plt.subplots(figsize=(8, 4))
    frame = pd.DataFrame(usable).fillna(0).sort_index()
    labels = [str(i) for i in frame.index]

    if len(frame.columns) == 1:
        flow = frame.columns[0]
        ax.bar(labels, frame[flow], color=PRIMARY_DARK)
    else:
        width = 0.38
        positions = range(len(frame))
        for offset, (flow, values) in zip((-width / 2, width / 2), frame.items()):
            ax.bar(
                [p + offset for p in positions],
                values,
                width=width,
                label=flow,
                color=PRIMARY_DARK,
                alpha=1.0 if offset < 0 else 0.55,
            )
        ax.set_xticks(list(positions), labels)
        ax.legend(frameon=False)

    ax.set_title("Phan bo diem bo do — step_index cuoi cung cham toi")
    ax.set_xlabel("step_index")
    ax.set_ylabel("so session bo do")
    ax.spines[["top", "right"]].set_visible(False)
    _save(fig, "abandon_distribution.png")


def chart_dwell(dwell_df: pd.DataFrame) -> None:
    if dwell_df.empty:
        return
    fig, ax = plt.subplots(figsize=(8, 0.5 * len(dwell_df) + 1.5))
    ax.barh(dwell_df["screen_name"][::-1], dwell_df["median_dwell_sec"][::-1], color=PRIMARY_DARK)
    for i, value in enumerate(dwell_df["median_dwell_sec"][::-1]):
        ax.text(value, i, f"  {value:.1f}s", va="center", fontsize=9)
    ax.set_title(f"Thoi gian dung moi man (median, bo cac lan > {DWELL_CAP_SEC}s)")
    ax.set_xlabel("giay")
    ax.set_xlim(0, dwell_df["median_dwell_sec"].max() * 1.25)
    ax.spines[["top", "right"]].set_visible(False)
    _save(fig, "dwell_per_screen.png")


# ─────────────────────────────────────────────────────────────
# Bao cao
# ─────────────────────────────────────────────────────────────


def build_summary(df: pd.DataFrame, stats: dict[str, int]) -> pd.DataFrame:
    """summary.csv — moi dong mot chi so, de dan thang vao bao cao."""
    rows: list[dict] = [
        {"nhom": "0-du lieu", "chi_so": k, "flow": "", "gia_tri": v} for k, v in stats.items()
    ]
    rows.append(
        {"nhom": "0-du lieu", "chi_so": "tong_event", "flow": "", "gia_tri": len(df)}
    )

    for flow in ("ride", "food"):
        if not has_events(df, flow):
            continue

        done, total, rate = completion_rate(df, flow)
        rows += [
            {"nhom": "2-hoan thanh", "chi_so": "session_vao_luong", "flow": flow, "gia_tri": total},
            {"nhom": "2-hoan thanh", "chi_so": "session_hoan_thanh", "flow": flow, "gia_tri": done},
            {"nhom": "2-hoan thanh", "chi_so": "completion_rate", "flow": flow, "gia_tri": round(rate, 4)},
        ]

        worst = worst_step(funnel(df, flow))
        if worst:
            rows += [
                {"nhom": "1-funnel", "chi_so": "buoc_tut_manh_nhat", "flow": flow, "gia_tri": worst[0]},
                {"nhom": "1-funnel", "chi_so": "ti_le_di_tiep_thap_nhat", "flow": flow, "gia_tri": round(worst[1], 4)},
            ]

        duration = flow_duration(df, flow)
        if duration is not None:
            rows.append(
                {"nhom": "3-thoi gian", "chi_so": "median_thoi_gian_hoan_thanh_sec", "flow": flow, "gia_tri": duration}
            )

    for key, value in edit_rates(df).items():
        rows.append({"nhom": "4-quay lai", "chi_so": key, "flow": "", "gia_tri": value})

    for key, value in content_choices(df).items():
        if isinstance(value, pd.Series):
            for idx, count in value.items():
                rows.append({"nhom": "5-lua chon", "chi_so": f"{key}.{idx}", "flow": "", "gia_tri": int(count)})
        else:
            rows.append({"nhom": "5-lua chon", "chi_so": key, "flow": "", "gia_tri": value})

    return pd.DataFrame(rows)


def print_report(df: pd.DataFrame, stats: dict[str, int]) -> None:
    print("── Du lieu ──")
    for key, value in stats.items():
        print(f"  {key:<26} {value}")
    print(f"  {'tong_event':<26} {len(df)}")

    for flow in ("ride", "food"):
        if not has_events(df, flow):
            print(f"\n── Luong {flow}: chua co du lieu ──")
            continue

        f = funnel(df, flow)
        print(f"\n── Nhom 1 · Funnel {flow} ──")
        print(f.to_string(index=False, na_rep="—"))

        worst = worst_step(f)
        if worst:
            print(f"  Tut manh nhat o `{worst[0]}`: chi {worst[1]:.0%} di tiep.")

        done, total, rate = completion_rate(df, flow)
        print(f"\n── Nhom 2 · Hoan thanh {flow} ──")
        print(f"  completion_rate: {done}/{total} = {rate:.0%}")
        abandon = abandon_points(df, flow)
        if abandon.empty:
            print("  Khong co session bo do.")
        else:
            print("  Diem bo do (step_index -> so session):")
            for step, count in abandon.items():
                label = STEP_LABELS[flow].get(int(step), "?")
                print(f"    step {step} ({label}): {count}")

        duration = flow_duration(df, flow)
        if duration is not None:
            print(f"  Thoi gian hoan thanh (median): {duration}s")

    dwell = dwell_per_screen(df)
    print("\n── Nhom 3 · Thoi gian dung moi man (median) ──")
    print(dwell.to_string(index=False) if not dwell.empty else "  (chua du du lieu)")

    print("\n── Nhom 4 · Quay lai & sua doi ──")
    backs = back_rate_per_screen(df)
    non_zero = backs[backs["back"] > 0] if not backs.empty else backs
    print(non_zero.to_string(index=False) if not non_zero.empty else "  Khong co event `back`.")
    for key, value in edit_rates(df).items():
        print(f"  {key}: {value:.0%}")
    revisits = revisit_count(df)
    if not revisits.empty:
        print("  Man bi xem lai trong cung phien:")
        print(revisits.to_string(index=False))

    print("\n── Nhom 5 · Lua chon noi dung ──")
    choices = content_choices(df)
    if not choices:
        print("  (chua du du lieu)")
    for key, value in choices.items():
        if isinstance(value, pd.Series):
            print(f"  {key}:")
            for idx, count in value.items():
                print(f"    {idx}: {count}")
        else:
            print(f"  {key}: {value}")


def main() -> None:
    args = sys.argv[1:]
    raw = load_events()
    df, stats = drop_junk_sessions(raw)

    if df.empty:
        raise SystemExit(
            "Sau khi loc session rac khong con du lieu nao. "
            "Can it nhat mot phien di vao luong (step_index >= 1)."
        )

    if "--replay" in args:
        index = args.index("--replay")
        if index + 1 >= len(args):
            raise SystemExit("Thieu session_id. Vi du: python metrics.py --replay last")
        # Replay doc du lieu THO: session bi loc van can xem lai duoc.
        replay(raw, args[index + 1])
        return

    OUTPUT_DIR.mkdir(exist_ok=True)
    print_report(df, stats)

    print("\n── Ghi file ──")
    abandon_by_flow: dict[str, pd.Series] = {}
    for flow in ("ride", "food"):
        if not has_events(df, flow):
            continue
        f = funnel(df, flow)
        f.to_csv(OUTPUT_DIR / f"funnel_{flow}.csv", index=False)
        print(f"  -> funnel_{flow}.csv")
        chart_funnel(f, flow)
        abandon_by_flow[flow] = abandon_points(df, flow)

    build_summary(df, stats).to_csv(OUTPUT_DIR / "summary.csv", index=False)
    print("  -> summary.csv")

    chart_abandon(abandon_by_flow)
    chart_dwell(dwell_per_screen(df))

    print(f"\nXong. Xem {OUTPUT_DIR}")
    print("Replay mot phien: python metrics.py --replay last")


if __name__ == "__main__":
    main()
