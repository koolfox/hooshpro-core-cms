type ApiFetchOptions = RequestInit & {
	nextPath?: string;
};

type ApiErrorPayload = {
	error_code?: unknown;
	message?: unknown;
	detail?: unknown;
	trace_id?: unknown;
	details?: unknown;
};

const CSRF_HEADER = 'X-CSRF-Token';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfBootstrapPromise: Promise<string | null> | null = null;

export class ApiError extends Error {
	status: number;
	bodyText: string;
	errorCode?: string;
	traceId?: string;
	details?: unknown;

	constructor(args: {
		status: number;
		message: string;
		bodyText: string;
		errorCode?: string;
		traceId?: string;
		details?: unknown;
	}) {
		super(args.message);
		this.name = 'ApiError';
		this.status = args.status;
		this.bodyText = args.bodyText;
		this.errorCode = args.errorCode;
		this.traceId = args.traceId;
		this.details = args.details;
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

function parseApiErrorBody(bodyText: string): {
	message?: string;
	errorCode?: string;
	traceId?: string;
	details?: unknown;
} {
	if (!bodyText) return {};
	try {
		const parsed = JSON.parse(bodyText) as ApiErrorPayload;
		if (!parsed || typeof parsed !== 'object') return {};

		const message =
			typeof parsed.message === 'string'
				? parsed.message
				: typeof parsed.detail === 'string'
					? parsed.detail
					: undefined;
		const errorCode =
			typeof parsed.error_code === 'string' ? parsed.error_code : undefined;
		const traceId =
			typeof parsed.trace_id === 'string' ? parsed.trace_id : undefined;
		return {
			message,
			errorCode,
			traceId,
			details: parsed.details,
		};
	} catch {
		return {};
	}
}

function readCsrfTokenFromCookie(): string | null {
	if (typeof document === 'undefined') return null;
	const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
	if (!m) return null;
	return decodeURIComponent(m[1]);
}

function setCsrfHeaderFromCookie(headers: Headers): void {
	if (headers.has(CSRF_HEADER)) return;
	const token = readCsrfTokenFromCookie();
	if (token) headers.set(CSRF_HEADER, token);
}

async function bootstrapCsrfToken(forceRefresh = false): Promise<string | null> {
	if (!isBrowser()) return null;

	if (!forceRefresh) {
		const existing = readCsrfTokenFromCookie();
		if (existing) return existing;
	}

	if (!csrfBootstrapPromise) {
		csrfBootstrapPromise = (async () => {
			try {
				const res = await fetch('/api/auth/csrf', {
					method: 'GET',
					credentials: 'include',
				});
				if (!res.ok) return readCsrfTokenFromCookie();
				return (
					res.headers.get(CSRF_HEADER) ??
					readCsrfTokenFromCookie()
				);
			} catch {
				return readCsrfTokenFromCookie();
			} finally {
				csrfBootstrapPromise = null;
			}
		})();
	}

	return csrfBootstrapPromise;
}

function isCsrfRejection(
	status: number,
	parsed: { message?: string; errorCode?: string },
	bodyText: string
): boolean {
	if (status !== 403) return false;
	const candidate = `${parsed.message ?? ''} ${bodyText}`;
	return /csrf/i.test(candidate);
}

export async function apiFetch<T>(
	path: string,
	opts: ApiFetchOptions = {}
): Promise<T> {
	const method = (opts.method ?? 'GET').toUpperCase();
	const unsafe = UNSAFE_METHODS.has(method);

	const headers = new Headers(opts.headers ?? undefined);
	if (unsafe && !headers.has(CSRF_HEADER)) {
		setCsrfHeaderFromCookie(headers);
		if (!headers.has(CSRF_HEADER)) {
			const token = await bootstrapCsrfToken();
			if (token) headers.set(CSRF_HEADER, token);
		}
	}

	const perform = (requestHeaders: Headers) =>
		fetch(path, {
			...opts,
			headers: requestHeaders,
			credentials: 'include',
		});

	let res = await perform(headers);
	let preReadError:
		| { bodyText: string; parsed: ReturnType<typeof parseApiErrorBody> }
		| undefined;

	if (unsafe && res.status === 403) {
		const bodyText = await res.text().catch(() => '');
		const parsed = parseApiErrorBody(bodyText);
		if (isCsrfRejection(res.status, parsed, bodyText)) {
			const refreshed = await bootstrapCsrfToken(true);
			const retryHeaders = new Headers(headers);
			if (refreshed) retryHeaders.set(CSRF_HEADER, refreshed);
			res = await perform(retryHeaders);
		} else {
			preReadError = { bodyText, parsed };
		}
	}

	if (res.status === 401) {
		toLogin(opts.nextPath);
		const text = await res.text().catch(() => '');
		const parsed = parseApiErrorBody(text);
		throw new ApiError({
			status: 401,
			message: parsed.message ?? 'Unauthorized',
			bodyText: text,
			errorCode: parsed.errorCode,
			traceId: parsed.traceId ?? res.headers.get('x-trace-id') ?? undefined,
			details: parsed.details,
		});
	}

	if (!res.ok) {
		const text = preReadError?.bodyText ?? (await res.text().catch(() => ''));
		const parsed = preReadError?.parsed ?? parseApiErrorBody(text);
		throw new ApiError({
			status: res.status,
			message: parsed.message ?? (text || `Request failed (${res.status})`),
			bodyText: text,
			errorCode: parsed.errorCode,
			traceId: parsed.traceId ?? res.headers.get('x-trace-id') ?? undefined,
			details: parsed.details,
		});
	}

	const ct = res.headers.get('content-type') ?? '';
	if (ct.includes('application/json')) {
		return (await res.json()) as T;
	}

	return (await res.text()) as unknown as T;
}
