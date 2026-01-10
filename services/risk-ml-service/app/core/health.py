"""Health check module for risk-ml-service."""
from typing import Any, Callable, Optional
import asyncio
from enum import Enum
from dataclasses import dataclass, field

from fastapi import FastAPI, Response
from pydantic import BaseModel


class HealthStatus(str, Enum):
    UP = "up"
    DOWN = "down"


class CheckResult(BaseModel):
    name: str
    status: HealthStatus
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: HealthStatus
    checks: dict[str, CheckResult] = {}
    details: dict[str, Any] = {}


@dataclass
class HealthCheck:
    name: str
    check: Callable[[], Any]
    timeout: float = 5.0


@dataclass
class HealthChecker:
    checks: list[HealthCheck] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)
    _ready: bool = False

    def add_check(
        self, name: str, check: Callable[[], Any], timeout: float = 5.0
    ) -> None:
        self.checks.append(HealthCheck(name=name, check=check, timeout=timeout))

    def set_detail(self, key: str, value: Any) -> None:
        self.details[key] = value

    def set_ready(self, ready: bool) -> None:
        self._ready = ready

    def is_ready(self) -> bool:
        return self._ready

    async def _run_check(self, check: HealthCheck) -> CheckResult:
        try:
            result = check.check()
            if asyncio.iscoroutine(result):
                await asyncio.wait_for(result, timeout=check.timeout)
            return CheckResult(name=check.name, status=HealthStatus.UP)
        except asyncio.TimeoutError:
            return CheckResult(
                name=check.name,
                status=HealthStatus.DOWN,
                error=f"Timeout after {check.timeout}s",
            )
        except Exception as e:
            return CheckResult(
                name=check.name, status=HealthStatus.DOWN, error=str(e)
            )

    async def run_checks(self) -> HealthResponse:
        results = await asyncio.gather(
            *[self._run_check(check) for check in self.checks]
        )

        checks_dict = {r.name: r for r in results}
        overall_status = HealthStatus.UP

        for result in results:
            if result.status == HealthStatus.DOWN:
                overall_status = HealthStatus.DOWN
                break

        return HealthResponse(
            status=overall_status, checks=checks_dict, details=self.details
        )


def register_health_routes(app: FastAPI, checker: HealthChecker) -> None:
    @app.get("/health")
    async def health():
        response = await checker.run_checks()
        status_code = 200 if response.status == HealthStatus.UP else 503
        return Response(
            content=response.model_dump_json(),
            status_code=status_code,
            media_type="application/json",
        )

    @app.get("/health/live")
    async def liveness():
        return {"status": "alive"}

    @app.get("/health/ready")
    async def readiness():
        if not checker.is_ready():
            return Response(
                content='{"status": "not_ready"}',
                status_code=503,
                media_type="application/json",
            )

        response = await checker.run_checks()
        status_code = 200 if response.status == HealthStatus.UP else 503
        return Response(
            content=response.model_dump_json(),
            status_code=status_code,
            media_type="application/json",
        )
