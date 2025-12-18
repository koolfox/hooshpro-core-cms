'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/core';
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	type DragEndEvent,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

import type { Page } from '@/lib/types';
import { apiFetch } from '@/lib/http';
import { sanitizeRichHtml } from '@/lib/sanitize';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

import { TipTapEditor } from '@/components/tiptap-editor';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

type TipTapValue = { doc: JSONContent; html: string };

type Block = {
	id?: unknown;
	type: string;
	data?: unknown;
};

type TipTapBlockState = {
	id: string;
	value: TipTapValue;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function createBlockId(prefix = 'block'): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	if (uuid) return `${prefix}_${uuid}`;
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function escapeHtml(input: string): string {
	return input
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function blocksFrom(value: unknown): Block[] {
	if (!isRecord(value)) return [];
	const rawBlocks = value['blocks'];
	if (!Array.isArray(rawBlocks)) return [];

	const blocks: Block[] = [];
	for (const b of rawBlocks) {
		if (!isRecord(b)) continue;
		const type = b['type'];
		if (typeof type !== 'string') continue;
		blocks.push({ id: b['id'], type, data: b['data'] });
	}
	return blocks;
}

function blocksForCompare(value: unknown): { version: number; blocks: Block[] } {
	if (!isRecord(value)) return { version: 1, blocks: [] };

	const rawVersion = value['version'];
	const version =
		typeof rawVersion === 'number'
			? rawVersion
			: typeof rawVersion === 'string' && /^\d+$/.test(rawVersion)
				? Number(rawVersion)
				: 1;

	return {
		version,
		blocks: blocksFrom(value).map((b) => ({
			type: b.type,
			data: b.data,
		})),
	};
}

function emptyTipTapValue(): TipTapValue {
	return {
		doc: {
			type: 'doc',
			content: [{ type: 'paragraph' }],
		},
		html: '<p></p>',
	};
}

function pickTipTapValue(blocks: unknown): TipTapValue {
	// fallback: derive from legacy blocks (hero + paragraph)
	const all = blocksFrom(blocks);

	const hero = all.find((x) => x.type === 'hero')?.data;
	const paragraph = all.find((x) => x.type === 'paragraph')?.data;

	const heroHeadline =
		isRecord(hero) && typeof hero['headline'] === 'string'
			? hero['headline'].trim()
			: '';
	const heroSubheadline =
		isRecord(hero) && typeof hero['subheadline'] === 'string'
			? hero['subheadline'].trim()
			: '';

	const paragraphText =
		isRecord(paragraph) && typeof paragraph['text'] === 'string'
			? paragraph['text'].trim()
			: '';

	const content: JSONContent[] = [];
	const htmlParts: string[] = [];

	if (heroHeadline) {
		content.push({
			type: 'heading',
			attrs: { level: 2 },
			content: [{ type: 'text', text: heroHeadline }],
		});
		htmlParts.push(`<h2>${escapeHtml(heroHeadline)}</h2>`);
	}

	if (heroSubheadline) {
		content.push({
			type: 'paragraph',
			content: [{ type: 'text', text: heroSubheadline }],
		});
		htmlParts.push(`<p>${escapeHtml(heroSubheadline)}</p>`);
	}

	if (paragraphText) {
		content.push({
			type: 'paragraph',
			content: [{ type: 'text', text: paragraphText }],
		});
		htmlParts.push(`<p>${escapeHtml(paragraphText)}</p>`);
	}

	if (content.length === 0) {
		content.push({ type: 'paragraph' });
		htmlParts.push('<p></p>');
	}

	return { doc: { type: 'doc', content }, html: htmlParts.join('') };
}

function tiptapBlocksFrom(blocks: unknown): TipTapBlockState[] {
	const tiptapBlocks = blocksFrom(blocks).filter((b) => b.type === 'tiptap');
	const parsed: TipTapBlockState[] = [];

	for (const b of tiptapBlocks) {
		const id =
			typeof b.id === 'string' && b.id.trim()
				? b.id
				: createBlockId('tiptap');

		const data = b.data ?? null;
		if (
			isRecord(data) &&
			isRecord(data['doc']) &&
			typeof data['html'] === 'string'
		) {
			const doc = data['doc'];
			const docType = doc['type'];
			if (typeof docType === 'string') {
				parsed.push({ id, value: { doc: doc as JSONContent, html: data['html'] } });
				continue;
			}
		}

		parsed.push({ id, value: emptyTipTapValue() });
	}

	if (parsed.length > 0) return parsed;

	return [{ id: createBlockId('tiptap'), value: pickTipTapValue(blocks) }];
}

function blocksWithTipTapBlocks(
	blocks: TipTapBlockState[],
	options?: { includeIds?: boolean }
) {
	const includeIds = options?.includeIds !== false;
	return {
		version: 2,
		blocks: blocks.map((b) => ({
			...(includeIds ? { id: b.id } : {}),
			type: 'tiptap',
			data: {
				doc: b.value.doc,
				html: b.value.html,
			},
		})),
	};
}

function extractHtml(blocks: unknown): string {
	const parts: string[] = [];
	for (const b of blocksFrom(blocks)) {
		if (b.type !== 'tiptap') continue;
		const data = b.data;
		if (isRecord(data) && typeof data['html'] === 'string') {
			parts.push(data['html']);
		}
	}
	if (parts.length > 0) return parts.join('');

	// legacy paragraph fallback
	const p = blocksFrom(blocks).find((x) => x.type === 'paragraph');
	const pData = p?.data;
	const text = isRecord(pData) ? pData['text'] : '';
	return typeof text === 'string' && text ? `<p>${text}</p>` : '';
}

function SortableTipTapBlock({
	block,
	index,
	disabled,
	onRemove,
	onChange,
}: {
	block: TipTapBlockState;
	index: number;
	disabled: boolean;
	onRemove: (id: string) => void;
	onChange: (id: string, next: TipTapValue) => void;
}) {
	const {
		attributes,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: block.id, disabled });

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<section
			ref={setNodeRef}
			style={style}
			className={isDragging ? 'opacity-70' : ''}
			{...attributes}>
			<div className='flex items-center justify-between gap-2 mb-2'>
				<div className='flex items-center gap-2'>
					<Button
						type='button'
						variant='ghost'
						size='icon'
						className='cursor-grab active:cursor-grabbing touch-none'
						ref={setActivatorNodeRef}
						disabled={disabled}
						{...listeners}>
						<GripVertical className='h-4 w-4' />
						<span className='sr-only'>Drag section</span>
					</Button>
					<span className='text-xs text-muted-foreground'>
						Section {index + 1}
					</span>
				</div>

				<Button
					type='button'
					variant='outline'
					size='sm'
					onClick={() => onRemove(block.id)}
					disabled={disabled}>
					<Trash2 className='h-4 w-4 mr-2' />
					Remove
				</Button>
			</div>

			<TipTapEditor
				value={block.value}
				onChange={(next) => onChange(block.id, next)}
				disabled={disabled}
			/>
		</section>
	);
}

export function PublicPageClient({
	initialPage,
	isAdmin,
	defaultEdit,
}: {
	initialPage: Page;
	isAdmin: boolean;
	defaultEdit: boolean;
}) {
	const router = useRouter();

	const [page, setPage] = useState<Page>(initialPage);

	// view/edit
	const [editMode, setEditMode] = useState<boolean>(isAdmin && defaultEdit);

	// settings modal
	const [settingsOpen, setSettingsOpen] = useState(false);

	// editable fields
	const [title, setTitle] = useState(page.title);
	const [seoTitle, setSeoTitle] = useState(page.seo_title ?? '');
	const [seoDesc, setSeoDesc] = useState(page.seo_description ?? '');
	const [status, setStatus] = useState<'draft' | 'published'>(page.status);

	const [contentBlocks, setContentBlocks] = useState<TipTapBlockState[]>(() =>
		tiptapBlocksFrom(initialPage.blocks)
	);

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const html = useMemo(() => extractHtml(page.blocks), [page.blocks]);
	const safeHtml = useMemo(() => sanitizeRichHtml(html), [html]);

	const dirty = useMemo(() => {
		const blocksNow = JSON.stringify(blocksForCompare(page.blocks));
		const blocksNext = JSON.stringify(
			blocksWithTipTapBlocks(contentBlocks, { includeIds: false })
		);
		if (blocksNow !== blocksNext) return true;

		if (title !== page.title) return true;
		if ((seoTitle || null) !== (page.seo_title ?? null)) return true;
		if ((seoDesc || null) !== (page.seo_description ?? null)) return true;
		if (status !== page.status) return true;

		return false;
	}, [page, contentBlocks, title, seoTitle, seoDesc, status]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	async function save(nextStatus?: 'draft' | 'published') {
		if (!isAdmin) return;

		setSaving(true);
		setError(null);

		const payload = {
			title: title.trim(),
			status: nextStatus ?? status,
			seo_title: seoTitle.trim() ? seoTitle.trim() : null,
			seo_description: seoDesc.trim() ? seoDesc.trim() : null,
			blocks: blocksWithTipTapBlocks(contentBlocks),
		};

		try {
			const updated = await apiFetch<Page>(
				`/api/admin/pages/by-slug/${page.slug}`,
				{
					// first resolve id (backend endpoint returns full PageOut)
					cache: 'no-store',
					nextPath: `/${page.slug}?edit=1`,
				}
			);

			const out = await apiFetch<Page>(`/api/admin/pages/${updated.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
				nextPath: `/${page.slug}?edit=1`,
			});

			setPage(out);
			setTitle(out.title);
			setSeoTitle(out.seo_title ?? '');
			setSeoDesc(out.seo_description ?? '');
			setStatus(out.status);
			setContentBlocks(tiptapBlocksFrom(out.blocks));
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	async function toggleStatus() {
		if (status === 'draft') {
			await save('published');
		} else {
			await save('draft');
		}
	}

	function enterEdit() {
		if (!isAdmin) return;
		setEditMode(true);
		router.replace(`/${page.slug}?edit=1`);
	}

	function exitEdit() {
		setEditMode(false);
		router.replace(`/${page.slug}`);
	}

	function addSection() {
		setContentBlocks((prev) => [
			...prev,
			{ id: createBlockId('tiptap'), value: emptyTipTapValue() },
		]);
	}

	function removeSection(id: string) {
		setContentBlocks((prev) => {
			const next = prev.filter((b) => b.id !== id);
			return next.length > 0
				? next
				: [{ id: createBlockId('tiptap'), value: emptyTipTapValue() }];
		});
	}

	function updateSection(id: string, next: TipTapValue) {
		setContentBlocks((prev) =>
			prev.map((b) => (b.id === id ? { ...b, value: next } : b))
		);
	}

	function onDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		setContentBlocks((items) => {
			const oldIndex = items.findIndex((b) => b.id === active.id);
			const newIndex = items.findIndex((b) => b.id === over.id);
			if (oldIndex === -1 || newIndex === -1) return items;
			return arrayMove(items, oldIndex, newIndex);
		});
	}

	const pageContent = (
		<div className='max-w-4xl mx-auto p-6 space-y-6'>
			{/* Admin top bar */}
			{isAdmin ? (
				<div className='rounded-xl border p-3 flex items-center justify-between gap-3'>
					<div className='flex items-center gap-2'>
						<Badge
							variant={
								status === 'published' ? 'default' : 'secondary'
							}>
							{status}
						</Badge>
						<span className='text-xs text-muted-foreground'>
							Slug: /{page.slug}
						</span>
					</div>

					<div className='flex items-center gap-2'>
						<Button
							variant='outline'
							onClick={() => setSettingsOpen(true)}
							disabled={saving}>
							Settings
						</Button>

						{editMode ? (
							<Button
								variant='outline'
								onClick={exitEdit}
								disabled={saving}>
								Preview
							</Button>
						) : (
							<Button
								variant='outline'
								onClick={enterEdit}>
								Edit
							</Button>
						)}

						<Button
							variant='outline'
							onClick={toggleStatus}
							disabled={saving}>
							{status === 'published' ? 'Unpublish' : 'Publish'}
						</Button>

						<Button
							onClick={() => save()}
							disabled={saving || !dirty}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</div>
				</div>
			) : null}

			{/* Title */}
			{editMode ? (
				<div className='space-y-2'>
					<Label>Title</Label>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder='Page title'
						disabled={saving}
					/>
				</div>
			) : (
				<h1 className='text-4xl font-bold tracking-tight'>
					{page.title}
				</h1>
			)}

			<Separator />

			{/* Body */}
			{editMode ? (
				<div className='space-y-2'>
					<div className='flex items-center justify-between gap-2'>
						<Label>Content</Label>
						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={addSection}
							disabled={saving}>
							<Plus className='h-4 w-4 mr-2' />
							Add section
						</Button>
					</div>

					<p className='text-xs text-muted-foreground'>
						Drag sections to reorder. Each section is a TipTap block (MVP).
					</p>

					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={onDragEnd}>
						<SortableContext
							items={contentBlocks.map((b) => b.id)}
							strategy={verticalListSortingStrategy}>
							<div className='space-y-6'>
								{contentBlocks.map((b, index) => (
									<SortableTipTapBlock
										key={b.id}
										block={b}
										index={index}
										disabled={saving}
										onRemove={removeSection}
										onChange={updateSection}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
					{error ? (
						<p className='text-sm text-red-600'>{error}</p>
					) : null}
				</div>
			) : (
				<div
					className='prose prose-neutral dark:prose-invert max-w-none'
					dangerouslySetInnerHTML={{ __html: safeHtml || '<p></p>' }}
				/>
			)}

			{/* Settings dialog */}
			<Dialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}>
				<DialogContent className='sm:max-w-xl'>
					<DialogHeader>
						<DialogTitle>Page settings</DialogTitle>
						<DialogDescription>
							SEO + status controls (MVP).
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label>SEO Title</Label>
							<Input
								value={seoTitle}
								onChange={(e) => setSeoTitle(e.target.value)}
								disabled={saving}
							/>
						</div>

						<div className='space-y-2'>
							<Label>SEO Description</Label>
							<Input
								value={seoDesc}
								onChange={(e) => setSeoDesc(e.target.value)}
								disabled={saving}
							/>
						</div>
					</div>

					{error ? (
						<p className='text-sm text-red-600'>{error}</p>
					) : null}

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setSettingsOpen(false)}
							disabled={saving}>
							Close
						</Button>
						<Button
							onClick={() => save()}
							disabled={saving || !dirty}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);

	if (editMode && isAdmin) {
		return (
			<div className='[--header-height:calc(--spacing(14))]'>
				<SidebarProvider className='flex flex-col'>
					<SiteHeader title={`Editing /${page.slug}`} />

					<div className='flex flex-1'>
						<AppSidebar />
						<SidebarInset>{pageContent}</SidebarInset>
					</div>
				</SidebarProvider>
			</div>
		);
	}

	return (
		<main>{pageContent}</main>
	);
}
