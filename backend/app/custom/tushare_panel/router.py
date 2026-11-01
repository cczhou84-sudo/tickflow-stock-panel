"""Tushare 分析模块 API 端点。

所有 /api/tushare/* 由 main.py 认证中间件统一保护。
token 存 data/user_data/secrets.json（secrets_store，权限 0600），不进代码/前端/日志。
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import secrets_store

from .client import TushareClient, TushareError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tushare", tags=["tushare"])

TOKEN_KEY = "tushare_token"


class TokenBody(BaseModel):
    token: str


def _client() -> TushareClient:
    token = secrets_store.load().get(TOKEN_KEY, "")
    if not token:
        raise HTTPException(status_code=400, detail="未配置 Tushare token，请先在面板填写")
    return TushareClient(token)


# ============ Token 管理 ============

@router.get("/status")
def status() -> dict:
    token = secrets_store.load().get(TOKEN_KEY, "")
    return {
        "configured": bool(token),
        "tokenMask": secrets_store.mask(token) if token else "",
    }


@router.post("/token")
def save_token(body: TokenBody) -> dict:
    token = body.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="token 不能为空")
    secrets_store.save({TOKEN_KEY: token})
    return {"ok": True, "tokenMask": secrets_store.mask(token)}


@router.delete("/token")
def clear_token() -> dict:
    secrets_store.clear(TOKEN_KEY)
    return {"ok": True}


# ============ 财务深度 ============

# 核心指标单接口 fina_indicator 覆盖，避免分别调三张表
FINANCIAL_FIELDS = [
    "end_date", "eps", "bps", "roe", "roe_dt", "roa",
    "grossprofit_margin", "netprofit_margin", "debt_to_assets",
    "current_ratio", "assets_turn", "ocfps",
    "netprofit_yoy", "tr_yoy", "update_flag",
]


@router.get("/financial")
async def financial(ts_code: str, limit: int = 8) -> dict:
    ts_code = ts_code.strip()
    if not ts_code:
        raise HTTPException(status_code=400, detail="ts_code 不能为空")
    try:
        rows = await _client().call(
            "fina_indicator",
            {"ts_code": ts_code},
            ",".join(FINANCIAL_FIELDS),
        )
    except TushareError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    # 同一报告期可能多条（更新），按 end_date 去重保留最新
    latest: dict[str, dict] = {}
    for r in rows:
        if r.get("end_date"):
            latest[r["end_date"]] = r
    periods = sorted(latest.values(), key=lambda x: x["end_date"], reverse=True)[:limit]
    for p in periods:
        p.pop("update_flag", None)
    return {"ts_code": ts_code, "periods": periods}


# ============ 资金流 ============

MONEYFLOW_FIELDS = [
    "trade_date",
    "buy_sm_amount", "sell_sm_amount",
    "buy_md_amount", "sell_md_amount",
    "buy_lg_amount", "sell_lg_amount",
    "buy_elg_amount", "sell_elg_amount",
    "net_mf_amount",
]


def _net(buy, sell) -> float | None:
    if buy is None or sell is None:
        return None
    return round(buy - sell, 2)


@router.get("/moneyflow")
async def moneyflow(ts_code: str, limit: int = 20) -> dict:
    ts_code = ts_code.strip()
    if not ts_code:
        raise HTTPException(status_code=400, detail="ts_code 不能为空")
    try:
        rows = await _client().call(
            "moneyflow",
            {"ts_code": ts_code},
            ",".join(MONEYFLOW_FIELDS),
        )
    except TushareError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    rows = sorted(rows, key=lambda x: x.get("trade_date") or "")
    daily = []
    for r in rows[-limit:]:
        daily.append({
            "trade_date": r.get("trade_date"),
            "net_mf": r.get("net_mf_amount"),
            "sm_net": _net(r.get("buy_sm_amount"), r.get("sell_sm_amount")),
            "md_net": _net(r.get("buy_md_amount"), r.get("sell_md_amount")),
            "lg_net": _net(r.get("buy_lg_amount"), r.get("sell_lg_amount")),
            "elg_net": _net(r.get("buy_elg_amount"), r.get("sell_elg_amount")),
        })
    total_net = round(sum(d["net_mf"] for d in daily if d["net_mf"] is not None), 2)
    return {"ts_code": ts_code, "unit": "万元", "total_net": total_net, "daily": daily}


@router.get("/north")
async def north(limit: int = 30) -> dict:
    """北向/南向资金（接口单位百万元，转亿元）。"""
    try:
        rows = await _client().call(
            "moneyflow_hsgt",
            {},
            "trade_date,hgt,sgt,north_money,south_money",
        )
    except TushareError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    rows = sorted(rows, key=lambda x: x.get("trade_date") or "")

    def _yi(v):
        return round(v / 100, 2) if v is not None else None

    daily = [
        {
            "trade_date": r.get("trade_date"),
            "hgt": _yi(r.get("hgt")),
            "sgt": _yi(r.get("sgt")),
            "north": _yi(r.get("north_money")),
            "south": _yi(r.get("south_money")),
        }
        for r in rows[-limit:]
    ]
    return {"unit": "亿元", "daily": daily}


# ============ 龙虎榜 ============

DRAGON_FIELDS = [
    "ts_code", "name", "close", "pct_change", "turnover_rate",
    "l_buy", "l_sell", "net_amount", "net_rate", "amount_rate", "reason",
]


@router.get("/dragon")
async def dragon(trade_date: str) -> dict:
    trade_date = trade_date.strip()
    if not trade_date:
        raise HTTPException(status_code=400, detail="trade_date 不能为空")
    try:
        rows = await _client().call(
            "top_list",
            {"trade_date": trade_date},
            ",".join(DRAGON_FIELDS),
        )
    except TushareError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    def _yi(v):
        return round(v / 1e8, 2) if v is not None else None

    items = [
        {
            "ts_code": r.get("ts_code"),
            "name": r.get("name"),
            "close": r.get("close"),
            "pct_change": r.get("pct_change"),
            "turnover_rate": r.get("turnover_rate"),
            "l_buy": _yi(r.get("l_buy")),
            "l_sell": _yi(r.get("l_sell")),
            "net_amount": _yi(r.get("net_amount")),
            "net_rate": r.get("net_rate"),
            "amount_rate": r.get("amount_rate"),
            "reason": r.get("reason"),
        }
        for r in rows
    ]
    return {"trade_date": trade_date, "unit": "亿元", "items": items}


# ============ 股东筹码 ============

@router.get("/holders")
async def holders(ts_code: str, limit: int = 12) -> dict:
    """股东户数变化（户数下降=筹码集中）。"""
    ts_code = ts_code.strip()
    if not ts_code:
        raise HTTPException(status_code=400, detail="ts_code 不能为空")
    try:
        rows = await _client().call(
            "stk_holdernumber",
            {"ts_code": ts_code},
            "ann_date,end_date,holder_num",
        )
    except TushareError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    rows = sorted(rows, key=lambda x: x.get("end_date") or "", reverse=True)[:limit]
    # 计算环比变化
    items = []
    for i, r in enumerate(rows):
        prev = rows[i + 1].get("holder_num") if i + 1 < len(rows) else None
        num = r.get("holder_num")
        change = round(num - prev) if (num is not None and prev is not None) else None
        items.append({
            "end_date": r.get("end_date"),
            "ann_date": r.get("ann_date"),
            "holder_num": num,
            "change": change,
        })
    return {"ts_code": ts_code, "items": items}


@router.get("/holdertrade")
async def holdertrade(ts_code: str, limit: int = 20) -> dict:
    """重要股东增减持。"""
    ts_code = ts_code.strip()
    if not ts_code:
        raise HTTPException(status_code=400, detail="ts_code 不能为空")
    try:
        rows = await _client().call(
            "stk_holdertrade",
            {"ts_code": ts_code},
            "ann_date,holder_name,holder_type,in_de,change_vol,change_ratio,avg_price",
        )
    except TushareError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    rows = sorted(rows, key=lambda x: x.get("ann_date") or "", reverse=True)[:limit]
    type_label = {"G": "高管", "P": "个人", "C": "公司"}
    items = [
        {
            "ann_date": r.get("ann_date"),
            "holder_name": r.get("holder_name"),
            "holder_type": type_label.get(r.get("holder_type"), r.get("holder_type")),
            "in_de": r.get("in_de"),
            "change_vol": round(r["change_vol"] / 10000, 2) if r.get("change_vol") is not None else None,
            "change_ratio": r.get("change_ratio"),
            "avg_price": r.get("avg_price"),
        }
        for r in rows
    ]
    return {"ts_code": ts_code, "vol_unit": "万股", "items": items}
