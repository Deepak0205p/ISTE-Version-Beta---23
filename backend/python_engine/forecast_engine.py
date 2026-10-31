# Adapted from https://github.com/nixtla/statsforecast python/statsforecast/core.py (Apache-2.0)
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Dict, List
import numpy as np
import pandas as pd
from statsforecast import StatsForecast
from statsforecast.models import AutoETS


@dataclass
class WeeklyForecastPoint:
    week_start: str
    point_paise: int
    lo80_paise: int
    hi80_paise: int

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


def forecast_weekly_balance(
    transactions: List[Dict[str, object]],
    closing_balance_paise: int,
    horizon_weeks: int = 4,
) -> List[WeeklyForecastPoint]:
    """
    Projects weekly net cashflow and cumulative balance over the next `horizon_weeks`
    with 80% prediction intervals using Nixtla's StatsForecast (AutoETS).
    """
    valid_txs = [tx for tx in transactions if not tx.get("is_duplicate", False)]
    if not valid_txs:
        return []

    rows = []
    for tx in valid_txs:
        d_str = str(tx["date"])[:10]
        amt = int(tx["amount_paise"]) / 100.0
        signed = amt if str(tx.get("direction", "")).lower() == "credit" else -amt
        rows.append({"ds": pd.to_datetime(d_str), "y": signed})

    df = pd.DataFrame(rows)
    weekly = (
        df.set_index("ds")
        .resample("W-MON")["y"]
        .sum()
        .reset_index()
        .sort_values("ds")
    )
    weekly["unique_id"] = "balance_flow"

    last_date = weekly["ds"].max()
    points: List[WeeklyForecastPoint] = []

    if len(weekly) >= 6:
        try:
            sf = StatsForecast(models=[AutoETS(season_length=1)], freq="W-MON", n_jobs=1)
            fcst = sf.forecast(df=weekly[["unique_id", "ds", "y"]], h=horizon_weeks, level=[80])
            running_balance = closing_balance_paise / 100.0
            for idx, row in fcst.iterrows():
                ds_str = pd.to_datetime(row["ds"]).strftime("%Y-%m-%d")
                mean_delta = float(row["AutoETS"])
                lo_delta = float(row["AutoETS-lo-80"])
                hi_delta = float(row["AutoETS-hi-80"])
                running_balance += mean_delta
                half_width = max(abs(hi_delta - lo_delta) / 2.0, abs(mean_delta) * 0.15 + 1500.0)
                points.append(
                    WeeklyForecastPoint(
                        week_start=ds_str,
                        point_paise=int(round(running_balance * 100)),
                        lo80_paise=int(round((running_balance - half_width) * 100)),
                        hi80_paise=int(round((running_balance + half_width) * 100)),
                    )
                )
            return points
        except Exception:
            pass

    # Fallback deterministic weekly projection with 80% normal Z=1.2816 interval
    deltas = weekly["y"].to_numpy(dtype=float)
    mean_w = float(np.mean(deltas)) if len(deltas) > 0 else 0.0
    std_w = float(np.std(deltas)) if len(deltas) > 1 else 2500.0
    running_balance = closing_balance_paise / 100.0

    for step in range(1, horizon_weeks + 1):
        wk_date = (last_date + timedelta(days=7 * step)).strftime("%Y-%m-%d")
        running_balance += mean_w
        band = 1.2816 * std_w * np.sqrt(step)
        points.append(
            WeeklyForecastPoint(
                week_start=wk_date,
                point_paise=int(round(running_balance * 100)),
                lo80_paise=int(round((running_balance - band) * 100)),
                hi80_paise=int(round((running_balance + band) * 100)),
            )
        )

    return points
