import { apiFetch } from '@/lib/http';
import type { OptionListOut, OptionOut } from '@/lib/types';

type PublicOptionsOut = { options: Record<string, unknown> };

export type SortDir = 'asc' | 'desc';
export const DEFAULT_OPTION_SORT = 'key';
export const DEFAULT_OPTION_DIR: SortDir = 'asc';

export type AdminOptionsListParams = {
	limit: number;
	offset: number;
	q?: string;
	keys?: string[];
	sort?: string;
	dir?: SortDir;
};

export function buildAdminOptionsListUrl(params: AdminOptionsListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.keys?.length) sp.set('keys', params.keys.join(','));
	sp.set('sort', params.sort ?? DEFAULT_OPTION_SORT);
	sp.set('dir', params.dir ?? DEFAULT_OPTION_DIR);
	return `/api/admin/options?${sp.toString()}`;
}

export function listAdminOptions(params: AdminOptionsListParams, nextPath = '/admin/settings') {
	return apiFetch<OptionListOut>(buildAdminOptionsListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function getAdminOption(key: string, nextPath = '/admin/settings') {
	return apiFetch<OptionOut>(`/api/admin/options/${encodeURIComponent(key)}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function setAdminOption(key: string, value: unknown, nextPath = '/admin/settings') {
	return apiFetch<OptionOut>(`/api/admin/options/${encodeURIComponent(key)}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ value }),
		cache: 'no-store',
		nextPath,
	});
}

export function deleteAdminOption(key: string, nextPath = '/admin/settings') {
	return apiFetch<{ ok: boolean }>(`/api/admin/options/${encodeURIComponent(key)}`, {
		method: 'DELETE',
		cache: 'no-store',
		nextPath,
	});
}

export function fetchPublicOptions(keys: string[] = []) {
	const sp = new URLSearchParams();
	if (keys.length) sp.set('keys', keys.join(','));
	const suffix = sp.toString();
	return apiFetch<PublicOptionsOut>(`/api/public/options${suffix ? `?${suffix}` : ''}`, {
		cache: 'no-store',
	});
}

