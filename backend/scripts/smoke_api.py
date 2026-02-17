from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass
class SmokeResult:
    name: str
    ok: bool
    detail: str


def _request(base_url: str, path: str) -> tuple[int, dict[str, str], str]:
    req = Request(f"{base_url}{path}", method="GET")
    try:
        with urlopen(req, timeout=10) as res:
            status = int(res.status)
            headers = {k.lower(): v for k, v in res.headers.items()}
            body = res.read().decode("utf-8", errors="replace")
            return status, headers, body
    except HTTPError as err:
        status = int(err.code)
        headers = {k.lower(): v for k, v in err.headers.items()} if err.headers else {}
        body = err.read().decode("utf-8", errors="replace")
        return status, headers, body


def check_health(base_url: str) -> SmokeResult:
    status, _, body = _request(base_url, "/health")
    if status != 200:
        return SmokeResult("health", False, f"expected 200, got {status}")
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return SmokeResult("health", False, "response is not valid JSON")
    if payload.get("status") != "ok":
        return SmokeResult("health", False, f"unexpected payload: {payload}")
    return SmokeResult("health", True, "ok")


def check_csrf(base_url: str) -> SmokeResult:
    status, headers, body = _request(base_url, "/api/auth/csrf")
    if status != 200:
        return SmokeResult("auth.csrf", False, f"expected 200, got {status}")
    csrf_header = headers.get("x-csrf-token")
    cookie_header = headers.get("set-cookie", "")
    if not csrf_header:
        return SmokeResult("auth.csrf", False, "missing x-csrf-token header")
    if "csrftoken=" not in cookie_header:
        return SmokeResult("auth.csrf", False, "missing csrftoken cookie")
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return SmokeResult("auth.csrf", False, "response is not valid JSON")
    if not isinstance(payload.get("csrf_token"), str) or not payload["csrf_token"]:
        return SmokeResult("auth.csrf", False, "missing csrf_token field")
    return SmokeResult("auth.csrf", True, "ok")


def check_admin_gate(base_url: str) -> SmokeResult:
    status, _, _ = _request(base_url, "/api/admin/ping")
    if status not in {401, 403}:
        return SmokeResult("admin.gate", False, f"expected 401/403, got {status}")
    return SmokeResult("admin.gate", True, f"got {status}")


def main() -> int:
    parser = argparse.ArgumentParser(description="HooshPro API smoke checks")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend base URL")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")

    try:
        checks = [
            check_health(base_url),
            check_csrf(base_url),
            check_admin_gate(base_url),
        ]
    except URLError as err:
        print(f"[FAIL] network: {err}")
        return 1

    failed = False
    for check in checks:
        mark = "PASS" if check.ok else "FAIL"
        print(f"[{mark}] {check.name}: {check.detail}")
        if not check.ok:
            failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
