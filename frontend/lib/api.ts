export async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...init,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {}),
		},
	});

	if (!res.ok) {
		let msg = `Request failed (${res.status})`;
		try {
			const data = await res.json();
			msg = data?.detail ?? data?.message ?? msg;
		} catch {}
		throw new Error(msg);
	}

	return res.json() as Promise<T>;
}
