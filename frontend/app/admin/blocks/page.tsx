'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ApiError } from '@/lib/http';
import {
	buildAdminBlocksListUrl,
	createAdminBlock,
	deleteAdminBlock,
	updateAdminBlock,
} from '@/lib/api/blocks';
import type { BlockListOut, BlockTemplate } from '@/lib/types';
import {
	defaultPageBuilderState,
	parsePageBuilderState,
	serializePageBuilderState,
	type PageBuilderState,
	
	type PageNode,
} from '@/lib/page-builder';
import { useApiList } from '@/hooks/use-api-list';

import { AdminListPage } from '@/components/admin/admin-list-page';
import { AdminDataTable } from '@/components/admin/admin-data-table';
import { ClientOnly } from '@/components/client-only';
import { PageBuilder } from '@/components/page-builder/page-builder';

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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatUiError } from '@/lib/error-message';

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

const LIMIT = 30;
const EMPTY_BLOCKS: BlockTemplate[] = [];

type SortDir = 'asc' | 'desc';

const SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug'] as const;
type BlockSort = (typeof SORT_FIELDS)[number];
const DEFAULT_SORT: BlockSort = 'updated_at';
const DEFAULT_DIR: SortDir = 'desc';

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseSortParam(value: string | null): BlockSort {
	const v = (value ?? '').trim().toLowerCase();
	if ((SORT_FIELDS as readonly string[]).includes(v)) return v as BlockSort;
	return DEFAULT_SORT;
}

function parseDirParam(value: string | null): SortDir {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'asc' ? 'asc' : DEFAULT_DIR;
}

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
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

function getBlockStats(definition: unknown) {
	const state = parsePageBuilderState(definition);

	function walk(nodes: PageNode[]) {
		let nodesTotal = 0;
		let frames = 0;
		let items = 0;
		for (const n of nodes) {
			nodesTotal += 1;
			if (n.type === 'frame') frames += 1;
			else items += 1;

			if (Array.isArray(n.nodes)) {
				const nested = walk(n.nodes);
				nodesTotal += nested.nodesTotal;
				frames += nested.frames;
				items += nested.items;
			}
		}
		return { nodesTotal, frames, items };
	}

	return walk(state.nodes);
}

export default function AdminBlocksScreen() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;
	const urlSort = parseSortParam(searchParams.get('sort'));
	const urlDir = parseDirParam(searchParams.get('dir'));

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [sortInput, setSortInput] = useState<BlockSort>(urlSort);
	const [dirInput, setDirInput] = useState<SortDir>(urlDir);
	const [q, setQ] = useState(urlQ);
	const [sort, setSort] = useState<BlockSort>(urlSort);
	const [dir, setDir] = useState<SortDir>(urlDir);

	const qRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setQInput(urlQ);
		setSort(urlSort);
		setDir(urlDir);
		setSortInput(urlSort);
		setDirInput(urlDir);
	}, [urlOffset, urlQ, urlSort, urlDir]);

	function updateUrl(next: { page?: number; q?: string; sort?: BlockSort; dir?: SortDir }) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

		const rawSort = (next.sort ?? parseSortParam(params.get('sort'))).trim().toLowerCase();
		const nextSort = parseSortParam(rawSort);

		const rawDir = (next.dir ?? parseDirParam(params.get('dir'))).trim().toLowerCase();
		const nextDir: SortDir = rawDir === 'asc' ? 'asc' : DEFAULT_DIR;

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

	const listUrl = useMemo(
		() =>
			buildAdminBlocksListUrl({
				limit: LIMIT,
				offset,
				q,
				sort: sort !== DEFAULT_SORT || dir !== DEFAULT_DIR ? sort : undefined,
				dir: sort !== DEFAULT_SORT || dir !== DEFAULT_DIR ? dir : undefined,
			}),
		[offset, q, sort, dir]
	);

	const { data, loading, error, reload } = useApiList<BlockListOut>(listUrl, {
		nextPath: '/admin/blocks',
	});

	const items = data?.items ?? EMPTY_BLOCKS;
	const total = data?.total ?? 0;

	function applyFilters() {
		const nextQ = qInput.trim();
		const nextSort = sortInput;
		const nextDir = dirInput;
		setOffset(0);
		setQ(nextQ);
		setSort(nextSort);
		setDir(nextDir);
		updateUrl({ page: 1, q: nextQ, sort: nextSort, dir: nextDir });
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setSortInput(DEFAULT_SORT);
		setDirInput(DEFAULT_DIR);
		setQ('');
		setSort(DEFAULT_SORT);
		setDir(DEFAULT_DIR);
		updateUrl({ page: 1, q: '', sort: DEFAULT_SORT, dir: DEFAULT_DIR });
		qRef.current?.focus();
	}

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<BlockTemplate | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [builder, setBuilder] = useState<PageBuilderState>(() => defaultPageBuilderState());

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<BlockTemplate | null>(null);

	function openCreate() {
		setEditing(null);
		setTitle('');
		setSlug('');
		setDescription('');
		setBuilder(defaultPageBuilderState());
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(b: BlockTemplate) {
		setEditing(b);
		setTitle(b.title);
		setSlug(b.slug);
		setDescription(b.description ?? '');
		setBuilder(parsePageBuilderState(b.definition));
		setFormError(null);
		setEditorOpen(true);
	}

	async function cloneAsVariant(source: BlockTemplate) {
		if (saving) return;

		setSaving(true);
		setFormError(null);

		const baseSlug = slugify(source.slug) || 'block';
		const baseVariant = baseSlug.endsWith('-variant') ? baseSlug : `${baseSlug}-variant`;

		const payloadBase = {
			title: `${(title.trim() || source.title || 'Block').trim()} (variant)`,
			description: description.trim() ? description.trim() : null,
			definition: serializePageBuilderState(builder) as Record<string, unknown>,
		};

		try {
			let lastErr: unknown = null;
			for (let i = 0; i < 50; i++) {
				const candidate = i === 0 ? baseVariant : `${baseVariant}-${i + 1}`;
				try {
					const created = await createAdminBlock({ ...payloadBase, slug: candidate }, '/admin/blocks');

					setActionError(null);
					await reload();
					openEdit(created);
					return;
				} catch (e) {
					lastErr = e;
					if (e instanceof ApiError && e.status === 409) continue;
					throw e;
				}
			}
			throw lastErr ?? new Error('Failed to clone block');
		} catch (e) {
			setFormError(toErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	async function save() {
		setSaving(true);
		setFormError(null);

		const payload = {
			title: title.trim(),
			slug: slug.trim(),
			description: description.trim() ? description.trim() : null,
			definition: serializePageBuilderState(builder) as Record<string, unknown>,
		};

		try {
			if (editing) {
				await updateAdminBlock(editing.id, payload, '/admin/blocks');
			} else {
				await createAdminBlock(payload, '/admin/blocks');
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

	async function doDelete(b: BlockTemplate) {
		try {
			await deleteAdminBlock(b.id, '/admin/blocks');
			setConfirmDelete(null);
			setActionError(null);

			const nextTotal = Math.max(0, total - 1);
				const lastOffset = Math.max(
					0,
					Math.floor(Math.max(0, nextTotal - 1) / LIMIT) * LIMIT
				);
				const nextOffset = Math.min(offset, lastOffset);
				goToOffset(nextOffset);
				if (nextOffset === offset) await reload();
			} catch (e) {
				setActionError(toErrorMessage(e));
			}
	}

	return (
		<AdminListPage
			title='Blocks'
			description='Reusable sections (blocks) composed of multiple components.'
			actions={
				<Button
					onClick={openCreate}
					disabled={loading}>
					New block
				</Button>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-7 space-y-2'>
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
					<div className='md:col-span-3 space-y-2'>
						<Label>Sort</Label>
						<Select
							value={sortInput}
							onValueChange={(v) => setSortInput(v as BlockSort)}
							disabled={loading}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='updated_at'>Updated</SelectItem>
								<SelectItem value='created_at'>Created</SelectItem>
								<SelectItem value='title'>Title</SelectItem>
								<SelectItem value='slug'>Slug</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='md:col-span-2 space-y-2'>
						<Label>Order</Label>
						<Select
							value={dirInput}
							onValueChange={(v) => setDirInput(v as SortDir)}
							disabled={loading}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='desc'>desc</SelectItem>
								<SelectItem value='asc'>asc</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='md:col-span-12 flex gap-2 justify-end'>
						<Button
							variant='outline'
							onClick={resetFilters}
							disabled={loading}>
							Reset
						</Button>
						<Button
							onClick={applyFilters}
							disabled={loading}>
							Apply
						</Button>
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
				getRowKey={(b) => b.id}
				columns={[
					{
						header: 'Title',
						cell: (b) => (
							<div className='space-y-1'>
								<div className='font-medium'>{b.title}</div>
								<div className='text-xs text-muted-foreground'>/{b.slug}</div>
							</div>
						),
					},
					{
						header: 'Structure',
						cell: (b) => {
							const stats = getBlockStats(b.definition);
							return (
								<span className='text-xs text-muted-foreground'>
									{stats.nodesTotal} node{stats.nodesTotal === 1 ? '' : 's'} ·{' '}
									{stats.frames} frame{stats.frames === 1 ? '' : 's'} · {stats.items} item
									{stats.items === 1 ? '' : 's'}
								</span>
							);
						},
						headerClassName: 'w-[260px]',
					},
					{
						header: 'Updated',
						cell: (b) => (
							<span className='text-xs text-muted-foreground'>
								{formatIso(b.updated_at)}
							</span>
						),
						headerClassName: 'w-[220px]',
					},
					{
						header: '',
						cell: (b) => (
							<div className='flex items-center justify-end gap-2'>
								<Button
									size='sm'
									variant='outline'
									onClick={() => openEdit(b)}>
									Edit
								</Button>
								<Button
									size='sm'
									variant='destructive'
									onClick={() => setConfirmDelete(b)}>
									Delete
								</Button>
							</div>
						),
						headerClassName: 'w-[190px]',
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
				<DialogContent className='sm:max-w-6xl max-h-[90svh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit block' : 'New block'}</DialogTitle>
						<DialogDescription>
							Blocks are reusable section templates (one or more rows).
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label>Title</Label>
								<Input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									disabled={saving}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Slug</Label>
								<Input
									value={slug}
									onChange={(e) => setSlug(e.target.value)}
									placeholder='e.g. hero-section'
									disabled={saving || !!editing}
								/>
								{editing ? (
									<p className='text-xs text-muted-foreground'>
										Slug changes are disabled for now (keeps references stable).
									</p>
								) : null}
							</div>
						</div>

						<div className='space-y-2'>
							<Label>Description</Label>
							<Input
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								disabled={saving}
							/>
						</div>

						<div className='space-y-2'>
							<Label>Layout</Label>
							<div className='rounded-xl border p-4'>
								<ClientOnly fallback={<div className='text-sm text-muted-foreground'>Loading editor…</div>}>
									<PageBuilder
										value={builder}
										onChange={setBuilder}
										disabled={saving}
									/>
								</ClientOnly>
							</div>
						</div>

						<details className='rounded-xl border p-4'>
							<summary className='cursor-pointer text-sm font-medium'>
								Advanced (JSON)
							</summary>
							<div className='mt-3 space-y-2'>
								<p className='text-xs text-muted-foreground'>
									This is the stored definition payload (v4 canvas layout).
								</p>
								<Textarea
									value={JSON.stringify(serializePageBuilderState(builder), null, 2)}
									readOnly
									className='font-mono text-xs min-h-[220px]'
								/>
							</div>
						</details>

						{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}
					</div>

					<DialogFooter>
						{editing ? (
							<Button
								variant='secondary'
								onClick={() => cloneAsVariant(editing)}
								disabled={saving}>
								Clone as variant
							</Button>
						) : null}
						<Button
							variant='outline'
							onClick={() => setEditorOpen(false)}
							disabled={saving}>
							Cancel
						</Button>
						<Button
							onClick={save}
							disabled={saving || !title.trim() || !slug.trim()}>
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
						<AlertDialogTitle>Delete block?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes <strong>{confirmDelete?.title}</strong> from the blocks library.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={loading || !confirmDelete}
							onClick={() => {
								if (confirmDelete) void doDelete(confirmDelete);
							}}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{items.length === 0 && !loading && !error ? (
				<div className='rounded-xl border p-6'>
					<p className='text-sm text-muted-foreground'>No blocks yet.</p>
					<div className='mt-3'>
						<Badge variant='secondary'>Tip</Badge>
						<span className='ml-2 text-sm text-muted-foreground'>
							Blocks are “sections”: saved row/column/component layouts.
						</span>
					</div>
				</div>
			) : null}
		</AdminListPage>
	);
}
