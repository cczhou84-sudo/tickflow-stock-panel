"""Tushare Pro HTTP 客户端。

接口文档: https://tushare.pro/document/1?doc_id=130
请求: POST https://api.tushare.pro
      body = {api_name, token, params, fields}
响应: {code:0 成功, msg, data:{fields:[...], items:[[...], ...]}}
"""
from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

API_URL = "https://api.tushare.pro"
TIMEOUT = 30.0


class TushareError(RuntimeError):
    """Tushare 业务/网络错误。"""


class TushareClient:
    def __init__(self, token: str, timeout: float = TIMEOUT) -> None:
        self._token = token
        self._timeout = timeout

    async def call(
        self,
        api_name: str,
        params: dict | None = None,
        fields: str = "",
    ) -> list[dict]:
        """调用接口，把 fields+items 转成 list[dict] 返回。"""
        body = {
            "api_name": api_name,
            "token": self._token,
            "params": params or {},
            "fields": fields,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(API_URL, json=body)
                payload = resp.json()
        except Exception as exc:  # noqa: BLE001
            raise TushareError(f"网络请求失败: {exc}") from exc

        code = payload.get("code")
        if code != 0:
            raise TushareError(payload.get("msg") or f"接口返回错误码 {code}")

        data = payload.get("data") or {}
        cols: list = data.get("fields") or []
        rows: list = data.get("items") or []
        return [dict(zip(cols, row)) for row in rows]
