type ApiFetchOptions = RequestInit & {
	nextPath?: string;
};

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
	const res = await fetch(path, {
		...opts,
		credentials: 'include',
	});

	if (res.status === 401) {
		toLogin(opts.nextPath);
		throw new Error('Unauthorized');
	}

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(text || `Request failed (${res.status})`);
	}

	const ct = res.headers.get('content-type') ?? '';
	if (ct.includes('application/json')) {
		return (await res.json()) as T;
	}

	return (await res.text()) as unknown as T;
}
