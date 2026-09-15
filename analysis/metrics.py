"""Tinh chi so funnel tu output/events.csv.

KHUNG — noi dung that lam o Tuan 5 (roadmap.md).
Danh sach 6 nhom chi so can tinh: analysis-spec.md.

    python fetch_events.py && python metrics.py
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

OUTPUT_DIR = Path(__file__).parent / "output"
EVENTS_CSV = OUTPUT_DIR / "events.csv"

# Event ket thuc funnel cua tung luong — event-taxonomy.md muc 1.
COMPLETION_EVENT = {"ride": "confirm_ride", "food": "place_order"}


def load_events() -> pd.DataFrame:
    if not EVENTS_CSV.exists():
        raise SystemExit(f"Chua co {EVENTS_CSV}. Chay `python fetch_events.py` truoc.")
    return pd.read_csv(EVENTS_CSV)


def funnel(df: pd.DataFrame, flow: str) -> pd.DataFrame:
    """So session duy nhat cham toi tung buoc.

    Nho thiet ke `step_index` la SO CO DINH gan cho tung man (khong phai bo dem),
    ca funnel chi la mot phep groupby — xem event-taxonomy.md muc 1.
    """
    return (
        df[df["flow"] == flow]
        .groupby("step_index")["session_id"]
        .nunique()
        .rename("sessions")
        .reset_index()
    )


def abandon_points(df: pd.DataFrame, flow: str) -> pd.Series:
    """Diem bo do = max(step_index) cua cac session KHONG co event ket thuc.

    Khong co event `abandon` rieng — mot session bo do duoc suy ra bang cach
    thieu `confirm_ride` / `place_order` (event-taxonomy.md muc 1).
    """
    flow_df = df[df["flow"] == flow]
    completed = set(flow_df.loc[flow_df["event_name"] == COMPLETION_EVENT[flow], "session_id"])
    dropped = flow_df[~flow_df["session_id"].isin(completed)]
    return dropped.groupby("session_id")["step_index"].max().value_counts().sort_index()


def main() -> None:
    df = load_events()
    OUTPUT_DIR.mkdir(exist_ok=True)

    for flow in ("ride", "food"):
        print(f"\n── Funnel {flow} ──")
        print(funnel(df, flow).to_string(index=False))
        print(f"\n── Diem bo do {flow} ──")
        print(abandon_points(df, flow).to_string())

    # TODO(Tuan 5): 6 nhom chi so day du theo analysis-spec.md
    #   - ti le chuyen doi tung buoc
    #   - thoi gian dung o moi man
    #   - ti le chon promo/offer
    #   - hanh vi quay lai sua lua chon (event `back`, `change_address`)
    #   - phan bo gia tri don hang
    #   - cong cu replay mot phien
    # TODO(Tuan 5): bieu do funnel + phan bo diem bo do -> output/*.png (matplotlib)


if __name__ == "__main__":
    main()
