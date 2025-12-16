'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Page } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function NewPage() {
	const router = useRouter();
	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [status, setStatus] = useState<'draft' | 'published'>('draft');
	const [seoTitle, setSeoTitle] = useState('');
	const [seoDesc, setSeoDesc] = useState('');
	const [body, setBody] = useState('');

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const created = await api<Page>('/api/admin/pages', {
				method: 'POST',
				body: JSON.stringify({
					title,
					slug,
					status,
					seo_title: seoTitle || null,
					seo_description: seoDesc || null,
					body,
				}),
			});
			router.push(`/admin/pages/${created.id}`);
		} catch (e: any) {
			setError(String(e.message ?? e));
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className='p-6 max-w-2xl space-y-6'>
			<h1 className='text-2xl font-semibold'>New Page</h1>

			<form
				onSubmit={onSubmit}
				className='space-y-4'>
				<div className='space-y-2'>
					<div className='text-sm font-medium'>Title</div>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder='Home'
					/>
				</div>

				<div className='space-y-2'>
					<div className='text-sm font-medium'>Slug</div>
					<Input
						value={slug}
						onChange={(e) => setSlug(e.target.value)}
						placeholder='home'
					/>
					<p className='text-xs text-muted-foreground'>
						lowercase + hyphens, e.g. about-us
					</p>
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
						placeholder='Optional'
					/>
				</div>

				<div className='space-y-2'>
					<div className='text-sm font-medium'>SEO Description</div>
					<Textarea
						value={seoDesc}
						onChange={(e) => setSeoDesc(e.target.value)}
						placeholder='Optional'
					/>
				</div>

				<div className='space-y-2'>
					<div className='text-sm font-medium'>Body (v1 ساده)</div>
					<Textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						placeholder='Just some text for now…'
						className='min-h-40'
					/>
				</div>

				{error ? <p className='text-sm text-red-600'>{error}</p> : null}

				<Button disabled={loading}>
					{loading ? 'Creating…' : 'Create'}
				</Button>
			</form>
		</main>
	);
}
