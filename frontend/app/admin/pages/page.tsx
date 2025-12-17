'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

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

type EditorMode = 'create';

const LIMIT = 20;

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export default function AdminPagesScreen() {
	const [items, setItems] = useState<Page[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [offset, setOffset] = useState(0);
	const [qInput, setQInput] = useState('');
	const [statusInput, setStatusInput] = useState<
		'all' | 'draft' | 'published'
	>('all');

	const [q, setQ] = useState('');
	const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all');

	const qRef = useRef<HTMLInputElement | null>(null);

	const canPrev = offset > 0;
	const canNext = offset + LIMIT < total;

	const listUrl = useMemo(() => {
		const params = new URLSearchParams();
		params.set('limit', String(LIMIT));
		params.set('offset', String(offset));
		if (q.trim()) params.set('q', q.trim());
		if (status !== 'all') params.set('status', status);
		return `/api/admin/pages?${params.toString()}`;
	}, [offset, q, status]);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const data = await apiFetch<PageListOut>(listUrl, {
				cache: 'no-store',
				nextPath: '/admin/pages',
			});
			setItems(data.items);
			setTotal(data.total);
		} catch (e: any) {
			setError(String(e?.message ?? e));
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [listUrl]);

	function applyFilters() {
		setOffset(0);
		setQ(qInput.trim());
		setStatus(statusInput);
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setStatusInput('all');
		setQ('');
		setStatus('all');
		qRef.current?.focus();
	}

	const [editorOpen, setEditorOpen] = useState(false);
	const [editorMode, setEditorMode] = useState<EditorMode>('create');

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [slugTouched, setSlugTouched] = useState(false);

	const [pageStatus, setPageStatus] = useState<'draft' | 'published'>(
		'draft'
	);

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

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
		setEditorMode('create');
		setEditorOpen(true);
	}

	async function submitCreate() {
		setSaving(true);
		setFormError(null);

		const payload = {
			title: title.trim(),
			slug: slug.trim(),
			status: pageStatus,
		};

		try {
			await apiFetch<Page>('/api/admin/pages', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
				nextPath: '/admin/pages',
			});
			setEditorOpen(false);
			await load();
		} catch (e: any) {
			setFormError(String(e?.message ?? e));
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

			const nextTotal = Math.max(0, total - 1);
			const lastOffset = Math.max(
				0,
				Math.floor(Math.max(0, nextTotal - 1) / LIMIT) * LIMIT
			);
			setOffset((cur) => Math.min(cur, lastOffset));
			if (offset === Math.min(offset, lastOffset)) await load();
		} catch (e: any) {
			setError(String(e?.message ?? e));
		}
	}

	return (
		<main className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold'>Pages</h1>
					<p className='text-sm text-muted-foreground'>
						Create/select here. Edit happens on the page itself.
					</p>
				</div>

				<Button
					onClick={openCreate}
					disabled={loading}>
					New Page
				</Button>
			</div>

			<div className='rounded-xl border p-4'>
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
							onValueChange={(v) => setStatusInput(v as any)}>
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
			</div>

			<div className='flex items-center justify-between'>
				<p className='text-sm text-muted-foreground'>
					{total > 0 ? (
						<>
							Showing <b>{offset + 1}</b>–
							<b>{Math.min(offset + items.length, total)}</b> of{' '}
							<b>{total}</b>
						</>
					) : null}
				</p>

				<div className='flex items-center gap-2'>
					<Button
						variant='outline'
						disabled={!canPrev || loading}
						onClick={() =>
							setOffset((v) => Math.max(0, v - LIMIT))
						}>
						Prev
					</Button>
					<Button
						variant='outline'
						disabled={!canNext || loading}
						onClick={() => setOffset((v) => v + LIMIT)}>
						Next
					</Button>
				</div>
			</div>

			{loading ? (
				<p className='text-sm text-muted-foreground'>Loading…</p>
			) : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}

			{!loading && !error && items.length === 0 ? (
				<div className='rounded-xl border p-6'>
					<p className='text-sm text-muted-foreground'>
						No pages yet.
					</p>
				</div>
			) : null}

			{!loading && !error && items.length > 0 ? (
				<div className='rounded-xl border overflow-hidden'>
					<div className='grid grid-cols-12 gap-2 p-3 text-sm font-medium bg-muted/40'>
						<div className='col-span-4'>Title</div>
						<div className='col-span-3'>Slug</div>
						<div className='col-span-2'>Status</div>
						<div className='col-span-2'>Updated</div>
						<div className='col-span-1 text-right'>Actions</div>
					</div>

					{items.map((p) => (
						<div
							key={p.id}
							className='grid grid-cols-12 gap-2 p-3 text-sm border-t items-center'>
							<div className='col-span-4 font-medium'>
								{p.title}
							</div>
							<div className='col-span-3 text-muted-foreground'>
								/{p.slug}
							</div>

							<div className='col-span-2'>
								<Badge
									variant={
										p.status === 'published'
											? 'default'
											: 'secondary'
									}>
									{p.status}
								</Badge>
							</div>

							<div className='col-span-2 text-muted-foreground'>
								{new Date(p.updated_at).toLocaleString()}
							</div>

							<div className='col-span-1 flex justify-end gap-2'>
								<Button
									asChild
									variant='outline'
									size='sm'>
									<Link href={`/${p.slug}?edit=1`}>Edit</Link>
								</Button>

								<Button
									variant='destructive'
									size='sm'
									disabled={loading}
									onClick={() => setConfirmDelete(p)}>
									Delete
								</Button>
							</div>
						</div>
					))}
				</div>
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
								onValueChange={(v) => setPageStatus(v as any)}
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
		</main>
	);
}
