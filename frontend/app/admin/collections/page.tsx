'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { ContentType, ContentTypeListOut } from '@/lib/types';
import { buildAdminContentTypesListUrl, createAdminContentType, deleteAdminContentType } from '@/lib/api/content';
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

const LIMIT = 20;
const EMPTY: ContentType[] = [];

type SortDir = 'asc' | 'desc';
const SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug', 'id'] as const;
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

export default function AdminCollectionsPage() {
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
	const [sortInput, setSortInput] = useState<SortField>(urlSort);
	const [dirInput, setDirInput] = useState<SortDir>(urlDir);

	const [q, setQ] = useState(urlQ);
	const [sort, setSort] = useState<SortField>(urlSort);
	const [dir, setDir] = useState<SortDir>(urlDir);

	const qRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setSort(urlSort);
		setDir(urlDir);
		setQInput(urlQ);
		setSortInput(urlSort);
		setDirInput(urlDir);
	}, [urlOffset, urlQ, urlSort, urlDir]);

	function updateUrl(next: { page?: number; q?: string; sort?: SortField; dir?: SortDir }) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

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
		return buildAdminContentTypesListUrl({
			limit: LIMIT,
			offset,
			q,
			sort: sort,
			dir: dir,
		});
	}, [offset, q, sort, dir]);

	const { data, loading, error, reload } = useApiList<ContentTypeListOut>(listUrl, {
		nextPath: '/admin/collections',
	});

	const items = data?.items ?? EMPTY;
	const total = data?.total ?? 0;

	const [createOpen, setCreateOpen] = useState(false);
	const [createTitle, setCreateTitle] = useState('');
	const [createSlug, setCreateSlug] = useState('');
	const [createDesc, setCreateDesc] = useState('');
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<ContentType | null>(null);

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
		setQ('');
		setQInput('');
		setSort(DEFAULT_SORT);
		setDir(DEFAULT_DIR);
		setSortInput(DEFAULT_SORT);
		setDirInput(DEFAULT_DIR);
		updateUrl({ page: 1, q: '', sort: DEFAULT_SORT, dir: DEFAULT_DIR });
		window.requestAnimationFrame(() => qRef.current?.focus());
	}

	async function create() {
		setSaving(true);
		setFormError(null);
		try {
			const payload = {
				title: createTitle.trim(),
				slug: createSlug.trim() || slugify(createTitle),
				description: createDesc.trim() ? createDesc.trim() : null,
			};

			const out = await createAdminContentType(payload, '/admin/collections');

			setCreateOpen(false);
			setCreateTitle('');
			setCreateSlug('');
			setCreateDesc('');
			await reload();
			router.push(`/admin/collections/${out.id}`);
		} catch (e) {
			setFormError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(item: ContentType) {
		setSaving(true);
		setFormError(null);
		try {
			await deleteAdminContentType(item.id, '/admin/collections');
			setConfirmDelete(null);
			await reload();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}
	return (
		<AdminListPage
			title='Collections'
			description='Define content types (e.g. Products, Projects) and manage fields/entries.'
			total={total}
			offset={offset}
			limit={LIMIT}
			loading={loading}
			onPrev={() => goToOffset(offset - LIMIT)}
			onNext={() => goToOffset(offset + LIMIT)}
			onSetOffset={goToOffset}
			actions={
				<Button onClick={() => setCreateOpen(true)}>
					New collection
				</Button>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3'>
					<div className='md:col-span-6 space-y-1'>
						<Label>Search</Label>
						<Input
							ref={qRef}
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search title or slug…'
						/>
					</div>
					<div className='md:col-span-3 space-y-1'>
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
					<div className='md:col-span-3 space-y-1'>
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
			{error ? (
				<p className='text-sm text-red-600'>{error}</p>
			) : null}

			{formError ? (
				<p className='text-sm text-red-600'>{formError}</p>
			) : null}

			<AdminDataTable
				rows={items}
				getRowKey={(it) => it.id}
				emptyText={loading ? 'Loading…' : 'No collections yet.'}
				columns={[
					{
						header: 'Title',
						cell: (it) => (
							<div className='min-w-0'>
								<div className='font-medium truncate'>{it.title}</div>
								<div className='text-xs text-muted-foreground truncate'>
									<Badge variant='secondary'>/{it.slug}</Badge>
								</div>
							</div>
						),
					},
					{
						header: 'Description',
						cell: (it) => (
							<div className='text-sm text-muted-foreground line-clamp-2'>
								{it.description ?? ''}
							</div>
						),
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
									asChild
									variant='outline'
									size='sm'>
									<Link href={`/admin/collections/${it.id}`}>Manage</Link>
								</Button>
								<Button
									size='sm'
									variant='destructive'
									onClick={() => setConfirmDelete(it)}>
									Delete
								</Button>
							</div>
						),
					},
				]}
			/>

			<Dialog
				open={createOpen}
				onOpenChange={(open) => {
					setCreateOpen(open);
					if (!open) setFormError(null);
				}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New collection</DialogTitle>
						<DialogDescription>
							A collection is a content type + its entries (e.g. Products).
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label>Title</Label>
							<Input
								value={createTitle}
								onChange={(e) => {
									const nextTitle = e.target.value;
									setCreateTitle(nextTitle);
									if (!createSlug.trim()) setCreateSlug(slugify(nextTitle));
								}}
								disabled={saving}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Slug</Label>
							<Input
								value={createSlug}
								onChange={(e) => setCreateSlug(e.target.value)}
								placeholder='e.g. products'
								disabled={saving}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Description</Label>
							<Input
								value={createDesc}
								onChange={(e) => setCreateDesc(e.target.value)}
								placeholder='Optional'
								disabled={saving}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setCreateOpen(false)}
							disabled={saving}>
							Cancel
						</Button>
						<Button
							onClick={create}
							disabled={saving || !createTitle.trim()}>
							{saving ? 'Creating…' : 'Create'}
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
						<AlertDialogTitle>Delete collection?</AlertDialogTitle>
						<AlertDialogDescription>
							This deletes <strong>{confirmDelete?.title}</strong>. You must delete its entries first.
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



