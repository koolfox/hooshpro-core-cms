import { apiFetch } from '@/lib/http';
import type {
	MediaAsset,
	MediaFolder,
	MediaFolderListOut,
	MediaListOut,
} from '@/lib/types';

export type SortDir = 'asc' | 'desc';

export const MEDIA_SORT_FIELDS = ['created_at', 'name', 'size_bytes', 'content_type'] as const;
export type MediaSort = (typeof MEDIA_SORT_FIELDS)[number];

export type AdminMediaListParams = {
	limit: number;
	offset: number;
	folder_id?: number | null;
	q?: string;
	sort?: MediaSort;
	dir?: SortDir;
};

export type MediaMovePayload = {
	folder_id: number;
};

export type MediaFolderCreatePayload = {
	name: string;
	parent_id?: number | null;
};

export type MediaFolderUpdatePayload = {
	name?: string;
	parent_id?: number | null;
};

export const ADMIN_MEDIA_FOLDERS_URL = '/api/admin/media/folders';

export function buildAdminMediaListUrl(params: AdminMediaListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (typeof params.folder_id === 'number') sp.set('folder_id', String(params.folder_id));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/media?${sp.toString()}`;
}

export function listAdminMedia(params: AdminMediaListParams, nextPath = '/admin/media') {
	return apiFetch<MediaListOut>(buildAdminMediaListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function listAdminMediaFolders(nextPath = '/admin/media') {
	return apiFetch<MediaFolderListOut>(ADMIN_MEDIA_FOLDERS_URL, {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminMediaFolder(
	payload: MediaFolderCreatePayload,
	nextPath = '/admin/media'
) {
	return apiFetch<MediaFolder>(ADMIN_MEDIA_FOLDERS_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function updateAdminMediaFolder(
	folderId: number,
	payload: MediaFolderUpdatePayload,
	nextPath = '/admin/media'
) {
	return apiFetch<MediaFolder>(`/api/admin/media/folders/${folderId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminMediaFolder(folderId: number, nextPath = '/admin/media') {
	return apiFetch<{ ok: boolean }>(`/api/admin/media/folders/${folderId}`, {
		method: 'DELETE',
		nextPath,
	});
}

export function uploadAdminMedia(
	file: File,
	folderId = 0,
	nextPath = '/admin/media'
) {
	const fd = new FormData();
	fd.append('file', file);
	fd.append('folder_id', String(folderId));
	return apiFetch<MediaAsset>('/api/admin/media/upload', {
		method: 'POST',
		body: fd,
		nextPath,
	});
}

export function updateAdminMedia(
	mediaId: number,
	payload: MediaMovePayload,
	nextPath = '/admin/media'
) {
	return apiFetch<MediaAsset>(`/api/admin/media/${mediaId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminMedia(mediaId: number, nextPath = '/admin/media') {
	return apiFetch<{ ok: boolean }>(`/api/admin/media/${mediaId}`, {
		method: 'DELETE',
		nextPath,
	});
}
