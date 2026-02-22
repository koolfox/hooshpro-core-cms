from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as OrmSession

from app.config import settings
from app.core.rate_limit import SlidingWindowRateLimiter
from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.flow import (
    FlowCreate,
    FlowListOut,
    FlowOut,
    FlowRunListOut,
    FlowTriggerIn,
    FlowTriggerOut,
    FlowUpdate,
)
from app.services import flows_service

router = APIRouter(tags=["flows"])

flow_trigger_limiter = SlidingWindowRateLimiter(
    limit=getattr(settings, "FLOW_TRIGGER_RATE_LIMIT_MAX_PER_IP", 120),
    window_seconds=getattr(settings, "FLOW_TRIGGER_RATE_LIMIT_WINDOW_SECONDS", 60),
)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        candidate = forwarded_for.split(",", maxsplit=1)[0].strip()
        if candidate:
            return candidate
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@router.get("/api/admin/flows", response_model=FlowListOut)
def admin_list_flows(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    status: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return flows_service.list_flows(db, limit, offset, q, status, sort, dir)


@router.post("/api/admin/flows", response_model=FlowOut)
def admin_create_flow(
    payload: FlowCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        payload.normalized()
        return flows_service.create_flow(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except flows_service.FlowConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/api/admin/flows/{flow_id}", response_model=FlowOut)
def admin_get_flow(
    flow_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = flows_service.get_flow(db, flow_id)
    if not row:
        raise HTTPException(status_code=404, detail="Flow not found")
    return row


@router.put("/api/admin/flows/{flow_id}", response_model=FlowOut)
def admin_update_flow(
    flow_id: int,
    payload: FlowUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        payload.normalized()
        return flows_service.update_flow(db, flow_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except flows_service.FlowNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/api/admin/flows/{flow_id}")
def admin_delete_flow(
    flow_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        flows_service.delete_flow(db, flow_id)
    except flows_service.FlowNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.get("/api/admin/flows/{flow_id}/runs", response_model=FlowRunListOut)
def admin_list_flow_runs(
    flow_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
):
    try:
        return flows_service.list_runs(db, flow_id, limit, offset)
    except flows_service.FlowNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/api/admin/flows/{flow_id}/run-test", response_model=FlowTriggerOut)
def admin_run_flow_test(
    flow_id: int,
    payload: FlowTriggerIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return flows_service.run_flow_test(db, flow_id, payload)
    except flows_service.FlowNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/api/public/flows/{slug}/trigger", response_model=FlowTriggerOut)
def public_trigger_flow(
    slug: str,
    payload: FlowTriggerIn,
    request: Request,
    db: OrmSession = Depends(get_db),
):
    ip_key = _client_ip(request)
    limited, retry_after = flow_trigger_limiter.is_limited(ip_key)
    if limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many flow trigger requests. Please retry later.",
            headers={"Retry-After": str(retry_after)},
        )

    flow_trigger_limiter.hit(ip_key)

    try:
        return flows_service.trigger_public_flow(db, slug, payload)
    except flows_service.FlowNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except flows_service.FlowBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))
