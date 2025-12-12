'use client';

import {
	AdminContentType,
	AdminFieldMeta,
	createEntry,
	fetchContentTypes,
} from '@/lib/api';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function NewPageForm() {
	const router = useRouter();
	const [contentType, setContentType] = useState<AdminContentType | null>(
		null
	);
	const [status, setStatus] = useState<Status>('idle');
	const [error, setError] = useState<string | null>(null);

	const [formValues, setFormValues] = useState<Record<string, any>>({
		title: '',
		slug: '',
		body: '',
		seo_title: '',
		seo_description: '',
	});

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const types = await fetchContentTypes();
				const pageType = types.find((t) => t.key === 'page') ?? null;
				if (!pageType) {
					throw new Error("Content Type 'page' is undefined");
				}
				if (!cancelled) {
					setContentType(pageType);
				}
			} catch (err: any) {
				if (!cancelled) {
					setError(err?.message ?? 'Fetching Schema failed');
				}
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, []);

	function handleChange(field: string, value: string | boolean) {
		setFormValues((prev) => ({ ...prev, [field]: value }));
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!contentType) return;

		setStatus('submitting');
		setError(null);

		try {
			const payload = { ...formValues };

			if (typeof payload.slug === 'string') {
				payload.slug = payload.slug.trim();
			}
			const created = await createEntry('page', payload);
			setStatus('success');

			router.push('/app/admin/page');
			router.refresh();
		} catch (err: any) {
			setStatus('error');
			setError(err?.message ?? 'Creating page failed');
		}
	}

	const fields: AdminFieldMeta[] = contentType?.fields ?? [
		{
			name: 'title',
			label: 'Title',
			type: 'string',
			required: true,
			list: true,
			filterable: true,
			order_index: 10,
		},
		{
			name: 'slug',
			label: 'Slug',
			type: 'string',
			required: true,
			list: true,
			filterable: true,
			order_index: 20,
		},
		{
			name: 'body',
			label: 'Body',
			type: 'text',
			required: false,
			list: false,
			filterable: false,
			order_index: 30,
		},
		{
			name: 'seo_title',
			label: 'Seo Title',
			type: 'string',
			required: false,
			list: false,
			filterable: false,
			order_index: 40,
		},
		{
			name: 'seo_description',
			label: 'Seo Description',
			type: 'text',
			required: false,
			list: false,
			filterable: false,
			order_index: 50,
		},
	];

	return (
		<div className='max-w-2xl'>
			<h2 className='text-2xl font-semibold mb-4'>New Page</h2>

			{error && (
				<p className='text-sm text-red-400 bg-red-950/40 border border-red-950/50 rounded-md px-3 py-2 mb-4'>
					{error}
				</p>
			)}

			<form
				onSubmit={handleSubmit}
				className='space-y-4'>
				{fields.map((field) => {
					const value = formValues[field.name] ?? '';
					const required = field.required;

					if (field.type === 'text') {
						return (
							<div
								key={field.name}
								className='space-y-1'>
								<label className='block text-sm font-medium text-slate-200'>
									{field.label}
									{required && (
										<span className='text-red-500'>*</span>
									)}
								</label>
								<textarea
									value={value}
									onChange={(e) =>
										handleChange(field.name, e.target.value)
									}
									className='block w-full rounded-md bg-slate-900 border border-slate700 px-3-py-2 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60'
									rows={4}
								/>
							</div>
						);
					}

					return (
						<div
							key={field.name}
							className='space-y-1'>
							<label className='block text-sm font-medium text-slate-200'>
								{field.label}
								{required && (
									<span className='text-red-500'>*</span>
								)}
							</label>
							<input
								type='text'
								value={value}
								onChange={(e) =>
									handleChange(field.name, e.target.value)
								}
								className='block w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60'
							/>
						</div>
					);
				})}
				<div className='flex items-center gap-3 pt-2'>
					<button
						type='submit'
						disabled={status === 'submitting'}
						className='inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition'>
						{status === 'submitting' ? 'SAVING...' : 'SAVE'}
					</button>
					<button
						type='button'
						onClick={() => router.push('/app/admin/page')}
						className='text-sm text-slate-300 hover:text-slate-100'>
						CANCEL
					</button>
				</div>
			</form>
		</div>
	);
}
