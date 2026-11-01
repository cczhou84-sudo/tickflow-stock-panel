"""基金组合分析：单基金 XIRR 与组合汇总。"""
from __future__ import annotations

from .models import FundStateModel
from .xirr import xirr


def fund_xirr(transactions: list[dict], shares: float, nav: float | None) -> float | None:
    flows: list[tuple] = []
    for t in transactions:
        ttype = t.get("type", "buy")
        amount = float(t.get("amount", 0) or 0)
        fee = float(t.get("fee", 0) or 0)
        date = t.get("date")
        if not date:
            continue
        if ttype == "buy":
            flows.append((date, -(amount + fee)))
        elif ttype in ("sell", "div"):
            flows.append((date, amount))
    if nav and shares:
        flows.append(("2099-12-31", shares * nav))
    if len(flows) < 2:
        return None
    try:
        return xirr(flows)
    except Exception:
        return None


def build_overview(state: FundStateModel) -> dict:
    tx_by_fund: dict[str, list[dict]] = {}
    for t in state.transactions:
        tx_by_fund.setdefault(t.fundCode, []).append(t.model_dump())

    total_value = 0.0
    total_cost = 0.0
    for f in state.funds:
        nav = f.nav or 0
        if nav:
            total_value += f.shares * nav
        cost = 0.0
        for t in tx_by_fund.get(f.code, []):
            if t.get("type") == "buy":
                cost += float(t.get("amount", 0)) + float(t.get("fee", 0))
            elif t.get("type") == "sell":
                cost -= float(t.get("amount", 0))
        total_cost += cost
        f.xirrValue = fund_xirr(tx_by_fund.get(f.code, []), f.shares, f.nav)

    total_pnl = total_value - total_cost
    portfolio_xirr = None
    if state.transactions:
        flows = []
        for t in state.transactions:
            amount = float(t.amount)
            fee = float(t.fee or 0)
            if t.type == "buy":
                flows.append((t.date, -(amount + fee)))
            elif t.type in ("sell", "div"):
                flows.append((t.date, amount))
        if total_value:
            flows.append(("2099-12-31", total_value))
        portfolio_xirr = xirr(flows) if len(flows) >= 2 else None

    return {
        "totalValue": round(total_value, 2),
        "totalCost": round(total_cost, 2),
        "totalPnl": round(total_pnl, 2),
        "portfolioXirr": portfolio_xirr,
        "fundCount": len(state.funds),
    }
