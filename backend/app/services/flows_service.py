from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.models import ContentEntry, ContentType, Option, Workflow, WorkflowRun
from app.schemas.flow import (
    FlowCreate,
    FlowDefinition,
    FlowListOut,
    FlowOut,
    FlowRunListOut,
    FlowRunOut,
    FlowTriggerIn,
    FlowTriggerOut,
    FlowUpdate,
    dump_flow_definition,
    dump_run_json,
    load_flow_definition,
    load_run_json,
)


class FlowNotFound(Exception):
    pass


class FlowConflict(Exception):
    pass


class FlowBadRequest(Exception):
    pass


_TEMPLATE_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")


def _to_out(row: Workflow) -> FlowOut:
    return FlowOut(
        id=row.id,
        slug=row.slug,
        title=row.title,
        description=row.description,
        status=row.status,
        trigger_event=row.trigger_event,
        definition=load_flow_definition(row.definition_json),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_run_out(row: WorkflowRun) -> FlowRunOut:
    return FlowRunOut(
        id=row.id,
        flow_id=row.workflow_id,
        status=row.status,
        input=load_run_json(row.input_json),
        output=load_run_json(row.output_json),
        error=row.error_text,
        created_at=row.created_at,
    )


def list_flows(
    db: OrmSession,
    limit: int,
    offset: int,
    q: str | None,
    status: str | None,
    sort: str | None,
    direction: str | None,
) -> FlowListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(Workflow)
    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(
            func.lower(Workflow.slug).like(qq)
            | func.lower(Workflow.title).like(qq)
            | func.lower(Workflow.description).like(qq)
        )

    if status:
        st = status.strip().lower()
        if st in {"draft", "active", "disabled"}:
            base = base.filter(Workflow.status == st)

    total = base.with_entities(func.count(Workflow.id)).scalar() or 0

    allowed = {
        "updated_at": Workflow.updated_at,
        "created_at": Workflow.created_at,
        "title": func.lower(Workflow.title),
        "slug": func.lower(Workflow.slug),
        "status": func.lower(Workflow.status),
        "trigger_event": func.lower(Workflow.trigger_event),
        "id": Workflow.id,
    }

    sort_key = (sort or "updated_at").strip().lower()
    dir_key = (direction or "desc").strip().lower()
    sort_col = allowed.get(sort_key) or allowed["updated_at"]
    asc = dir_key == "asc"

    order = sort_col.asc() if asc else sort_col.desc()
    tie = Workflow.id.asc() if asc else Workflow.id.desc()

    rows = base.order_by(order, tie).limit(limit).offset(offset).all()
    return FlowListOut(items=[_to_out(r) for r in rows], total=total, limit=limit, offset=offset)


def create_flow(db: OrmSession, payload: FlowCreate) -> FlowOut:
    p = payload.normalized()
    exists = db.query(Workflow).filter(Workflow.slug == p.slug).first()
    if exists:
        raise FlowConflict("Flow slug already exists")

    row = Workflow(
        slug=p.slug,
        title=p.title,
        description=p.description,
        status=p.status,
        trigger_event=p.trigger_event,
        definition_json=dump_flow_definition(p.definition),
    )

    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise FlowConflict("Flow slug already exists") from exc

    db.refresh(row)
    return _to_out(row)


def get_flow(db: OrmSession, flow_id: int) -> FlowOut | None:
    row = db.query(Workflow).filter(Workflow.id == flow_id).first()
    return _to_out(row) if row else None


def _get_flow_row_or_404(db: OrmSession, flow_id: int) -> Workflow:
    row = db.query(Workflow).filter(Workflow.id == flow_id).first()
    if not row:
        raise FlowNotFound("Flow not found")
    return row


def update_flow(db: OrmSession, flow_id: int, payload: FlowUpdate) -> FlowOut:
    row = _get_flow_row_or_404(db, flow_id)
    p = payload.normalized()
    data = p.model_dump(exclude_unset=True)

    if "title" in data and data["title"] is not None:
        row.title = data["title"]
    if "description" in data:
        row.description = data["description"]
    if "status" in data and data["status"]:
        row.status = data["status"]
    if "trigger_event" in data and data["trigger_event"]:
        row.trigger_event = data["trigger_event"]
    if "definition" in data and data["definition"] is not None:
        row.definition_json = dump_flow_definition(data["definition"])

    db.commit()
    db.refresh(row)
    return _to_out(row)


def delete_flow(db: OrmSession, flow_id: int) -> None:
    row = _get_flow_row_or_404(db, flow_id)
    db.delete(row)
    db.commit()


def list_runs(db: OrmSession, flow_id: int, limit: int, offset: int) -> FlowRunListOut:
    _get_flow_row_or_404(db, flow_id)

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(WorkflowRun).filter(WorkflowRun.workflow_id == flow_id)
    total = base.with_entities(func.count(WorkflowRun.id)).scalar() or 0
    rows = (
        base.order_by(WorkflowRun.created_at.desc(), WorkflowRun.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return FlowRunListOut(items=[_to_run_out(r) for r in rows], total=total, limit=limit, offset=offset)


def _resolve_ref(expr: str, *, input_data: dict[str, Any], context: dict[str, Any], output: dict[str, Any]) -> Any:
    e = expr.strip()
    if not e:
        return ""

    if e == "now_iso":
        return datetime.now(timezone.utc).isoformat()
    if e == "timestamp":
        return int(datetime.now(timezone.utc).timestamp())
    if e == "uuid":
        return uuid4().hex
    if e == "random6":
        return uuid4().hex[:6]

    def get_path(root: Any, path: str) -> Any:
        current = root
        for part in path.split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return ""
        return current

    if e == "input":
        return input_data
    if e == "context":
        return context
    if e == "output":
        return output

    if e.startswith("input."):
        return get_path(input_data, e[6:])
    if e.startswith("context."):
        return get_path(context, e[8:])
    if e.startswith("output."):
        return get_path(output, e[7:])

    return ""


def _render_template_value(value: Any, *, input_data: dict[str, Any], context: dict[str, Any], output: dict[str, Any]) -> Any:
    if isinstance(value, str):
        matches = list(_TEMPLATE_RE.finditer(value))
        if not matches:
            return value

        if len(matches) == 1 and matches[0].span() == (0, len(value)):
            return _resolve_ref(matches[0].group(1), input_data=input_data, context=context, output=output)

        def repl(match: re.Match[str]) -> str:
            resolved = _resolve_ref(match.group(1), input_data=input_data, context=context, output=output)
            return "" if resolved is None else str(resolved)

        return _TEMPLATE_RE.sub(repl, value)

    if isinstance(value, list):
        return [
            _render_template_value(v, input_data=input_data, context=context, output=output)
            for v in value
        ]

    if isinstance(value, dict):
        return {
            str(k): _render_template_value(v, input_data=input_data, context=context, output=output)
            for k, v in value.items()
        }

    return value


def _slugify(value: str) -> str:
    s = re.sub(r"[^a-z0-9-]+", "-", (value or "").strip().lower())
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "entry"


def _ensure_unique_entry_slug(db: OrmSession, content_type_id: int, base_slug: str) -> str:
    slug = _slugify(base_slug)
    if not db.query(ContentEntry).filter(ContentEntry.content_type_id == content_type_id, ContentEntry.slug == slug).first():
        return slug

    for i in range(2, 1000):
        candidate = f"{slug}-{i}"
        if not db.query(ContentEntry).filter(ContentEntry.content_type_id == content_type_id, ContentEntry.slug == candidate).first():
            return candidate

    return f"{slug}-{uuid4().hex[:6]}"


def _execute_action(
    db: OrmSession,
    node: dict[str, Any],
    *,
    input_data: dict[str, Any],
    context: dict[str, Any],
    output: dict[str, Any],
) -> dict[str, Any]:
    config_raw = node.get("config") or {}
    config = _render_template_value(config_raw, input_data=input_data, context=context, output=output)
    operation = str(config.get("operation", "noop") or "noop").strip().lower()

    step: dict[str, Any] = {
        "node_id": node.get("id"),
        "label": node.get("label") or node.get("id"),
        "operation": operation,
        "status": "ok",
    }

    if operation == "noop":
        step["message"] = "No-op"
        return step

    if operation == "set_output":
        values = config.get("values")
        if isinstance(values, dict):
            for k, v in values.items():
                output[str(k)] = v
            step["message"] = f"Updated output values ({len(values)})"
            return step

        key = str(config.get("key", "") or "").strip()
        if not key:
            raise FlowBadRequest(f"Action node '{node.get('id')}' set_output requires config.key")
        output[key] = config.get("value")
        step["message"] = f"Set output[{key}]"
        return step

    if operation == "upsert_option":
        key = str(config.get("key", "") or "").strip()
        if not key:
            raise FlowBadRequest(f"Action node '{node.get('id')}' upsert_option requires config.key")

        value = config.get("value")
        row = db.query(Option).filter(Option.key == key).first()
        if row is None:
            row = Option(key=key, value_json=json.dumps(value, ensure_ascii=False))
            db.add(row)
            step["message"] = f"Created option '{key}'"
        else:
            row.value_json = json.dumps(value, ensure_ascii=False)
            step["message"] = f"Updated option '{key}'"
        return step

    if operation == "create_entry":
        type_slug = str(config.get("content_type_slug", "") or "").strip().lower()
        if not type_slug:
            raise FlowBadRequest(
                f"Action node '{node.get('id')}' create_entry requires config.content_type_slug"
            )

        ct = db.query(ContentType).filter(ContentType.slug == type_slug).first()
        if ct is None:
            raise FlowBadRequest(f"Content type '{type_slug}' not found for action node '{node.get('id')}'")

        title = str(config.get("title", "Flow entry") or "Flow entry").strip() or "Flow entry"
        base_slug = str(config.get("slug", "") or "").strip() or title
        slug = _ensure_unique_entry_slug(db, ct.id, base_slug)

        status = str(config.get("status", "draft") or "draft").strip().lower()
        if status not in {"draft", "published"}:
            status = "draft"

        data = config.get("data")
        if not isinstance(data, dict):
            data = {}

        published_at = datetime.now(timezone.utc) if status == "published" else None

        entry = ContentEntry(
            content_type_id=ct.id,
            title=title,
            slug=slug,
            status=status,
            order_index=int(config.get("order_index", 0) or 0),
            data_json=json.dumps(data, ensure_ascii=False),
            published_at=published_at,
        )
        db.add(entry)
        db.flush()

        step["message"] = f"Created entry '{slug}' in '{ct.slug}'"
        step["entry_id"] = entry.id

        output_key = str(config.get("output_key", "") or "").strip()
        if output_key:
            output[output_key] = {
                "entry_id": entry.id,
                "slug": entry.slug,
                "content_type": ct.slug,
            }

        return step

    raise FlowBadRequest(
        f"Action node '{node.get('id')}' has unsupported operation '{operation}'"
    )


def _execute_definition(
    db: OrmSession,
    definition: FlowDefinition,
    *,
    event: str,
    input_data: dict[str, Any],
    context: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    node_map: dict[str, dict[str, Any]] = {n.id: n.model_dump() for n in definition.nodes}
    outgoing: dict[str, list[str]] = {n.id: [] for n in definition.nodes}
    for edge in definition.edges:
        outgoing.setdefault(edge.source, []).append(edge.target)

    trigger_ids: list[str] = []
    for n in definition.nodes:
        if n.kind != "trigger":
            continue
        configured_event = str((n.config or {}).get("event", "") or "").strip().lower()
        if not configured_event or configured_event == "*" or configured_event == event:
            trigger_ids.append(n.id)

    if not trigger_ids:
        raise FlowBadRequest(f"No trigger node matched event '{event}'")

    output: dict[str, Any] = {}
    steps: list[dict[str, Any]] = []

    queue: list[str] = list(trigger_ids)
    visited: set[str] = set()
    step_guard = 0

    while queue:
        node_id = queue.pop(0)
        if node_id in visited:
            continue

        visited.add(node_id)
        node = node_map.get(node_id)
        if not node:
            continue

        if node.get("kind") == "action":
            steps.append(
                _execute_action(
                    db,
                    node,
                    input_data=input_data,
                    context=context,
                    output=output,
                )
            )

        for next_id in outgoing.get(node_id, []):
            if next_id not in visited:
                queue.append(next_id)

        step_guard += 1
        if step_guard > 1000:
            raise FlowBadRequest("Flow execution stopped: graph too deep or cyclic")

    return steps, output


def _insert_run(
    db: OrmSession,
    *,
    flow_id: int,
    status: str,
    input_data: dict[str, Any],
    output_data: dict[str, Any],
    error_text: str | None,
) -> WorkflowRun:
    run = WorkflowRun(
        workflow_id=flow_id,
        status=status,
        input_json=dump_run_json(input_data),
        output_json=dump_run_json(output_data),
        error_text=error_text,
    )
    db.add(run)
    db.flush()
    return run


def run_flow(
    db: OrmSession,
    row: Workflow,
    payload: FlowTriggerIn,
    *,
    persist_run: bool,
) -> FlowTriggerOut:
    event = str(payload.event or row.trigger_event or "manual").strip().lower()
    if not event:
        event = "manual"

    input_data = payload.input or {}
    context_data = payload.context or {}

    definition = load_flow_definition(row.definition_json)

    try:
        steps, output = _execute_definition(
            db,
            definition,
            event=event,
            input_data=input_data,
            context=context_data,
        )

        run_id: int | None = None
        if persist_run:
            run = _insert_run(
                db,
                flow_id=row.id,
                status="success",
                input_data=input_data,
                output_data=output,
                error_text=None,
            )
            run_id = run.id

        db.commit()

        return FlowTriggerOut(
            ok=True,
            flow_id=row.id,
            flow_slug=row.slug,
            status="success",
            event=event,
            output=output,
            steps=steps,
            run_id=run_id,
        )
    except Exception as exc:
        db.rollback()
        error_text = str(exc) or "Flow execution failed"

        run_id: int | None = None
        if persist_run:
            run = _insert_run(
                db,
                flow_id=row.id,
                status="failed",
                input_data=input_data,
                output_data={},
                error_text=error_text,
            )
            db.commit()
            run_id = run.id

        if isinstance(exc, FlowBadRequest):
            message = str(exc)
        else:
            message = f"Flow execution failed: {error_text}"

        return FlowTriggerOut(
            ok=False,
            flow_id=row.id,
            flow_slug=row.slug,
            status="failed",
            event=event,
            output={"error": message},
            steps=[],
            run_id=run_id,
        )


def run_flow_test(db: OrmSession, flow_id: int, payload: FlowTriggerIn) -> FlowTriggerOut:
    row = _get_flow_row_or_404(db, flow_id)
    return run_flow(db, row, payload, persist_run=False)


def trigger_public_flow(db: OrmSession, slug: str, payload: FlowTriggerIn) -> FlowTriggerOut:
    flow_slug = (slug or "").strip().lower()
    if not flow_slug:
        raise FlowBadRequest("Flow slug is required")

    row = db.query(Workflow).filter(Workflow.slug == flow_slug).first()
    if not row:
        raise FlowNotFound("Flow not found")

    if row.status != "active":
        raise FlowBadRequest("Flow is not active")

    return run_flow(db, row, payload, persist_run=True)
