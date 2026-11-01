"""基金模块数据模型。

字段命名与前端 JSON 保持一致。extra="allow" 容忍前端多出的展示字段。
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class FundModel(BaseModel):
    code: str
    name: str
    type: str = "otc"  # otc | etf
    secid: str = ""
    shares: float = 0.0
    dayInvest: float = 0.0
    mtype: str = "otc"
    groupId: str = "default"
    nav: float | None = None
    navDate: str | None = None
    chg: float | None = None
    xirrValue: float | None = None
    r3: float | None = None
    r5: float | None = None
    r10: float | None = None
    note: str = ""

    model_config = {"extra": "allow"}


class GroupModel(BaseModel):
    id: str
    name: str
    order: int = 0

    model_config = {"extra": "allow"}


class TransactionModel(BaseModel):
    fundCode: str
    date: str
    type: str = "buy"
    amount: float = 0.0
    shares: float = 0.0
    fee: float = 0.0

    model_config = {"extra": "allow"}


class FundStateModel(BaseModel):
    funds: list[FundModel] = Field(default_factory=list)
    groups: list[GroupModel] = Field(default_factory=list)
    transactions: list[TransactionModel] = Field(default_factory=list)

    model_config = {"extra": "allow"}
