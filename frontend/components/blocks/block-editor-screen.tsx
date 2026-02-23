'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/http';
import {
	createAdminBlock,
	getAdminBlock,
	updateAdminBlock,
} from '@/lib/api/blocks';
import {
	comparableJsonFromState,
	defaultPageBuilderState,
	parsePageBuilderState,
	serializePageBuilderState,
	type PageBuilderState,
} from '@/lib/page-builder';
import type { BlockTemplate } from '@/lib/types';
import { formatUiError } from '@/lib/error-message';

import { ClientOnly } from '@/components/client-only';
import { PageBuilder } from '@/components/page-builder/page-builder';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
}

export function BlockEditorScreen({ blockId }: { blockId?: number }) {
	const router = useRouter();
	const isEdit = Number.isFinite(blockId);

	const [loading, setLoading] = useState(isEdit);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [block, setBlock] = useState<BlockTemplate | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [builder, setBuilder] = useState<PageBuilderState>(() => defaultPageBuilderState());
	const [baseline, setBaseline] = useState('');

	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			if (!isEdit || !blockId) {
				setLoading(false);
				setBlock(null);
				setTitle('');
				setSlug('');
				setDescription('');
				setBuilder(defaultPageBuilderState());
				setBaseline(comparableJsonFromState(defaultPageBuilderState()));
				return;
			}

			setLoading(true);
			setLoadError(null);
			try {
				const out = await getAdminBlock(blockId, `/admin/blocks/${blockId}`);
				if (cancelled) return;
				const state = parsePageBuilderState(out.definition);
				setBlock(out);
				setTitle(out.title);
				setSlug(out.slug);
				setDescription(out.description ?? '');
				setBuilder(state);
				setBaseline(comparableJsonFromState(state));
			} catch (error) {
				if (cancelled) return;
				setLoadError(toErrorMessage(error));
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [isEdit, blockId]);

	const dirty = useMemo(() => {
		if (!isEdit) {
			return !!title.trim() || !!slug.trim() || !!description.trim() || builder.nodes.length > 0;
		}
		if (!block) return false;
		if (title.trim() !== block.title) return true;
		if ((description.trim() || null) !== (block.description ?? null)) return true;
		return baseline !== comparableJsonFromState(builder);
	}, [isEdit, block, title, slug, description, baseline, builder]);

	async function save() {
		if (!title.trim()) return;
		if (!isEdit && !slug.trim()) return;

		setSaving(true);
		setSaveError(null);

		try {
			if (isEdit && blockId) {
				const out = await updateAdminBlock(
					blockId,
					{
						title: title.trim(),
						description: description.trim() ? description.trim() : null,
						definition: serializePageBuilderState(builder) as Record<string, unknown>,
					},
					`/admin/blocks/${blockId}`
				);
				const state = parsePageBuilderState(out.definition);
				setBlock(out);
				setTitle(out.title);
				setDescription(out.description ?? '');
				setBuilder(state);
				setBaseline(comparableJsonFromState(state));
			} else {
				const out = await createAdminBlock(
					{
						title: title.trim(),
						slug: slug.trim(),
						description: description.trim() ? description.trim() : null,
						definition: serializePageBuilderState(builder) as Record<string, unknown>,
					},
					'/admin/blocks'
				);
				router.replace(`/admin/blocks/${out.id}`);
			}
		} catch (error) {
			setSaveError(toErrorMessage(error));
		} finally {
			setSaving(false);
		}
	}

	async function cloneAsVariant() {
		if (!block) return;
		setSaving(true);
		setSaveError(null);

		const baseSlug = slugify(block.slug) || 'block';
		const baseVariant = baseSlug.endsWith('-variant') ? baseSlug : `${baseSlug}-variant`;

		try {
			let lastError: unknown = null;
			for (let i = 0; i < 50; i += 1) {
				const candidate = i === 0 ? baseVariant : `${baseVariant}-${i + 1}`;
				try {
					const out = await createAdminBlock(
						{
							title: `${(title.trim() || block.title).trim()} (variant)`,
							slug: candidate,
							description: description.trim() ? description.trim() : null,
							definition: serializePageBuilderState(builder) as Record<string, unknown>,
						},
						'/admin/blocks'
					);
					router.push(`/admin/blocks/${out.id}`);
					return;
				} catch (error) {
					lastError = error;
					if (error instanceof ApiError && error.status === 409) continue;
					throw error;
				}
			}
			throw lastError ?? new Error('Failed to clone block as variant.');
		} catch (error) {
			setSaveError(toErrorMessage(error));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1 min-w-0'>
					<div className='flex items-center gap-2'>
						<Button asChild variant='outline' size='sm'>
							<Link href='/admin/blocks'>Back</Link>
						</Button>
						{block ? <Badge variant='secondary'>/{block.slug}</Badge> : null}
					</div>
					<h1 className='text-2xl font-semibold truncate'>{isEdit ? 'Edit block' : 'New block'}</h1>
					<p className='text-sm text-muted-foreground'>
						Build reusable sections with the same editor used for page composition.
					</p>
				</div>

				<div className='flex items-center gap-2'>
					{isEdit ? (
						<Button variant='secondary' onClick={() => void cloneAsVariant()} disabled={saving || !block}>
							Clone as variant
						</Button>
					) : null}
					<Button onClick={() => void save()} disabled={saving || !title.trim() || (!isEdit && !slug.trim()) || !dirty}>
						{saving ? 'Saving…' : 'Save'}
					</Button>
				</div>
			</div>

			{loading ? <p className='text-sm text-muted-foreground'>Loading…</p> : null}
			{loadError ? <p className='text-sm text-red-600'>{loadError}</p> : null}
			{saveError ? <p className='text-sm text-red-600'>{saveError}</p> : null}

			{!loading ? (
				<div className='space-y-4'>
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
						<div className='space-y-2'>
							<Label>Title</Label>
							<Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
						</div>
						<div className='space-y-2'>
							<Label>Slug</Label>
							<Input
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								disabled={saving || isEdit}
								placeholder='hero-section'
							/>
							{isEdit ? (
								<p className='text-xs text-muted-foreground'>Slug is locked to keep block references stable.</p>
							) : null}
						</div>
					</div>

					<div className='space-y-2'>
						<Label>Description</Label>
						<Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} rows={3} />
					</div>

					<div className='space-y-2'>
						<Label>Layout</Label>
						<div className='rounded-xl border p-4'>
							<ClientOnly fallback={<div className='text-sm text-muted-foreground'>Loading editor…</div>}>
								<PageBuilder value={builder} onChange={setBuilder} disabled={saving} />
							</ClientOnly>
						</div>
					</div>

					<details className='rounded-xl border p-4'>
						<summary className='cursor-pointer text-sm font-medium'>Advanced (JSON)</summary>
						<div className='mt-3 space-y-2'>
							<p className='text-xs text-muted-foreground'>This is the stored V6 block definition payload.</p>
							<Textarea
								value={JSON.stringify(serializePageBuilderState(builder), null, 2)}
								readOnly
								className='font-mono text-xs min-h-[220px]'
							/>
						</div>
					</details>
				</div>
			) : null}
		</div>
	);
}
