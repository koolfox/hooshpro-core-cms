from __future__ import annotations

from collections import deque
from threading import Lock
from time import monotonic


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding-window rate limiter."""

    def __init__(self, *, limit: int, window_seconds: int) -> None:
        self.limit = max(1, int(limit))
        self.window_seconds = max(1, int(window_seconds))
        self._attempts: dict[str, deque[float]] = {}
        self._lock = Lock()

    def is_limited(self, key: str) -> tuple[bool, int]:
        now = monotonic()
        with self._lock:
            attempts = self._prune(key, now)
            if len(attempts) < self.limit:
                return False, 0

            retry_after = int(max(1, (attempts[0] + self.window_seconds) - now))
            return True, retry_after

    def hit(self, key: str) -> None:
        now = monotonic()
        with self._lock:
            attempts = self._prune(key, now)
            attempts.append(now)
            self._attempts[key] = attempts

    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._attempts.get(key, deque())
        threshold = now - self.window_seconds
        while attempts and attempts[0] <= threshold:
            attempts.popleft()
        if attempts:
            self._attempts[key] = attempts
        else:
            self._attempts.pop(key, None)
        return attempts
