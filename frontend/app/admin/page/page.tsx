'use client';

import {
	AdminContentType,
	AdminEntrySummary,
	fetchContentTypes,
	fetchEntries,
} from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AdminPageList() {
	const [entries, setEntries] = useState<AdminEntrySummary[]>([]);
	const [contentType, setContentType] = useState<AdminContentType | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				setLoading(true);
				setError(null);

				const types = await fetchContentTypes();
				const pageType = types.find((t) => t.key === 'page') ?? null;
				if (!pageType) {
					throw new Error('Content type is not defiend');
				}

				if (cancelled) return;
				setContentType(pageType);

				const data = await fetchEntries('page');
				if (cancelled) return;
				setEntries(data);
			} catch (err: any) {
				if (!cancelled) {
					setError(err?.message ?? 'Failed to load page entries');
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}
		load();

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className='space-y-6'>
			<header className='flex items-center justify-between'>
				<div>
					<h2 className='text-2xl font-semibold'>Pages</h2>
					<p className='text-sm text-slate-400 mt-1'>
						Dynamically loaded from content engine
					</p>
				</div>
				<Link
					href='/app/admin/page/new'
					className='inline-flex items-center ounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 transition'>
					+ CREATE NEW PAGE
				</Link>
			</header>
			{loading && <p className='text-sm text-slate-300'>Loading...</p>}

			{error && (
				<p className='text-sm text-red-400 bg-red-950/40 border border-red-900 roundex-md px-3 py-2'>
					{error}
				</p>
			)}
			{!loading && !error && entries.length === 0 && (
				<p className='text-sm text-slate-300'>
					No Pages yet?{' '}
					<span className='font-semibold'>New Page</span>
					Click here.
				</p>
			)}
			{!loading && !error && entries.length > 0 && (
				<div className='overflow-x-auto border border-slate-800 rounded-xl'>
					<table className='w-full text-sm'>
						<thead className='bg-slate-900/60 border-b border-slate-800'>
							<tr>
								<th className='text-left px-4 py-2'>Title</th>
								<th className='text-left px-4 py-2'>Slug</th>
								<th className='text-left px-4 py-2'>Status</th>
								<th className='text-left px-4 py-2'>Updated</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((entry) => {
								const title =
									(entry.data &&
										(entry.data.title as string)) ??
									'[no title]';
								return (
									<tr
										key={entry.id}
										className='border-b border-slate-900-/60 hover:bg-slate-900/60 transition'>
										<td className='px-4 py-2'>
											<Link
												href={`/app/admin/page/${entry.id}`}
												className='text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline'>
												{title}
											</Link>
										</td>
										<td className='px-4 py-2 text-slate-300'>
											{entry.slug ?? '-'}
										</td>
										<td className='px-4 py-2 text-slate-300'>
											{entry.status}
										</td>
										<td className='px-4 py-2 text-slate-400 text-xs'>
											{new Date(
												entry.updated_at
											).toLocaleString()}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
