from __future__ import annotations

import argparse
import json
import secrets
import time
from dataclasses import dataclass
from http.cookiejar import CookieJar
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener


@dataclass
class SmokeResult:
    name: str
    ok: bool
    detail: str


@dataclass
class HttpResponse:
    status: int
    headers: dict[str, str]
    body: str


class HttpClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.jar = CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.jar))

    def cookie(self, name: str) -> str | None:
        for cookie in self.jar:
            if cookie.name == name:
                return cookie.value
        return None

    def csrf_headers(self) -> dict[str, str]:
        token = self.cookie("csrftoken")
        return {"X-CSRF-Token": token} if token else {}

    def request(
        self,
        path: str,
        *,
        method: str = "GET",
        payload: dict | None = None,
        headers: dict[str, str] | None = None,
    ) -> HttpResponse:
        body_bytes: bytes | None = None
        req_headers: dict[str, str] = {"accept": "application/json"}

        if payload is not None:
            body_bytes = json.dumps(payload).encode("utf-8")
            req_headers["content-type"] = "application/json"

        if headers:
            req_headers.update(headers)

        req = Request(
            f"{self.base_url}{path}",
            method=method.upper(),
            data=body_bytes,
            headers=req_headers,
        )

        try:
            with self.opener.open(req, timeout=15) as res:
                return HttpResponse(
                    status=int(res.status),
                    headers={k.lower(): v for k, v in res.headers.items()},
                    body=res.read().decode("utf-8", errors="replace"),
                )
        except HTTPError as err:
            return HttpResponse(
                status=int(err.code),
                headers={k.lower(): v for k, v in err.headers.items()} if err.headers else {},
                body=err.read().decode("utf-8", errors="replace"),
            )


def _parse_json(body: str) -> dict:
    if not body:
        return {}
    try:
        parsed = json.loads(body)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def check_health(client: HttpClient) -> SmokeResult:
    res = client.request("/health")
    if res.status != 200:
        return SmokeResult("health", False, f"expected 200, got {res.status}")
    payload = _parse_json(res.body)
    if payload.get("status") != "ok":
        return SmokeResult("health", False, f"unexpected payload: {payload}")
    return SmokeResult("health", True, "ok")


def check_admin_gate_unauth(client: HttpClient) -> SmokeResult:
    res = client.request("/api/admin/ping")
    if res.status not in {401, 403}:
        return SmokeResult("admin.gate.unauth", False, f"expected 401/403, got {res.status}")
    return SmokeResult("admin.gate.unauth", True, f"got {res.status}")


def ensure_csrf(client: HttpClient) -> SmokeResult:
    res = client.request("/api/auth/csrf")
    if res.status != 200:
        return SmokeResult("auth.csrf", False, f"expected 200, got {res.status}")

    payload = _parse_json(res.body)
    token = payload.get("csrf_token")
    if not isinstance(token, str) or not token:
        return SmokeResult("auth.csrf", False, "missing csrf_token payload")

    cookie_token = client.cookie("csrftoken")
    if not cookie_token:
        return SmokeResult("auth.csrf", False, "missing csrftoken cookie")

    return SmokeResult("auth.csrf", True, "ok")


def ensure_admin_login(
    client: HttpClient,
    *,
    admin_email: str,
    admin_password: str,
    setup_key: str,
) -> SmokeResult:
    login_payload = {"email": admin_email, "password": admin_password}

    first = client.request("/api/auth/login", method="POST", payload=login_payload)
    if first.status == 200:
        return SmokeResult("auth.login", True, "ok")

    # Bootstrap once when login fails.
    bootstrap_payload = {"email": admin_email, "password": admin_password}
    boot = client.request(
        "/api/bootstrap/admin",
        method="POST",
        payload=bootstrap_payload,
        headers={"x-setup-key": setup_key},
    )
    if boot.status not in {200, 409}:
        detail = _parse_json(boot.body).get("message") or boot.body.strip() or "bootstrap failed"
        return SmokeResult(
            "auth.login",
            False,
            f"login={first.status}; bootstrap={boot.status}; {detail}",
        )

    second = client.request("/api/auth/login", method="POST", payload=login_payload)
    if second.status != 200:
        detail = _parse_json(second.body).get("message") or second.body.strip() or "login failed"
        return SmokeResult("auth.login", False, f"expected 200 after bootstrap, got {second.status}; {detail}")

    return SmokeResult("auth.login", True, "ok")


def check_auth_me(client: HttpClient, admin_email: str) -> SmokeResult:
    res = client.request("/api/auth/me")
    if res.status != 200:
        return SmokeResult("auth.me", False, f"expected 200, got {res.status}")
    payload = _parse_json(res.body)
    email = str(payload.get("email") or "").strip().lower()
    if email != admin_email.strip().lower():
        return SmokeResult("auth.me", False, f"unexpected email: {payload.get('email')}")
    return SmokeResult("auth.me", True, "ok")


def check_admin_gate_auth(client: HttpClient) -> SmokeResult:
    res = client.request("/api/admin/ping")
    if res.status != 200:
        return SmokeResult("admin.gate.auth", False, f"expected 200, got {res.status}")
    payload = _parse_json(res.body)
    if payload.get("ok") is not True:
        return SmokeResult("admin.gate.auth", False, f"unexpected payload: {payload}")
    return SmokeResult("admin.gate.auth", True, "ok")


def check_pages_crud(client: HttpClient) -> SmokeResult:
    csrf = ensure_csrf(client)
    if not csrf.ok:
        return SmokeResult("pages.crud", False, f"csrf failed: {csrf.detail}")

    nonce = f"{int(time.time())}-{secrets.token_hex(2)}"
    slug = f"smoke-{nonce}"

    blocks = {
        "version": 6,
        "canvas": {
            "snapPx": 1,
            "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
            "minHeightPx": 800,
        },
        "layout": {"nodes": []},
    }

    create_payload = {
        "title": f"Smoke {nonce}",
        "slug": slug,
        "status": "draft",
        "blocks": blocks,
    }

    create = client.request(
        "/api/admin/pages",
        method="POST",
        payload=create_payload,
        headers=client.csrf_headers(),
    )
    if create.status != 200:
        return SmokeResult("pages.crud", False, f"create expected 200, got {create.status}")

    created = _parse_json(create.body)
    page_id = created.get("id")
    if not isinstance(page_id, int):
        return SmokeResult("pages.crud", False, "create response missing page id")

    update = client.request(
        f"/api/admin/pages/{page_id}",
        method="PUT",
        payload={"status": "published", "blocks": blocks},
        headers=client.csrf_headers(),
    )
    if update.status != 200:
        return SmokeResult("pages.crud", False, f"update expected 200, got {update.status}")

    public_get = client.request(f"/api/public/pages/{slug}")
    if public_get.status != 200:
        return SmokeResult("pages.crud", False, f"public page expected 200, got {public_get.status}")

    delete = client.request(
        f"/api/admin/pages/{page_id}",
        method="DELETE",
        headers=client.csrf_headers(),
    )
    if delete.status != 200:
        return SmokeResult("pages.crud", False, f"delete expected 200, got {delete.status}")

    return SmokeResult("pages.crud", True, "ok")


def main() -> int:
    parser = argparse.ArgumentParser(description="HooshPro MVP smoke checks")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend base URL")
    parser.add_argument("--admin-email", default="admin@hooshpro.local")
    parser.add_argument("--admin-password", default="admin123456")
    parser.add_argument("--setup-key", default="dev-setup-key-123")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")

    try:
        anonymous = HttpClient(base_url)
        authed = HttpClient(base_url)

        results = [
            check_health(anonymous),
            check_admin_gate_unauth(anonymous),
            ensure_csrf(authed),
            ensure_admin_login(
                authed,
                admin_email=args.admin_email,
                admin_password=args.admin_password,
                setup_key=args.setup_key,
            ),
        ]

        if all(r.ok for r in results):
            results.extend(
                [
                    check_auth_me(authed, args.admin_email),
                    check_admin_gate_auth(authed),
                    check_pages_crud(authed),
                ]
            )
    except URLError as err:
        print(f"[FAIL] network: {err}")
        return 1

    failed = False
    for result in results:
        mark = "PASS" if result.ok else "FAIL"
        print(f"[{mark}] {result.name}: {result.detail}")
        if not result.ok:
            failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
