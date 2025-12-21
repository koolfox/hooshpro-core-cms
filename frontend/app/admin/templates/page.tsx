'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { apiFetch } from '@/lib/http';
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

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
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

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [q, setQ] = useState(urlQ);

	const qRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setQInput(urlQ);
	}, [urlOffset, urlQ]);

	function updateUrl(next: { page?: number; q?: string }) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

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
		return `/api/admin/templates?${params.toString()}`;
	}, [offset, q]);

	const { data, loading, error, reload } = useApiList<PageTemplateListOut>(listUrl, {
		nextPath: '/admin/templates',
	});

	const items = data?.items ?? EMPTY_TEMPLATES;
	const total = data?.total ?? 0;

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
				await apiFetch<PageTemplate>(`/api/admin/templates/${editing.id}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/templates',
				});
			} else {
				await apiFetch<PageTemplate>('/api/admin/templates', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/templates',
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

	const [confirmDelete, setConfirmDelete] = useState<PageTemplate | null>(null);

	async function doDelete(t: PageTemplate) {
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/templates/${t.id}`, {
				method: 'DELETE',
				nextPath: '/admin/templates',
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
					<div className='md:col-span-9 space-y-2'>
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
