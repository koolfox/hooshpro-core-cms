'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { getAdminTemplate, updateAdminTemplate } from '@/lib/api/templates';
import {
	comparableJsonFromState,
	createId,
	parsePageBuilderState,
	serializePageBuilderState,
	type PageBuilderState,
	type PageNode,
} from '@/lib/page-builder';
import type { PageTemplate } from '@/lib/types';
import { formatUiError } from '@/lib/error-message';

import { ClientOnly } from '@/components/client-only';
import { PageBuilder } from '@/components/page-builder/page-builder';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
}

function parseId(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

function hasSlot(state: PageBuilderState): boolean {
	function walk(nodes: PageNode[]): boolean {
		for (const n of nodes) {
			if (n.type === 'slot') return true;
			if (Array.isArray(n.nodes) && walk(n.nodes)) return true;
		}
		return false;
	}
	return walk(state.nodes);
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

		const resolvedTemplateId = templateId;
		let canceled = false;

		async function load() {
			setLoading(true);
			setLoadError(null);
			try {
				const t = await getAdminTemplate(resolvedTemplateId, `/admin/templates/${resolvedTemplateId}`);
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

			function maxBottom(nodes: PageNode[], breakpoint: 'desktop' | 'tablet' | 'mobile'): number {
				let max = 0;
				for (const n of nodes) {
					const f = n.frames[breakpoint];
					const childMax = Array.isArray(n.nodes) ? maxBottom(n.nodes, breakpoint) : 0;
					max = Math.max(max, f.y + Math.max(f.h, childMax));
				}
				return max;
			}

			const y = Math.max(0, Math.round(maxBottom(prev.nodes, 'desktop') + 80));
			const padding = 24;
			const sectionHeight = 600;
			const slotHeight = 520;

			const slotNode: PageNode = {
				id: createId('node'),
				type: 'slot',
				data: { name: 'Page content' },
				frames: {
					mobile: { x: padding, y: padding, w: prev.canvas.widths.mobile - padding * 2, h: slotHeight },
					tablet: { x: padding, y: padding, w: prev.canvas.widths.tablet - padding * 2, h: slotHeight },
					desktop: { x: padding, y: padding, w: prev.canvas.widths.desktop - padding * 2, h: slotHeight },
				},
			};

			const frame: PageNode = {
				id: createId('node'),
				type: 'frame',
				data: { label: 'Page slot', paddingPx: padding },
				frames: {
					mobile: { x: 0, y, w: prev.canvas.widths.mobile, h: sectionHeight },
					tablet: { x: 0, y, w: prev.canvas.widths.tablet, h: sectionHeight },
					desktop: { x: 0, y, w: prev.canvas.widths.desktop, h: sectionHeight },
				},
				nodes: [slotNode],
			};

			return { ...prev, nodes: [...prev.nodes, frame] };
		});
	}

	async function save() {
		const resolvedTemplateId = templateId;
		if (!template || !resolvedTemplateId) return;

		setSaving(true);
		setSaveError(null);

		const payload = {
			title: title.trim(),
			description: description.trim() ? description.trim() : null,
			definition: serializePageBuilderState(builder) as Record<string, unknown>,
		};

		try {
			const out = await updateAdminTemplate(
				resolvedTemplateId,
				payload,
				`/admin/templates/${resolvedTemplateId}`
			);

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
						<div className='lg:col-span-12 space-y-4'>
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

							<ClientOnly fallback={<div className='rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground'>Loading editor…</div>}>
								<PageBuilder
									value={builder}
									onChange={setBuilder}
									disabled={saving}
								/>
							</ClientOnly>
						</div>
					</div>
				</>
			) : null}
		</div>
	);
}
