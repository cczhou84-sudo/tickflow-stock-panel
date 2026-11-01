"""基金状态 JSON 持久化。

文件位置: settings.data_dir / "fund-state.json"
写入策略: 先写 .tmp 再 os.replace。
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from app.config import settings

from .models import FundStateModel

logger = logging.getLogger(__name__)

STATE_FILE = "fund-state.json"

SEED_GROUPS = [
    {"id": "core", "name": "核心宽基", "order": 1},
    {"id": "industry", "name": "行业主题", "order": 2},
    {"id": "overseas", "name": "海外/QDII", "order": 3},
    {"id": "bond", "name": "固收类", "order": 4},
    {"id": "money", "name": "货币/现金", "order": 5},
    {"id": "default", "name": "未分组", "order": 99},
]

SEED_FUNDS = [
    {"code": "510300", "name": "沪深300ETF", "type": "etf", "secid": "sh510300", "shares": 12000, "groupId": "core"},
    {"code": "510500", "name": "中证500ETF", "type": "etf", "secid": "sh510500", "shares": 8000, "groupId": "core"},
    {"code": "159915", "name": "创业板ETF", "type": "etf", "secid": "sz159915", "shares": 5000, "groupId": "core"},
    {"code": "512100", "name": "中证1000ETF", "type": "etf", "secid": "sh512100", "shares": 6000, "groupId": "core"},
    {"code": "588000", "name": "科创50ETF", "type": "etf", "secid": "sh588000", "shares": 3000, "groupId": "industry"},
    {"code": "110022", "name": "易方达消费行业", "type": "otc", "secid": "jj110022", "shares": 12000, "groupId": "industry"},
    {"code": "005827", "name": "易方达蓝筹精选", "type": "otc", "secid": "jj005827", "shares": 18000, "groupId": "industry"},
    {"code": "260108", "name": "景顺长城新兴成长", "type": "otc", "secid": "jj260108", "shares": 9000, "groupId": "industry"},
    {"code": "001938", "name": "中欧时代先锋", "type": "otc", "secid": "jj001938", "shares": 7000, "groupId": "industry"},
    {"code": "519674", "name": "银河创新成长", "type": "otc", "secid": "jj519674", "shares": 5000, "groupId": "industry"},
    {"code": "000961", "name": "天弘沪深300联接A", "type": "otc", "secid": "jj000961", "shares": 20000, "groupId": "core"},
    {"code": "001594", "name": "富国天惠成长A", "type": "otc", "secid": "jj001594", "shares": 6000, "groupId": "core"},
]


def _state_path() -> Path:
    return Path(settings.data_dir) / STATE_FILE


def seed_state() -> FundStateModel:
    return FundStateModel.model_validate(
        {"groups": SEED_GROUPS, "funds": SEED_FUNDS, "transactions": []}
    )


def load_state() -> FundStateModel:
    path = _state_path()
    if not path.exists():
        state = seed_state()
        save_state(state)
        return state
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return FundStateModel.model_validate(data)
    except Exception as exc:
        logger.warning("fund-state.json 损坏(%s)，回退种子数据", exc)
        state = seed_state()
        save_state(state)
        return state


def save_state(state: FundStateModel) -> None:
    path = _state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(state.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(tmp, path)
