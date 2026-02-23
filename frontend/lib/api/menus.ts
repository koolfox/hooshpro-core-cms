import { apiFetch } from '@/lib/http';
import type { Menu, MenuItem, MenuItemListOut, MenuListOut, PublicMenuOut } from '@/lib/types';

export type SortDir = 'asc' | 'desc';

export const MENU_SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug', 'id'] as const;
export type MenuSort = (typeof MENU_SORT_FIELDS)[number];

export type AdminMenusListParams = {
	limit: number;
	offset: number;
	q?: string;
	sort?: MenuSort;
	dir?: SortDir;
};

export type MenuUpsertPayload = {
	title: string;
	slug: string;
	description?: string | null;
};

export type MenuItemCreatePayload = {
	type: 'page' | 'link';
	label: string;
	page_id?: number | null;
	href?: string | null;
};

export type MenuItemUpdatePayload = {
	label?: string;
	page_id?: number | null;
	href?: string | null;
};

export function buildAdminMenusListUrl(params: AdminMenusListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/menus?${sp.toString()}`;
}

export function listAdminMenus(params: AdminMenusListParams, nextPath = '/admin/menus') {
	return apiFetch<MenuListOut>(buildAdminMenusListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminMenu(payload: MenuUpsertPayload, nextPath = '/admin/menus') {
	return apiFetch<Menu>('/api/admin/menus', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function getAdminMenu(menuId: number, nextPath = '/admin/menus') {
	return apiFetch<Menu>(`/api/admin/menus/${menuId}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function updateAdminMenu(
	menuId: number,
	payload: Partial<MenuUpsertPayload>,
	nextPath = '/admin/menus'
) {
	return apiFetch<Menu>(`/api/admin/menus/${menuId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminMenu(menuId: number, nextPath = '/admin/menus') {
	return apiFetch<{ ok: boolean }>(`/api/admin/menus/${menuId}`, {
		method: 'DELETE',
		nextPath,
	});
}

export function listAdminMenuItems(menuId: number, nextPath = '/admin/menus') {
	return apiFetch<MenuItemListOut>(`/api/admin/menus/${menuId}/items`, {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminMenuItem(
	menuId: number,
	payload: MenuItemCreatePayload,
	nextPath = '/admin/menus'
) {
	return apiFetch<MenuItem>(`/api/admin/menus/${menuId}/items`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function updateAdminMenuItem(
	menuId: number,
	itemId: number,
	payload: MenuItemUpdatePayload,
	nextPath = '/admin/menus'
) {
	return apiFetch<MenuItem>(`/api/admin/menus/${menuId}/items/${itemId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminMenuItem(menuId: number, itemId: number, nextPath = '/admin/menus') {
	return apiFetch<{ ok: boolean }>(`/api/admin/menus/${menuId}/items/${itemId}`, {
		method: 'DELETE',
		nextPath,
	});
}

export function reorderAdminMenuItems(menuId: number, itemIds: number[], nextPath = '/admin/menus') {
	return apiFetch<{ ok: boolean }>(`/api/admin/menus/${menuId}/items/reorder`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ item_ids: itemIds }),
		nextPath,
	});
}

export function getPublicMenu(slug: string, nextPath = '/') {
	return apiFetch<PublicMenuOut>(`/api/public/menus/${slug}`, {
		cache: 'no-store',
		nextPath,
	});
}
