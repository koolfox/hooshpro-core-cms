'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '@/components/ui/alert-dialog';

type Page = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;
	body?: string;
	updated_at: string;
};

type PageList = {
	items: Page[];
	total: number;
	limit: number;
	offset: number;
};

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {}),
		},
		...init,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(text || `Request failed: ${res.status}`);
	}
	return res.json();
}

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const RESERVED = new Set(['admin', 'login', 'logout', 'api', 'auth']);

export default function AdminPages() {
	const [q, setQ] = React.useState('');
	const [limit] = React.useState(20);
	const [offset, setOffset] = React.useState(0);

	const [data, setData] = React.useState<PageList | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Page | null>(null);

	const [confirmOpen, setConfirmOpen] = React.useState(false);
	const [deleteTarget, setDeleteTarget] = React.useState<Page | null>(null);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const qs = new URLSearchParams();
			qs.set('limit', String(limit));
			qs.set('offset', String(offset));
			if (q.trim()) qs.set('q', q.trim());

			const d = await apiJson<PageList>(
				`/api/admin/pages?${qs.toString()}`
			);
			setData(d);
		} catch (e: any) {
			setError(String(e?.message ?? e));
		} finally {
			setLoading(false);
		}
	}

	React.useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [offset]);

	const total = data?.total ?? 0;
	const items = data?.items ?? [];
	const canPrev = offset > 0;
	const canNext = offset + limit < total;

	function openCreate() {
		setEditing(null);
		setOpen(true);
	}

	function openEdit(p: Page) {
		setEditing(p);
		setOpen(true);
	}

	function askDelete(p: Page) {
		setDeleteTarget(p);
		setConfirmOpen(true);
	}

	async function doDelete() {
		if (!deleteTarget) return;
		await apiJson(`/api/admin/pages/${deleteTarget.id}`, {
			method: 'DELETE',
		});
		setConfirmOpen(false);
		setDeleteTarget(null);
		if (items.length === 1 && canPrev) setOffset(offset - limit);
		else load();
	}

	return (
		<main className='p-6 space-y-6'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-2xl font-semibold'>Pages</h1>
					<p className='text-sm text-muted-foreground'>
						Create and publish pages. Public URL is{' '}
						<code>/{'{slug}'}</code>.
					</p>
				</div>

				<div className='flex items-center gap-2'>
					<Button
						variant='outline'
						asChild>
						<Link
							href='/'
							target='_blank'>
							View site
						</Link>
					</Button>
					<Button onClick={openCreate}>New Page</Button>
				</div>
			</div>

			<Separator />

			<div className='flex items-end gap-3'>
				<div className='grid gap-2'>
					<Label htmlFor='q'>Search</Label>
					<Input
						id='q'
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder='title or slug…'
					/>
				</div>
				<Button
					variant='secondary'
					onClick={() => {
						setOffset(0);
						load();
					}}>
					Apply
				</Button>
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
					<div className='mt-4'>
						<Button onClick={openCreate}>Create first page</Button>
					</div>
				</div>
			) : null}

			{!loading && !error && items.length > 0 ? (
				<div className='rounded-xl border overflow-hidden'>
					<div className='grid grid-cols-12 gap-2 p-3 text-sm font-medium bg-muted/40'>
						<div className='col-span-5'>Title</div>
						<div className='col-span-3'>Slug</div>
						<div className='col-span-2'>Status</div>
						<div className='col-span-2 text-right'>Actions</div>
					</div>

					{items.map((p) => (
						<div
							key={p.id}
							className='grid grid-cols-12 gap-2 p-3 text-sm border-t items-center'>
							<div className='col-span-5 font-medium'>
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
							<div className='col-span-2 flex justify-end gap-2'>
								<Button
									variant='outline'
									size='sm'
									asChild>
									<Link
										href={`/${p.slug}`}
										target='_blank'>
										View
									</Link>
								</Button>
								<Button
									variant='secondary'
									size='sm'
									onClick={() => openEdit(p)}>
									Edit
								</Button>
								<Button
									variant='destructive'
									size='sm'
									onClick={() => askDelete(p)}>
									Delete
								</Button>
							</div>
						</div>
					))}
				</div>
			) : null}

			{!loading && !error && total > 0 ? (
				<div className='flex items-center justify-between'>
					<p className='text-sm text-muted-foreground'>
						Showing {Math.min(offset + 1, total)}–
						{Math.min(offset + limit, total)} of {total}
					</p>
					<div className='flex gap-2'>
						<Button
							variant='outline'
							disabled={!canPrev}
							onClick={() => setOffset(offset - limit)}>
							Prev
						</Button>
						<Button
							variant='outline'
							disabled={!canNext}
							onClick={() => setOffset(offset + limit)}>
							Next
						</Button>
					</div>
				</div>
			) : null}

			<PageUpsertDialog
				open={open}
				onOpenChange={setOpen}
				initial={editing}
				onSaved={() => load()}
			/>

			<AlertDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete page?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete{' '}
							<b>{deleteTarget?.title}</b>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={doDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}

function PageUpsertDialog({
	open,
	onOpenChange,
	initial,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	initial: Page | null;
	onSaved: () => void;
}) {
	const isEdit = !!initial?.id;

	const [title, setTitle] = React.useState(initial?.title ?? '');
	const [slug, setSlug] = React.useState(initial?.slug ?? '');
	const [status, setStatus] = React.useState<Page['status']>(
		initial?.status ?? 'draft'
	);
	const [seoTitle, setSeoTitle] = React.useState(initial?.seo_title ?? '');
	const [seoDesc, setSeoDesc] = React.useState(
		initial?.seo_description ?? ''
	);
	const [body, setBody] = React.useState(initial?.body ?? '');

	const [busy, setBusy] = React.useState(false);
	const [err, setErr] = React.useState<string | null>(null);

	React.useEffect(() => {
		setTitle(initial?.title ?? '');
		setSlug(initial?.slug ?? '');
		setStatus(initial?.status ?? 'draft');
		setSeoTitle(initial?.seo_title ?? '');
		setSeoDesc(initial?.seo_description ?? '');
		setBody(initial?.body ?? '');
		setErr(null);
	}, [initial, open]);

	function validate() {
		const s = slugify(slug);
		if (!title.trim()) return 'Title is required';
		if (!s) return 'Slug is required';
		if (RESERVED.has(s)) return `Slug '${s}' is reserved`;
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))
			return 'Slug format is invalid';
		return null;
	}

	async function save() {
		const v = validate();
		if (v) {
			setErr(v);
			return;
		}
		setBusy(true);
		setErr(null);

		const payload = {
			title: title.trim(),
			slug: slugify(slug),
			status,
			seo_title: seoTitle.trim() || null,
			seo_description: seoDesc.trim() || null,
			body,
		};

		try {
			if (isEdit && initial) {
				await apiJson(`/api/admin/pages/${initial.id}`, {
					method: 'PUT',
					body: JSON.stringify(payload),
				});
			} else {
				await apiJson(`/api/admin/pages`, {
					method: 'POST',
					body: JSON.stringify(payload),
				});
			}
			onOpenChange(false);
			onSaved();
		} catch (e: any) {
			setErr(String(e?.message ?? e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className='max-w-2xl'>
				<DialogHeader>
					<DialogTitle>
						{isEdit ? 'Edit Page' : 'New Page'}
					</DialogTitle>
					<DialogDescription>
						Keep it simple: title, slug, status, body, SEO.
					</DialogDescription>
				</DialogHeader>

				<div className='grid gap-4'>
					<div className='grid gap-2'>
						<Label>Title</Label>
						<Input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</div>

					<div className='grid grid-cols-2 gap-4'>
						<div className='grid gap-2'>
							<Label>Slug</Label>
							<Input
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
							/>
							<p className='text-xs text-muted-foreground'>
								Suggested:{' '}
								<code>
									{slugify(title || slug || '') ||
										'your-slug'}
								</code>
							</p>
						</div>

						<div className='grid gap-2'>
							<Label>Status</Label>
							<div className='flex gap-2'>
								<Button
									type='button'
									variant={
										status === 'draft'
											? 'default'
											: 'outline'
									}
									onClick={() => setStatus('draft')}>
									Draft
								</Button>
								<Button
									type='button'
									variant={
										status === 'published'
											? 'default'
											: 'outline'
									}
									onClick={() => setStatus('published')}>
									Published
								</Button>
							</div>
						</div>
					</div>

					<div className='grid gap-2'>
						<Label>Body</Label>
						<Textarea
							rows={8}
							value={body}
							onChange={(e) => setBody(e.target.value)}
						/>
					</div>

					<div className='grid grid-cols-2 gap-4'>
						<div className='grid gap-2'>
							<Label>SEO title</Label>
							<Input
								value={seoTitle}
								onChange={(e) => setSeoTitle(e.target.value)}
							/>
						</div>
						<div className='grid gap-2'>
							<Label>SEO description</Label>
							<Input
								value={seoDesc}
								onChange={(e) => setSeoDesc(e.target.value)}
							/>
						</div>
					</div>

					{err ? <p className='text-sm text-red-600'>{err}</p> : null}
				</div>

				<DialogFooter className='mt-6'>
					<Button
						variant='outline'
						onClick={() => onOpenChange(false)}
						disabled={busy}>
						Cancel
					</Button>
					<Button
						onClick={save}
						disabled={busy}>
						{busy ? 'Saving…' : 'Save'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
