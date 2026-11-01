"""XIRR（不定期现金流内部收益率）。

牛顿法为主、二分法兜底。现金流约定：投入为负、回款/期末市值为正。
少于两笔非零现金流时返回 None（无法定义 IRR）。
"""
from __future__ import annotations

from datetime import date, datetime

DAYS_IN_YEAR = 365.25


def _to_date(d) -> date:
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    return datetime.strptime(str(d)[:10], "%Y-%m-%d").date()


def xirr(cashflows: list[tuple[object, float]], *, guess: float = 0.1) -> float | None:
    flows = [(_to_date(d), float(a)) for d, a in cashflows if abs(float(a)) > 1e-9]
    if len(flows) < 2:
        return None

    d0 = min(d for d, _ in flows)

    def npv(rate: float) -> float:
        total = 0.0
        for d, amt in flows:
            years = (d - d0).days / DAYS_IN_YEAR
            total += amt / ((1.0 + rate) ** years)
        return total

    def dnpv(rate: float) -> float:
        total = 0.0
        for d, amt in flows:
            years = (d - d0).days / DAYS_IN_YEAR
            denom = (1.0 + rate) ** years
            total += -years * amt / ((1.0 + rate) * denom)
        return total

    rate = guess
    for _ in range(60):
        f = npv(rate)
        df = dnpv(rate)
        if abs(df) < 1e-12:
            break
        new_rate = rate - f / df
        if abs(new_rate - rate) < 1e-9:
            return new_rate
        rate = new_rate
        if rate <= -0.9999:
            rate = -0.9999

    lo, hi = -0.9999, 10.0
    flo, fhi = npv(lo), npv(hi)
    if flo * fhi > 0:
        return rate if rate > -0.999 else None
    for _ in range(120):
        mid = (lo + hi) / 2.0
        fmid = npv(mid)
        if abs(fmid) < 1e-7:
            return mid
        if flo * fmid < 0:
            hi, fhi = mid, fmid
        else:
            lo, flo = mid, fmid
    return (lo + hi) / 2.0
