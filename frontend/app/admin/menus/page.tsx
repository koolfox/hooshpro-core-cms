'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
	DndContext,
	PointerSensor,
	closestCenter,
	type DragEndEvent,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';

import { apiFetch } from '@/lib/http';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api-list';
import type {
	Menu,
	MenuItem,
	MenuItemListOut,
	MenuListOut,
	Page,
	PageListOut,
} from '@/lib/types';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const LIMIT = 20;
const EMPTY_MENUS: Menu[] = [];
const EMPTY_ITEMS: MenuItem[] = [];
const EMPTY_PAGES: Page[] = [];

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseIdParam(value: string | null): number | null {
	if (!value) return null;
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

function formatDestination(it: MenuItem) {
	if (it.type === 'link') return it.href || '';
	if (it.type === 'page') return it.page_slug ? `/${it.page_slug}` : `page:${it.page_id ?? ''}`;
	return '';
}

function SortableMenuItemRow({
	item,
	disabled,
	onEdit,
	onDelete,
}: {
	item: MenuItem;
	disabled: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id,
		disabled,
	});

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				'flex items-center justify-between gap-3 rounded-lg border bg-background p-3',
				isDragging && 'opacity-70'
			)}
			{...attributes}>
			<div className='flex items-center gap-3 min-w-0'>
				<Button
					type='button'
					variant='ghost'
					size='icon'
					className='cursor-grab active:cursor-grabbing touch-none shrink-0'
					disabled={disabled}
					{...listeners}>
					<GripVertical className='h-4 w-4' />
					<span className='sr-only'>Drag</span>
				</Button>

				<div className='min-w-0'>
					<div className='font-medium truncate'>{item.label}</div>
					<div className='text-xs text-muted-foreground truncate'>
						{item.type === 'page' ? (
							<>
								Page: <span className='font-medium'>{item.page_title ?? item.page_slug ?? item.page_id}</span>{' '}
								<span className='text-muted-foreground'>({formatDestination(item)})</span>
							</>
						) : item.type === 'link' ? (
							<>
								Link: <span className='font-medium'>{item.href}</span>
							</>
						) : (
							<>Unknown: {formatDestination(item)}</>
						)}
					</div>
				</div>
			</div>

			<div className='flex items-center gap-2 shrink-0'>
				<Button
					type='button'
					variant='outline'
					size='sm'
					onClick={onEdit}
					disabled={disabled}>
					<Pencil className='h-4 w-4 mr-2' />
					Edit
				</Button>
				<Button
					type='button'
					variant='destructive'
					size='sm'
					onClick={onDelete}
					disabled={disabled}>
					<Trash2 className='h-4 w-4 mr-2' />
					Delete
				</Button>
			</div>
		</div>
	);
}

export default function AdminMenusScreen() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;
	const urlEditId = parseIdParam(searchParams.get('edit'));

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [q, setQ] = useState(urlQ);

	const [selectedMenuId, setSelectedMenuId] = useState<number | null>(urlEditId);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setQInput(urlQ);
		setSelectedMenuId(urlEditId);
	}, [urlOffset, urlQ, urlEditId]);

	const updateUrl = useCallback((next: { page?: number; q?: string; edit?: number | null }) => {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

		const edit = typeof next.edit === 'number' ? next.edit : parseIdParam(params.get('edit'));
		if (edit) params.set('edit', String(edit));
		else params.delete('edit');

		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname);
	}, [searchParams, router, pathname]);

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
		return `/api/admin/menus?${params.toString()}`;
	}, [offset, q]);

	const { data, loading, error, reload } = useApiList<MenuListOut>(listUrl, {
		nextPath: '/admin/menus',
	});

	const menus = data?.items ?? EMPTY_MENUS;
	const total = data?.total ?? 0;

	// Auto-select first menu for stable UX (and URL state)
	useEffect(() => {
		if (!loading && !error && !urlEditId && menus.length > 0) {
			updateUrl({ edit: menus[0].id });
		}
	}, [loading, error, urlEditId, menus, updateUrl]);

	const selectedMenuUrl = selectedMenuId ? `/api/admin/menus/${selectedMenuId}` : '/api/admin/menus/0';
	const {
		data: selectedMenu,
		loading: selectedMenuLoading,
		error: selectedMenuError,
		reload: reloadSelectedMenu,
	} = useApiList<Menu>(selectedMenuUrl, {
		nextPath: '/admin/menus',
		enabled: !!selectedMenuId,
	});

	const itemsUrl = selectedMenuId ? `/api/admin/menus/${selectedMenuId}/items` : '/api/admin/menus/0/items';
	const {
		data: itemsData,
		loading: itemsLoading,
		error: itemsError,
		reload: reloadItems,
		setData: setItemsData,
	} = useApiList<MenuItemListOut>(itemsUrl, {
		nextPath: '/admin/menus',
		enabled: !!selectedMenuId,
	});

	const items = itemsData?.items ?? EMPTY_ITEMS;

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const [actionError, setActionError] = useState<string | null>(null);
	const [savingOrder, setSavingOrder] = useState(false);

	async function persistOrder(nextItems: MenuItem[]) {
		if (!selectedMenuId) return;
		setSavingOrder(true);
		setActionError(null);
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/menus/${selectedMenuId}/items/reorder`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ item_ids: nextItems.map((x) => x.id) }),
				nextPath: '/admin/menus',
			});
		} catch (e) {
			setActionError(toErrorMessage(e));
			await reloadItems();
		} finally {
			setSavingOrder(false);
		}
	}

	function onDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const fromIndex = items.findIndex((x) => x.id === active.id);
		const toIndex = items.findIndex((x) => x.id === over.id);
		if (fromIndex < 0 || toIndex < 0) return;

		const next = arrayMove(items, fromIndex, toIndex);
		setItemsData({ items: next });
		void persistOrder(next);
	}

	function applyFilters() {
		const nextQ = qInput.trim();
		setOffset(0);
		setQ(nextQ);
		updateUrl({ page: 1, q: nextQ });
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setQ('');
		updateUrl({ page: 1, q: '' });
	}

	function pickMenu(menuId: number) {
		setSelectedMenuId(menuId);
		updateUrl({ edit: menuId });
	}

	// Create menu
	const [createOpen, setCreateOpen] = useState(false);
	const [createTitle, setCreateTitle] = useState('');
	const [createSlug, setCreateSlug] = useState('');
	const [createDescription, setCreateDescription] = useState('');
	const [createSaving, setCreateSaving] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	async function doCreate() {
		setCreateSaving(true);
		setCreateError(null);
		try {
			const out = await apiFetch<Menu>('/api/admin/menus', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					title: createTitle.trim(),
					slug: createSlug.trim(),
					description: createDescription.trim() ? createDescription.trim() : null,
				}),
				nextPath: '/admin/menus',
			});

			setCreateOpen(false);
			setCreateTitle('');
			setCreateSlug('');
			setCreateDescription('');
			await reload();
			updateUrl({ edit: out.id });
		} catch (e) {
			setCreateError(toErrorMessage(e));
		} finally {
			setCreateSaving(false);
		}
	}

	// Delete menu
	const [confirmDeleteMenu, setConfirmDeleteMenu] = useState<Menu | null>(null);
	const [deleteMenuError, setDeleteMenuError] = useState<string | null>(null);

	async function doDeleteMenu(m: Menu) {
		setDeleteMenuError(null);
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/menus/${m.id}`, {
				method: 'DELETE',
				nextPath: '/admin/menus',
			});
			setConfirmDeleteMenu(null);
			if (selectedMenuId === m.id) {
				updateUrl({ edit: null });
			}
			await reload();
		} catch (e) {
			setDeleteMenuError(toErrorMessage(e));
		}
	}

	// Add item
	const [addOpen, setAddOpen] = useState(false);
	const [addType, setAddType] = useState<'page' | 'link'>('page');
	const [addLabel, setAddLabel] = useState('');
	const [addPageId, setAddPageId] = useState<number | null>(null);
	const [addHref, setAddHref] = useState('');
	const [addSaving, setAddSaving] = useState(false);
	const [addError, setAddError] = useState<string | null>(null);

	const pagesUrl = '/api/admin/pages?limit=200&offset=0';
	const { data: pagesData, loading: pagesLoading, error: pagesError } = useApiList<PageListOut>(pagesUrl, {
		nextPath: '/admin/menus',
		enabled: addOpen && addType === 'page',
	});
	const pages = pagesData?.items ?? EMPTY_PAGES;

	const pagesById = useMemo(() => {
		const m = new Map<number, Page>();
		for (const p of pages) m.set(p.id, p);
		return m;
	}, [pages]);

	// auto-fill label from selected page (only if label is empty)
	const prevAddPageRef = useRef<number | null>(null);
	useEffect(() => {
		if (addType !== 'page') return;
		if (!addPageId) return;
		if (prevAddPageRef.current === addPageId) return;
		prevAddPageRef.current = addPageId;

		if (addLabel.trim()) return;
		const p = pagesById.get(addPageId);
		if (p) setAddLabel(p.title);
	}, [addType, addPageId, pagesById, addLabel]);

	async function doAddItem() {
		if (!selectedMenuId) return;

		setAddSaving(true);
		setAddError(null);
		try {
			const payload =
				addType === 'page'
					? { type: 'page', label: addLabel.trim(), page_id: addPageId }
					: { type: 'link', label: addLabel.trim(), href: addHref.trim() };

			await apiFetch<MenuItem>(`/api/admin/menus/${selectedMenuId}/items`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
				nextPath: '/admin/menus',
			});

			setAddOpen(false);
			setAddLabel('');
			setAddPageId(null);
			setAddHref('');
			setActionError(null);
			await reloadItems();
		} catch (e) {
			setAddError(toErrorMessage(e));
		} finally {
			setAddSaving(false);
		}
	}

	// Edit item
	const [editItem, setEditItem] = useState<MenuItem | null>(null);
	const [editLabel, setEditLabel] = useState('');
	const [editHref, setEditHref] = useState('');
	const [editPageId, setEditPageId] = useState<number | null>(null);
	const [editSaving, setEditSaving] = useState(false);
	const [editError, setEditError] = useState<string | null>(null);

	function openEditItem(it: MenuItem) {
		setEditItem(it);
		setEditError(null);
		setEditSaving(false);
		setEditLabel(it.label);
		setEditHref(it.href ?? '');
		setEditPageId(it.page_id ?? null);
	}

	async function doSaveItem() {
		if (!selectedMenuId || !editItem) return;
		setEditSaving(true);
		setEditError(null);
		try {
			const payload =
				editItem.type === 'page'
					? { label: editLabel.trim(), page_id: editPageId }
					: { label: editLabel.trim(), href: editHref.trim() };

			await apiFetch<MenuItem>(
				`/api/admin/menus/${selectedMenuId}/items/${editItem.id}`,
				{
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/menus',
				}
			);
			setEditItem(null);
			await reloadItems();
		} catch (e) {
			setEditError(toErrorMessage(e));
		} finally {
			setEditSaving(false);
		}
	}

	// Delete item
	const [confirmDeleteItem, setConfirmDeleteItem] = useState<MenuItem | null>(null);
	const [deleteItemError, setDeleteItemError] = useState<string | null>(null);

	async function doDeleteItem(it: MenuItem) {
		if (!selectedMenuId) return;
		setDeleteItemError(null);
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/menus/${selectedMenuId}/items/${it.id}`, {
				method: 'DELETE',
				nextPath: '/admin/menus',
			});
			setConfirmDeleteItem(null);
			await reloadItems();
		} catch (e) {
			setDeleteItemError(toErrorMessage(e));
		}
	}

	const canInteract = !loading && !selectedMenuLoading && !itemsLoading && !savingOrder;

	return (
		<AdminListPage
			title='Menus'
			description='Build your site navigation menus with drag & drop.'
			actions={
				<div className='flex items-center gap-2'>
					<Button
						variant='outline'
						asChild>
						<Link href='/' target='_blank'>
							View site
						</Link>
					</Button>
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className='h-4 w-4 mr-2' />
						New menu
					</Button>
				</div>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-9 space-y-2'>
						<Label>Search</Label>
						<Input
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search menus...'
							onKeyDown={(e) => {
								if (e.key === 'Enter') applyFilters();
								if (e.key === 'Escape') resetFilters();
							}}
						/>
					</div>
					<div className='md:col-span-3 flex gap-2 justify-end'>
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
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}

			<AdminDataTable<Menu>
				rows={menus}
				getRowKey={(m) => m.id}
				columns={[
					{
						header: 'Menu',
						cell: (m) => (
							<div className='space-y-1'>
								<div className='font-medium'>{m.title}</div>
								<div className='text-xs text-muted-foreground'>
									slug: <code className='text-xs'>{m.slug}</code>
								</div>
							</div>
						),
					},
					{
						header: 'Description',
						cell: (m) => (
							<span className='text-sm text-muted-foreground'>
								{m.description ?? '—'}
							</span>
						),
					},
					{
						header: '',
						cell: (m) => (
							<div className='flex items-center justify-end gap-2'>
								<Button
									size='sm'
									variant={selectedMenuId === m.id ? 'secondary' : 'outline'}
									onClick={() => pickMenu(m.id)}>
									{selectedMenuId === m.id ? 'Editing' : 'Edit'}
								</Button>
								<Button
									size='sm'
									variant='destructive'
									onClick={() => setConfirmDeleteMenu(m)}
									disabled={m.slug === 'main'}>
									Delete
								</Button>
							</div>
						),
						headerClassName: 'w-[140px]',
						cellClassName: 'text-right',
					},
				]}
			/>

			<div className='mt-8 space-y-3'>
				<div className='flex items-center justify-between gap-3'>
					<div className='space-y-1'>
						<div className='text-sm font-medium'>Menu builder</div>
						<div className='text-xs text-muted-foreground'>
							Select a menu above, then drag items to reorder.
						</div>
					</div>
					<Button
						variant='outline'
						onClick={() => {
							void reloadSelectedMenu();
							void reloadItems();
						}}
						disabled={!selectedMenuId}>
						Refresh
					</Button>
				</div>

				{selectedMenuError ? (
					<p className='text-sm text-red-600'>{selectedMenuError}</p>
				) : null}
				{itemsError ? (
					<p className='text-sm text-red-600'>{itemsError}</p>
				) : null}
				{actionError ? (
					<p className='text-sm text-red-600'>{actionError}</p>
				) : null}

				{selectedMenu ? (
					<div className='rounded-xl border p-4 space-y-3'>
						<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
							<div className='space-y-1'>
								<div className='font-medium'>{selectedMenu.title}</div>
								<div className='text-xs text-muted-foreground'>
									slug: <code className='text-xs'>{selectedMenu.slug}</code>{' '}
									{selectedMenu.slug === 'none' ? '(hidden)' : null}
								</div>
							</div>

							<div className='flex items-center gap-2'>
								<Button
									onClick={() => setAddOpen(true)}
									disabled={!canInteract}>
									<Plus className='h-4 w-4 mr-2' />
									Add item
								</Button>
								<Button
									variant='outline'
									asChild>
									<Link href={`/?menu=${encodeURIComponent(selectedMenu.slug)}`} target='_blank'>
										Preview
									</Link>
								</Button>
							</div>
						</div>

						{selectedMenu.description ? (
							<p className='text-sm text-muted-foreground'>{selectedMenu.description}</p>
						) : null}

						{itemsLoading ? <p className='text-sm text-muted-foreground'>Loading items…</p> : null}

						{!itemsLoading && items.length === 0 ? (
							<div className='rounded-lg border p-4 text-sm text-muted-foreground'>
								No items yet. Click “Add item”.
							</div>
						) : null}

						{!itemsLoading && items.length > 0 ? (
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={onDragEnd}>
								<SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
									<div className='space-y-2'>
										{items.map((it) => (
											<SortableMenuItemRow
												key={it.id}
												item={it}
												disabled={!canInteract}
												onEdit={() => openEditItem(it)}
												onDelete={() => setConfirmDeleteItem(it)}
											/>
										))}
									</div>
								</SortableContext>
							</DndContext>
						) : null}

						{savingOrder ? (
							<p className='text-xs text-muted-foreground'>Saving order…</p>
						) : null}
					</div>
				) : (
					<div className='rounded-xl border p-6 text-sm text-muted-foreground'>
						Create a menu (or select an existing one) to start building navigation.
					</div>
				)}
			</div>

			{/* Create menu dialog */}
			<Dialog
				open={createOpen}
				onOpenChange={(v) => {
					setCreateOpen(v);
					if (!v) {
						setCreateTitle('');
						setCreateSlug('');
						setCreateDescription('');
						setCreateError(null);
						setCreateSaving(false);
					}
				}}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>New menu</DialogTitle>
						<DialogDescription>Create a named navigation menu (e.g. main, footer).</DialogDescription>
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
								placeholder='Main'
								disabled={createSaving}
							/>
						</div>

						<div className='space-y-2'>
							<Label>Slug</Label>
							<Input
								value={createSlug}
								onChange={(e) => setCreateSlug(slugify(e.target.value))}
								placeholder='main'
								disabled={createSaving}
							/>
							<p className='text-xs text-muted-foreground'>
								Templates/pages reference menus by slug (example: <code>main</code>).
							</p>
						</div>

						<div className='space-y-2'>
							<Label>Description</Label>
							<Input
								value={createDescription}
								onChange={(e) => setCreateDescription(e.target.value)}
								placeholder='Primary site navigation.'
								disabled={createSaving}
							/>
						</div>

						{createError ? <p className='text-sm text-red-600'>{createError}</p> : null}
					</div>

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setCreateOpen(false)}
							disabled={createSaving}>
							Cancel
						</Button>
						<Button
							onClick={doCreate}
							disabled={createSaving || !createTitle.trim() || !createSlug.trim()}>
							{createSaving ? 'Creating…' : 'Create'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete menu */}
			<AlertDialog
				open={!!confirmDeleteMenu}
				onOpenChange={(v) => !v && setConfirmDeleteMenu(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete menu?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete <b>{confirmDeleteMenu?.title}</b> and all of its items.
							Templates/pages referencing this slug will fall back to the default menu.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{deleteMenuError ? <p className='text-sm text-red-600'>{deleteMenuError}</p> : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={loading || confirmDeleteMenu?.slug === 'main'}
							onClick={() => confirmDeleteMenu && doDeleteMenu(confirmDeleteMenu)}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Add item */}
			<Dialog
				open={addOpen}
				onOpenChange={(v) => {
					setAddOpen(v);
					if (!v) {
						setAddType('page');
						setAddLabel('');
						setAddPageId(null);
						setAddHref('');
						setAddError(null);
						setAddSaving(false);
					}
				}}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>Add menu item</DialogTitle>
						<DialogDescription>Add a page link or a custom URL.</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label>Type</Label>
								<Select
									value={addType}
									onValueChange={(v) => setAddType(v as 'page' | 'link')}
									disabled={addSaving}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='page'>Page</SelectItem>
										<SelectItem value='link'>Link</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className='space-y-2'>
								<Label>Label</Label>
								<Input
									value={addLabel}
									onChange={(e) => setAddLabel(e.target.value)}
									placeholder='e.g. About'
									disabled={addSaving}
								/>
							</div>
						</div>

						{addType === 'page' ? (
							<div className='space-y-2'>
								<Label>Page</Label>
								<Select
									value={addPageId ? String(addPageId) : ''}
									onValueChange={(v) => setAddPageId(Number(v))}
									disabled={addSaving || pagesLoading}>
									<SelectTrigger>
										<SelectValue placeholder='Select a page' />
									</SelectTrigger>
									<SelectContent>
										{pages.map((p) => (
											<SelectItem
												key={p.id}
												value={String(p.id)}>
												{p.title} ({p.slug}) {p.status === 'draft' ? '[draft]' : ''}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{pagesError ? <p className='text-xs text-red-600'>{pagesError}</p> : null}
							</div>
						) : (
							<div className='space-y-2'>
								<Label>URL</Label>
								<Input
									value={addHref}
									onChange={(e) => setAddHref(e.target.value)}
									placeholder='e.g. /pricing or https://...'
									disabled={addSaving}
								/>
							</div>
						)}

						{addError ? <p className='text-sm text-red-600'>{addError}</p> : null}
					</div>

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setAddOpen(false)}
							disabled={addSaving}>
							Cancel
						</Button>
						<Button
							onClick={doAddItem}
							disabled={
								addSaving ||
								!addLabel.trim() ||
								(addType === 'page' ? !addPageId : !addHref.trim())
							}>
							{addSaving ? 'Adding…' : 'Add'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit item */}
			<Dialog
				open={!!editItem}
				onOpenChange={(v) => !v && setEditItem(null)}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>Edit item</DialogTitle>
						<DialogDescription>Update label and destination.</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label>Label</Label>
							<Input
								value={editLabel}
								onChange={(e) => setEditLabel(e.target.value)}
								disabled={editSaving}
							/>
						</div>

						{editItem?.type === 'page' ? (
							<div className='space-y-2'>
								<Label>Page</Label>
								<Select
									value={editPageId ? String(editPageId) : ''}
									onValueChange={(v) => setEditPageId(Number(v))}
									disabled={editSaving || pagesLoading}>
									<SelectTrigger>
										<SelectValue placeholder='Select a page' />
									</SelectTrigger>
									<SelectContent>
										{pages.map((p) => (
											<SelectItem
												key={p.id}
												value={String(p.id)}>
												{p.title} ({p.slug}) {p.status === 'draft' ? '[draft]' : ''}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{pagesError ? <p className='text-xs text-red-600'>{pagesError}</p> : null}
							</div>
						) : (
							<div className='space-y-2'>
								<Label>URL</Label>
								<Input
									value={editHref}
									onChange={(e) => setEditHref(e.target.value)}
									disabled={editSaving}
								/>
							</div>
						)}

						{editError ? <p className='text-sm text-red-600'>{editError}</p> : null}
					</div>

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setEditItem(null)}
							disabled={editSaving}>
							Cancel
						</Button>
						<Button
							onClick={doSaveItem}
							disabled={
								editSaving ||
								!editLabel.trim() ||
								(editItem?.type === 'page'
									? !editPageId
									: !editHref.trim())
							}>
							{editSaving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete item */}
			<AlertDialog
				open={!!confirmDeleteItem}
				onOpenChange={(v) => !v && setConfirmDeleteItem(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete item?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete <b>{confirmDeleteItem?.label}</b>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{deleteItemError ? <p className='text-sm text-red-600'>{deleteItemError}</p> : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={itemsLoading}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={itemsLoading}
							onClick={() => confirmDeleteItem && doDeleteItem(confirmDeleteItem)}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AdminListPage>
	);
}
