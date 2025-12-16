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

export interface Project {
	id: number;
	owner_id: number;
	name: string;
	slug: string;
	description: string | null;
	created_at: string;
}

export interface ProjectCreateInput {
	name: string;
	slug: string;
	description?: string;
}

export async function apiListProjects(token: string): Promise<Project[]> {
	const url = `${API_BASE_URL}/projects/`;

	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!res.ok) {
		throw new Error('Failed to load projects');
	}

	return res.json();
}

export async function apiCreateProject(
	token: string,
	input: ProjectCreateInput
): Promise<Project> {
	const url = `${API_BASE_URL}/projects`;

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(input),
	});

	if (!res.ok) {
		throw new Error('Failed to create project');
	}

	return res.json();
}

export interface AdminFieldMeta {
	name: string;
	label: string;
	type: string;
	required: boolean;
	list: boolean;
	filterable: boolean;
	order_index: number;
}

export interface AdminContentType {
	key: string;
	label: string;
	description?: string | null;
	singleton: boolean;
	fields: AdminFieldMeta[];
}

export interface AdminEntrySummary {
	id: number;
	slug: string;
	status: string;
	created_at: string;
	updated_at: string;
	data: Record<string, any>;
}

function getAuthToken() {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('hooshpro_token');
}

export async function fetchContentTypes(): Promise<AdminContentType[]> {
	const token = getAuthToken();
	const res = await fetch(`${API_BASE_URL}/admin/content-types`, {
		headers: {
			Authorization: token ? `Bearer ${token}` : '',
		},
	});
	if (!res.ok) {
		throw new Error('Failed to load content types');
	}
	return res.json();
}

export async function fetchEntries(
	typeKey: string
): Promise<AdminEntrySummary[]> {
	const token = getAuthToken();
	const res = await fetch(`${API_BASE_URL}/admin/content/${typeKey}`, {
		headers: {
			Authorization: token ? `Bearer ${token}` : '',
		},
	});
	if (!res.ok) {
		throw new Error('Failed to load entries');
	}
	return res.json();
}

export async function createEntry(
	typeKey: string,
	payload: Record<string, any>
): Promise<AdminEntrySummary> {
	const token = getAuthToken();
	const res = await fetch(`${API_BASE_URL}/admin/content/${typeKey}`, {
		method:'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: token ? `Bearer ${token}` : '',
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(
			`Failed to create entry (${res.status}): ${text || res.statusText}`
		);
	}
	return res.json();
}

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

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
		const msg = await res.text().catch(() => '');
		throw new ApiError(res.status, msg || res.statusText);
	}

	return res.json() as Promise<T>;
}
