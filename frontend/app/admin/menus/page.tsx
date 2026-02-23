'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
	buildAdminMenusListUrl,
	createAdminMenu,
	createAdminMenuItem,
	deleteAdminMenu,
	deleteAdminMenuItem,
	listAdminMenuItems,
	reorderAdminMenuItems,
	updateAdminMenu,
	updateAdminMenuItem,
	type MenuSort,
	MENU_SORT_FIELDS,
	type SortDir,
} from '@/lib/api/menus';
import { listAdminPages } from '@/lib/api/pages';
import { useApiList } from '@/hooks/use-api-list';
import { formatUiError } from '@/lib/error-message';
import type { Menu, MenuItem, MenuListOut, Page } from '@/lib/types';

import { AdminDataTable } from '@/components/admin/admin-data-table';
import { AdminListPage } from '@/components/admin/admin-list-page';
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
	MenuCanvasDesigner,
	type MenuCanvasDraftItem,
} from '@/components/menus/menu-canvas-designer';

const LIMIT = 20;
const DEFAULT_SORT: MenuSort = 'updated_at';
const DEFAULT_DIR: SortDir = 'desc';

type DraftMenuItem = MenuCanvasDraftItem;

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : Number.NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseSortParam(value: string | null): MenuSort {
	const v = (value ?? '').trim().toLowerCase();
	if ((MENU_SORT_FIELDS as readonly string[]).includes(v)) return v as MenuSort;
	return DEFAULT_SORT;
}

function parseDirParam(value: string | null): SortDir {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'asc' ? 'asc' : DEFAULT_DIR;
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

function toDraftItem(item: MenuItem): DraftMenuItem {
	return {
		key: `id-${item.id}`,
		id: item.id,
		type: item.type === 'page' ? 'page' : 'link',
		label: item.label,
		page_id: item.page_id ?? null,
		href: item.href ?? '',
		order_index: item.order_index,
	};
}

export default function AdminMenusPage() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const newItemCounter = useRef(1);

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;
	const urlSort = parseSortParam(searchParams.get('sort'));
	const urlDir = parseDirParam(searchParams.get('dir'));

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [sortInput, setSortInput] = useState<MenuSort>(urlSort);
	const [dirInput, setDirInput] = useState<SortDir>(urlDir);

	const [q, setQ] = useState(urlQ);
	const [sort, setSort] = useState<MenuSort>(urlSort);
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

	function updateUrl(next: {
		page?: number;
		q?: string;
		sort?: MenuSort;
		dir?: SortDir;
	}) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

		const nextSort = next.sort ?? parseSortParam(params.get('sort'));
		const nextDir = next.dir ?? parseDirParam(params.get('dir'));
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
			buildAdminMenusListUrl({
				limit: LIMIT,
				offset,
				q,
				sort: sort !== DEFAULT_SORT || dir !== DEFAULT_DIR ? sort : undefined,
				dir: sort !== DEFAULT_SORT || dir !== DEFAULT_DIR ? dir : undefined,
			}),
		[offset, q, sort, dir]
	);

	const { data, loading, error, reload } = useApiList<MenuListOut>(listUrl, {
		nextPath: '/admin/menus',
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	function applyFilters() {
		const nextQ = qInput.trim();
		setOffset(0);
		setQ(nextQ);
		setSort(sortInput);
		setDir(dirInput);
		updateUrl({ page: 1, q: nextQ, sort: sortInput, dir: dirInput });
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
	const [editing, setEditing] = useState<Menu | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<Menu | null>(null);

	function openCreate() {
		setEditing(null);
		setTitle('');
		setSlug('');
		setDescription('');
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(menu: Menu) {
		setEditing(menu);
		setTitle(menu.title);
		setSlug(menu.slug);
		setDescription(menu.description ?? '');
		setFormError(null);
		setEditorOpen(true);
	}

	async function saveMenu() {
		setSaving(true);
		setFormError(null);
		try {
			if (editing) {
				await updateAdminMenu(
					editing.id,
					{
						title: title.trim(),
						description: description.trim() ? description.trim() : null,
					},
					'/admin/menus'
				);
			} else {
				await createAdminMenu(
					{
						title: title.trim(),
						slug: slug.trim(),
						description: description.trim() ? description.trim() : null,
					},
					'/admin/menus'
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

	async function doDelete(menu: Menu) {
		try {
			await deleteAdminMenu(menu.id, '/admin/menus');
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

	const [structureOpen, setStructureOpen] = useState(false);
	const [structureMenu, setStructureMenu] = useState<Menu | null>(null);
	const [initialStructureItems, setInitialStructureItems] = useState<DraftMenuItem[]>([]);
	const [draftItems, setDraftItems] = useState<DraftMenuItem[]>([]);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [pages, setPages] = useState<Page[]>([]);
	const [structureLoading, setStructureLoading] = useState(false);
	const [structureSaving, setStructureSaving] = useState(false);
	const [structureError, setStructureError] = useState<string | null>(null);

	const selectedItem = useMemo(
		() => draftItems.find((item) => item.key === selectedKey) ?? null,
		[draftItems, selectedKey]
	);

	async function openStructure(menu: Menu) {
		setStructureMenu(menu);
		setStructureOpen(true);
		setStructureLoading(true);
		setStructureError(null);
		setSelectedKey(null);
		try {
			const [menuItemsOut, pagesOut] = await Promise.all([
				listAdminMenuItems(menu.id, '/admin/menus'),
				listAdminPages({ limit: 200, offset: 0, status: 'all' }, '/admin/menus'),
			]);
			const initial = menuItemsOut.items
				.slice()
				.sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id))
				.map(toDraftItem)
				.map((item, index) => ({ ...item, order_index: index }));
			setInitialStructureItems(initial);
			setDraftItems(initial);
			setPages(pagesOut.items);
			if (initial.length > 0) setSelectedKey(initial[0]?.key ?? null);
		} catch (e) {
			setStructureError(toErrorMessage(e));
		} finally {
			setStructureLoading(false);
		}
	}

	function updateDraftItem(key: string, patch: Partial<DraftMenuItem>) {
		setDraftItems((prev) =>
			prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
		);
	}

	function addDraftItem(type: 'page' | 'link') {
		const key = `new-${Date.now()}-${newItemCounter.current}`;
		newItemCounter.current += 1;
		setDraftItems((prev) => {
			const next = [
				...prev,
				{
					key,
					id: null,
					type,
					label: type === 'page' ? 'New page link' : 'New custom link',
					page_id: null,
					href: type === 'link' ? '/' : '',
					order_index: prev.length,
				},
			];
			return next;
		});
		setSelectedKey(key);
	}

	function removeDraftItem(key: string) {
		setDraftItems((prev) => {
			const next = prev.filter((item) => item.key !== key).map((item, index) => ({ ...item, order_index: index }));
			if (!next.some((item) => item.key === selectedKey)) {
				setSelectedKey(next[0]?.key ?? null);
			}
			return next;
		});
	}

	function validateDraftItems(itemsToValidate: DraftMenuItem[]) {
		for (const item of itemsToValidate) {
			if (!item.label.trim()) {
				return `Item '${item.key}' requires a label.`;
			}
			if (item.type === 'page') {
				if (!item.page_id || item.page_id <= 0) {
					return `Page item '${item.label}' requires a page.`;
				}
			}
			if (item.type === 'link') {
				if (!item.href.trim()) {
					return `Link item '${item.label}' requires an href.`;
				}
			}
		}
		return null;
	}

	async function saveStructure() {
		if (!structureMenu) return;
		const validationError = validateDraftItems(draftItems);
		if (validationError) {
			setStructureError(validationError);
			return;
		}

		setStructureSaving(true);
		setStructureError(null);
		try {
			const byIdInitial = new Map<number, DraftMenuItem>();
			for (const item of initialStructureItems) {
				if (item.id) byIdInitial.set(item.id, item);
			}

			const currentIds = new Set<number>();
			for (const item of draftItems) {
				if (item.id) currentIds.add(item.id);
			}

			for (const [id] of byIdInitial.entries()) {
				if (!currentIds.has(id)) {
					await deleteAdminMenuItem(structureMenu.id, id, '/admin/menus');
				}
			}

			const draftWithIds: DraftMenuItem[] = [];
			for (let index = 0; index < draftItems.length; index += 1) {
				const item = draftItems[index];
				const normalized = {
					...item,
					label: item.label.trim(),
					href: item.href.trim(),
					order_index: index,
				};

				if (normalized.id) {
					await updateAdminMenuItem(
						structureMenu.id,
						normalized.id,
						normalized.type === 'page'
							? {
								label: normalized.label,
								page_id: normalized.page_id,
							}
							: {
								label: normalized.label,
								href: normalized.href,
							},
						'/admin/menus'
					);
					draftWithIds.push(normalized);
					continue;
				}

				const created = await createAdminMenuItem(
					structureMenu.id,
					normalized.type === 'page'
						? {
							type: 'page',
							label: normalized.label,
							page_id: normalized.page_id,
						}
						: {
							type: 'link',
							label: normalized.label,
							href: normalized.href,
						},
					'/admin/menus'
				);
				draftWithIds.push({
					...normalized,
					key: `id-${created.id}`,
					id: created.id,
				});
			}

			const orderedIds = draftWithIds
				.map((item) => item.id)
				.filter((id): id is number => Boolean(id));
			await reorderAdminMenuItems(structureMenu.id, orderedIds, '/admin/menus');

			const refreshed = await listAdminMenuItems(structureMenu.id, '/admin/menus');
			const nextInitial = refreshed.items
				.slice()
				.sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id))
				.map(toDraftItem)
				.map((item, index) => ({ ...item, order_index: index }));
			setInitialStructureItems(nextInitial);
			setDraftItems(nextInitial);
			if (nextInitial.length > 0) {
				if (!nextInitial.some((item) => item.key === selectedKey)) {
					setSelectedKey(nextInitial[0]?.key ?? null);
				}
			} else {
				setSelectedKey(null);
			}
			await reload();
		} catch (e) {
			setStructureError(toErrorMessage(e));
		} finally {
			setStructureSaving(false);
		}
	}

	return (
		<AdminListPage
			title='Menus'
			description='Visual navigation editor using node graphs (flows/entities/menu structure under one canvas paradigm).'
			actions={<Button onClick={openCreate} disabled={loading}>New menu</Button>}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-6 space-y-2'>
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
						<Select value={sortInput} onValueChange={(v) => setSortInput(v as MenuSort)} disabled={loading}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value='updated_at'>Updated</SelectItem>
								<SelectItem value='created_at'>Created</SelectItem>
								<SelectItem value='title'>Title</SelectItem>
								<SelectItem value='slug'>Slug</SelectItem>
								<SelectItem value='id'>ID</SelectItem>
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
				getRowKey={(menu) => menu.id}
				columns={[
					{
						header: 'Menu',
						cell: (menu) => (
							<div className='space-y-1'>
								<div className='font-medium'>{menu.title}</div>
								<div className='text-xs text-muted-foreground'>/{menu.slug}</div>
								{menu.description ? <div className='text-xs text-muted-foreground line-clamp-2'>{menu.description}</div> : null}
							</div>
						),
					},
					{
						header: 'Updated',
						cell: (menu) => <span className='text-xs text-muted-foreground'>{formatIso(menu.updated_at)}</span>,
						headerClassName: 'w-[220px]',
					},
					{
						header: '',
						cell: (menu) => (
							<div className='flex items-center justify-end gap-2'>
								<Button size='sm' variant='outline' onClick={() => openStructure(menu)}>Structure</Button>
								<Button size='sm' variant='outline' onClick={() => openEdit(menu)}>Edit</Button>
								<Button size='sm' variant='destructive' onClick={() => setConfirmDelete(menu)}>Delete</Button>
							</div>
						),
						headerClassName: 'w-[300px]',
						cellClassName: 'text-right',
					},
				]}
			/>

			<Dialog open={editorOpen} onOpenChange={(open) => {
				setEditorOpen(open);
				if (!open) setEditing(null);
			}}>
				<DialogContent className='sm:max-w-2xl'>
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit menu' : 'New menu'}</DialogTitle>
						<DialogDescription>
							Create a menu container. Use the “Structure” action to edit links visually.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label>Title</Label>
							<Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
						</div>
						<div className='space-y-2'>
							<Label>Slug</Label>
							<Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={saving || !!editing} />
							{editing ? <p className='text-xs text-muted-foreground'>Slug is immutable after creation.</p> : null}
						</div>
						<div className='space-y-2'>
							<Label>Description</Label>
							<Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} rows={3} />
						</div>
						{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
						<Button onClick={saveMenu} disabled={saving || !title.trim() || (!editing && !slug.trim())}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={structureOpen} onOpenChange={(open) => {
				setStructureOpen(open);
				if (!open) {
					setStructureMenu(null);
					setSelectedKey(null);
					setStructureError(null);
				}
			}}>
				<DialogContent className='sm:max-w-7xl max-h-[92svh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>Menu structure: {structureMenu?.title ?? '...'}</DialogTitle>
						<DialogDescription>
							Graph editor for menu nodes. Drag nodes to reorder, then save to persist.
						</DialogDescription>
					</DialogHeader>

					{structureLoading ? <p className='text-sm text-muted-foreground'>Loading structure…</p> : null}

					{!structureLoading ? (
						<div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
							<div className='space-y-4 xl:col-span-2'>
								<div className='flex items-center justify-between'>
									<h3 className='text-sm font-semibold'>Visual node map</h3>
									<p className='text-xs text-muted-foreground'>Drag items to reorder. Root node is fixed.</p>
								</div>
								<MenuCanvasDesigner
									items={draftItems}
									onItemsChange={(next) => setDraftItems(next.map((item, index) => ({ ...item, order_index: index })))}
									onSelectItem={(selection) => setSelectedKey(selection.key)}
									disabled={structureSaving}
								/>

								<div className='flex gap-2'>
									<Button size='sm' variant='outline' onClick={() => addDraftItem('page')} disabled={structureSaving}>+ Page item</Button>
									<Button size='sm' variant='outline' onClick={() => addDraftItem('link')} disabled={structureSaving}>+ Custom link</Button>
								</div>

								<div className='rounded-xl border p-3 space-y-2'>
									<div className='text-xs font-medium text-muted-foreground'>Current order</div>
									<div className='flex flex-wrap gap-2'>
										{draftItems.map((item, index) => (
											<button
												type='button'
												key={item.key}
												onClick={() => setSelectedKey(item.key)}
												className={`rounded-md border px-2 py-1 text-xs ${selectedKey === item.key ? 'border-primary bg-primary/10' : 'border-border'}`}>
												#{index + 1} {item.label || '(untitled)'}
											</button>
										))}
									</div>
								</div>
							</div>

							<div className='space-y-4'>
								<div className='rounded-xl border p-4 space-y-3'>
									<div className='flex items-center justify-between'>
										<h3 className='text-sm font-semibold'>Item inspector</h3>
										{selectedItem ? (
											<Button size='sm' variant='destructive' onClick={() => removeDraftItem(selectedItem.key)} disabled={structureSaving}>Delete</Button>
										) : null}
									</div>

									{selectedItem ? (
										<div className='space-y-3'>
											<div className='space-y-1'>
												<Label>Label</Label>
												<Input
													value={selectedItem.label}
													onChange={(e) => updateDraftItem(selectedItem.key, { label: e.target.value })}
													disabled={structureSaving}
												/>
											</div>

											<div className='space-y-1'>
												<Label>Type</Label>
												<Select
													value={selectedItem.type}
													onValueChange={(v) => {
														const nextType = v as 'page' | 'link';
														if (nextType === 'page') {
															updateDraftItem(selectedItem.key, { type: 'page', href: '' });
															return;
														}
														updateDraftItem(selectedItem.key, { type: 'link', page_id: null, href: selectedItem.href || '/' });
													}}
													disabled={structureSaving}>
													<SelectTrigger><SelectValue /></SelectTrigger>
													<SelectContent>
														<SelectItem value='page'>Page</SelectItem>
														<SelectItem value='link'>Custom link</SelectItem>
													</SelectContent>
												</Select>
											</div>

											{selectedItem.type === 'page' ? (
												<div className='space-y-1'>
													<Label>Page</Label>
													<Select
														value={selectedItem.page_id ? String(selectedItem.page_id) : '__none'}
														onValueChange={(v) => {
															if (v === '__none') {
																updateDraftItem(selectedItem.key, { page_id: null });
																return;
															}
															const parsed = Number.parseInt(v, 10);
															updateDraftItem(selectedItem.key, { page_id: Number.isFinite(parsed) ? parsed : null });
														}}
														disabled={structureSaving}>
														<SelectTrigger><SelectValue /></SelectTrigger>
														<SelectContent>
															<SelectItem value='__none'>Select page...</SelectItem>
															{pages.map((page) => (
																<SelectItem key={page.id} value={String(page.id)}>
																	{page.title} /{page.slug}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											) : (
												<div className='space-y-1'>
													<Label>Href</Label>
													<Input
														value={selectedItem.href}
														onChange={(e) => updateDraftItem(selectedItem.key, { href: e.target.value })}
														placeholder='/contact or https://example.com'
														disabled={structureSaving}
													/>
												</div>
											)}
										</div>
									) : (
										<p className='text-sm text-muted-foreground'>Select a node from the graph or order chips.</p>
									)}
								</div>

								<div className='rounded-xl border p-4 space-y-2'>
									<h3 className='text-sm font-semibold'>All items</h3>
									<div className='max-h-[280px] overflow-auto space-y-2'>
										{draftItems.map((item, index) => (
											<button
												type='button'
												key={item.key}
												onClick={() => setSelectedKey(item.key)}
												className={`w-full rounded-lg border px-3 py-2 text-left ${selectedKey === item.key ? 'border-primary bg-primary/10' : 'border-border'}`}>
												<div className='text-xs text-muted-foreground'>#{index + 1} · {item.type}</div>
												<div className='text-sm font-medium truncate'>{item.label || '(untitled)'}</div>
											</button>
										))}
									</div>
								</div>
							</div>
						</div>
					) : null}

					{structureError ? <p className='text-sm text-red-600'>{structureError}</p> : null}

					<DialogFooter>
						<Button variant='outline' onClick={() => setStructureOpen(false)} disabled={structureSaving}>Close</Button>
						<Button onClick={saveStructure} disabled={structureSaving || !structureMenu}>
							{structureSaving ? 'Saving…' : 'Save structure'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete menu?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete <strong>{confirmDelete?.title}</strong> and all its items.
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
