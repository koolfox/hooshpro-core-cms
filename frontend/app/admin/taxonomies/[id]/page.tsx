'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { Taxonomy, Term, TermListOut } from '@/lib/types';
import {
	buildAdminTermsListUrl,
	createAdminTerm,
	deleteAdminTerm,
	getAdminTaxonomy,
	updateAdminTerm,
	type TermUpsertPayload,
} from '@/lib/api/taxonomies';
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

const LIMIT = 50;
const EMPTY: Term[] = [];

type SortDir = 'asc' | 'desc';
const SORT_FIELDS = ['title', 'slug', 'updated_at', 'created_at', 'id'] as const;
type SortField = (typeof SORT_FIELDS)[number];
const DEFAULT_SORT: SortField = 'title';
const DEFAULT_DIR: SortDir = 'asc';

function parseId(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

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
	return v === 'desc' ? 'desc' : DEFAULT_DIR;
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

export default function AdminTaxonomyDetailPage() {
	const params = useParams();
	const taxonomyId = parseId(params?.['id']);

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

	const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
	const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
	const [taxonomyLoading, setTaxonomyLoading] = useState(true);

	const qRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!taxonomyId) {
			setTaxonomyLoading(false);
			setTaxonomyError('Invalid taxonomy id.');
			return;
		}

		const currentTaxonomyId = taxonomyId;
		let canceled = false;
		async function load() {
			setTaxonomyLoading(true);
			setTaxonomyError(null);
			try {
				const out = await getAdminTaxonomy(currentTaxonomyId, `/admin/taxonomies/${currentTaxonomyId}`);
				if (canceled) return;
				setTaxonomy(out);
			} catch (e) {
				if (canceled) return;
				setTaxonomyError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!canceled) setTaxonomyLoading(false);
			}
		}
		void load();
		return () => {
			canceled = true;
		};
	}, [taxonomyId]);

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
		if (!taxonomyId) return '';
		return buildAdminTermsListUrl(taxonomyId, {
			limit: LIMIT,
			offset,
			q,
			sort,
			dir,
		});
	}, [taxonomyId, offset, q, sort, dir]);

	const { data, loading, error, reload } = useApiList<TermListOut>(listUrl, {
		nextPath: taxonomyId ? `/admin/taxonomies/${taxonomyId}` : '/admin/taxonomies',
		enabled: !!taxonomyId,
	});

	const terms = data?.items ?? EMPTY;
	const total = data?.total ?? 0;

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<Term | null>(null);
	const [termTitle, setTermTitle] = useState('');
	const [termSlug, setTermSlug] = useState('');
	const [termDesc, setTermDesc] = useState('');
	const [termParent, setTermParent] = useState<string>('0');

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<Term | null>(null);

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

	function openCreate() {
		setEditing(null);
		setTermTitle('');
		setTermSlug('');
		setTermDesc('');
		setTermParent('0');
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(t: Term) {
		setEditing(t);
		setTermTitle(t.title);
		setTermSlug(t.slug);
		setTermDesc(t.description ?? '');
		setTermParent(t.parent_id ? String(t.parent_id) : '0');
		setFormError(null);
		setEditorOpen(true);
	}

	async function save() {
		if (!taxonomyId) return;
		setSaving(true);
		setFormError(null);

		try {
			const payload: TermUpsertPayload = {
				title: termTitle.trim(),
				slug: (termSlug.trim() || slugify(termTitle)).trim(),
				description: termDesc.trim() || null,
			};
			if (!payload.title) throw new Error('Title is required');

			if (taxonomy?.hierarchical) {
				const parentId = Number.parseInt(termParent, 10);
				payload.parent_id = Number.isFinite(parentId) && parentId > 0 ? parentId : null;
			}

			if (editing) {
				await updateAdminTerm(taxonomyId, editing.id, payload, `/admin/taxonomies/${taxonomyId}`);
			} else {
				await createAdminTerm(taxonomyId, payload, `/admin/taxonomies/${taxonomyId}`);
			}

			setEditorOpen(false);
			setEditing(null);
			await reload();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(t: Term) {
		if (!taxonomyId) return;
		setSaving(true);
		setFormError(null);
		try {
			await deleteAdminTerm(taxonomyId, t.id, `/admin/taxonomies/${taxonomyId}`);
			setConfirmDelete(null);
			await reload();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	const description = taxonomy ? (
		<span className='flex flex-wrap items-center gap-2'>
			<Badge variant='secondary'>/{taxonomy.slug}</Badge>
			<Badge variant={taxonomy.hierarchical ? 'default' : 'secondary'}>
				{taxonomy.hierarchical ? 'hierarchical' : 'flat'}
			</Badge>
			{taxonomy.description ? <span className='text-muted-foreground'>· {taxonomy.description}</span> : null}
		</span>
	) : undefined;

	const parentOptions = useMemo(() => {
		if (!taxonomy?.hierarchical) return [];
		const opts: Array<{ value: string; label: string }> = [{ value: '0', label: 'None' }];
		for (const t of terms) {
			if (editing && t.id === editing.id) continue;
			opts.push({ value: String(t.id), label: `${t.title} (${t.slug})` });
		}
		return opts;
	}, [taxonomy?.hierarchical, terms, editing]);

	return (
		<AdminListPage
			title={taxonomy?.title ? `Terms · ${taxonomy.title}` : 'Terms'}
			description={taxonomyLoading ? 'Loading taxonomy…' : taxonomyError ? taxonomyError : 'Manage terms for this taxonomy.'}
			total={total}
			offset={offset}
			limit={LIMIT}
			loading={loading}
			onPrev={() => goToOffset(offset - LIMIT)}
			onNext={() => goToOffset(offset + LIMIT)}
			onSetOffset={(next) => goToOffset(next)}
			actions={
				<div className='flex items-center gap-2'>
					<Button asChild variant='outline' size='sm'>
						<Link href='/admin/taxonomies'>Back</Link>
					</Button>
					<Button onClick={openCreate} disabled={!taxonomyId || loading}>
						New term
					</Button>
				</div>
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
								<SelectItem value='asc'>asc</SelectItem>
								<SelectItem value='desc'>desc</SelectItem>
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
			{taxonomy && description ? <div className='text-sm text-muted-foreground'>{description}</div> : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}
			{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}

			<AdminDataTable
				rows={terms}
				getRowKey={(it) => it.id}
				emptyText={loading ? 'Loading…' : 'No terms yet.'}
				columns={[
					{
						header: 'Title',
						cell: (it) => (
							<div className='min-w-0'>
								<div className='font-medium truncate'>{it.title}</div>
								<div className='text-xs text-muted-foreground truncate'>
									<Badge variant='secondary'>/{it.slug}</Badge>
									{taxonomy?.hierarchical && it.parent_id ? (
										<span className='ml-2'>· parent #{it.parent_id}</span>
									) : null}
								</div>
							</div>
						),
					},
					{
						header: 'Updated',
						headerClassName: 'w-[190px]',
						cell: (it) => <span className='text-xs text-muted-foreground'>{formatIso(it.updated_at)}</span>,
					},
					{
						header: <span className='sr-only'>Actions</span>,
						headerClassName: 'w-[220px] text-right',
						cellClassName: 'text-right',
						cell: (it) => (
							<div className='flex items-center justify-end gap-2'>
								<Button size='sm' variant='outline' onClick={() => openEdit(it)}>
									Edit
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
				open={editorOpen}
				onOpenChange={(open) => {
					setEditorOpen(open);
					if (!open) setEditing(null);
				}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit term' : 'New term'}</DialogTitle>
						<DialogDescription>Terms are the values inside a taxonomy.</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label>Title</Label>
							<Input
								value={termTitle}
								onChange={(e) => {
									const next = e.target.value;
									setTermTitle(next);
									if (!editing && !termSlug.trim()) setTermSlug(slugify(next));
								}}
								disabled={saving}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Slug</Label>
							<Input value={termSlug} onChange={(e) => setTermSlug(e.target.value)} disabled={saving} />
						</div>

						{taxonomy?.hierarchical ? (
							<div className='space-y-2'>
								<Label>Parent</Label>
								<Select value={termParent} onValueChange={setTermParent} disabled={saving}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{parentOptions.map((o) => (
											<SelectItem key={o.value} value={o.value}>
												{o.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : null}

						<div className='space-y-2'>
							<Label>Description</Label>
							<Input value={termDesc} onChange={(e) => setTermDesc(e.target.value)} disabled={saving} />
						</div>
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={() => setEditorOpen(false)} disabled={saving}>
							Cancel
						</Button>
						<Button onClick={() => void save()} disabled={saving || !termTitle.trim()}>
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
						<AlertDialogTitle>Delete term?</AlertDialogTitle>
						<AlertDialogDescription>
							This deletes <strong>{confirmDelete?.title}</strong> and removes it from all entries.
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




