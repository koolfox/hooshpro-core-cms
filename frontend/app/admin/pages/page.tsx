'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

type Page = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;
	blocks?: any;
	created_at: string;
	updated_at: string;
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

async function readJson<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(text || `Request failed (${res.status})`);
	}
	return res.json() as Promise<T>;
}

function bodyFromBlocks(blocks: any): string {
	const b = blocks?.blocks?.find((x: any) => x?.type === 'paragraph');
	return b?.data?.text ?? '';
}

export default function PagesScreen() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const [items, setItems] = useState<Page[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [offset, setOffset] = useState(0);

	const [editorOpen, setEditorOpen] = useState(false);
	const [editorMode, setEditorMode] = useState<EditorMode>('create');
	const [editingId, setEditingId] = useState<number | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<Page | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [status, setStatus] = useState<'draft' | 'published'>('draft');
	const [seoTitle, setSeoTitle] = useState('');
	const [seoDesc, setSeoDesc] = useState('');
	const [body, setBody] = useState('');
	const [formError, setFormError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const canPrev = offset > 0;
	const canNext = items.length === LIMIT;

	const listUrl = useMemo(
		() => `/api/admin/pages?limit=${LIMIT}&offset=${offset}`,
		[offset]
	);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(listUrl, { cache: 'no-store' });
			const data = await readJson<Page[]>(res);
			setItems(data);
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

	useEffect(() => {
		const n = searchParams.get('new');
		const edit = searchParams.get('edit');
		if (n === '1') {
			openCreate();
			router.replace('/admin/pages', { scroll: false });
		} else if (edit) {
			const id = Number(edit);
			if (Number.isFinite(id)) openEdit(id);
			router.replace('/admin/pages', { scroll: false });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams]);

	function resetForm() {
		setTitle('');
		setSlug('');
		setStatus('draft');
		setSeoTitle('');
		setSeoDesc('');
		setBody('');
		setFormError(null);
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
			const p = await readJson<Page>(res);
			setEditorMode('edit');
			setEditingId(p.id);
			setTitle(p.title);
			setSlug(p.slug);
			setStatus(p.status);
			setSeoTitle(p.seo_title ?? '');
			setSeoDesc(p.seo_description ?? '');
			setBody(bodyFromBlocks((p as any).blocks));
			setEditorOpen(true);
		} catch (e: any) {
			setError(String(e?.message ?? e));
		}
	}

	async function submit() {
		setSaving(true);
		setFormError(null);

		const payload: any = {
			title,
			slug,
			status,
			seo_title: seoTitle || null,
			seo_description: seoDesc || null,
			body,
		};

		try {
			if (editorMode === 'create') {
				const res = await fetch('/api/admin/pages', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
				});
				await readJson(res);
			} else {
				const res = await fetch(`/api/admin/pages/${editingId}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
				});
				await readJson(res);
			}
			setEditorOpen(false);
			await load();
		} catch (e: any) {
			setFormError(String(e?.message ?? e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(p: Page) {
		try {
			const res = await fetch(`/api/admin/pages/${p.id}`, {
				method: 'DELETE',
			});
			await readJson(res);
			setConfirmDelete(null);
			await load();
		} catch (e: any) {
			setError(String(e?.message ?? e));
		}
	}

	return (
		<main className='p-6 space-y-6'>
			<div className='flex items-center justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-semibold'>Pages</h1>
					<p className='text-sm text-muted-foreground'>
						Create, edit, publish — all from one screen.
					</p>
				</div>

				<Button onClick={openCreate}>New Page</Button>
			</div>

			<div className='flex items-center justify-between'>
				<p className='text-sm text-muted-foreground'>
					Showing {offset + 1}–{offset + items.length}
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
				<DialogContent className='max-w-2xl'>
					<DialogHeader>
						<DialogTitle>
							{editorMode === 'create' ? 'New Page' : 'Edit Page'}
						</DialogTitle>
						<DialogDescription>
							MVP editor: title/slug/status + paragraph body.
						</DialogDescription>
					</DialogHeader>

					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
						<div className='space-y-2'>
							<Label>Title</Label>
							<Input
								value={title}
								onChange={(e) => {
									setTitle(e.target.value);
									if (editorMode === 'create' && !slug)
										setSlug(slugify(e.target.value));
								}}
								placeholder='Home'
							/>
						</div>

						<div className='space-y-2'>
							<Label>Slug</Label>
							<Input
								value={slug}
								onChange={(e) =>
									setSlug(slugify(e.target.value))
								}
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
							/>
						</div>

						<div className='space-y-2 sm:col-span-2'>
							<Label>SEO Description</Label>
							<Input
								value={seoDesc}
								onChange={(e) => setSeoDesc(e.target.value)}
							/>
						</div>

						<div className='space-y-2 sm:col-span-2'>
							<Label>Body</Label>
							<Textarea
								value={body}
								onChange={(e) => setBody(e.target.value)}
								rows={8}
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
							disabled={saving || !title || !slug}>
							{saving ? 'Saving…' : 'Save'}
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
						<AlertDialogCancel>Cancel</AlertDialogCancel>
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
