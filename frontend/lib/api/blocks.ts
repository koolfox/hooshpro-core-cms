import { apiFetch } from '@/lib/http';
import type { BlockListOut, BlockTemplate } from '@/lib/types';

export type SortDir = 'asc' | 'desc';

export const BLOCK_SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug'] as const;
export type BlockSort = (typeof BLOCK_SORT_FIELDS)[number];

export type AdminBlocksListParams = {
	limit: number;
	offset: number;
	q?: string;
	sort?: BlockSort;
	dir?: SortDir;
};

export type BlockUpsertPayload = {
	title: string;
	slug: string;
	description?: string | null;
	definition?: Record<string, unknown>;
};

export function buildAdminBlocksListUrl(params: AdminBlocksListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.sort) sp.set('sort', params.sort);
	if (params.dir) sp.set('dir', params.dir);
	return `/api/admin/blocks?${sp.toString()}`;
}

export function listAdminBlocks(params: AdminBlocksListParams, nextPath = '/admin/blocks') {
	return apiFetch<BlockListOut>(buildAdminBlocksListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminBlock(payload: BlockUpsertPayload, nextPath = '/admin/blocks') {
	return apiFetch<BlockTemplate>('/api/admin/blocks', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function getAdminBlock(blockId: number, nextPath = `/admin/blocks/${blockId}`) {
	return apiFetch<BlockTemplate>(`/api/admin/blocks/${blockId}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function updateAdminBlock(
	blockId: number,
	payload: Partial<BlockUpsertPayload>,
	nextPath = '/admin/blocks'
) {
	return apiFetch<BlockTemplate>(`/api/admin/blocks/${blockId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		nextPath,
	});
}

export function deleteAdminBlock(blockId: number, nextPath = '/admin/blocks') {
	return apiFetch<{ ok: boolean }>(`/api/admin/blocks/${blockId}`, {
		method: 'DELETE',
		nextPath,
	});
}
