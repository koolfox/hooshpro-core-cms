type ApiFetchOptions = RequestInit & {
	nextPath?: string;
};

export class ApiError extends Error {
	status: number;
	bodyText: string;

	constructor(status: number, message: string, bodyText: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.bodyText = bodyText;
	}
}

function isBrowser() {
	return typeof window !== 'undefined';
}

function toLogin(nextPath?: string) {
	const next = nextPath ?? (isBrowser() ? window.location.pathname : '/');
	const url = `/auth/login?next=${encodeURIComponent(next)}`;
	if (isBrowser()) window.location.href = url;
	return url;
}

export async function apiFetch<T>(
	path: string,
	opts: ApiFetchOptions = {}
): Promise<T> {
	const headers = new Headers(opts.headers ?? undefined);
	// Double-submit CSRF: send header matching csrftoken cookie when present.
	if (typeof document !== 'undefined') {
		const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
		if (m && !headers.has('X-CSRF-Token')) {
			headers.set('X-CSRF-Token', decodeURIComponent(m[1]));
		}
	}

	const res = await fetch(path, {
		...opts,
		headers,
		credentials: 'include',
	});

	if (res.status === 401) {
		toLogin(opts.nextPath);
		const text = await res.text().catch(() => '');
		throw new ApiError(401, 'Unauthorized', text);
	}

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		let message = text || `Request failed (${res.status})`;
		try {
			const parsed = JSON.parse(text) as unknown;
			if (
				parsed &&
				typeof parsed === 'object' &&
				'detail' in parsed &&
				typeof (parsed as { detail?: unknown }).detail === 'string'
			) {
				message = (parsed as { detail: string }).detail;
			}
		} catch {
			// ignore parse errors
		}
		throw new ApiError(res.status, message, text);
	}

	const ct = res.headers.get('content-type') ?? '';
	if (ct.includes('application/json')) {
		return (await res.json()) as T;
	}

	return (await res.text()) as unknown as T;
}
