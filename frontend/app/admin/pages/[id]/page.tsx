'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Page } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function extractBody(blocks: any): string {
	const paragraph = blocks?.blocks?.find((b: any) => b.type === 'paragraph');
	return paragraph?.data?.text ?? '';
}

export default function EditPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const id = Number(params.id);

	const [page, setPage] = useState<Page | null>(null);
	const [loading, setLoading] = useState(true);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [status, setStatus] = useState<'draft' | 'published'>('draft');
	const [seoTitle, setSeoTitle] = useState('');
	const [seoDesc, setSeoDesc] = useState('');
	const [body, setBody] = useState('');

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api<Page>(`/api/admin/pages/${id}`)
			.then((p) => {
				setPage(p);
				setTitle(p.title);
				setSlug(p.slug);
				setStatus(p.status);
				setSeoTitle(p.seo_title ?? '');
				setSeoDesc(p.seo_description ?? '');
				setBody(extractBody(p.blocks));
			})
			.catch((e) => setError(String(e.message ?? e)))
			.finally(() => setLoading(false));
	}, [id]);

	async function save() {
		setSaving(true);
		setError(null);
		try {
			const updated = await api<Page>(`/api/admin/pages/${id}`, {
				method: 'PUT',
				body: JSON.stringify({
					title,
					slug,
					status,
					seo_title: seoTitle || null,
					seo_description: seoDesc || null,
					body,
				}),
			});
			setPage(updated);
		} catch (e: any) {
			setError(String(e.message ?? e));
		} finally {
			setSaving(false);
		}
	}

	async function del() {
		if (!confirm('Delete this page?')) return;
		setError(null);
		try {
			await api(`/api/admin/pages/${id}`, { method: 'DELETE' });
			router.push('/admin/pages');
		} catch (e: any) {
			setError(String(e.message ?? e));
		}
	}

	if (loading) return <main className='p-6'>Loading…</main>;
	if (!page) return <main className='p-6'>Not found.</main>;

	return (
		<main className='p-6 max-w-2xl space-y-6'>
			<div className='flex items-center justify-between'>
				<h1 className='text-2xl font-semibold'>Edit Page</h1>
				<div className='flex gap-2'>
					<Button
						variant='secondary'
						onClick={() => window.open(`/${slug}`, '_blank')}>
						Open
					</Button>
					<Button
						variant='destructive'
						onClick={del}>
						Delete
					</Button>
				</div>
			</div>

			<div className='rounded-xl border p-4 space-y-4'>
				<div className='space-y-2'>
					<div className='text-sm font-medium'>Title</div>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className='space-y-2'>
					<div className='text-sm font-medium'>Slug</div>
					<Input
						value={slug}
						onChange={(e) => setSlug(e.target.value)}
					/>
				</div>

				<div className='space-y-2'>
					<div className='text-sm font-medium'>Status</div>
					<div className='flex gap-2'>
						<Button
							type='button'
							variant={
								status === 'draft' ? 'default' : 'secondary'
							}
							onClick={() => setStatus('draft')}>
							draft
						</Button>
						<Button
							type='button'
							variant={
								status === 'published' ? 'default' : 'secondary'
							}
							onClick={() => setStatus('published')}>
							published
						</Button>
					</div>
				</div>

				<div className='space-y-2'>
					<div className='text-sm font-medium'>SEO Title</div>
					<Input
						value={seoTitle}
						onChange={(e) => setSeoTitle(e.target.value)}
					/>
				</div>

				<div className='space-y-2'>
					<div className='text-sm font-medium'>SEO Description</div>
					<Textarea
						value={seoDesc}
						onChange={(e) => setSeoDesc(e.target.value)}
					/>
				</div>

				<div className='space-y-2'>
					<div className='text-sm font-medium'>Body (v1 ساده)</div>
					<Textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						className='min-h-40'
					/>
				</div>

				{error ? <p className='text-sm text-red-600'>{error}</p> : null}

				<Button
					onClick={save}
					disabled={saving}>
					{saving ? 'Saving…' : 'Save'}
				</Button>
			</div>
		</main>
	);
}
