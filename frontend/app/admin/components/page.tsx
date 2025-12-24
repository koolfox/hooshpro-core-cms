'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, List } from 'lucide-react';

import { apiFetch } from '@/lib/http';
import type { ComponentDef, ComponentListOut } from '@/lib/types';
import { SHADCN_DOCS_BASE, shadcnDocsUrl } from '@/lib/shadcn-docs';
import { shadcnComponentMeta } from '@/lib/shadcn-meta';
import { isRecord } from '@/lib/page-builder';
import { useApiList } from '@/hooks/use-api-list';
import { useShadcnVariants } from '@/hooks/use-shadcn-variants';

import { AdminListPage } from '@/components/admin/admin-list-page';
import { AdminDataTable } from '@/components/admin/admin-data-table';
import { ComponentPreview } from '@/components/components/component-preview';

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

const LIMIT = 50;
const EMPTY_COMPONENTS: ComponentDef[] = [];

type ViewMode = 'table' | 'gallery';

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseViewParam(value: string | null): ViewMode {
	const v = (value ?? '').trim().toLowerCase();
	if (v === 'gallery' || v === 'grid') return 'gallery';
	return 'table';
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
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

function defaultDataJson() {
	return JSON.stringify({}, null, 2);
}

function nextCloneSlug(base: string, existingSlugs: Set<string>): string {
	const normalized = base.trim().toLowerCase();
	const baseSlug = normalized.endsWith('-variant')
		? normalized
		: `${normalized}-variant`;

	if (!existingSlugs.has(baseSlug)) return baseSlug;

	for (let i = 2; i < 1000; i++) {
		const candidate = `${baseSlug}-${i}`;
		if (!existingSlugs.has(candidate)) return candidate;
	}

	return `${baseSlug}-${Math.floor(Math.random() * 100000)}`;
}

export default function AdminComponentsScreen() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlType = (searchParams.get('type') ?? 'all').trim() || 'all';
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;
	const urlView = parseViewParam(searchParams.get('view'));

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [typeInput, setTypeInput] = useState<'all' | string>(urlType);
	const [view, setView] = useState<ViewMode>(urlView);

	const [q, setQ] = useState(urlQ);
	const [type, setType] = useState<'all' | string>(urlType);

	const qRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setType(urlType);
		setQInput(urlQ);
		setTypeInput(urlType);
		setView(urlView);
	}, [urlOffset, urlQ, urlType, urlView]);

	function updateUrl(next: { page?: number; q?: string; type?: string; view?: ViewMode }) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

		const nextType = (next.type ?? params.get('type') ?? 'all').trim() || 'all';
		if (nextType !== 'all') params.set('type', nextType);
		else params.delete('type');

		const nextView = next.view ?? parseViewParam(params.get('view'));
		if (nextView !== 'table') params.set('view', nextView);
		else params.delete('view');

		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname);
	}

	function goToOffset(nextOffset: number) {
		const safeOffset = Math.max(0, Math.floor(nextOffset / LIMIT) * LIMIT);
		setOffset(safeOffset);
		updateUrl({ page: safeOffset / LIMIT + 1 });
	}

	const listUrl = useMemo(() => {
		const params = new URLSearchParams();
		params.set('limit', String(LIMIT));
		params.set('offset', String(offset));
		if (q.trim()) params.set('q', q.trim());
		if (type !== 'all' && type.trim()) params.set('type', type.trim());
		return `/api/admin/components?${params.toString()}`;
	}, [offset, q, type]);

	const { data, loading, error, reload } = useApiList<ComponentListOut>(listUrl, {
		nextPath: '/admin/components',
	});

	const items = data?.items ?? EMPTY_COMPONENTS;
	const total = data?.total ?? 0;

	const existingSlugs = useMemo(() => new Set(items.map((i) => i.slug)), [items]);

	function applyFilters() {
		const nextQ = qInput.trim();
		const nextType = typeInput;
		setOffset(0);
		setQ(nextQ);
		setType(nextType);
		updateUrl({ page: 1, q: nextQ, type: nextType });
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setTypeInput('all');
		setQ('');
		setType('all');
		updateUrl({ page: 1, q: '', type: 'all' });
		qRef.current?.focus();
	}

	function setViewMode(next: ViewMode) {
		setView(next);
		updateUrl({ view: next });
	}

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<ComponentDef | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [compType, setCompType] = useState('editor');
	const [description, setDescription] = useState('');
	const [dataJson, setDataJson] = useState(defaultDataJson());

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<ComponentDef | null>(null);

	function openCreate() {
		setEditing(null);
		setTitle('');
		setSlug('');
		setCompType('editor');
		setDescription('');
		setDataJson(defaultDataJson());
		setFormError(null);
		setEditorOpen(true);
	}

	function openClone(c: ComponentDef) {
		setEditing(null);
		setTitle(`${c.title} (variant)`);
		setSlug(nextCloneSlug(c.slug, existingSlugs));
		setCompType(c.type);
		setDescription(c.description ?? '');
		setDataJson(JSON.stringify(c.data ?? {}, null, 2));
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(c: ComponentDef) {
		setEditing(c);
		setTitle(c.title);
		setSlug(c.slug);
		setCompType(c.type);
		setDescription(c.description ?? '');
		setDataJson(JSON.stringify(c.data ?? {}, null, 2));
		setFormError(null);
		setEditorOpen(true);
	}

	async function save() {
		setSaving(true);
		setFormError(null);

		let dataObj: unknown = {};
		try {
			const raw = dataJson.trim();
			dataObj = raw ? JSON.parse(raw) : {};
			if (dataObj === null || typeof dataObj !== 'object' || Array.isArray(dataObj)) {
				throw new Error('Data JSON must be an object.');
			}
		} catch (e) {
			setFormError(toErrorMessage(e));
			setSaving(false);
			return;
		}

		const payload = {
			title: title.trim(),
			slug: slug.trim(),
			type: compType.trim(),
			description: description.trim() ? description.trim() : null,
			data: dataObj as Record<string, unknown>,
		};

		try {
			if (editing) {
				await apiFetch<ComponentDef>(`/api/admin/components/${editing.id}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/components',
				});
			} else {
				await apiFetch<ComponentDef>('/api/admin/components', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/components',
				});
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

	async function doDelete(c: ComponentDef) {
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/components/${c.id}`, {
				method: 'DELETE',
				nextPath: '/admin/components',
			});
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

	let previewData: unknown = {};
	let previewError: string | null = null;
	try {
		const parsed = dataJson.trim() ? JSON.parse(dataJson) : {};
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('Data JSON must be an object.');
		}
		previewData = parsed;
	} catch (e) {
		previewError = toErrorMessage(e);
	}

	const shadcnDocsLink =
		compType === 'shadcn' &&
		previewError === null &&
		isRecord(previewData) &&
		typeof previewData['component'] === 'string' &&
		previewData['component'].trim()
			? shadcnDocsUrl(previewData['component'].trim())
			: null;

	const shadcnComponentSlug =
		compType === 'shadcn' &&
		previewError === null &&
		isRecord(previewData) &&
		typeof previewData['component'] === 'string' &&
		previewData['component'].trim()
			? previewData['component'].trim()
			: null;
	const shadcnVariants = useShadcnVariants(shadcnComponentSlug);

	return (
		<AdminListPage
			title='Components'
			description='Reusable component presets used by the page editor.'
			actions={
				<div className='flex items-center gap-2'>
					<Button
						variant={view === 'table' ? 'secondary' : 'outline'}
						size='sm'
						onClick={() => setViewMode('table')}
						disabled={loading}
						title='Table view'>
						<List className='h-4 w-4' />
					</Button>
					<Button
						variant={view === 'gallery' ? 'secondary' : 'outline'}
						size='sm'
						onClick={() => setViewMode('gallery')}
						disabled={loading}
						title='Gallery view'>
						<LayoutGrid className='h-4 w-4' />
					</Button>
					<Button
						onClick={openCreate}
						disabled={loading}>
						New component
					</Button>
				</div>
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
						<Label>Type</Label>
						<Select
							value={typeInput}
							onValueChange={(v) => setTypeInput(v)}
							disabled={loading}>
							<SelectTrigger>
								<SelectValue placeholder='All types' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All</SelectItem>
								<SelectItem value='editor'>editor</SelectItem>
								<SelectItem value='image'>image</SelectItem>
								<SelectItem value='button'>button</SelectItem>
								<SelectItem value='card'>card</SelectItem>
								<SelectItem value='separator'>separator</SelectItem>
								<SelectItem value='shadcn'>shadcn</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='md:col-span-2 flex gap-2 justify-end'>
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

			{view === 'gallery' ? (
				<div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
					{items.map((c) => {
						const shadcnSlug =
							c.type === 'shadcn' &&
							isRecord(c.data) &&
							typeof c.data['component'] === 'string'
								? c.data['component'].trim().toLowerCase()
								: null;
						const shadcnMeta = shadcnComponentMeta(shadcnSlug);

						return (
							<div
								key={c.id}
								className='rounded-xl border bg-card p-4 space-y-3'>
								<div className='flex items-start justify-between gap-3'>
									<div className='min-w-0'>
										<div className='font-medium truncate'>{c.title}</div>
										<div className='text-xs text-muted-foreground truncate'>/{c.slug}</div>
									</div>
									<div className='flex items-center gap-2'>
										<Badge variant='secondary'>
											{c.type === 'shadcn' && shadcnSlug ? `shadcn/${shadcnSlug}` : c.type}
										</Badge>
										{shadcnMeta ? <Badge variant='outline'>{shadcnMeta.kind}</Badge> : null}
									</div>
								</div>

								<div className='p-3'>
									<ComponentPreview
										component={{
											title: c.title,
											type: c.type,
											data: c.data,
										}}
										className='max-w-none'
									/>
								</div>

								<div className='flex items-center justify-between gap-3'>
									<span className='text-xs text-muted-foreground'>
										Updated {formatIso(c.updated_at)}
									</span>
									<div className='flex items-center gap-2'>
										<Button
											size='sm'
											variant='outline'
											onClick={() => openEdit(c)}>
											Edit
										</Button>
										<Button
											size='sm'
											variant='secondary'
											onClick={() => openClone(c)}>
											Clone
										</Button>
										<Button
											size='sm'
											variant='destructive'
											onClick={() => setConfirmDelete(c)}>
											Delete
										</Button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<AdminDataTable
					rows={items}
					getRowKey={(c) => c.id}
					columns={[
						{
							header: 'Title',
							cell: (c) => (
								<div className='space-y-1'>
									<div className='font-medium'>{c.title}</div>
									<div className='text-xs text-muted-foreground'>/{c.slug}</div>
								</div>
							),
						},
						{
							header: 'Preview',
							cell: (c) => (
								<ComponentPreview
									component={{
										title: c.title,
										type: c.type,
										data: c.data,
									}}
									className='max-w-[420px]'
								/>
							),
							headerClassName: 'w-[460px]',
						},
						{
							header: 'Type',
							cell: (c) => {
								const shadcnSlug =
									c.type === 'shadcn' &&
									isRecord(c.data) &&
									typeof c.data['component'] === 'string'
										? c.data['component'].trim().toLowerCase()
										: null;
								const shadcnMeta = shadcnComponentMeta(shadcnSlug);

								return (
									<div className='flex flex-wrap items-center gap-2'>
										<Badge variant='secondary'>
											{c.type === 'shadcn' && shadcnSlug ? `shadcn/${shadcnSlug}` : c.type}
										</Badge>
										{shadcnMeta ? <Badge variant='outline'>{shadcnMeta.kind}</Badge> : null}
									</div>
								);
							},
							headerClassName: 'w-[140px]',
						},
						{
							header: 'Updated',
							cell: (c) => (
								<span className='text-xs text-muted-foreground'>
									{formatIso(c.updated_at)}
								</span>
							),
							headerClassName: 'w-[220px]',
						},
						{
							header: '',
							cell: (c) => (
								<div className='flex items-center justify-end gap-2'>
									<Button
										size='sm'
										variant='outline'
										onClick={() => openEdit(c)}>
										Edit
									</Button>
									<Button
										size='sm'
										variant='secondary'
										onClick={() => openClone(c)}>
										Clone
									</Button>
									<Button
										size='sm'
										variant='destructive'
										onClick={() => setConfirmDelete(c)}>
										Delete
									</Button>
								</div>
							),
							headerClassName: 'w-[260px]',
							cellClassName: 'text-right',
						},
					]}
				/>
			)}

			<Dialog
				open={editorOpen}
				onOpenChange={(open) => {
					setEditorOpen(open);
					if (!open) setEditing(null);
				}}>
				<DialogContent className='sm:max-w-2xl'>
					<DialogHeader>
						<DialogTitle>
							{editing ? 'Edit component' : 'New component'}
						</DialogTitle>
						<DialogDescription>
							Components are reusable presets that the page editor can insert.
						</DialogDescription>
					</DialogHeader>

					<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
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
										placeholder='e.g. hero-title'
										disabled={saving || !!editing}
									/>
									{editing ? (
										<p className='text-xs text-muted-foreground'>
											Slug changes are disabled for now (keeps references stable).
										</p>
									) : null}
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div className='space-y-2'>
									<Label>Type</Label>
									<Select
										value={compType}
										onValueChange={(v) => setCompType(v)}
										disabled={saving}>
										<SelectTrigger>
											<SelectValue placeholder='Type' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='editor'>editor</SelectItem>
											<SelectItem value='image'>image</SelectItem>
											<SelectItem value='button'>button</SelectItem>
											<SelectItem value='card'>card</SelectItem>
											<SelectItem value='separator'>separator</SelectItem>
											<SelectItem value='shadcn'>shadcn</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className='space-y-2'>
									<Label>Description</Label>
									<Input
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										disabled={saving}
									/>
								</div>
							</div>

							<div className='space-y-2'>
								<Label>Data (JSON)</Label>
								<Textarea
									value={dataJson}
									onChange={(e) => setDataJson(e.target.value)}
									className='font-mono text-xs min-h-[220px]'
									disabled={saving}
								/>
								<p className='text-xs text-muted-foreground'>
									Stored as JSON and used as the default <code>data</code> when inserted.
								</p>
								{compType === 'shadcn' ? (
									<p className='text-xs text-muted-foreground'>
										Docs:{' '}
										<a
											href={shadcnDocsLink ?? SHADCN_DOCS_BASE}
											target='_blank'
											rel='noreferrer'
											className='underline underline-offset-4'>
											{shadcnDocsLink ? shadcnDocsLink : SHADCN_DOCS_BASE}
										</a>
									</p>
								) : null}

								{compType === 'shadcn' && !shadcnVariants.loading && shadcnVariants.radix?.doc ? (
									<p className='text-xs text-muted-foreground'>
										Radix docs:{' '}
										<a
											href={shadcnVariants.radix.doc}
											target='_blank'
											rel='noreferrer'
											className='underline underline-offset-4'>
											{shadcnVariants.radix.doc}
										</a>
									</p>
								) : null}

								{compType === 'shadcn' && !shadcnVariants.loading && shadcnVariants.radix?.api ? (
									<p className='text-xs text-muted-foreground'>
										Radix API:{' '}
										<a
											href={shadcnVariants.radix.api}
											target='_blank'
											rel='noreferrer'
											className='underline underline-offset-4'>
											{shadcnVariants.radix.api}
										</a>
									</p>
								) : null}

								{compType === 'shadcn' &&
								shadcnComponentSlug &&
								!shadcnVariants.loading &&
								((shadcnVariants.title || shadcnVariants.description) ||
									shadcnVariants.exports.length ||
									shadcnVariants.install.length) ? (
									<details className='rounded-lg border bg-muted/10 p-3'>
										<summary className='text-sm font-medium cursor-pointer select-none'>
											Docs summary
										</summary>
										<div className='mt-3 space-y-3'>
											{shadcnVariants.title ? (
												<div className='space-y-1'>
													<div className='text-xs font-medium'>Title</div>
													<div className='text-xs text-muted-foreground'>
														{shadcnVariants.title}
													</div>
												</div>
											) : null}

											{shadcnVariants.description ? (
												<div className='space-y-1'>
													<div className='text-xs font-medium'>Description</div>
													<div className='text-xs text-muted-foreground'>
														{shadcnVariants.description}
													</div>
												</div>
											) : null}

											{shadcnVariants.exports.length ? (
												<div className='space-y-1'>
													<div className='text-xs font-medium'>Exports (anatomy)</div>
													<div className='flex flex-wrap gap-1'>
														{shadcnVariants.exports.map((e) => (
															<Badge
																key={e}
																variant='secondary'>
																{e}
															</Badge>
														))}
													</div>
												</div>
											) : null}

											{shadcnVariants.install.length ? (
												<div className='space-y-1'>
													<div className='text-xs font-medium'>Dependencies</div>
													<div className='flex flex-wrap gap-1'>
														{shadcnVariants.install.map((pkg) => (
															<Badge
																key={pkg}
																variant='outline'>
																{pkg}
															</Badge>
														))}
													</div>
												</div>
											) : null}
										</div>
									</details>
								) : null}

								{compType === 'shadcn' ? (
									<details className='rounded-lg border bg-muted/10 p-3'>
										<summary className='text-sm font-medium cursor-pointer select-none'>
											Variants (from docs)
										</summary>
										<div className='mt-3 space-y-2'>
											{!shadcnComponentSlug ? (
												<p className='text-xs text-muted-foreground'>
													Set <code>data.component</code> to a shadcn docs slug (e.g. <code>button</code>) to load variants.
												</p>
											) : shadcnVariants.loading ? (
												<p className='text-xs text-muted-foreground'>Loading…</p>
											) : shadcnVariants.error ? (
												<p className='text-xs text-red-600'>{shadcnVariants.error}</p>
											) : shadcnVariants.groups.length ? (
												<div className='space-y-3'>
													{shadcnVariants.groups.map((g) => (
														<div key={g.name} className='space-y-1'>
															<div className='text-xs font-medium'>{g.name}</div>
															<div className='flex flex-wrap gap-1'>
																{g.options.map((opt) => (
																	<Badge key={opt} variant='secondary'>
																		{opt}
																	</Badge>
																))}
															</div>
														</div>
													))}
												</div>
											) : (
												<p className='text-xs text-muted-foreground'>
													No variants detected in docs for <code>{shadcnComponentSlug}</code>.
												</p>
											)}
										</div>
									</details>
								) : null}
							</div>

							{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}
						</div>

						<div className='space-y-2'>
							<Label>Preview</Label>
							{previewError ? (
								<p className='text-sm text-red-600'>{previewError}</p>
							) : null}
							<div className='rounded-xl border bg-muted/10 p-3'>
								<ComponentPreview
									component={{
										title: title.trim() ? title.trim() : undefined,
										type: compType,
										data: previewData,
									}}
								/>
							</div>
							<p className='text-xs text-muted-foreground'>
								This is a lightweight preview of the saved <code>type</code> + <code>data</code>.
							</p>
						</div>
					</div>

					<DialogFooter>
						{editing ? (
							<Button
								variant='secondary'
								onClick={() => openClone(editing)}
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
							disabled={saving || !title.trim() || !slug.trim() || !compType.trim()}>
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
						<AlertDialogTitle>Delete component?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes <strong>{confirmDelete?.title}</strong> from the component library.
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
		</AdminListPage>
	);
}
