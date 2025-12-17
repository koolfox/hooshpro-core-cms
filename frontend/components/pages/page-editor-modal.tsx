'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type PageStatus = 'draft' | 'published';

type PageDTO = {
	id: number;
	title: string;
	slug: string;
	status: PageStatus;
	seo_title?: string | null;
	seo_description?: string | null;
	body?: string | null;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(['admin', 'login', 'logout', 'api', 'auth']);

function normalizeSlug(s: string) {
	return s.trim().toLowerCase();
}

function validateSlug(s: string) {
	const slug = normalizeSlug(s);
	if (!SLUG_RE.test(slug)) {
		return 'Slug باید lowercase + عدد + خط تیره باشد (مثل about-us-2)';
	}
	if (RESERVED.has(slug)) {
		return `Slug "${slug}" رزرو شده است.`;
	}
	return null;
}

async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
	const res = await fetch(input, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers || {}),
		},
		...init,
	});

	if (res.status === 401) {
		const err = new Error('UNAUTHORIZED');
		// @ts-expect-error
		err.code = 401;
		throw err;
	}

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(text || `Request failed: ${res.status}`);
	}

	return res.json();
}

export function PageEditorModal({
	mode,
	id,
}: {
	mode: 'create' | 'edit';
	id?: number;
}) {
	const router = useRouter();

	const [loading, setLoading] = useState(mode === 'edit');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState(false);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [status, setStatus] = useState<PageStatus>('draft');
	const [seoTitle, setSeoTitle] = useState('');
	const [seoDesc, setSeoDesc] = useState('');
	const [body, setBody] = useState('');

	const slugError = useMemo(() => (slug ? validateSlug(slug) : null), [slug]);

	function redirectToLogin() {
		const next = '/admin/pages';
		router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
	}

	useEffect(() => {
		let ignore = false;

		async function load() {
			if (mode !== 'edit' || !id) return;
			setLoading(true);
			setError(null);

			try {
				const p = await apiJson<PageDTO>(`/api/admin/pages/${id}`);
				if (ignore) return;

				setTitle(p.title ?? '');
				setSlug(p.slug ?? '');
				setStatus(p.status ?? 'draft');
				setSeoTitle(p.seo_title ?? '');
				setSeoDesc(p.seo_description ?? '');
				setBody(p.body ?? '');
			} catch (e: any) {
				if (e?.code === 401 || e?.message === 'UNAUTHORIZED') {
					redirectToLogin();
					return;
				}
				setError(String(e?.message ?? e));
			} finally {
				if (!ignore) setLoading(false);
			}
		}

		load();
		return () => {
			ignore = true;
		};
	}, [mode, id]);

	async function onSave() {
		setError(null);

		if (!title.trim()) {
			setError('Title لازم است.');
			return;
		}
		if (!slug.trim()) {
			setError('Slug لازم است.');
			return;
		}
		if (slugError) {
			setError(slugError);
			return;
		}

		setSaving(true);
		try {
			const payload = {
				title: title.trim(),
				slug: normalizeSlug(slug),
				status,
				seo_title: seoTitle.trim() || null,
				seo_description: seoDesc.trim() || null,
				body,
			};

			if (mode === 'create') {
				await apiJson(`/api/admin/pages`, {
					method: 'POST',
					body: JSON.stringify(payload),
				});
			} else {
				await apiJson(`/api/admin/pages/${id}`, {
					method: 'PUT',
					body: JSON.stringify(payload),
				});
			}

			router.refresh();
			router.back();
		} catch (e: any) {
			if (e?.code === 401 || e?.message === 'UNAUTHORIZED') {
				redirectToLogin();
				return;
			}
			setError(String(e?.message ?? e));
		} finally {
			setSaving(false);
		}
	}

	async function onDelete() {
		if (mode !== 'edit' || !id) return;

		setSaving(true);
		setError(null);
		try {
			await apiJson(`/api/admin/pages/${id}`, { method: 'DELETE' });
			setConfirmDelete(false);
			router.refresh();
			router.back();
		} catch (e: any) {
			if (e?.code === 401 || e?.message === 'UNAUTHORIZED') {
				redirectToLogin();
				return;
			}
			setError(String(e?.message ?? e));
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Dialog
				open={true}
				onOpenChange={(open) => {
					if (!open) router.back();
				}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{mode === 'create' ? 'New Page' : 'Edit Page'}
						</DialogTitle>
						<DialogDescription>
							{mode === 'create'
								? 'Create a new page (draft or published).'
								: 'Update page content and SEO fields.'}
						</DialogDescription>
					</DialogHeader>

					{loading ? (
						<p className='text-sm text-muted-foreground'>
							Loading…
						</p>
					) : (
						<div className='space-y-4'>
							{error ? (
								<div className='rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
									{error}
								</div>
							) : null}

							<div className='grid gap-2'>
								<Label htmlFor='title'>Title</Label>
								<Input
									id='title'
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder='Home'
								/>
							</div>

							<div className='grid gap-2'>
								<Label htmlFor='slug'>Slug</Label>
								<Input
									id='slug'
									value={slug}
									onChange={(e) => setSlug(e.target.value)}
									placeholder='home'
								/>
								{slugError ? (
									<p className='text-xs text-destructive'>
										{slugError}
									</p>
								) : (
									<p className='text-xs text-muted-foreground'>
										Example: about-us-2
									</p>
								)}
							</div>

							<div className='grid gap-2'>
								<Label htmlFor='status'>Status</Label>
								<div className='flex gap-2'>
									<Button
										type='button'
										variant={
											status === 'draft'
												? 'default'
												: 'secondary'
										}
										onClick={() => setStatus('draft')}>
										Draft
									</Button>
									<Button
										type='button'
										variant={
											status === 'published'
												? 'default'
												: 'secondary'
										}
										onClick={() => setStatus('published')}>
										Published
									</Button>
								</div>
							</div>

							<div className='grid gap-2'>
								<Label htmlFor='seoTitle'>SEO Title</Label>
								<Input
									id='seoTitle'
									value={seoTitle}
									onChange={(e) =>
										setSeoTitle(e.target.value)
									}
									placeholder='Optional'
								/>
							</div>

							<div className='grid gap-2'>
								<Label htmlFor='seoDesc'>SEO Description</Label>
								<Textarea
									id='seoDesc'
									value={seoDesc}
									onChange={(e) => setSeoDesc(e.target.value)}
									placeholder='Optional'
								/>
							</div>

							<div className='grid gap-2'>
								<Label htmlFor='body'>Body (MVP)</Label>
								<Textarea
									id='body'
									value={body}
									onChange={(e) => setBody(e.target.value)}
									placeholder='Write something…'
									rows={8}
								/>
							</div>
						</div>
					)}

					<DialogFooter className='gap-2'>
						{mode === 'edit' ? (
							<Button
								type='button'
								variant='destructive'
								disabled={saving || loading}
								onClick={() => setConfirmDelete(true)}>
								Delete
							</Button>
						) : null}

						<Button
							type='button'
							variant='secondary'
							disabled={saving}
							onClick={() => router.back()}>
							Cancel
						</Button>

						<Button
							type='button'
							disabled={saving || loading}
							onClick={onSave}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={confirmDelete}
				onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this page?</AlertDialogTitle>
						<AlertDialogDescription>
							This action can’t be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className='gap-2'>
						<AlertDialogCancel asChild>
							<Button
								type='button'
								variant='secondary'
								disabled={saving}>
								Cancel
							</Button>
						</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button
								type='button'
								variant='destructive'
								disabled={saving}
								onClick={onDelete}>
								{saving ? 'Deleting…' : 'Delete'}
							</Button>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
