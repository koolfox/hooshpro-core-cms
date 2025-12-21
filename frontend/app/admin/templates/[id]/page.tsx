'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { apiFetch } from '@/lib/http';
import {
	comparableJsonFromState,
	createId,
	parsePageBuilderState,
	serializePageBuilderState,
	type PageBuilderState,
} from '@/lib/page-builder';
import type { PageTemplate } from '@/lib/types';

import { PageBuilder } from '@/components/page-builder/page-builder';
import { PageBuilderOutline } from '@/components/page-builder/page-outline';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function parseId(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

function hasSlot(state: PageBuilderState): boolean {
	return state.rows.some((r) => r.columns.some((c) => c.blocks.some((b) => b.type === 'slot')));
}

export default function AdminTemplateEditorPage() {
	const params = useParams();
	const templateId = parseId(params?.['id']);

	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [template, setTemplate] = useState<PageTemplate | null>(null);

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [builder, setBuilder] = useState<PageBuilderState>(() => parsePageBuilderState(null));

	const [baseline, setBaseline] = useState<string>('');

	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	useEffect(() => {
		if (!templateId) {
			setLoading(false);
			setLoadError('Invalid template id.');
			return;
		}

		let canceled = false;
		async function load() {
			setLoading(true);
			setLoadError(null);
			try {
				const t = await apiFetch<PageTemplate>(`/api/admin/templates/${templateId}`, {
					cache: 'no-store',
					nextPath: `/admin/templates/${templateId}`,
				});
				if (canceled) return;
				const state = parsePageBuilderState(t.definition);
				setTemplate(t);
				setTitle(t.title);
				setDescription(t.description ?? '');
				setBuilder(state);
				setBaseline(comparableJsonFromState(state));
			} catch (e) {
				if (canceled) return;
				setLoadError(toErrorMessage(e));
				setTemplate(null);
			} finally {
				if (!canceled) setLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [templateId]);

	const dirty = useMemo(() => {
		if (!template) return false;
		if (title.trim() !== template.title) return true;
		if ((description.trim() || null) !== (template.description ?? null)) return true;
		if (baseline !== comparableJsonFromState(builder)) return true;
		return false;
	}, [template, title, description, baseline, builder]);

	function insertSlotBlock() {
		setBuilder((prev) => {
			if (hasSlot(prev)) return prev;

			const row = {
				id: createId('row'),
				settings: { columns: 1, sizes: [100] },
				columns: [
					{
						id: createId('col'),
						blocks: [{ id: createId('blk'), type: 'slot', data: { name: 'Page content' } }],
					},
				],
			} satisfies PageBuilderState['rows'][number];

			return { ...prev, rows: [...prev.rows, row] };
		});
	}

	async function save() {
		if (!template || !templateId) return;

		setSaving(true);
		setSaveError(null);

		const payload = {
			title: title.trim(),
			description: description.trim() ? description.trim() : null,
			definition: serializePageBuilderState(builder) as Record<string, unknown>,
		};

		try {
			const out = await apiFetch<PageTemplate>(`/api/admin/templates/${templateId}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
				nextPath: `/admin/templates/${templateId}`,
			});

			const nextState = parsePageBuilderState(out.definition);
			setTemplate(out);
			setTitle(out.title);
			setDescription(out.description ?? '');
			setBuilder(nextState);
			setBaseline(comparableJsonFromState(nextState));
		} catch (e) {
			setSaveError(toErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	const slotMissing = !hasSlot(builder);

	return (
		<div className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1 min-w-0'>
					<div className='flex items-center gap-2'>
						<Button
							asChild
							variant='outline'
							size='sm'>
							<Link href='/admin/templates'>Back</Link>
						</Button>
						{template ? (
							<Badge variant='secondary'>/{template.slug}</Badge>
						) : null}
					</div>
					<h1 className='text-2xl font-semibold truncate'>Template editor</h1>
					<p className='text-sm text-muted-foreground'>
						Templates are layouts that can include menus/footers and a required page slot.
					</p>
				</div>

				<div className='flex items-center gap-2'>
					{slotMissing ? (
						<Button
							variant='outline'
							onClick={insertSlotBlock}
							disabled={saving}>
							Add page slot
						</Button>
					) : null}
					<Button
						onClick={save}
						disabled={saving || !dirty || !title.trim() || !template}>
						{saving ? 'Saving…' : 'Save'}
					</Button>
				</div>
			</div>

			{loading ? <p className='text-sm text-muted-foreground'>Loading…</p> : null}
			{loadError ? <p className='text-sm text-red-600'>{loadError}</p> : null}
			{saveError ? <p className='text-sm text-red-600'>{saveError}</p> : null}

			{template ? (
				<>
					<div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
						<div className='lg:col-span-8 space-y-4'>
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div className='space-y-2'>
									<Label>Title</Label>
									<Input
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										disabled={saving}
									/>
								</div>
								<div className='space-y-2'>
									<Label>Slug</Label>
									<Input
										value={template.slug}
										readOnly
										disabled
									/>
								</div>
							</div>

							<div className='space-y-2'>
								<Label>Description</Label>
								<Textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									disabled={saving}
								/>
							</div>

							{slotMissing ? (
								<p className='text-sm text-amber-700'>
									This template has no page slot. Pages using it won’t render their content until you add a <code>slot</code>.
								</p>
							) : null}

							<Separator />

							<PageBuilder
								value={builder}
								onChange={setBuilder}
								disabled={saving}
							/>
						</div>

						<aside className='lg:col-span-4'>
							<div className='sticky top-(--header-height) max-h-[calc(100svh-var(--header-height))] overflow-auto rounded-md border bg-background p-4'>
								<PageBuilderOutline state={builder} />
							</div>
						</aside>
					</div>
				</>
			) : null}
		</div>
	);
}

