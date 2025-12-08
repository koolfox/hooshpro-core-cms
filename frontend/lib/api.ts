const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

interface LoginResponse {
	access_token: string;
	token_type: string;
}

export async function apiLogin(
	email: string,
	password: string
): Promise<LoginResponse> {
	const url = `${API_BASE_URL}/auth/login`;

	const body = new URLSearchParams();
	body.append('username', email);
	body.append('password', password);

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body,
	});

	if (!res.ok) {
		throw new Error('Login failed');
	}
	return res.json();
}

export interface MeResponse {
	id: number;
	email: string;
	created_at: string;
}

export async function apiGetMe(token: string): Promise<MeResponse> {
	const url = `${API_BASE_URL}/auth/me`;

	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!res.ok) {
		throw new Error('Failed to fetch user');
	}

	return res.json();
}
