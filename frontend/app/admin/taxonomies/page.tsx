'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { Taxonomy, TaxonomyListOut } from '@/lib/types';
import { buildAdminTaxonomiesListUrl, createAdminTaxonomy, deleteAdminTaxonomy } from '@/lib/api/taxonomies';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LIMIT = 20;
const EMPTY: Taxonomy[] = [];

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

export default function AdminTaxonomiesPage() {
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
		return buildAdminTaxonomiesListUrl({
			limit: LIMIT,
			offset,
			q,
			sort,
			dir,
		});
	}, [offset, q, sort, dir]);

	const { data, loading, error, reload } = useApiList<TaxonomyListOut>(listUrl, {
		nextPath: '/admin/taxonomies',
	});

	const items = data?.items ?? EMPTY;
	const total = data?.total ?? 0;

	const [createOpen, setCreateOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [createTitle, setCreateTitle] = useState('');
	const [createSlug, setCreateSlug] = useState('');
	const [createDesc, setCreateDesc] = useState('');
	const [createHier, setCreateHier] = useState<'true' | 'false'>('false');

	const [confirmDelete, setConfirmDelete] = useState<Taxonomy | null>(null);

	function applyFilters() {
		setQ(qInput.trim());
		setSort(sortInput);
		setDir(dirInput);
		setOffset(0);
		updateUrl({ page: 1, q: qInput.trim(), sort: sortInput, dir: dirInput });
	}

	function resetFilters() {
		setQInput('');
		setSortInput(DEFAULT_SORT);
		setDirInput(DEFAULT_DIR);
		setQ('');
		setSort(DEFAULT_SORT);
		setDir(DEFAULT_DIR);
		setOffset(0);
		updateUrl({ page: 1, q: '', sort: DEFAULT_SORT, dir: DEFAULT_DIR });
	}

	async function create() {
		setSaving(true);
		setFormError(null);
		try {
			const payload = {
				title: createTitle.trim(),
				slug: (createSlug.trim() || slugify(createTitle)).trim(),
				description: createDesc.trim() || null,
				hierarchical: createHier === 'true',
			};
			if (!payload.title) throw new Error('Title is required');

			await createAdminTaxonomy(payload, '/admin/taxonomies');

			setCreateOpen(false);
			setCreateTitle('');
			setCreateSlug('');
			setCreateDesc('');
			setCreateHier('false');
			await reload();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(t: Taxonomy) {
		setSaving(true);
		setFormError(null);
		try {
			await deleteAdminTaxonomy(t.id, '/admin/taxonomies');
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
			title='Taxonomies'
			description='WordPress-like taxonomies (categories/tags/custom).'
			total={total}
			offset={offset}
			limit={LIMIT}
			loading={loading}
			onPrev={() => goToOffset(offset - LIMIT)}
			onNext={() => goToOffset(offset + LIMIT)}
			onSetOffset={(next) => goToOffset(next)}
			actions={
				<Button onClick={() => setCreateOpen(true)} disabled={loading}>
					New taxonomy
				</Button>
			}
			filters={
				<div className='grid gap-3 md:grid-cols-12'>
					<div className='md:col-span-6 space-y-1'>
						<Label>Search</Label>
						<Input
							ref={qRef}
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search…'
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
						<Button variant='outline' onClick={applyFilters} disabled={loading}>
							Apply
						</Button>
						<Button variant='outline' onClick={resetFilters} disabled={loading}>
							Reset
						</Button>
					</div>
				</div>
			}>
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}
			{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}

			<AdminDataTable
				rows={items}
				getRowKey={(it) => it.id}
				emptyText={loading ? 'Loading…' : 'No taxonomies yet.'}
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
						header: 'Type',
						headerClassName: 'w-[140px]',
						cell: (it) => (
							<Badge variant={it.hierarchical ? 'default' : 'secondary'}>
								{it.hierarchical ? 'hierarchical' : 'flat'}
							</Badge>
						),
					},
					{
						header: 'Updated',
						headerClassName: 'w-[190px]',
						cell: (it) => <span className='text-xs text-muted-foreground'>{formatIso(it.updated_at)}</span>,
					},
					{
						header: <span className='sr-only'>Actions</span>,
						headerClassName: 'w-[210px] text-right',
						cellClassName: 'text-right',
						cell: (it) => (
							<div className='flex items-center justify-end gap-2'>
								<Button asChild variant='outline' size='sm'>
									<Link href={`/admin/taxonomies/${it.id}`}>Manage</Link>
								</Button>
								<Button size='sm' variant='destructive' onClick={() => setConfirmDelete(it)}>
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
						<DialogTitle>New taxonomy</DialogTitle>
						<DialogDescription>Creates a taxonomy like category or tag.</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label>Title</Label>
							<Input
								value={createTitle}
								onChange={(e) => {
									const next = e.target.value;
									setCreateTitle(next);
									if (!createSlug.trim()) setCreateSlug(slugify(next));
								}}
								disabled={saving}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Slug</Label>
							<Input
								value={createSlug}
								onChange={(e) => setCreateSlug(e.target.value)}
								placeholder='e.g. category'
								disabled={saving}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Kind</Label>
							<Select value={createHier} onValueChange={(v) => setCreateHier(v === 'true' ? 'true' : 'false')} disabled={saving}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='false'>Flat (tags)</SelectItem>
									<SelectItem value='true'>Hierarchical (categories)</SelectItem>
								</SelectContent>
							</Select>
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
						<Button variant='outline' onClick={() => setCreateOpen(false)} disabled={saving}>
							Cancel
						</Button>
						<Button onClick={create} disabled={saving || !createTitle.trim()}>
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
						<AlertDialogTitle>Delete taxonomy?</AlertDialogTitle>
						<AlertDialogDescription>
							This deletes <strong>{confirmDelete?.title}</strong> and all its terms/relationships.
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



