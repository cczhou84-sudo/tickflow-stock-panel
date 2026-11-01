"""基金管理 API 端点。

所有 /api/fund/* 由 main.py 的认证中间件统一保护。
"""
from __future__ import annotations

import logging

from fastapi import APIRouter

from . import store as store_mod
from .analytics import build_overview
from .models import FundStateModel
from .quotes import fetch_quotes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fund", tags=["fund"])


@router.get("/state")
def get_state() -> dict:
    state = store_mod.load_state()
    overview = build_overview(state)
    return {"state": state.model_dump(), "overview": overview}


@router.put("/state")
def put_state(payload: FundStateModel) -> dict:
    store_mod.save_state(payload)
    return {"ok": True, "overview": build_overview(payload)}


@router.post("/refresh")
async def refresh() -> dict:
    state = store_mod.load_state()
    funds = [{"code": f.code, "type": f.type, "secid": f.secid} for f in state.funds]
    quotes = await fetch_quotes(funds)
    for f in state.funds:
        q = quotes.get(f.code)
        if not q:
            continue
        if q.get("nav") is not None:
            f.nav = q["nav"]
        if q.get("chg") is not None:
            f.chg = q["chg"]
        if q.get("quoteDate"):
            f.navDate = q["quoteDate"]
        if q.get("name") and not f.name:
            f.name = q["name"]
    store_mod.save_state(state)
    return {"state": state.model_dump(), "overview": build_overview(state)}


@router.get("/overview")
def overview() -> dict:
    state = store_mod.load_state()
    return build_overview(state)
