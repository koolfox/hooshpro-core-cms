'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ApiError } from '@/lib/http';
import {
	buildAdminTemplatesListUrl,
	createAdminTemplate,
	deleteAdminTemplate,
	updateAdminTemplate,
} from '@/lib/api/templates';
import type { PageTemplate, PageTemplateListOut } from '@/lib/types';
import { useApiList } from '@/hooks/use-api-list';

import { AdminListPage } from '@/components/admin/admin-list-page';
import { AdminDataTable } from '@/components/admin/admin-data-table';

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
import { formatUiError } from '@/lib/error-message';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

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
const EMPTY_TEMPLATES: PageTemplate[] = [];

type SortDir = 'asc' | 'desc';

const SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug', 'menu', 'footer'] as const;
type TemplateSort = (typeof SORT_FIELDS)[number];
const DEFAULT_SORT: TemplateSort = 'updated_at';
const DEFAULT_DIR: SortDir = 'desc';

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
}

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseSortParam(value: string | null): TemplateSort {
	const v = (value ?? '').trim().toLowerCase();
	if ((SORT_FIELDS as readonly string[]).includes(v)) return v as TemplateSort;
	return DEFAULT_SORT;
}

function parseDirParam(value: string | null): SortDir {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'asc' ? 'asc' : DEFAULT_DIR;
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

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export default function AdminTemplatesScreen() {
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
	const [q, setQ] = useState(urlQ);
	const [sortInput, setSortInput] = useState<TemplateSort>(urlSort);
	const [dirInput, setDirInput] = useState<SortDir>(urlDir);
	const [sort, setSort] = useState<TemplateSort>(urlSort);
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

	function updateUrl(next: { page?: number; q?: string; sort?: TemplateSort; dir?: SortDir }) {
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
			buildAdminTemplatesListUrl({
				limit: LIMIT,
				offset,
				q,
				sort: sort !== DEFAULT_SORT || dir !== DEFAULT_DIR ? sort : undefined,
				dir: sort !== DEFAULT_SORT || dir !== DEFAULT_DIR ? dir : undefined,
			}),
		[offset, q, sort, dir]
	);

	const { data, loading, error, reload } = useApiList<PageTemplateListOut>(listUrl, {
		nextPath: '/admin/templates',
	});

	const items = data?.items ?? EMPTY_TEMPLATES;
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
	const [editing, setEditing] = useState<PageTemplate | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [slugTouched, setSlugTouched] = useState(false);
	const [description, setDescription] = useState('');

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	function resetForm() {
		setTitle('');
		setSlug('');
		setSlugTouched(false);
		setDescription('');
		setFormError(null);
	}

	function openCreate() {
		setEditing(null);
		resetForm();
		setEditorOpen(true);
	}

	function openEdit(t: PageTemplate) {
		setEditing(t);
		setTitle(t.title);
		setSlug(t.slug);
		setSlugTouched(true);
		setDescription(t.description ?? '');
		setFormError(null);
		setEditorOpen(true);
	}

	async function cloneAsVariant(source: PageTemplate) {
		if (saving) return;
		setSaving(true);
		setFormError(null);

		const baseSlug = slugify(source.slug) || 'template';
		const baseVariant = baseSlug.endsWith('-variant') ? baseSlug : `${baseSlug}-variant`;
		const payloadBase = {
			title: `${(source.title || 'Template').trim() || 'Template'} (variant)`,
			description: (source.description ?? '').trim() ? source.description : null,
			menu: source.menu,
			footer: source.footer,
			definition: source.definition,
		};

		try {
			let lastErr: unknown = null;
			for (let i = 0; i < 50; i++) {
				const candidate = i === 0 ? baseVariant : `${baseVariant}-${i + 1}`;
				try {
					const created = await createAdminTemplate({ ...payloadBase, slug: candidate }, '/admin/templates');
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
			throw lastErr ?? new Error('Failed to clone template');
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
		};

		try {
			if (editing) {
				await updateAdminTemplate(editing.id, payload, '/admin/templates');
			} else {
				await createAdminTemplate(payload, '/admin/templates');
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

	const [confirmDelete, setConfirmDelete] = useState<PageTemplate | null>(null);

	async function doDelete(t: PageTemplate) {
		try {
			await deleteAdminTemplate(t.id, '/admin/templates');
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
			title='Templates'
			description='Reusable layout presets that pages can reference.'
			actions={
				<Button
					onClick={openCreate}
					disabled={loading}>
					New template
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
							onValueChange={(v) => setSortInput(v as TemplateSort)}
							disabled={loading}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='updated_at'>Updated</SelectItem>
								<SelectItem value='created_at'>Created</SelectItem>
								<SelectItem value='title'>Title</SelectItem>
								<SelectItem value='slug'>Slug</SelectItem>
								<SelectItem value='menu'>Menu</SelectItem>
								<SelectItem value='footer'>Footer</SelectItem>
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
				getRowKey={(t) => t.id}
				columns={[
					{
						header: 'Title',
						cell: (t) => (
							<div className='space-y-1'>
								<div className='font-medium'>{t.title}</div>
								<div className='text-xs text-muted-foreground'>/{t.slug}</div>
							</div>
						),
					},
					{
						header: 'Updated',
						cell: (t) => (
							<span className='text-xs text-muted-foreground'>
								{formatIso(t.updated_at)}
							</span>
						),
						headerClassName: 'w-[220px]',
					},
					{
						header: '',
						cell: (t) => (
							<div className='flex items-center justify-end gap-2'>
								<Button
									size='sm'
									variant='outline'
									asChild>
									<Link href={`/admin/templates/${t.id}`}>Layout</Link>
								</Button>
								<Button
									size='sm'
									variant='outline'
									onClick={() => openEdit(t)}>
									Edit
								</Button>
								<Button
									size='sm'
									variant='destructive'
									onClick={() => setConfirmDelete(t)}>
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
				<DialogContent className='sm:max-w-2xl'>
					<DialogHeader>
						<DialogTitle>
							{editing ? 'Edit template' : 'New template'}
						</DialogTitle>
						<DialogDescription>
							Templates define reusable layouts for pages. Use the “Layout” button to edit menus/footers as blocks.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label>Title</Label>
								<Input
									value={title}
									onChange={(e) => {
										const v = e.target.value;
										setTitle(v);
										if (!slugTouched) setSlug(slugify(v));
									}}
									disabled={saving}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Slug</Label>
								<Input
									value={slug}
									onChange={(e) => {
										setSlugTouched(true);
										setSlug(slugify(e.target.value));
									}}
									placeholder='e.g. landing-default'
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

						{formError ? (
							<p className='text-sm text-red-600'>{formError}</p>
						) : null}
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
						<AlertDialogTitle>Delete template?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete <b>{confirmDelete?.title}</b>.
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
					<p className='text-sm text-muted-foreground'>No templates yet.</p>
				</div>
			) : null}
		</AdminListPage>
	);
}
