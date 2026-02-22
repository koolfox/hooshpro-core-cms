'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
	buildAdminFlowsListUrl,
	createAdminFlow,
	DEFAULT_FLOW_DIR,
	DEFAULT_FLOW_SORT,
	deleteAdminFlow,
	runAdminFlowTest,
	updateAdminFlow,
	type FlowSort,
	FLOW_SORT_FIELDS,
	listAdminFlowRuns,
} from '@/lib/api/flows';
import { useApiList } from '@/hooks/use-api-list';
import { formatUiError } from '@/lib/error-message';
import type { Flow, FlowListOut, FlowRun } from '@/lib/types';

import { AdminDataTable } from '@/components/admin/admin-data-table';
import { AdminListPage } from '@/components/admin/admin-list-page';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const LIMIT = 20;

type ViewStatus = 'all' | 'draft' | 'active' | 'disabled';
type SortDir = 'asc' | 'desc';

type DraftNode = {
	id: string;
	kind: 'trigger' | 'action';
	label: string;
	event: string;
	operation: 'noop' | 'set_output' | 'upsert_option' | 'create_entry';
	payloadJson: string;
};

type DraftEdge = {
	source: string;
	target: string;
};

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : Number.NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseStatusParam(value: string | null): ViewStatus {
	const v = (value ?? '').trim().toLowerCase();
	if (v === 'draft' || v === 'active' || v === 'disabled') return v;
	return 'all';
}

function parseSortParam(value: string | null): FlowSort {
	const v = (value ?? '').trim().toLowerCase();
	if ((FLOW_SORT_FIELDS as readonly string[]).includes(v)) return v as FlowSort;
	return DEFAULT_FLOW_SORT;
}

function parseDirParam(value: string | null): SortDir {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'asc' ? 'asc' : DEFAULT_FLOW_DIR;
}

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
}

function formatIso(iso: string) {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
	} catch {
		return iso;
	}
}

function defaultDraftNodes(): DraftNode[] {
	return [
		{
			id: 'start',
			kind: 'trigger',
			label: 'Start',
			event: 'contact.submit',
			operation: 'noop',
			payloadJson: '{}',
		},
		{
			id: 'save',
			kind: 'action',
			label: 'Save submission',
			event: '',
			operation: 'create_entry',
			payloadJson: JSON.stringify(
				{
					content_type_slug: 'contact_submissions',
					title: 'Contact from {{input.name}}',
					slug: 'contact-{{timestamp}}-{{random6}}',
					status: 'draft',
					data: {
						name: '{{input.name}}',
						email: '{{input.email}}',
						message: '{{input.message}}',
					},
				},
				null,
				2
			),
		},
		{
			id: 'response',
			kind: 'action',
			label: 'Set response',
			event: '',
			operation: 'set_output',
			payloadJson: JSON.stringify(
				{
					values: {
						message: 'Thanks, we received your request.',
					},
				},
				null,
				2
			),
		},
	];
}

function defaultDraftEdges(): DraftEdge[] {
	return [
		{ source: 'start', target: 'save' },
		{ source: 'save', target: 'response' },
	];
}

function hydrateDraftNodes(flow: Flow): DraftNode[] {
	return (flow.definition?.nodes ?? []).map((n) => {
		const kind = n.kind === 'action' ? 'action' : 'trigger';
		const config = n.config ?? {};
		if (kind === 'trigger') {
			return {
				id: n.id,
				kind,
				label: n.label ?? n.id,
				event: typeof config['event'] === 'string' ? String(config['event']) : '',
				operation: 'noop',
				payloadJson: '{}',
			};
		}

		const operation =
			typeof config['operation'] === 'string'
				? (String(config['operation']) as DraftNode['operation'])
				: 'noop';
		const payload = { ...config } as Record<string, unknown>;
		delete payload.operation;

		return {
			id: n.id,
			kind,
			label: n.label ?? n.id,
			event: '',
			operation,
			payloadJson: JSON.stringify(payload, null, 2),
		};
	});
}

function hydrateDraftEdges(flow: Flow): DraftEdge[] {
	return (flow.definition?.edges ?? []).map((e) => ({ source: e.source, target: e.target }));
}

function buildDefinition(nodes: DraftNode[], edges: DraftEdge[]) {
	const nodeIds = new Set<string>();
	const outNodes = nodes.map((n) => {
		const id = n.id.trim();
		if (!id) throw new Error('Node id cannot be empty.');
		if (nodeIds.has(id)) throw new Error(`Duplicate node id '${id}'.`);
		nodeIds.add(id);

		const label = n.label.trim() || id;
		if (n.kind === 'trigger') {
			const config: Record<string, unknown> = {};
			if (n.event.trim()) config.event = n.event.trim().toLowerCase();
			return { id, kind: 'trigger' as const, label, config };
		}

		let payload: Record<string, unknown> = {};
		const text = n.payloadJson.trim();
		if (text) {
			const parsed = JSON.parse(text);
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new Error(`Node '${id}' payload must be a JSON object.`);
			}
			payload = parsed as Record<string, unknown>;
		}
		return {
			id,
			kind: 'action' as const,
			label,
			config: {
				operation: n.operation,
				...payload,
			},
		};
	});

	const outEdges = edges.map((e, idx) => {
		const source = e.source.trim();
		const target = e.target.trim();
		if (!source || !target) throw new Error(`Edge #${idx + 1} requires source and target.`);
		if (!nodeIds.has(source)) throw new Error(`Edge #${idx + 1} source '${source}' does not exist.`);
		if (!nodeIds.has(target)) throw new Error(`Edge #${idx + 1} target '${target}' does not exist.`);
		return { source, target };
	});

	return {
		version: 1 as const,
		nodes: outNodes,
		edges: outEdges,
	};
}

export default function AdminFlowsPage() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlStatus = parseStatusParam(searchParams.get('status'));
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;
	const urlSort = parseSortParam(searchParams.get('sort'));
	const urlDir = parseDirParam(searchParams.get('dir'));

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [statusInput, setStatusInput] = useState<ViewStatus>(urlStatus);
	const [sortInput, setSortInput] = useState<FlowSort>(urlSort);
	const [dirInput, setDirInput] = useState<SortDir>(urlDir);

	const [q, setQ] = useState(urlQ);
	const [status, setStatus] = useState<ViewStatus>(urlStatus);
	const [sort, setSort] = useState<FlowSort>(urlSort);
	const [dir, setDir] = useState<SortDir>(urlDir);

	const qRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setStatus(urlStatus);
		setSort(urlSort);
		setDir(urlDir);
		setQInput(urlQ);
		setStatusInput(urlStatus);
		setSortInput(urlSort);
		setDirInput(urlDir);
	}, [urlOffset, urlQ, urlStatus, urlSort, urlDir]);

	function updateUrl(next: {
		page?: number;
		q?: string;
		status?: ViewStatus;
		sort?: FlowSort;
		dir?: SortDir;
	}) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

		const nextStatus = next.status ?? parseStatusParam(params.get('status'));
		if (nextStatus !== 'all') params.set('status', nextStatus);
		else params.delete('status');

		const nextSort = next.sort ?? parseSortParam(params.get('sort'));
		const nextDir = next.dir ?? parseDirParam(params.get('dir'));
		if (nextSort === DEFAULT_FLOW_SORT && nextDir === DEFAULT_FLOW_DIR) {
			params.delete('sort');
			params.delete('dir');
		} else {
			params.set('sort', nextSort);
			params.set('dir', nextDir);
		}

		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname);
	}

	function goToOffset(nextOffset: number) {
		const safeOffset = Math.max(0, Math.floor(nextOffset / LIMIT) * LIMIT);
		setOffset(safeOffset);
		updateUrl({ page: safeOffset / LIMIT + 1 });
	}

	const listUrl = useMemo(
		() =>
			buildAdminFlowsListUrl({
				limit: LIMIT,
				offset,
				q,
				status,
				sort: sort !== DEFAULT_FLOW_SORT || dir !== DEFAULT_FLOW_DIR ? sort : undefined,
				dir: sort !== DEFAULT_FLOW_SORT || dir !== DEFAULT_FLOW_DIR ? dir : undefined,
			}),
		[offset, q, status, sort, dir]
	);

	const { data, loading, error, reload } = useApiList<FlowListOut>(listUrl, {
		nextPath: '/admin/flows',
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	function applyFilters() {
		const nextQ = qInput.trim();
		setOffset(0);
		setQ(nextQ);
		setStatus(statusInput);
		setSort(sortInput);
		setDir(dirInput);
		updateUrl({ page: 1, q: nextQ, status: statusInput, sort: sortInput, dir: dirInput });
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setStatusInput('all');
		setSortInput(DEFAULT_FLOW_SORT);
		setDirInput(DEFAULT_FLOW_DIR);
		setQ('');
		setStatus('all');
		setSort(DEFAULT_FLOW_SORT);
		setDir(DEFAULT_FLOW_DIR);
		updateUrl({ page: 1, q: '', status: 'all', sort: DEFAULT_FLOW_SORT, dir: DEFAULT_FLOW_DIR });
		qRef.current?.focus();
	}

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<Flow | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [flowStatus, setFlowStatus] = useState<'draft' | 'active' | 'disabled'>('draft');
	const [triggerEvent, setTriggerEvent] = useState('contact.submit');
	const [nodes, setNodes] = useState<DraftNode[]>(defaultDraftNodes());
	const [edges, setEdges] = useState<DraftEdge[]>(defaultDraftEdges());

	const [formError, setFormError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<Flow | null>(null);

	const [testFlow, setTestFlow] = useState<Flow | null>(null);
	const [testEvent, setTestEvent] = useState('contact.submit');
	const [testInputJson, setTestInputJson] = useState(JSON.stringify({ name: 'John Doe', email: 'john@company.com', message: 'Need a quote.' }, null, 2));
	const [testContextJson, setTestContextJson] = useState('{}');
	const [testOutput, setTestOutput] = useState('');
	const [testLoading, setTestLoading] = useState(false);
	const [testError, setTestError] = useState<string | null>(null);
	const [runs, setRuns] = useState<FlowRun[]>([]);

	function openCreate() {
		setEditing(null);
		setTitle('');
		setSlug('');
		setDescription('');
		setFlowStatus('draft');
		setTriggerEvent('contact.submit');
		setNodes(defaultDraftNodes());
		setEdges(defaultDraftEdges());
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(flow: Flow) {
		setEditing(flow);
		setTitle(flow.title);
		setSlug(flow.slug);
		setDescription(flow.description ?? '');
		setFlowStatus(flow.status);
		setTriggerEvent(flow.trigger_event);
		setNodes(hydrateDraftNodes(flow));
		setEdges(hydrateDraftEdges(flow));
		setFormError(null);
		setEditorOpen(true);
	}

	function addNode(kind: 'trigger' | 'action') {
		const base = kind === 'trigger' ? 'trigger' : 'action';
		let i = 1;
		const taken = new Set(nodes.map((n) => n.id));
		let id = `${base}-${i}`;
		while (taken.has(id)) {
			i += 1;
			id = `${base}-${i}`;
		}
		setNodes((prev) => [
			...prev,
			{
				id,
				kind,
				label: id,
				event: kind === 'trigger' ? triggerEvent : '',
				operation: 'noop',
				payloadJson: '{}',
			},
		]);
	}

	function addEdge() {
		if (nodes.length < 2) return;
		setEdges((prev) => [
			...prev,
			{ source: nodes[0]?.id ?? '', target: nodes[1]?.id ?? '' },
		]);
	}

	function removeNode(id: string) {
		setNodes((prev) => prev.filter((n) => n.id !== id));
		setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
	}

	async function saveFlow() {
		setSaving(true);
		setFormError(null);
		try {
			const definition = buildDefinition(nodes, edges);
			if (editing) {
				await updateAdminFlow(
					editing.id,
					{
						title: title.trim(),
						description: description.trim() ? description.trim() : null,
						status: flowStatus,
						trigger_event: triggerEvent.trim().toLowerCase(),
						definition,
					},
					'/admin/flows'
				);
			} else {
				await createAdminFlow(
					{
						slug: slug.trim(),
						title: title.trim(),
						description: description.trim() ? description.trim() : null,
						status: flowStatus,
						trigger_event: triggerEvent.trim().toLowerCase(),
						definition,
					},
					'/admin/flows'
				);
			}
			setEditorOpen(false);
			setActionError(null);
			await reload();
		} catch (e) {
			setFormError(toErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(flow: Flow) {
		try {
			await deleteAdminFlow(flow.id, '/admin/flows');
			setConfirmDelete(null);
			setActionError(null);
			const nextTotal = Math.max(0, total - 1);
			const lastOffset = Math.max(0, Math.floor(Math.max(0, nextTotal - 1) / LIMIT) * LIMIT);
			const nextOffset = Math.min(offset, lastOffset);
			goToOffset(nextOffset);
			if (nextOffset === offset) await reload();
		} catch (e) {
			setActionError(toErrorMessage(e));
		}
	}

	async function openTester(flow: Flow) {
		setTestFlow(flow);
		setTestEvent(flow.trigger_event || 'manual');
		setTestError(null);
		setTestOutput('');
		try {
			const out = await listAdminFlowRuns(flow.id, 10, 0, '/admin/flows');
			setRuns(out.items);
		} catch {
			setRuns([]);
		}
	}

	async function runTest() {
		if (!testFlow) return;
		setTestLoading(true);
		setTestError(null);
		setTestOutput('');

		try {
			const input = testInputJson.trim() ? JSON.parse(testInputJson) : {};
			const context = testContextJson.trim() ? JSON.parse(testContextJson) : {};
			if (!input || typeof input !== 'object' || Array.isArray(input)) {
				throw new Error('Input payload must be a JSON object.');
			}
			if (!context || typeof context !== 'object' || Array.isArray(context)) {
				throw new Error('Context payload must be a JSON object.');
			}

			const result = await runAdminFlowTest(
				testFlow.id,
				{ event: testEvent.trim(), input, context },
				'/admin/flows'
			);
			setTestOutput(JSON.stringify(result, null, 2));
			const out = await listAdminFlowRuns(testFlow.id, 10, 0, '/admin/flows');
			setRuns(out.items);
		} catch (e) {
			setTestError(toErrorMessage(e));
		} finally {
			setTestLoading(false);
		}
	}

	return (
		<AdminListPage
			title='Flows'
			description='Automation workflows for forms, confirmations, and CMS actions (N8N-style MVP).'
			actions={
				<Button onClick={openCreate} disabled={loading}>New flow</Button>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-4 space-y-2'>
						<Label>Search</Label>
						<Input
							ref={qRef}
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search by title or slug...'
							onKeyDown={(e) => {
								if (e.key === 'Enter') applyFilters();
								if (e.key === 'Escape') resetFilters();
							}}
						/>
					</div>

					<div className='md:col-span-2 space-y-2'>
						<Label>Status</Label>
						<Select value={statusInput} onValueChange={(v) => setStatusInput(v as ViewStatus)} disabled={loading}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All</SelectItem>
								<SelectItem value='draft'>draft</SelectItem>
								<SelectItem value='active'>active</SelectItem>
								<SelectItem value='disabled'>disabled</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className='md:col-span-3 space-y-2'>
						<Label>Sort</Label>
						<Select value={sortInput} onValueChange={(v) => setSortInput(v as FlowSort)} disabled={loading}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value='updated_at'>Updated</SelectItem>
								<SelectItem value='created_at'>Created</SelectItem>
								<SelectItem value='title'>Title</SelectItem>
								<SelectItem value='slug'>Slug</SelectItem>
								<SelectItem value='status'>Status</SelectItem>
								<SelectItem value='trigger_event'>Trigger Event</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className='md:col-span-3 space-y-2'>
						<Label>Order</Label>
						<Select value={dirInput} onValueChange={(v) => setDirInput(v as SortDir)} disabled={loading}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value='desc'>desc</SelectItem>
								<SelectItem value='asc'>asc</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className='md:col-span-12 flex justify-end gap-2'>
						<Button variant='outline' onClick={resetFilters} disabled={loading}>Reset</Button>
						<Button onClick={applyFilters} disabled={loading}>Apply</Button>
					</div>
				</div>
			}
			total={total}
			offset={offset}
			limit={LIMIT}
			loading={loading}
			onPrev={() => goToOffset(offset - LIMIT)}
			onNext={() => goToOffset(offset + LIMIT)}
			onSetOffset={goToOffset}>
			{loading ? <p className='text-sm text-muted-foreground'>Loading…</p> : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}
			{actionError ? <p className='text-sm text-red-600'>{actionError}</p> : null}

			<AdminDataTable
				rows={items}
				getRowKey={(f) => f.id}
				columns={[
					{
						header: 'Flow',
						cell: (f) => (
							<div className='space-y-1'>
								<div className='font-medium'>{f.title}</div>
								<div className='text-xs text-muted-foreground'>/{f.slug}</div>
								{f.description ? <div className='text-xs text-muted-foreground line-clamp-2'>{f.description}</div> : null}
							</div>
						),
					},
					{
						header: 'Status',
						cell: (f) => (
							<Badge variant={f.status === 'active' ? 'secondary' : f.status === 'disabled' ? 'outline' : 'default'}>
								{f.status}
							</Badge>
						),
						headerClassName: 'w-[130px]',
					},
					{
						header: 'Trigger',
						cell: (f) => <code className='text-xs'>{f.trigger_event}</code>,
						headerClassName: 'w-[180px]',
					},
					{
						header: 'Graph',
						cell: (f) => (
							<span className='text-sm text-muted-foreground'>
								{f.definition?.nodes?.length ?? 0} nodes / {f.definition?.edges?.length ?? 0} edges
							</span>
						),
						headerClassName: 'w-[170px]',
					},
					{
						header: 'Updated',
						cell: (f) => <span className='text-xs text-muted-foreground'>{formatIso(f.updated_at)}</span>,
						headerClassName: 'w-[220px]',
					},
					{
						header: '',
						cell: (f) => (
							<div className='flex justify-end items-center gap-2'>
								<Button size='sm' variant='outline' onClick={() => openTester(f)}>Run test</Button>
								<Button size='sm' variant='outline' onClick={() => openEdit(f)}>Edit</Button>
								<Button size='sm' variant='destructive' onClick={() => setConfirmDelete(f)}>Delete</Button>
							</div>
						),
						headerClassName: 'w-[320px]',
						cellClassName: 'text-right',
					},
				]}
			/>

			<Dialog
				open={editorOpen}
				onOpenChange={(open) => {
					setEditorOpen(open);
					if (!open) setEditing(null);
				}}>
				<DialogContent className='sm:max-w-6xl max-h-[92svh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit flow' : 'New flow'}</DialogTitle>
						<DialogDescription>
							Create automation graphs for real product workflows (contact forms, CMS updates, confirmations).
						</DialogDescription>
					</DialogHeader>

					<div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
						<div className='space-y-4 lg:col-span-1'>
							<div className='space-y-2'>
								<Label>Title</Label>
								<Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
							</div>
							<div className='space-y-2'>
								<Label>Slug</Label>
								<Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={saving || !!editing} />
								{editing ? <p className='text-xs text-muted-foreground'>Slug is immutable to keep integrations stable.</p> : null}
							</div>
							<div className='space-y-2'>
								<Label>Status</Label>
								<Select value={flowStatus} onValueChange={(v) => setFlowStatus(v as 'draft' | 'active' | 'disabled')} disabled={saving}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value='draft'>draft</SelectItem>
										<SelectItem value='active'>active</SelectItem>
										<SelectItem value='disabled'>disabled</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className='space-y-2'>
								<Label>Default trigger event</Label>
								<Input value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)} disabled={saving} placeholder='contact.submit' />
							</div>
							<div className='space-y-2'>
								<Label>Description</Label>
								<Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} rows={4} />
							</div>
							<Button variant='secondary' onClick={() => {
								setNodes(defaultDraftNodes());
								setEdges(defaultDraftEdges());
								setTriggerEvent('contact.submit');
							}} disabled={saving}>
								Load contact-us starter
							</Button>
						</div>

						<div className='space-y-4 lg:col-span-3'>
							<div className='flex items-center justify-between'>
								<h3 className='text-sm font-semibold'>Nodes</h3>
								<div className='flex gap-2'>
									<Button size='sm' variant='outline' onClick={() => addNode('trigger')} disabled={saving}>+ Trigger</Button>
									<Button size='sm' variant='outline' onClick={() => addNode('action')} disabled={saving}>+ Action</Button>
								</div>
							</div>
							<div className='space-y-3'>
								{nodes.map((node, idx) => (
									<div key={`${node.id}-${idx}`} className='rounded-xl border p-3 space-y-3'>
										<div className='grid grid-cols-1 md:grid-cols-12 gap-2'>
											<div className='md:col-span-3 space-y-1'>
												<Label>ID</Label>
												<Input value={node.id} onChange={(e) => setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, id: e.target.value } : n))} disabled={saving} />
											</div>
											<div className='md:col-span-3 space-y-1'>
												<Label>Kind</Label>
												<Select value={node.kind} onValueChange={(v) => setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, kind: v as 'trigger' | 'action' } : n))} disabled={saving}>
													<SelectTrigger><SelectValue /></SelectTrigger>
													<SelectContent>
														<SelectItem value='trigger'>trigger</SelectItem>
														<SelectItem value='action'>action</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className='md:col-span-5 space-y-1'>
												<Label>Label</Label>
												<Input value={node.label} onChange={(e) => setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, label: e.target.value } : n))} disabled={saving} />
											</div>
											<div className='md:col-span-1 flex items-end'>
												<Button size='sm' variant='destructive' onClick={() => removeNode(node.id)} disabled={saving}>×</Button>
											</div>
										</div>

										{node.kind === 'trigger' ? (
											<div className='space-y-1'>
												<Label>Trigger event</Label>
												<Input value={node.event} onChange={(e) => setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, event: e.target.value } : n))} placeholder='contact.submit or *' disabled={saving} />
											</div>
										) : (
											<div className='space-y-2'>
												<div className='space-y-1'>
													<Label>Operation</Label>
													<Select value={node.operation} onValueChange={(v) => setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, operation: v as DraftNode['operation'] } : n))} disabled={saving}>
														<SelectTrigger><SelectValue /></SelectTrigger>
														<SelectContent>
															<SelectItem value='noop'>noop</SelectItem>
															<SelectItem value='set_output'>set_output</SelectItem>
															<SelectItem value='upsert_option'>upsert_option</SelectItem>
															<SelectItem value='create_entry'>create_entry</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div className='space-y-1'>
													<Label>Payload JSON (operation params)</Label>
													<Textarea value={node.payloadJson} onChange={(e) => setNodes((prev) => prev.map((n, i) => i === idx ? { ...n, payloadJson: e.target.value } : n))} className='font-mono text-xs min-h-[120px]' disabled={saving} />
												</div>
											</div>
										)}
									</div>
								))}
							</div>

							<div className='flex items-center justify-between pt-2'>
								<h3 className='text-sm font-semibold'>Edges</h3>
								<Button size='sm' variant='outline' onClick={addEdge} disabled={saving || nodes.length < 2}>+ Edge</Button>
							</div>
							<div className='space-y-2'>
								{edges.map((edge, idx) => (
									<div key={`${edge.source}-${edge.target}-${idx}`} className='grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border p-2'>
										<div className='md:col-span-5 space-y-1'>
											<Label>Source</Label>
											<Select value={edge.source} onValueChange={(v) => setEdges((prev) => prev.map((e, i) => i === idx ? { ...e, source: v } : e))} disabled={saving}>
												<SelectTrigger><SelectValue /></SelectTrigger>
												<SelectContent>
													{nodes.map((n) => <SelectItem key={`${idx}-source-${n.id}`} value={n.id}>{n.id}</SelectItem>)}
												</SelectContent>
											</Select>
										</div>
										<div className='md:col-span-5 space-y-1'>
											<Label>Target</Label>
											<Select value={edge.target} onValueChange={(v) => setEdges((prev) => prev.map((e, i) => i === idx ? { ...e, target: v } : e))} disabled={saving}>
												<SelectTrigger><SelectValue /></SelectTrigger>
												<SelectContent>
													{nodes.map((n) => <SelectItem key={`${idx}-target-${n.id}`} value={n.id}>{n.id}</SelectItem>)}
												</SelectContent>
											</Select>
										</div>
										<div className='md:col-span-2 flex items-end justify-end'>
											<Button size='sm' variant='destructive' onClick={() => setEdges((prev) => prev.filter((_, i) => i !== idx))} disabled={saving}>×</Button>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}

					<DialogFooter>
						<Button variant='outline' onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
						<Button onClick={saveFlow} disabled={saving || !title.trim() || (!editing && !slug.trim()) || !triggerEvent.trim()}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!testFlow} onOpenChange={(open) => !open && setTestFlow(null)}>
				<DialogContent className='sm:max-w-4xl max-h-[92svh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>Run flow test: {testFlow?.title}</DialogTitle>
						<DialogDescription>
							Execute the flow with sample input and inspect output before publishing.
						</DialogDescription>
					</DialogHeader>

					<div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
						<div className='space-y-3'>
							<div className='space-y-2'>
								<Label>Event</Label>
								<Input value={testEvent} onChange={(e) => setTestEvent(e.target.value)} disabled={testLoading} />
							</div>
							<div className='space-y-2'>
								<Label>Input JSON</Label>
								<Textarea value={testInputJson} onChange={(e) => setTestInputJson(e.target.value)} className='font-mono text-xs min-h-[180px]' disabled={testLoading} />
							</div>
							<div className='space-y-2'>
								<Label>Context JSON</Label>
								<Textarea value={testContextJson} onChange={(e) => setTestContextJson(e.target.value)} className='font-mono text-xs min-h-[120px]' disabled={testLoading} />
							</div>
							{testError ? <p className='text-sm text-red-600'>{testError}</p> : null}
							<Button onClick={runTest} disabled={testLoading || !testFlow}>{testLoading ? 'Running…' : 'Run test'}</Button>
						</div>

						<div className='space-y-3'>
							<div className='space-y-2'>
								<Label>Result</Label>
								<Textarea value={testOutput} readOnly className='font-mono text-xs min-h-[260px]' />
							</div>
							<div className='space-y-2'>
								<Label>Recent runs</Label>
								<div className='rounded-xl border divide-y max-h-[220px] overflow-auto'>
									{runs.length ? runs.map((run) => (
										<div key={run.id} className='p-2 text-xs flex items-center justify-between gap-2'>
											<div className='flex items-center gap-2'>
												<Badge variant={run.status === 'success' ? 'secondary' : 'destructive'}>{run.status}</Badge>
												<span>Run #{run.id}</span>
											</div>
											<span className='text-muted-foreground'>{formatIso(run.created_at)}</span>
										</div>
									)) : <p className='p-3 text-xs text-muted-foreground'>No runs yet.</p>}
								</div>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={() => setTestFlow(null)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete flow?</AlertDialogTitle>
						<AlertDialogDescription>
							This will delete <strong>{confirmDelete?.title}</strong> and its run history.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
						<AlertDialogAction disabled={loading || !confirmDelete} onClick={() => { if (confirmDelete) void doDelete(confirmDelete); }}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AdminListPage>
	);
}
