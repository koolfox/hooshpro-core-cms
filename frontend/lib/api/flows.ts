import { apiFetch } from '@/lib/http';
import type { Flow, FlowListOut, FlowRunListOut, FlowTriggerResult } from '@/lib/types';

export type SortDir = 'asc' | 'desc';
export const FLOW_SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug', 'status', 'trigger_event', 'id'] as const;
export type FlowSort = (typeof FLOW_SORT_FIELDS)[number];

export const DEFAULT_FLOW_SORT: FlowSort = 'updated_at';
export const DEFAULT_FLOW_DIR: SortDir = 'desc';

export type AdminFlowsListParams = {
	limit: number;
	offset: number;
	q?: string;
	status?: string;
	sort?: FlowSort;
	dir?: SortDir;
};

export type FlowUpsertPayload = {
	slug?: string;
	title?: string;
	description?: string | null;
	status?: 'draft' | 'active' | 'disabled';
	trigger_event?: string;
	definition?: {
		version: 1;
		nodes: Array<{ id: string; kind: 'trigger' | 'action'; label: string; config: Record<string, unknown> }>;
		edges: Array<{ source: string; target: string }>;
	};
};

export type FlowTriggerPayload = {
	event?: string;
	input?: Record<string, unknown>;
	context?: Record<string, unknown>;
};

export function buildAdminFlowsListUrl(params: AdminFlowsListParams): string {
	const sp = new URLSearchParams();
	sp.set('limit', String(params.limit));
	sp.set('offset', String(params.offset));
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.status?.trim() && params.status.trim().toLowerCase() !== 'all') sp.set('status', params.status.trim().toLowerCase());
	sp.set('sort', params.sort ?? DEFAULT_FLOW_SORT);
	sp.set('dir', params.dir ?? DEFAULT_FLOW_DIR);
	return `/api/admin/flows?${sp.toString()}`;
}

export function listAdminFlows(params: AdminFlowsListParams, nextPath = '/admin/flows') {
	return apiFetch<FlowListOut>(buildAdminFlowsListUrl(params), {
		cache: 'no-store',
		nextPath,
	});
}

export function createAdminFlow(payload: Required<Pick<FlowUpsertPayload, 'slug' | 'title'>> & FlowUpsertPayload, nextPath = '/admin/flows') {
	return apiFetch<Flow>('/api/admin/flows', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		cache: 'no-store',
		nextPath,
	});
}

export function updateAdminFlow(flowId: number, payload: FlowUpsertPayload, nextPath = '/admin/flows') {
	return apiFetch<Flow>(`/api/admin/flows/${flowId}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		cache: 'no-store',
		nextPath,
	});
}

export function deleteAdminFlow(flowId: number, nextPath = '/admin/flows') {
	return apiFetch<{ ok: boolean }>(`/api/admin/flows/${flowId}`, {
		method: 'DELETE',
		cache: 'no-store',
		nextPath,
	});
}

export function runAdminFlowTest(flowId: number, payload: FlowTriggerPayload, nextPath = '/admin/flows') {
	return apiFetch<FlowTriggerResult>(`/api/admin/flows/${flowId}/run-test`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		cache: 'no-store',
		nextPath,
	});
}

export function listAdminFlowRuns(flowId: number, limit = 20, offset = 0, nextPath = '/admin/flows') {
	const sp = new URLSearchParams();
	sp.set('limit', String(limit));
	sp.set('offset', String(offset));
	return apiFetch<FlowRunListOut>(`/api/admin/flows/${flowId}/runs?${sp.toString()}`, {
		cache: 'no-store',
		nextPath,
	});
}

export function triggerPublicFlow(slug: string, payload: FlowTriggerPayload) {
	return apiFetch<FlowTriggerResult>(`/api/public/flows/${encodeURIComponent(slug)}/trigger`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
		cache: 'no-store',
	});
}
