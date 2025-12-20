'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

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

import { apiFetch } from '@/lib/http';
import type { Page, PageListOut } from '@/lib/types';
import {
	defaultPageBuilderState,
	serializePageBuilderState,
} from '@/lib/page-builder';
import { useApiList } from '@/hooks/use-api-list';
import { AdminListPage } from '@/components/admin/admin-list-page';
import { AdminDataTable } from '@/components/admin/admin-data-table';

const LIMIT = 20;
type StatusFilter = 'all' | 'draft' | 'published';
const EMPTY_PAGES: Page[] = [];

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

function defaultPageBlocks() {
	return serializePageBuilderState(defaultPageBuilderState());
}

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export default function AdminPagesScreen() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlStatusRaw = (searchParams.get('status') ?? 'all').trim();
	const urlStatus: StatusFilter =
		urlStatusRaw === 'draft' || urlStatusRaw === 'published' ? urlStatusRaw : 'all';
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [statusInput, setStatusInput] = useState<StatusFilter>(urlStatus);

	const [q, setQ] = useState(urlQ);
	const [status, setStatus] = useState<StatusFilter>(urlStatus);

	const qRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setStatus(urlStatus);
		setQInput(urlQ);
		setStatusInput(urlStatus);
	}, [urlOffset, urlQ, urlStatus]);

	function updateUrl(next: { page?: number; q?: string; status?: StatusFilter }) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

		const rawStatus = (next.status ?? (params.get('status') ?? 'all')).trim();
		const nextStatus: StatusFilter =
			rawStatus === 'draft' || rawStatus === 'published' ? rawStatus : 'all';
		if (nextStatus !== 'all') params.set('status', nextStatus);
		else params.delete('status');

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
		if (status !== 'all') params.set('status', status);
		return `/api/admin/pages?${params.toString()}`;
	}, [offset, q, status]);

	const { data, loading, error, reload } = useApiList<PageListOut>(listUrl, {
		nextPath: '/admin/pages',
	});

	const items = data?.items ?? EMPTY_PAGES;
	const total = data?.total ?? 0;

	function applyFilters() {
		const nextQ = qInput.trim();
		const nextStatus = statusInput;
		setOffset(0);
		setQ(nextQ);
		setStatus(nextStatus);
		updateUrl({ page: 1, q: nextQ, status: nextStatus });
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setStatusInput('all');
		setQ('');
		setStatus('all');
		updateUrl({ page: 1, q: '', status: 'all' });
		qRef.current?.focus();
	}

	const [editorOpen, setEditorOpen] = useState(false);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [slugTouched, setSlugTouched] = useState(false);

	const [pageStatus, setPageStatus] = useState<'draft' | 'published'>(
		'draft'
	);

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	function resetForm() {
		setTitle('');
		setSlug('');
		setSlugTouched(false);
		setPageStatus('draft');
		setFormError(null);
		setSaving(false);
	}

	function openCreate() {
		resetForm();
		setEditorOpen(true);
	}

	async function submitCreate() {
		setSaving(true);
		setFormError(null);

		const payload = {
			title: title.trim(),
			slug: slug.trim(),
			status: pageStatus,
			blocks: defaultPageBlocks(),
		};

		try {
			await apiFetch<Page>('/api/admin/pages', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
				nextPath: '/admin/pages',
			});
			setEditorOpen(false);
			await reload();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	const [confirmDelete, setConfirmDelete] = useState<Page | null>(null);

	async function doDelete(p: Page) {
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/pages/${p.id}`, {
				method: 'DELETE',
				nextPath: '/admin/pages',
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
				setActionError(e instanceof Error ? e.message : String(e));
			}
	}

	return (
		<AdminListPage
			title='Pages'
			description='Create/select here. Edit happens on the page itself. Homepage is the page with slug "home" (route "/").'
			actions={
				<Button
					onClick={openCreate}
					disabled={loading}>
					New Page
				</Button>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-6 space-y-2'>
						<Label>Search</Label>
						<Input
							ref={qRef}
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search title or slug...'
							onKeyDown={(e) => {
								if (e.key === 'Enter') applyFilters();
								if (e.key === 'Escape') resetFilters();
							}}
						/>
					</div>

					<div className='md:col-span-3 space-y-2'>
						<Label>Status</Label>
						<Select
							value={statusInput}
							onValueChange={(v) => setStatusInput(v as StatusFilter)}>
							<SelectTrigger>
								<SelectValue placeholder='All' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>all</SelectItem>
								<SelectItem value='draft'>draft</SelectItem>
								<SelectItem value='published'>
									published
								</SelectItem>
							</SelectContent>
						</Select>
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

			{loading ? (
				<p className='text-sm text-muted-foreground'>Loading…</p>
			) : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}
			{actionError ? (
				<p className='text-sm text-red-600'>{actionError}</p>
			) : null}

			{!loading && !error && items.length === 0 ? (
				<div className='rounded-xl border p-6'>
					<p className='text-sm text-muted-foreground'>
						No pages yet.
					</p>
				</div>
			) : null}

			{!loading && !error && items.length > 0 ? (
				<AdminDataTable
					rows={items}
					getRowKey={(p) => p.id}
					columns={[
						{
							header: 'Title',
							cell: (p) => p.title,
							cellClassName: 'font-medium whitespace-normal',
						},
						{
							header: 'Slug',
							cell: (p) => (
								<div className='space-y-1'>
									<div className='text-sm text-muted-foreground'>
										{p.slug === 'home' ? '/' : `/${p.slug}`}
									</div>
									{p.slug === 'home' ? (
										<div className='text-xs text-muted-foreground'>
											slug: home
										</div>
									) : null}
								</div>
							),
						},
						{
							header: 'Status',
							cell: (p) => (
								<Badge
									variant={
										p.status === 'published'
											? 'default'
											: 'secondary'
									}>
									{p.status}
								</Badge>
							),
						},
						{
							header: 'Updated',
							cell: (p) => formatIso(p.updated_at),
							cellClassName: 'text-muted-foreground',
						},
						{
							header: <span className='sr-only'>Actions</span>,
							headerClassName: 'text-right',
							cellClassName: 'text-right',
							cell: (p) => (
								<div className='flex justify-end gap-2'>
									<Button
										asChild
										variant='outline'
										size='sm'>
										<Link href={p.slug === 'home' ? '/?edit=1' : `/${p.slug}?edit=1`}>
											Edit
										</Link>
									</Button>

									<Button
										variant='destructive'
										size='sm'
										disabled={loading}
										onClick={() => setConfirmDelete(p)}>
										Delete
									</Button>
								</div>
							),
						},
					]}
				/>
			) : null}

			<Dialog
				open={editorOpen}
				onOpenChange={setEditorOpen}>
				<DialogContent className='sm:max-w-xl'>
					<DialogHeader>
						<DialogTitle>New Page</DialogTitle>
						<DialogDescription>
							Editing happens on the page itself.
						</DialogDescription>
					</DialogHeader>

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
								disabled={saving}
							/>
						</div>

						<div className='space-y-2'>
							<Label>Status</Label>
							<Select
								value={pageStatus}
								onValueChange={(v) =>
									setPageStatus(v as 'draft' | 'published')
								}
								disabled={saving}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='draft'>draft</SelectItem>
									<SelectItem value='published'>
										published
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{formError ? (
						<p className='text-sm text-red-600'>{formError}</p>
					) : null}

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setEditorOpen(false)}
							disabled={saving}>
							Cancel
						</Button>
						<Button
							onClick={submitCreate}
							disabled={saving || !title.trim() || !slug.trim()}>
							{saving ? 'Creating…' : 'Create'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!confirmDelete}
				onOpenChange={(v) => !v && setConfirmDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete page?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete{' '}
							<b>{confirmDelete?.title}</b>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={loading}
							onClick={() =>
								confirmDelete && doDelete(confirmDelete)
							}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AdminListPage>
	);
}
