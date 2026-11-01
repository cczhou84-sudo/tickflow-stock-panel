"""腾讯实时行情刷新。

ETF:   secid 形如 sh510300 / sz159915，返回 v_sh510300="1~名称~代码~现价~..."
OTC:   secid 形如 jj110022，返回 v_jj110022="110022~名称~净值~日期~..."
统一 GBK 解码。
"""
from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

QUOTE_URL = "https://qt.gtimg.cn/q={secids}"
TIMEOUT = 15.0


def _parse_etf(payload: str) -> dict:
    parts = payload.split("~")
    return {
        "name": parts[1] if len(parts) > 1 else "",
        "nav": float(parts[3]) if len(parts) > 3 and parts[3] else None,
        "quoteDate": parts[30] if len(parts) > 30 else "",
        "chg": float(parts[32]) if len(parts) > 32 and parts[32] else None,
    }


def _parse_otc(payload: str) -> dict:
    parts = payload.split("~")
    nav = float(parts[2]) if len(parts) > 2 and parts[2] else None
    date = parts[3] if len(parts) > 3 else ""
    chg = float(parts[4]) if len(parts) > 4 and parts[4] else None
    return {
        "name": parts[1] if len(parts) > 1 else "",
        "nav": nav,
        "quoteDate": date,
        "chg": chg,
    }


async def fetch_quotes(funds: list[dict]) -> dict[str, dict]:
    secids = [f["secid"] for f in funds if f.get("secid")]
    if not secids:
        return {}

    url = QUOTE_URL.format(secids=",".join(secids))
    result: dict[str, dict] = {}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.encoding = "gbk"
            text = resp.text
    except Exception as exc:
        logger.warning("腾讯行情请求失败: %s", exc)
        return result

    for line in text.strip().splitlines():
        line = line.strip().rstrip(";")
        if "=" not in line:
            continue
        var, _, raw = line.partition("=")
        raw = raw.strip().strip('"')
        secid = var.replace("v_", "")
        ftype = "otc" if secid.startswith("jj") else "etf"
        parsed = _parse_otc(raw) if ftype == "otc" else _parse_etf(raw)
        for f in funds:
            if f.get("secid") == secid:
                result[f["code"]] = parsed
                break
    return result
