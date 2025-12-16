'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Page } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AdminPagesList() {
	const [items, setItems] = useState<Page[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api<Page[]>('/api/admin/pages')
			.then(setItems)
			.catch((e) => setError(String(e.message ?? e)))
			.finally(() => setLoading(false));
	}, []);

	return (
		<main className='p-6 space-y-6'>
			<div className='flex items-center justify-between'>
				<h1 className='text-2xl font-semibold'>Pages</h1>
				<Button asChild>
					<Link href='/admin/pages/new'>New Page</Link>
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
				</div>
			) : null}

			{!loading && !error && items.length > 0 ? (
				<div className='rounded-xl border overflow-hidden'>
					<div className='grid grid-cols-12 gap-2 p-3 text-sm font-medium bg-muted/40'>
						<div className='col-span-5'>Title</div>
						<div className='col-span-3'>Slug</div>
						<div className='col-span-2'>Status</div>
						<div className='col-span-2'>Updated</div>
					</div>
					{items.map((p) => (
						<Link
							key={p.id}
							href={`/admin/pages/${p.id}`}
							className='grid grid-cols-12 gap-2 p-3 text-sm hover:bg-muted/30 border-t'>
							<div className='col-span-5'>{p.title}</div>
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
						</Link>
					))}
				</div>
			) : null}
		</main>
	);
}
