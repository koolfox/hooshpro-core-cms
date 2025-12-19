'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
	rectSortingStrategy,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

import type {
	PageBlock,
	PageBuilderState,
	PageColumn,
	PageRow,
	EditorValue,
} from '@/lib/page-builder';
import {
	cloneRowsWithNewIds,
	createId,
	emptyEditorValue,
	isRecord,
	parsePageBuilderState,
} from '@/lib/page-builder';
import { sanitizeRichHtml } from '@/lib/sanitize';
import type { BlockTemplate, ComponentDef } from '@/lib/types';

import { EditorBlock } from '@/components/editor-block';
import { BlockPickerDialog, type ComponentPickerItem } from './block-picker-dialog';
import { BlockTemplatePickerDialog } from './block-template-picker-dialog';
import { MediaPickerDialog } from '@/components/media/media-picker-dialog';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type SortableRowData = { kind: 'row'; rowId: string };
type SortableColumnData = { kind: 'column'; rowId: string; columnId: string };
type SortableBlockData = {
	kind: 'block';
	rowId: string;
	columnId: string;
};

const MAX_COLUMNS = 12;

const MD_GRID_COLS_CLASS: Record<number, string> = {
	1: 'md:grid-cols-1',
	2: 'md:grid-cols-2',
	3: 'md:grid-cols-3',
	4: 'md:grid-cols-4',
	5: 'md:grid-cols-5',
	6: 'md:grid-cols-6',
	7: 'md:grid-cols-7',
	8: 'md:grid-cols-8',
	9: 'md:grid-cols-9',
	10: 'md:grid-cols-10',
	11: 'md:grid-cols-11',
	12: 'md:grid-cols-12',
};

function clampColumnsCount(value: number): number {
	if (!Number.isFinite(value)) return 1;
	return Math.max(1, Math.min(MAX_COLUMNS, Math.round(value)));
}

function responsiveGridColsClass(count: number): string {
	const c = clampColumnsCount(count);
	return `grid-cols-1 ${MD_GRID_COLS_CLASS[c] ?? 'md:grid-cols-1'}`;
}

function ensureRowColumns(row: PageRow, count: number): PageRow {
	count = clampColumnsCount(count);
	const current = row.columns.length;
	if (current === count) {
		return {
			...row,
			settings: { ...(row.settings ?? {}), columns: count },
		};
	}

	if (current < count) {
		const extra = Array.from({ length: count - current }).map(() => ({
			id: createId('col'),
			blocks: [],
		}));
		return {
			...row,
			settings: { ...(row.settings ?? {}), columns: count },
			columns: [...row.columns, ...extra],
		};
	}

	// shrink: merge removed blocks into first column
	const kept = row.columns.slice(0, count);
	const removed = row.columns.slice(count);
	const mergedBlocks: PageBlock[] = [
		...kept[0].blocks,
		...removed.flatMap((c) => c.blocks),
	];

	return {
		...row,
		settings: { ...(row.settings ?? {}), columns: count },
		columns: [{ ...kept[0], blocks: mergedBlocks }, ...kept.slice(1)],
	};
}

function renderBlockPreview(block: PageBlock) {
	if (block.type === 'editor') {
		const html = block.data.html;
		const safe = sanitizeRichHtml(html);
		return (
			<div
				className='prose prose-neutral dark:prose-invert max-w-none'
				dangerouslySetInnerHTML={{ __html: safe || '<p></p>' }}
			/>
		);
	}

	if (block.type === 'separator') {
		return <Separator />;
	}

	if (block.type === 'button') {
		const href = block.data.href?.trim();
		return (
			<Button
				variant={block.data.variant ?? 'default'}
				asChild={!!href}>
				{href ? <Link href={href}>{block.data.label}</Link> : block.data.label}
			</Button>
		);
	}

	if (block.type === 'card') {
		return (
			<Card>
				{block.data.title ? (
					<CardHeader>
						<CardTitle>{block.data.title}</CardTitle>
					</CardHeader>
				) : null}
				<CardContent>
					{block.data.body ? (
						<p className='text-sm text-muted-foreground whitespace-pre-wrap'>
							{block.data.body}
						</p>
					) : (
						<p className='text-sm text-muted-foreground'>Card</p>
					)}
				</CardContent>
			</Card>
		);
	}

	if (block.type === 'image') {
		if (!block.data.url) {
			return (
				<div className='rounded-lg border p-4 text-sm text-muted-foreground'>
					Image (no URL)
				</div>
			);
		}
		return (
			<div className='relative aspect-video rounded-lg border overflow-hidden bg-muted/30'>
				<Image
					src={block.data.url}
					alt={block.data.alt ?? ''}
					fill
					unoptimized
					sizes='(min-width: 1024px) 50vw, 100vw'
					className='object-cover'
				/>
			</div>
		);
	}

	if (block.type === 'shadcn') {
		return (
			<Card>
				<CardHeader>
					<CardTitle className='text-sm'>
						{block.data.component || 'Shadcn component'}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className='text-sm text-muted-foreground'>
						Placeholder block. Configure this component later.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className='rounded-lg border p-3 text-sm text-muted-foreground'>
			Unknown component: <code>{block.data.originalType}</code>
		</div>
	);
}

function SortableRow({
	row,
	disabled,
	onRemoveRow,
	onSetColumns,
	children,
}: {
	row: PageRow;
	disabled: boolean;
	onRemoveRow: (rowId: string) => void;
	onSetColumns: (rowId: string, columns: number) => void;
	children: React.ReactNode;
}) {
	const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } =
		useSortable({
			id: row.id,
			data: { kind: 'row', rowId: row.id } satisfies SortableRowData,
			disabled,
		});

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const columnsCount = clampColumnsCount(row.settings?.columns ?? row.columns.length);

	return (
		<section
			ref={setNodeRef}
			style={style}
			className={isDragging ? 'opacity-70' : ''}
			{...attributes}>
			<div className='rounded-xl border bg-card/50'>
				<div className='flex items-center justify-between gap-2 p-3 border-b'>
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
							<span className='sr-only'>Drag row</span>
						</Button>
						<span className='text-xs text-muted-foreground'>Row</span>
					</div>

					<div className='flex items-center gap-2'>
						<Select
							value={String(columnsCount)}
							onValueChange={(v) => onSetColumns(row.id, clampColumnsCount(Number(v)))}
							disabled={disabled}>
							<SelectTrigger className='w-[110px]'>
								<SelectValue placeholder='Columns' />
							</SelectTrigger>
							<SelectContent>
								{Array.from({ length: MAX_COLUMNS }, (_, i) => i + 1).map((n) => (
									<SelectItem
										key={n}
										value={String(n)}>
										{n} col
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={() => onRemoveRow(row.id)}
							disabled={disabled}>
							<Trash2 className='h-4 w-4 mr-2' />
							Remove
						</Button>
					</div>
				</div>

				<div className='p-4'>{children}</div>
			</div>
		</section>
	);
}

function SortableColumn({
	column,
	rowId,
	disabled,
	onAddBlock,
	children,
}: {
	column: PageColumn;
	rowId: string;
	disabled: boolean;
	onAddBlock: () => void;
	children: React.ReactNode;
}) {
	const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging, isOver } =
		useSortable({
			id: column.id,
			data: { kind: 'column', rowId, columnId: column.id } satisfies SortableColumnData,
			disabled,
		});

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={[
				isDragging ? 'opacity-70' : '',
				isOver ? 'ring-2 ring-ring rounded-xl' : '',
			].join(' ')}
			{...attributes}>
			<div className='rounded-xl border bg-background p-3 space-y-3 min-h-[120px]'>
				<div className='flex items-center justify-between gap-2'>
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
							<span className='sr-only'>Drag column</span>
						</Button>
						<span className='text-xs text-muted-foreground'>Column</span>
					</div>

					<Button
						type='button'
						variant='outline'
						size='sm'
						onClick={onAddBlock}
						disabled={disabled}>
						<Plus className='h-4 w-4 mr-2' />
						Add component
					</Button>
				</div>

				{children}
			</div>
		</div>
	);
}

function SortableBlock({
	block,
	rowId,
	columnId,
	disabled,
	activeBlockId,
	setActiveBlockId,
	activeBlockRef,
	onRemove,
	onUpdate,
}: {
	block: PageBlock;
	rowId: string;
	columnId: string;
	disabled: boolean;
	activeBlockId: string | null;
	setActiveBlockId: (id: string | null) => void;
	activeBlockRef: React.RefObject<HTMLDivElement | null>;
	onRemove: () => void;
	onUpdate: (next: PageBlock) => void;
}) {
	const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
	const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } =
		useSortable({
			id: block.id,
			data: { kind: 'block', rowId, columnId } satisfies SortableBlockData,
			disabled,
		});

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const isActive = activeBlockId === block.id;

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={isDragging ? 'opacity-70' : ''}
			{...attributes}>
			<div className='rounded-xl border bg-background'>
				<div className='flex items-center justify-between gap-2 p-2 border-b'>
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
							<span className='sr-only'>Drag component</span>
						</Button>
						<span className='text-xs text-muted-foreground'>
							{block.type === 'unknown'
								? block.data.originalType
								: block.type === 'shadcn'
									? `shadcn/${block.data.component || 'component'}`
									: block.type}
						</span>
					</div>

					<div className='flex items-center gap-2'>
						{block.type === 'editor' && isActive ? (
							<Button
								type='button'
								variant='outline'
								size='sm'
								onClick={() => setActiveBlockId(null)}
								disabled={disabled}>
								Done
							</Button>
						) : null}

						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={onRemove}
							disabled={disabled}>
							Remove
						</Button>
					</div>
				</div>

				<div
					ref={isActive ? activeBlockRef : undefined}
					className='p-3'>
					{block.type === 'editor' ? (
						isActive ? (
							<EditorBlock
								value={block.data}
								onChange={(next: EditorValue) =>
									onUpdate({ ...block, data: next })
								}
								disabled={disabled}
							/>
						) : (
							<button
								type='button'
								className='w-full text-left'
								onClick={() => setActiveBlockId(block.id)}
								disabled={disabled}>
								{renderBlockPreview(block)}
							</button>
						)
					) : null}

					{block.type === 'button' ? (
						<div className='space-y-3'>
							{renderBlockPreview(block)}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div className='space-y-1'>
									<Label className='text-xs'>Label</Label>
									<Input
										value={block.data.label}
										onChange={(e) =>
											onUpdate({
												...block,
												data: {
													...block.data,
													label: e.target.value,
												},
											})
										}
										disabled={disabled}
									/>
								</div>
								<div className='space-y-1'>
									<Label className='text-xs'>Href</Label>
									<Input
										value={block.data.href ?? ''}
										onChange={(e) =>
											onUpdate({
												...block,
												data: {
													...block.data,
													href: e.target.value,
												},
											})
										}
										disabled={disabled}
									/>
								</div>
							</div>
						</div>
					) : null}

					{block.type === 'card' ? (
						<div className='space-y-3'>
							{renderBlockPreview(block)}
							<div className='space-y-2'>
								<div className='space-y-1'>
									<Label className='text-xs'>Title</Label>
									<Input
										value={block.data.title ?? ''}
										onChange={(e) =>
											onUpdate({
												...block,
												data: {
													...block.data,
													title: e.target.value,
												},
											})
										}
										disabled={disabled}
									/>
								</div>
								<div className='space-y-1'>
									<Label className='text-xs'>Body</Label>
									<Input
										value={block.data.body ?? ''}
										onChange={(e) =>
											onUpdate({
												...block,
												data: {
													...block.data,
													body: e.target.value,
												},
											})
										}
										disabled={disabled}
									/>
								</div>
							</div>
						</div>
					) : null}

					{block.type === 'separator' ? renderBlockPreview(block) : null}

					{block.type === 'image' ? (
						<div className='space-y-3'>
							{renderBlockPreview(block)}
							<div className='flex items-center gap-2'>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={() => setMediaPickerOpen(true)}
									disabled={disabled}>
									Pick from library
								</Button>
								{block.data.media_id ? (
									<span className='text-xs text-muted-foreground'>
										media_id: {block.data.media_id}
									</span>
								) : null}
							</div>

							<div className='space-y-1'>
								<Label className='text-xs'>Alt text</Label>
								<Input
									value={block.data.alt ?? ''}
									onChange={(e) =>
										onUpdate({
											...block,
											data: {
												...block.data,
												alt: e.target.value,
											},
										})
									}
									disabled={disabled}
								/>
							</div>

							<MediaPickerDialog
								open={mediaPickerOpen}
								onOpenChange={setMediaPickerOpen}
								onPick={(m) => {
									onUpdate({
										...block,
										data: {
											...block.data,
											url: m.url,
											media_id: m.id,
											alt: block.data.alt ?? m.original_name,
										},
									});
								}}
							/>
						</div>
					) : null}

					{block.type !== 'editor' &&
					block.type !== 'button' &&
					block.type !== 'card' &&
					block.type !== 'separator' &&
					block.type !== 'image'
						? renderBlockPreview(block)
						: null}
				</div>
			</div>
		</div>
	);
}

	function createBlockFromComponent(component: ComponentDef): PageBlock {
	const type = (component.type || '').trim();
	const data = component.data;

	if (type === 'editor') {
		return { id: createId('blk'), type: 'editor', data: emptyEditorValue() };
	}

	if (type === 'separator') {
		return { id: createId('blk'), type: 'separator', data: {} };
	}

	if (type === 'button') {
		const d = isRecord(data) ? data : {};
		const label = typeof d['label'] === 'string' ? d['label'] : 'Button';
		const href = typeof d['href'] === 'string' ? d['href'] : '';
		const rawVariant = typeof d['variant'] === 'string' ? d['variant'] : undefined;
		const variant =
			rawVariant && ['default', 'secondary', 'outline', 'destructive', 'ghost'].includes(rawVariant)
				? (rawVariant as 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost')
				: undefined;
		return {
			id: createId('blk'),
			type: 'button',
			data: { label, href, variant },
		};
	}

	if (type === 'card') {
		const d = isRecord(data) ? data : {};
		const title = typeof d['title'] === 'string' ? d['title'] : 'Card';
		const body = typeof d['body'] === 'string' ? d['body'] : '';
		return { id: createId('blk'), type: 'card', data: { title, body } };
	}

	if (type === 'image') {
		const d = isRecord(data) ? data : {};
		const url = typeof d['url'] === 'string' ? d['url'] : '';
		const alt = typeof d['alt'] === 'string' ? d['alt'] : '';
		const mediaId = typeof d['media_id'] === 'number' ? d['media_id'] : undefined;
		return { id: createId('blk'), type: 'image', data: { url, alt, media_id: mediaId } };
	}

	if (type === 'shadcn') {
		const d = isRecord(data) ? data : {};
		const componentId =
			typeof d['component'] === 'string' ? d['component'] : component.slug;
		return { id: createId('blk'), type: 'shadcn', data: { component: componentId } };
	}

	return {
		id: createId('blk'),
		type: 'unknown',
		data: { originalType: type || component.slug || 'unknown', data },
	};
}

export function PageBuilder({
	value,
	onChange,
	disabled,
}: {
	value: PageBuilderState;
	onChange: (next: PageBuilderState) => void;
	disabled?: boolean;
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const [blockPickerOpen, setBlockPickerOpen] = useState(false);
	const [addTarget, setAddTarget] = useState<{
		rowId: string;
		columnId: string;
	} | null>(null);

	const [blockTemplatePickerOpen, setBlockTemplatePickerOpen] = useState(false);

	const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
	const activeBlockRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		function onMouseDown(ev: MouseEvent) {
			if (!activeBlockId) return;
			if (!activeBlockRef.current) return;
			if (!ev.target) return;
			if (activeBlockRef.current.contains(ev.target as Node)) return;
			setActiveBlockId(null);
		}
		document.addEventListener('mousedown', onMouseDown);
		return () => document.removeEventListener('mousedown', onMouseDown);
	}, [activeBlockId]);

	function setColumns(rowId: string, columns: number) {
		onChange({
			...value,
			rows: value.rows.map((r) => (r.id === rowId ? ensureRowColumns(r, columns) : r)),
		});
	}

	function addRow() {
		const nextRow: PageRow = {
			id: createId('row'),
			settings: { columns: 1 },
			columns: [
				{
					id: createId('col'),
					blocks: [],
				},
			],
		};

		onChange({
			...value,
			rows: [...value.rows, nextRow],
		});
	}

	function addEditorSection() {
		const nextRow: PageRow = {
			id: createId('row'),
			settings: { columns: 1 },
			columns: [
				{
					id: createId('col'),
					blocks: [
						{
							id: createId('blk'),
							type: 'editor',
							data: emptyEditorValue(),
						},
					],
				},
			],
		};

		onChange({
			...value,
			rows: [...value.rows, nextRow],
		});
		setActiveBlockId(nextRow.columns[0]?.blocks[0]?.id ?? null);
	}

	function removeRow(rowId: string) {
		const nextRows = value.rows.filter((r) => r.id !== rowId);
		onChange({
			...value,
			rows:
				nextRows.length > 0
					? nextRows
					: [
							{
								id: createId('row'),
								settings: { columns: 1 },
								columns: [
									{
										id: createId('col'),
										blocks: [],
									},
								],
							},
						],
		});
	}

	function openAddBlock(rowId: string, columnId: string) {
		setAddTarget({ rowId, columnId });
		setBlockPickerOpen(true);
	}

	function addBlock(component: ComponentPickerItem) {
		if (!addTarget) return;

		const nextBlock = createBlockFromComponent(component);
		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== addTarget.rowId) return r;
				return {
					...r,
					columns: r.columns.map((c) =>
						c.id === addTarget.columnId
							? { ...c, blocks: [...c.blocks, nextBlock] }
							: c
					),
				};
			}),
		});

		setBlockPickerOpen(false);
		setAddTarget(null);
		if (nextBlock.type === 'editor') setActiveBlockId(nextBlock.id);
	}

	function insertBlockTemplate(block: BlockTemplate) {
		const parsed = parsePageBuilderState(block.definition);
		const cloned = cloneRowsWithNewIds(parsed.rows);
		if (cloned.length === 0) return;

		onChange({
			...value,
			rows: [...value.rows, ...cloned],
		});

		setBlockTemplatePickerOpen(false);
	}

	function updateBlock(rowId: string, columnId: string, blockId: string, next: PageBlock) {
		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== rowId) return r;
				return {
					...r,
					columns: r.columns.map((c) => {
						if (c.id !== columnId) return c;
						return {
							...c,
							blocks: c.blocks.map((b) => (b.id === blockId ? next : b)),
						};
					}),
				};
			}),
		});
	}

	function removeBlock(rowId: string, columnId: string, blockId: string) {
		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== rowId) return r;
				return {
					...r,
					columns: r.columns.map((c) => {
						if (c.id !== columnId) return c;
						return { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) };
					}),
				};
			}),
		});
		if (activeBlockId === blockId) setActiveBlockId(null);
	}

	function findBlock(state: PageBuilderState, blockId: string): PageBlock | null {
		for (const r of state.rows) {
			for (const c of r.columns) {
				for (const b of c.blocks) {
					if (b.id === blockId) return b;
				}
			}
		}
		return null;
	}

	function onDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const activeData = active.data.current as
			| SortableRowData
			| SortableColumnData
			| SortableBlockData
			| undefined;
		const overData = over.data.current as
			| SortableRowData
			| SortableColumnData
			| SortableBlockData
			| undefined;

		if (!activeData || !overData) return;

		if (activeData.kind === 'row' && overData.kind === 'row') {
			const oldIndex = value.rows.findIndex((r) => r.id === active.id);
			const newIndex = value.rows.findIndex((r) => r.id === over.id);
			if (oldIndex === -1 || newIndex === -1) return;
			onChange({ ...value, rows: arrayMove(value.rows, oldIndex, newIndex) });
			return;
		}

		if (activeData.kind === 'column' && overData.kind === 'column') {
			if (activeData.rowId !== overData.rowId) return;
			const rowIndex = value.rows.findIndex((r) => r.id === activeData.rowId);
			if (rowIndex === -1) return;
			const row = value.rows[rowIndex];
			const oldIndex = row.columns.findIndex((c) => c.id === active.id);
			const newIndex = row.columns.findIndex((c) => c.id === over.id);
			if (oldIndex === -1 || newIndex === -1) return;

			const nextRows = [...value.rows];
			nextRows[rowIndex] = {
				...row,
				columns: arrayMove(row.columns, oldIndex, newIndex),
			};
			onChange({ ...value, rows: nextRows });
			return;
		}

		if (activeData.kind === 'block') {
			const from = { rowId: activeData.rowId, columnId: activeData.columnId, blockId: String(active.id) };

			let to: { rowId: string; columnId: string; index: number } | null = null;

			if (overData.kind === 'block') {
				const toRow = value.rows.find((r) => r.id === overData.rowId);
				const toCol = toRow?.columns.find((c) => c.id === overData.columnId);
				if (!toCol) return;
				const overIndex = toCol.blocks.findIndex((b) => b.id === over.id);
				if (overIndex === -1) return;
				to = { rowId: overData.rowId, columnId: overData.columnId, index: overIndex };
			} else if (overData.kind === 'column') {
				const toRow = value.rows.find((r) => r.id === overData.rowId);
				const toCol = toRow?.columns.find((c) => c.id === overData.columnId);
				if (!toCol) return;
				to = { rowId: overData.rowId, columnId: overData.columnId, index: toCol.blocks.length };
			}

			if (!to) return;

			const moving = findBlock(value, from.blockId);
			if (!moving) return;

			// remove from source
			let next = {
				...value,
				rows: value.rows.map((r) => {
					if (r.id !== from.rowId) return r;
					return {
						...r,
						columns: r.columns.map((c) =>
							c.id === from.columnId
								? { ...c, blocks: c.blocks.filter((b) => b.id !== from.blockId) }
								: c
						),
					};
				}),
			};

			// insert into target
			next = {
				...next,
				rows: next.rows.map((r) => {
					if (r.id !== to.rowId) return r;
					return {
						...r,
						columns: r.columns.map((c) => {
							if (c.id !== to.columnId) return c;
							const blocks = [...c.blocks];
							const safeIndex = Math.max(0, Math.min(to.index, blocks.length));
							blocks.splice(safeIndex, 0, moving);
							return { ...c, blocks };
						}),
					};
				}),
			};

			onChange(next);
		}
	}

	const disabledFlag = !!disabled;

	const rowIds = useMemo(() => value.rows.map((r) => r.id), [value.rows]);

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<p className='text-sm text-muted-foreground'>
					Rows / columns grid. Drag rows, columns, and components to reorder.
				</p>
				<div className='flex items-center gap-2'>
					<Button
						type='button'
						variant='outline'
						size='sm'
						onClick={addRow}
						disabled={disabledFlag}>
						<Plus className='h-4 w-4 mr-2' />
						Row
					</Button>
					<Button
						type='button'
						variant='outline'
						size='sm'
						onClick={addEditorSection}
						disabled={disabledFlag}>
						<Plus className='h-4 w-4 mr-2' />
						Editor section
					</Button>
					<Button
						type='button'
						variant='outline'
						size='sm'
						onClick={() => setBlockTemplatePickerOpen(true)}
						disabled={disabledFlag}>
						<Plus className='h-4 w-4 mr-2' />
						Insert block
					</Button>
				</div>
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={onDragEnd}>
				<SortableContext
					items={rowIds}
					strategy={verticalListSortingStrategy}>
					<div className='space-y-6'>
						{value.rows.map((row) => {
							const columnsCount = clampColumnsCount(
								row.settings?.columns ?? row.columns.length
							);

							const columnIds = row.columns.map((c) => c.id);

							return (
								<SortableRow
									key={row.id}
									row={row}
									disabled={disabledFlag}
									onRemoveRow={removeRow}
									onSetColumns={setColumns}>
									<div
										className={`grid ${responsiveGridColsClass(columnsCount)} gap-4`}>
										<SortableContext
											items={columnIds}
											strategy={rectSortingStrategy}>
											{row.columns.map((col) => (
												<SortableColumn
													key={col.id}
													column={col}
													rowId={row.id}
													disabled={disabledFlag}
													onAddBlock={() => openAddBlock(row.id, col.id)}>
													<SortableContext
														items={col.blocks.map((b) => b.id)}
														strategy={verticalListSortingStrategy}>
														<div className='space-y-3'>
															{col.blocks.map((b) => (
																<SortableBlock
																	key={b.id}
																	block={b}
																	rowId={row.id}
																	columnId={col.id}
																	disabled={disabledFlag}
																	activeBlockId={activeBlockId}
																	setActiveBlockId={setActiveBlockId}
																	activeBlockRef={activeBlockRef}
																	onRemove={() =>
																		removeBlock(
																			row.id,
																			col.id,
																			b.id
																		)
																	}
																	onUpdate={(next) =>
																		updateBlock(
																			row.id,
																			col.id,
																			b.id,
																			next
																		)
																	}
																/>
															))}
														</div>
													</SortableContext>
												</SortableColumn>
											))}
										</SortableContext>
									</div>
								</SortableRow>
							);
						})}
					</div>
				</SortableContext>
			</DndContext>

			<BlockPickerDialog
				open={blockPickerOpen}
				onOpenChange={(open) => {
					setBlockPickerOpen(open);
					if (!open) setAddTarget(null);
				}}
				onPick={addBlock}
			/>

			<BlockTemplatePickerDialog
				open={blockTemplatePickerOpen}
				onOpenChange={setBlockTemplatePickerOpen}
				onPick={insertBlockTemplate}
			/>
		</div>
	);
}

export function PageRenderer({ state }: { state: PageBuilderState }) {
	return (
		<div className='space-y-10'>
			{state.rows.map((row) => {
				const columnsCount = clampColumnsCount(
					row.settings?.columns ?? row.columns.length
				);
				return (
					<section key={row.id}>
						<div
							className={`grid ${responsiveGridColsClass(columnsCount)} gap-6`}>
							{row.columns.map((col) => (
								<div
									key={col.id}
									className='space-y-4'>
									{col.blocks.map((b) => (
										<div key={b.id}>{renderBlockPreview(b)}</div>
									))}
								</div>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}
