'use client';

import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';

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

type PageOut = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;
	body?: string;
	blocks?: any;
	published_at?: string | null;
	created_at: string;
	updated_at: string;
};

type PageListOut = {
	items: PageOut[];
	total: number;
	limit: number;
	offset: number;
};

type EditorMode = 'create' | 'edit';

const LIMIT = 20;

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

async function readJsonOrThrow<T>(res: Response): Promise<T> {
	if (res.ok) return (await res.json()) as T;

	if (res.status === 401 || res.status === 403) {
		throw Object.assign(new Error('AUTH_REQUIRED'), {
			code: 'AUTH_REQUIRED',
		});
	}

	const ct = res.headers.get('content-type') || '';
	if (ct.includes('application/json')) {
		const j: any = await res.json().catch(() => null);
		throw new Error(j?.detail || `Request failed (${res.status})`);
	}
	const text = await res.text().catch(() => '');
	throw new Error(text || `Request failed (${res.status})`);
}

export default function AdminPages() {
	const router = useRouter();

	const [items, setItems] = useState<PageOut[]>([]);
	const [total, setTotal] = useState(0);
	const [offset, setOffset] = useState(0);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [qDraft, setQDraft] = useState('');
	const [q, setQ] = useState('');
	const [statusFilter, setStatusFilter] = useState<
		'all' | 'draft' | 'published'
	>('all');

	const [editorOpen, setEditorOpen] = useState(false);
	const [editorMode, setEditorMode] = useState<EditorMode>('create');
	const [editingId, setEditingId] = useState<number | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [slugTouched, setSlugTouched] = useState(false);
	const [status, setStatus] = useState<'draft' | 'published'>('draft');
	const [seoTitle, setSeoTitle] = useState('');
	const [seoDesc, setSeoDesc] = useState('');
	const [body, setBody] = useState('');

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<PageOut | null>(null);

	const canPrev = offset > 0;
	const canNext = offset + items.length < total;

	const debounceRef = useRef<number | null>(null);
	useEffect(() => {
		if (debounceRef.current) window.clearTimeout(debounceRef.current);
		debounceRef.current = window.setTimeout(() => setQ(qDraft.trim()), 250);
		return () => {
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
		};
	}, [qDraft]);

	const listUrl = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set('limit', String(LIMIT));
		sp.set('offset', String(offset));
		if (q) sp.set('q', q);
		if (statusFilter !== 'all') sp.set('status', statusFilter);
		return `/api/admin/pages?${sp.toString()}`;
	}, [offset, q, statusFilter]);

	function goLogin() {
		const next = `/admin/pages`;
		router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
	}

	async function load() {
		setLoading(true);
		setError(null);

		try {
			const res = await fetch(listUrl, { cache: 'no-store' });
			const data = await readJsonOrThrow<PageListOut>(res);

			setItems(data.items || []);
			setTotal(data.total || 0);

			if ((data.items || []).length === 0 && offset > 0) {
				setOffset((v) => Math.max(0, v - LIMIT));
			}
		} catch (e: any) {
			if (
				e?.code === 'AUTH_REQUIRED' ||
				String(e?.message) === 'AUTH_REQUIRED'
			) {
				goLogin();
				return;
			}
			setError(String(e?.message ?? e));
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [listUrl]);

	function resetForm() {
		setTitle('');
		setSlug('');
		setSlugTouched(false);
		setStatus('draft');
		setSeoTitle('');
		setSeoDesc('');
		setBody('');
		setFormError(null);
		setSaving(false);
	}

	function openCreate() {
		resetForm();
		setEditorMode('create');
		setEditingId(null);
		setEditorOpen(true);
	}

	async function openEdit(id: number) {
		setFormError(null);
		setSaving(false);

		try {
			const res = await fetch(`/api/admin/pages/${id}`, {
				cache: 'no-store',
			});
			const p = await readJsonOrThrow<PageOut>(res);

			setEditorMode('edit');
			setEditingId(p.id);
			setTitle(p.title);
			setSlug(p.slug);
			setSlugTouched(true);
			setStatus(p.status);
			setSeoTitle(p.seo_title ?? '');
			setSeoDesc(p.seo_description ?? '');
			setBody(p.body ?? '');
			setEditorOpen(true);
		} catch (e: any) {
			if (
				e?.code === 'AUTH_REQUIRED' ||
				String(e?.message) === 'AUTH_REQUIRED'
			) {
				goLogin();
				return;
			}
			setError(String(e?.message ?? e));
		}
	}

	async function submit() {
		if (!title.trim() || !slug.trim()) return;

		setSaving(true);
		setFormError(null);

		const payload = {
			title: title.trim(),
			slug: slug.trim(),
			status,
			seo_title: seoTitle.trim() || null,
			seo_description: seoDesc.trim() || null,
			body,
		};

		try {
			if (editorMode === 'create') {
				const res = await fetch('/api/admin/pages', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
				});
				await readJsonOrThrow(res);
			} else {
				const res = await fetch(`/api/admin/pages/${editingId}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
				});
				await readJsonOrThrow(res);
			}

			setEditorOpen(false);
			await load();
		} catch (e: any) {
			if (
				e?.code === 'AUTH_REQUIRED' ||
				String(e?.message) === 'AUTH_REQUIRED'
			) {
				goLogin();
				return;
			}
			setFormError(String(e?.message ?? e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(p: PageOut) {
		try {
			const res = await fetch(`/api/admin/pages/${p.id}`, {
				method: 'DELETE',
			});
			await readJsonOrThrow(res);
			setConfirmDelete(null);
			await load();
		} catch (e: any) {
			if (
				e?.code === 'AUTH_REQUIRED' ||
				String(e?.message) === 'AUTH_REQUIRED'
			) {
				goLogin();
				return;
			}
			setError(String(e?.message ?? e));
		}
	}

	const from = total === 0 ? 0 : offset + 1;
	const to = Math.min(offset + items.length, total);

	return (
		<main className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold'>Pages</h1>
					<p className='text-sm text-muted-foreground'>
						Create, edit, publish — all from one screen.
					</p>
				</div>

				<Button onClick={openCreate}>New Page</Button>
			</div>

			<div className='flex flex-col sm:flex-row sm:items-end gap-3'>
				<div className='flex-1 space-y-2'>
					<Label>Search</Label>
					<Input
						value={qDraft}
						onChange={(e) => {
							setOffset(0);
							setQDraft(e.target.value);
						}}
						placeholder='Search by title or slug…'
					/>
				</div>

				<div className='w-full sm:w-56 space-y-2'>
					<Label>Status</Label>
					<Select
						value={statusFilter}
						onValueChange={(v) => {
							setOffset(0);
							setStatusFilter(v as any);
						}}>
						<SelectTrigger>
							<SelectValue placeholder='All' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>all</SelectItem>
							<SelectItem value='draft'>draft</SelectItem>
							<SelectItem value='published'>published</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className='flex items-center justify-between'>
				<p className='text-sm text-muted-foreground'>
					{ total > 0
						? `Showing ${from}–${to} of ${total}`
						: ''}
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
							<div className='col-span-4 font-medium truncate'>
								{p.title}
							</div>
							<div className='col-span-3 text-muted-foreground truncate'>
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
									variant='outline'
									size='sm'
									onClick={() => openEdit(p.id)}>
									Edit
								</Button>
								<Button
									variant='destructive'
									size='sm'
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
				<DialogContent className='sm:max-w-2xl max-h-[85vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>
							{editorMode === 'create' ? 'New Page' : 'Edit Page'}
						</DialogTitle>
						<DialogDescription>
							SEO fields are optional. Status controls public
							visibility.
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
									if (
										editorMode === 'create' &&
										!slugTouched
									) {
										setSlug(slugify(v));
									}
								}}
								placeholder='Home'
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
								placeholder='home'
							/>
						</div>

						<div className='space-y-2'>
							<Label>Status</Label>
							<Select
								value={status}
								onValueChange={(v) => setStatus(v as any)}>
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

						<div className='space-y-2'>
							<Label>SEO Title</Label>
							<Input
								value={seoTitle}
								onChange={(e) => setSeoTitle(e.target.value)}
								placeholder='(optional)'
							/>
						</div>

						<div className='space-y-2 sm:col-span-2'>
							<Label>SEO Description</Label>
							<Input
								value={seoDesc}
								onChange={(e) => setSeoDesc(e.target.value)}
								placeholder='(optional)'
							/>
						</div>

						<div className='space-y-2 sm:col-span-2'>
							<Label>Body</Label>
							<Textarea
								value={body}
								onChange={(e) => setBody(e.target.value)}
								rows={10}
								placeholder='Write your content…'
							/>
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
							onClick={submit}
							disabled={saving || !title.trim() || !slug.trim()}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!confirmDelete}
				onOpenChange={(v) => !v && setConfirmDelete(null)}>
				<AlertDialogContent className='sm:max-w-md'>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete page?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete{' '}
							<b>{confirmDelete?.title}</b>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={!confirmDelete}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
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
