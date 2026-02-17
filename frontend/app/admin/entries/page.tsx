'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type {
	ContentEntry,
	ContentEntryListOut,
	ContentType,
} from '@/lib/types';
import { buildAdminEntriesListUrl, createAdminEntry, deleteAdminEntry, listAdminContentTypes, updateAdminEntry } from '@/lib/api/content';
import { useApiList } from '@/hooks/use-api-list';

import { AdminListPage } from '@/components/admin/admin-list-page';
import { AdminDataTable } from '@/components/admin/admin-data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatUiError } from '@/lib/error-message';

const LIMIT = 20;
const EMPTY: ContentEntry[] = [];

type StatusFilter = 'all' | 'draft' | 'published';
type SortDir = 'asc' | 'desc';

const SORT_FIELDS = ['updated_at', 'created_at', 'published_at', 'title', 'slug', 'status', 'order_index', 'id'] as const;
type SortField = (typeof SORT_FIELDS)[number];
const DEFAULT_SORT: SortField = 'updated_at';
const DEFAULT_DIR: SortDir = 'desc';

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseSortParam(value: string | null): SortField {
	const v = (value ?? '').trim().toLowerCase();
	if ((SORT_FIELDS as readonly string[]).includes(v)) return v as SortField;
	return DEFAULT_SORT;
}

function parseDirParam(value: string | null): SortDir {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'asc' ? 'asc' : DEFAULT_DIR;
}

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
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

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
}

export default function AdminEntriesPage() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlType = (searchParams.get('type') ?? '').trim();
	const urlStatusRaw = (searchParams.get('status') ?? 'all').trim();
	const urlStatus: StatusFilter =
		urlStatusRaw === 'draft' || urlStatusRaw === 'published' ? urlStatusRaw : 'all';
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;
	const urlSort = parseSortParam(searchParams.get('sort'));
	const urlDir = parseDirParam(searchParams.get('dir'));

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [typeInput, setTypeInput] = useState(urlType);
	const [statusInput, setStatusInput] = useState<StatusFilter>(urlStatus);
	const [sortInput, setSortInput] = useState<SortField>(urlSort);
	const [dirInput, setDirInput] = useState<SortDir>(urlDir);

	const [q, setQ] = useState(urlQ);
	const [type, setType] = useState(urlType);
	const [status, setStatus] = useState<StatusFilter>(urlStatus);
	const [sort, setSort] = useState<SortField>(urlSort);
	const [dir, setDir] = useState<SortDir>(urlDir);

	const qRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setType(urlType);
		setStatus(urlStatus);
		setSort(urlSort);
		setDir(urlDir);

		setQInput(urlQ);
		setTypeInput(urlType);
		setStatusInput(urlStatus);
		setSortInput(urlSort);
		setDirInput(urlDir);
	}, [urlOffset, urlQ, urlType, urlStatus, urlSort, urlDir]);

	function updateUrl(next: {
		page?: number;
		q?: string;
		type?: string;
		status?: StatusFilter;
		sort?: SortField;
		dir?: SortDir;
	}) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

		const nextType = (next.type ?? params.get('type') ?? '').trim();
		if (nextType) params.set('type', nextType);
		else params.delete('type');

		const rawStatus = (next.status ?? (params.get('status') ?? 'all')).trim();
		const nextStatus: StatusFilter =
			rawStatus === 'draft' || rawStatus === 'published' ? rawStatus : 'all';
		if (nextStatus !== 'all') params.set('status', nextStatus);
		else params.delete('status');

		const nextSort = parseSortParam(next.sort ?? params.get('sort'));
		const nextDir = parseDirParam(next.dir ?? params.get('dir'));

		if (nextSort === DEFAULT_SORT && nextDir === DEFAULT_DIR) {
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

	const listUrl = useMemo(() => {
		return buildAdminEntriesListUrl({
			limit: LIMIT,
			offset,
			q,
			type,
			status,
			sort,
			dir,
		});
	}, [offset, q, type, status, sort, dir]);

	const { data, loading, error, reload, setData } = useApiList<ContentEntryListOut>(listUrl, {
		nextPath: '/admin/entries',
	});

	const items = data?.items ?? EMPTY;
	const total = data?.total ?? 0;

	const [types, setTypes] = useState<ContentType[]>([]);
	const [typesError, setTypesError] = useState<string | null>(null);

	useEffect(() => {
		let canceled = false;
		async function loadTypes() {
			setTypesError(null);
			try {
				const out = await listAdminContentTypes({ limit: 200, offset: 0 }, '/admin/entries');
				if (canceled) return;
				setTypes(out.items ?? []);
			} catch (e) {
				if (canceled) return;
				setTypesError(toErrorMessage(e));
				setTypes([]);
			}
		}
		void loadTypes();
		return () => {
			canceled = true;
		};
	}, []);

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<ContentEntry | null>(null);
	const [entryType, setEntryType] = useState('');
	const [entryTitle, setEntryTitle] = useState('');
	const [entrySlug, setEntrySlug] = useState('');
	const [entryStatus, setEntryStatus] = useState<'draft' | 'published'>('draft');
	const [entryOrder, setEntryOrder] = useState(0);
	const [entryDataRaw, setEntryDataRaw] = useState('{}');

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<ContentEntry | null>(null);

	function applyFilters() {
		const nextQ = qInput.trim();
		const nextType = typeInput.trim();
		const nextStatus = statusInput;
		const nextSort = sortInput;
		const nextDir = dirInput;

		setOffset(0);
		setQ(nextQ);
		setType(nextType);
		setStatus(nextStatus);
		setSort(nextSort);
		setDir(nextDir);
		updateUrl({ page: 1, q: nextQ, type: nextType, status: nextStatus, sort: nextSort, dir: nextDir });
	}

	function resetFilters() {
		setOffset(0);
		setQ('');
		setType('');
		setStatus('all');
		setSort(DEFAULT_SORT);
		setDir(DEFAULT_DIR);

		setQInput('');
		setTypeInput('');
		setStatusInput('all');
		setSortInput(DEFAULT_SORT);
		setDirInput(DEFAULT_DIR);

		updateUrl({ page: 1, q: '', type: '', status: 'all', sort: DEFAULT_SORT, dir: DEFAULT_DIR });
		window.requestAnimationFrame(() => qRef.current?.focus());
	}

	function openCreate() {
		setEditing(null);
		setEntryType(type.trim() || (types[0]?.slug ?? ''));
		setEntryTitle('');
		setEntrySlug('');
		setEntryStatus('draft');
		setEntryOrder(0);
		setEntryDataRaw('{}');
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(e: ContentEntry) {
		setEditing(e);
		setEntryType(e.content_type_slug);
		setEntryTitle(e.title);
		setEntrySlug(e.slug);
		setEntryStatus(e.status);
		setEntryOrder(e.order_index ?? 0);
		setEntryDataRaw(JSON.stringify(e.data ?? {}, null, 2));
		setFormError(null);
		setEditorOpen(true);
	}

	async function save() {
		setSaving(true);
		setFormError(null);

		let dataJson: Record<string, unknown> = {};
		try {
			const raw = entryDataRaw.trim();
			if (raw) dataJson = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			setSaving(false);
			setFormError('Data must be valid JSON.');
			return;
		}

		const payloadCreate = {
			content_type_slug: entryType.trim(),
			title: entryTitle.trim(),
			slug: entrySlug.trim() || slugify(entryTitle),
			status: entryStatus,
			order_index: Math.round(Number(entryOrder) || 0),
			data: dataJson,
		};

		try {
			if (editing) {
				const out = await updateAdminEntry(
					editing.id,
					{
						title: payloadCreate.title,
						slug: payloadCreate.slug,
						status: payloadCreate.status,
						order_index: payloadCreate.order_index,
						data: payloadCreate.data,
					},
					'/admin/entries'
				);

				setData((prev) => {
					if (!prev) return prev;
					return { ...prev, items: prev.items.map((x) => (x.id === out.id ? out : x)) };
				});
			} else {
				const out = await createAdminEntry(payloadCreate, '/admin/entries');
				await reload();
				router.push(`/admin/entries?type=${encodeURIComponent(out.content_type_slug)}`);
			}

			setEditorOpen(false);
			setEditing(null);
		} catch (e) {
			setFormError(toErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(e: ContentEntry) {
		setSaving(true);
		setFormError(null);
		try {
			await deleteAdminEntry(e.id, '/admin/entries');
			setConfirmDelete(null);
			await reload();
		} catch (err) {
			setFormError(toErrorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<AdminListPage
			title='Entries'
			description='Create and manage collection entries (dynamic content).'
			total={total}
			offset={offset}
			limit={LIMIT}
			loading={loading}
			onPrev={() => goToOffset(offset - LIMIT)}
			onNext={() => goToOffset(offset + LIMIT)}
			onSetOffset={goToOffset}
			actions={
				<Button onClick={openCreate} disabled={types.length === 0}>
					New entry
				</Button>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3'>
					<div className='md:col-span-4 space-y-1'>
						<Label>Search</Label>
						<Input
							ref={qRef}
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search title or slug…'
						/>
					</div>
					<div className='md:col-span-3 space-y-1'>
						<Label>Type</Label>
						<Select value={typeInput || 'all'} onValueChange={(v) => setTypeInput(v === 'all' ? '' : v)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>all</SelectItem>
								{types.map((t) => (
									<SelectItem key={t.slug} value={t.slug}>
										{t.title} ({t.slug})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className='md:col-span-2 space-y-1'>
						<Label>Status</Label>
						<Select value={statusInput} onValueChange={(v) => setStatusInput(v as StatusFilter)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>all</SelectItem>
								<SelectItem value='draft'>draft</SelectItem>
								<SelectItem value='published'>published</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='md:col-span-2 space-y-1'>
						<Label>Sort</Label>
						<Select value={sortInput} onValueChange={(v) => setSortInput(parseSortParam(v))}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SORT_FIELDS.map((f) => (
									<SelectItem key={f} value={f}>
										{f}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className='md:col-span-1 space-y-1'>
						<Label>Dir</Label>
						<Select value={dirInput} onValueChange={(v) => setDirInput(parseDirParam(v))}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='desc'>desc</SelectItem>
								<SelectItem value='asc'>asc</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className='md:col-span-12 flex flex-wrap items-center gap-2 justify-end'>
						<Button
							variant='outline'
							onClick={applyFilters}
							disabled={loading}>
							Apply
						</Button>
						<Button
							variant='outline'
							onClick={resetFilters}
							disabled={loading}>
							Reset
						</Button>
					</div>
				</div>
			}>
			{typesError ? <p className='text-sm text-red-600'>{typesError}</p> : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}
			{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}

			<AdminDataTable
				rows={items}
				getRowKey={(it) => it.id}
				emptyText={loading ? 'Loading…' : 'No entries yet.'}
				columns={[
					{
						header: 'Title',
						cell: (it) => (
							<div className='min-w-0'>
								<div className='font-medium truncate'>{it.title}</div>
								<div className='text-xs text-muted-foreground truncate'>
									<Badge variant='secondary'>{it.content_type_slug}</Badge>
									<span className='mx-2'>·</span>
									<code>/{it.slug}</code>
								</div>
							</div>
						),
					},
					{
						header: 'Status',
						cell: (it) => (
							<Badge variant={it.status === 'published' ? 'default' : 'secondary'}>{it.status}</Badge>
						),
						headerClassName: 'w-[120px]',
					},
					{
						header: 'Updated',
						cell: (it) => (
							<span className='text-xs text-muted-foreground'>{formatIso(it.updated_at)}</span>
						),
						headerClassName: 'w-[190px]',
					},
					{
						header: <span className='sr-only'>Actions</span>,
						headerClassName: 'w-[190px] text-right',
						cellClassName: 'text-right',
						cell: (it) => (
							<div className='flex items-center justify-end gap-2'>
								<Button
									variant='outline'
									size='sm'
									onClick={() => openEdit(it)}>
									Edit
								</Button>
								<Button
									variant='destructive'
									size='sm'
									onClick={() => setConfirmDelete(it)}>
									Delete
								</Button>
							</div>
						),
					},
				]}
			/>

			<Dialog
				open={editorOpen}
				onOpenChange={(open) => {
					setEditorOpen(open);
					if (!open) setEditing(null);
				}}>
				<DialogContent className='sm:max-w-3xl max-h-[90svh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit entry' : 'New entry'}</DialogTitle>
						<DialogDescription>
							Entries are dynamic content used by blocks like <code>collection-list</code>.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						{types.length === 0 ? (
							<div className='rounded-md border bg-muted/10 p-3 text-sm text-muted-foreground'>
								Create a collection first in <Link href='/admin/collections' className='underline underline-offset-4'>Collections</Link>.
							</div>
						) : null}

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label>Collection</Label>
								<Select value={entryType || 'none'} onValueChange={(v) => setEntryType(v === 'none' ? '' : v)} disabled={saving || !!editing}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>Select…</SelectItem>
										{types.map((t) => (
											<SelectItem key={t.slug} value={t.slug}>
												{t.title} ({t.slug})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{editing ? (
									<p className='text-xs text-muted-foreground'>
										Collection is fixed for existing entries.
									</p>
								) : null}
							</div>

							<div className='space-y-2'>
								<Label>Status</Label>
								<Select value={entryStatus} onValueChange={(v) => setEntryStatus(v as 'draft' | 'published')} disabled={saving}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='draft'>draft</SelectItem>
										<SelectItem value='published'>published</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label>Title</Label>
								<Input
									value={entryTitle}
									onChange={(e) => {
										const nextTitle = e.target.value;
										setEntryTitle(nextTitle);
										if (!editing && !entrySlug.trim()) setEntrySlug(slugify(nextTitle));
									}}
									disabled={saving}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Slug</Label>
								<Input
									value={entrySlug}
									onChange={(e) => setEntrySlug(e.target.value)}
									placeholder='e.g. gold-ring'
									disabled={saving}
								/>
							</div>
						</div>

						<div className='space-y-2'>
							<Label>Order index</Label>
							<Input
								type='number'
								value={entryOrder}
								onChange={(e) => setEntryOrder(Number(e.target.value))}
								disabled={saving}
							/>
						</div>

						<div className='space-y-2'>
							<Label>Data (JSON)</Label>
							<Textarea
								value={entryDataRaw}
								onChange={(e) => setEntryDataRaw(e.target.value)}
								className='font-mono text-xs min-h-[240px]'
								disabled={saving}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setEditorOpen(false)}
							disabled={saving}>
							Cancel
						</Button>
						<Button
							onClick={() => void save()}
							disabled={saving || !entryType.trim() || !entryTitle.trim()}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!confirmDelete}
				onOpenChange={(open) => {
					if (!open) setConfirmDelete(null);
				}}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete entry?</AlertDialogTitle>
						<AlertDialogDescription>
							This deletes <strong>{confirmDelete?.title}</strong>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={saving || !confirmDelete}
							onClick={() => {
								if (confirmDelete) void doDelete(confirmDelete);
							}}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AdminListPage>
	);
}
