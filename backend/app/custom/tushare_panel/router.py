"""Tushare 分析模块 API 端点。

所有 /api/tushare/* 由 main.py 认证中间件统一保护。
token 存 data/user_data/secrets.json（secrets_store，权限 0600），不进代码/前端/日志。
"""
from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import secrets_store
from app.config import settings

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


# ============ 代码归一化（自动补交易所后缀） ============

_SH_PREFIX = ("600", "601", "603", "605", "688", "689", "900")
_SZ_PREFIX = ("000", "001", "002", "003", "300", "301", "200")
_BJ_PREFIX = ("4", "8", "920")


def normalize_ts_code(raw: str) -> str:
    """把用户输入归一为 Tushare 标准 ts_code（代码.后缀）。

    - 已带合法后缀：原样返回并校验。
    - 裸 6 位数字：按代码段自动补 .SH/.SZ/.BJ。
    - 无法识别抛 400。
    """
    code = (raw or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="股票代码不能为空")
    if "." in code:
        symbol, _, exchange = code.partition(".")
        if exchange not in ("SH", "SZ", "BJ") or not symbol.isdigit():
            raise HTTPException(status_code=400, detail=f"代码格式无法识别：{raw}（应为 000001.SZ 形式）")
        return code
    if code.isdigit():
        if len(code) == 6:
            if code.startswith(_SH_PREFIX):
                return code + ".SH"
            if code.startswith(_SZ_PREFIX):
                return code + ".SZ"
            if code.startswith(_BJ_PREFIX):
                return code + ".BJ"
            raise HTTPException(status_code=400, detail=f"无法判断 {code} 所属交易所，请带后缀（.SH/.SZ/.BJ）")
        if code.startswith(_BJ_PREFIX):
            return code + ".BJ"
    raise HTTPException(status_code=400, detail="代码格式无法识别：请输入代码、中文名或拼音")


# ============ 全 A 名单缓存（中文名 / 拼音搜索） ============

_BASIC_CACHE: list[dict] | None = None
_BASIC_LOCK = threading.RLock()
_BASIC_LOADED_AT = 0.0
_BASIC_TTL = 12 * 3600


def _basic_path() -> Path:
    p = settings.data_dir / "user_data" / "tushare_stock_basic.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _read_basic_disk() -> list[dict]:
    p = _basic_path()
    if not p.exists():
        return []
    try:
        rows = json.loads(p.read_text(encoding="utf-8"))
        return rows if isinstance(rows, list) else []
    except Exception as exc:  # noqa: BLE001
        logger.warning("stock_basic 本地缓存读取失败: %s", exc)
        return []


async def _ensure_stock_basic(force: bool = False) -> list[dict]:
    """加载全 A 名单：内存 → 本地 json → Tushare stock_basic；拉取失败时降级用本地旧缓存。"""
    global _BASIC_CACHE, _BASIC_LOADED_AT

    with _BASIC_LOCK:
        if not force and _BASIC_CACHE is not None and time.time() - _BASIC_LOADED_AT < _BASIC_TTL:
            return _BASIC_CACHE
        if not force:
            disk = _read_basic_disk()
            if disk:
                _BASIC_CACHE, _BASIC_LOADED_AT = disk, time.time()
                return disk

    try:
        rows = await _client().call(
            "stock_basic",
            {"list_status": "L"},
            "ts_code,symbol,name,cnspell,industry,market,exchange,area,list_date",
        )
    except TushareError:
        disk = _read_basic_disk()
        if disk:
            with _BASIC_LOCK:
                _BASIC_CACHE, _BASIC_LOADED_AT = disk, time.time()
            return disk
        raise

    rows = [r for r in rows if r.get("ts_code")]
    with _BASIC_LOCK:
        _BASIC_CACHE, _BASIC_LOADED_AT = rows, time.time()
    try:
        _basic_path().write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        logger.warning("stock_basic 落盘失败: %s", exc)
    return rows


@router.get("/search")
async def search(q: str = "", limit: int = 20) -> dict:
    """代码 / 中文名 / 拼音缩写分层模糊搜索全 A 名单。"""
    q = q.strip()
    if not q:
        return {"results": []}
    try:
        stocks = await _ensure_stock_basic()
    except TushareError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    kw = q.upper()
    is_alpha = kw.isascii() and kw.isalpha()
    prefix: list[dict] = []
    pinyin: list[dict] = []
    contains: list[dict] = []
    for s in stocks:
        symbol = (s.get("symbol") or "").upper()
        ts_code = (s.get("ts_code") or "").upper()
        name = s.get("name") or ""
        spell = (s.get("cnspell") or "").upper()
        if symbol.startswith(kw) or ts_code.startswith(kw):
            prefix.append(s)
        elif is_alpha and spell.startswith(kw):
            pinyin.append(s)
        elif kw in name.upper() or kw in ts_code:
            contains.append(s)

    results: list[dict] = []
    seen: set[str] = set()
    for s in prefix + pinyin + contains:
        code = s.get("ts_code")
        if code in seen:
            continue
        seen.add(code)
        results.append({
            "ts_code": code,
            "symbol": s.get("symbol"),
            "name": s.get("name"),
            "industry": s.get("industry"),
            "market": s.get("market"),
        })
        if len(results) >= limit:
            break
    return {"results": results}


@router.get("/resolve")
async def resolve(code: str) -> dict:
    """归一化用户输入为标准 ts_code，并尽量从名单带出中文名/行业。"""
    ts_code = normalize_ts_code(code)
    name = None
    industry = None
    try:
        stocks = await _ensure_stock_basic()
        hit = next((s for s in stocks if s.get("ts_code") == ts_code), None)
        if hit:
            name = hit.get("name")
            industry = hit.get("industry")
    except TushareError:
        # 名单不可用不阻塞代码归一
        pass
    return {"ts_code": ts_code, "name": name, "industry": industry}


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
    ts_code = normalize_ts_code(ts_code)
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
    return {"ts_code": ts_code, "empty": not periods, "periods": periods}


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
    ts_code = normalize_ts_code(ts_code)
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
    return {"ts_code": ts_code, "unit": "万元", "empty": not daily, "total_net": total_net, "daily": daily}


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
    return {"unit": "亿元", "empty": not daily, "daily": daily}


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
    return {"trade_date": trade_date, "unit": "亿元", "empty": not items, "items": items}


# ============ 股东筹码 ============

@router.get("/holders")
async def holders(ts_code: str, limit: int = 12) -> dict:
    """股东户数变化（户数下降=筹码集中）。"""
    ts_code = normalize_ts_code(ts_code)
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
    return {"ts_code": ts_code, "empty": not items, "items": items}


@router.get("/holdertrade")
async def holdertrade(ts_code: str, limit: int = 20) -> dict:
    """重要股东增减持。"""
    ts_code = normalize_ts_code(ts_code)
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
    return {"ts_code": ts_code, "empty": not items, "vol_unit": "万股", "items": items}
