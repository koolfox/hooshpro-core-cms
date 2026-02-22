from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.page import validate_slug

FLOW_STATUSES = {"draft", "active", "disabled"}
NODE_KINDS = {"trigger", "action"}
ACTION_OPERATIONS = {"noop", "set_output", "upsert_option", "create_entry"}


def validate_flow_status(value: str) -> str:
    v = (value or "").strip().lower()
    if v not in FLOW_STATUSES:
        raise ValueError("status must be draft|active|disabled")
    return v


def validate_trigger_event(value: str) -> str:
    v = (value or "").strip().lower()
    if not v:
        raise ValueError("trigger_event is required")
    if len(v) > 120:
        raise ValueError("trigger_event must be <= 120 chars")
    return v


NODE_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")


class FlowNode(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    kind: Literal["trigger", "action"]
    label: str = Field(default="", max_length=200)
    config: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_node(self) -> "FlowNode":
        node_id = self.id.strip()
        if not NODE_ID_RE.match(node_id):
            raise ValueError("node.id must match [a-zA-Z0-9_-] and start with alnum")
        self.id = node_id
        self.label = (self.label or "").strip()[:200]
        self.config = self.config or {}

        if self.kind == "action":
            op = str(self.config.get("operation", "noop") or "noop").strip().lower()
            if op not in ACTION_OPERATIONS:
                raise ValueError(
                    "action config.operation must be one of: " + ", ".join(sorted(ACTION_OPERATIONS))
                )
            self.config["operation"] = op
        elif self.kind == "trigger":
            event = str(self.config.get("event", "") or "").strip().lower()
            if event:
                self.config["event"] = event
        return self


class FlowEdge(BaseModel):
    source: str = Field(min_length=1, max_length=64)
    target: str = Field(min_length=1, max_length=64)


class FlowDefinition(BaseModel):
    version: int = 1
    nodes: list[FlowNode] = Field(default_factory=list)
    edges: list[FlowEdge] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_graph(self) -> "FlowDefinition":
        if self.version != 1:
            raise ValueError("flow definition version must be 1")

        ids = [n.id for n in self.nodes]
        if len(ids) != len(set(ids)):
            raise ValueError("flow definition contains duplicate node ids")

        id_set = set(ids)
        trigger_count = sum(1 for n in self.nodes if n.kind == "trigger")
        if trigger_count == 0:
            raise ValueError("flow definition must include at least one trigger node")

        for e in self.edges:
            if e.source not in id_set:
                raise ValueError(f"edge source '{e.source}' does not exist")
            if e.target not in id_set:
                raise ValueError(f"edge target '{e.target}' does not exist")

        return self


class FlowCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    status: str = Field(default="draft")
    trigger_event: str = Field(default="manual", min_length=1, max_length=120)
    definition: FlowDefinition = Field(default_factory=FlowDefinition)

    def normalized(self) -> "FlowCreate":
        self.slug = validate_slug(self.slug)
        self.title = self.title.strip()[:200] or self.slug
        self.description = (self.description or "").strip()[:500] or None
        self.status = validate_flow_status(self.status)
        self.trigger_event = validate_trigger_event(self.trigger_event)
        return self


class FlowUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    status: Optional[str] = None
    trigger_event: Optional[str] = Field(default=None, max_length=120)
    definition: Optional[FlowDefinition] = None

    def normalized(self) -> "FlowUpdate":
        if self.title is not None:
            self.title = self.title.strip()[:200]
        if self.description is not None:
            self.description = self.description.strip()[:500] or None
        if self.status is not None:
            self.status = validate_flow_status(self.status)
        if self.trigger_event is not None:
            self.trigger_event = validate_trigger_event(self.trigger_event)
        return self


class FlowOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    status: str
    trigger_event: str
    definition: FlowDefinition
    created_at: datetime
    updated_at: datetime


class FlowListOut(BaseModel):
    items: list[FlowOut]
    total: int
    limit: int
    offset: int


class FlowRunOut(BaseModel):
    id: int
    flow_id: int
    status: str
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    created_at: datetime


class FlowRunListOut(BaseModel):
    items: list[FlowRunOut]
    total: int
    limit: int
    offset: int


class FlowTriggerIn(BaseModel):
    event: Optional[str] = None
    input: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)


class FlowTriggerOut(BaseModel):
    ok: bool
    flow_id: int
    flow_slug: str
    status: str
    event: str
    output: dict[str, Any] = Field(default_factory=dict)
    steps: list[dict[str, Any]] = Field(default_factory=list)
    run_id: Optional[int] = None


def load_flow_definition(raw_json: str | None) -> FlowDefinition:
    if not raw_json:
        return FlowDefinition()
    try:
        parsed = json.loads(raw_json)
    except Exception:
        return FlowDefinition()
    if not isinstance(parsed, dict):
        return FlowDefinition()
    return FlowDefinition.model_validate(parsed)


def dump_flow_definition(definition: FlowDefinition) -> str:
    return json.dumps(definition.model_dump(), ensure_ascii=False)


def load_run_json(raw_json: str | None) -> dict[str, Any]:
    if not raw_json:
        return {}
    try:
        parsed = json.loads(raw_json)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def dump_run_json(value: dict[str, Any] | None) -> str:
    try:
        return json.dumps(value or {}, ensure_ascii=False)
    except TypeError as exc:
        raise ValueError("Run payload must be JSON-serializable") from exc
