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
		const text = await res.text().catch(() => '');
		const parsed = parseApiErrorBody(text);
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
