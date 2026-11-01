"""基金管理扩展入口。

被 backend/app/extensions/loader.py 自动发现（非下划线模块）。
"""
from __future__ import annotations

from app.extensions import BACKEND_EXTENSION_API_VERSION

from .router import router

EXTENSION_ID = "fund.panel"
EXTENSION_API_VERSION = BACKEND_EXTENSION_API_VERSION


def setup(registrar) -> None:
    registrar.include_router(router)
