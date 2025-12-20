'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
	horizontalListSortingStrategy,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, LayoutTemplate, List, Plus, Sparkles, Trash2, Type } from 'lucide-react';

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
import type { BlockTemplate, ComponentDef } from '@/lib/types';
import { cn } from '@/lib/utils';
import { shadcnDocsUrl } from '@/lib/shadcn-docs';

import { EditorBlock } from '@/components/editor-block';
import { renderBlockPreview } from './page-renderer';
import { BlockPickerDialog, type ComponentPickerItem } from './block-picker-dialog';
import { BlockTemplatePickerDialog } from './block-template-picker-dialog';
import { MediaPickerDialog } from '@/components/media/media-picker-dialog';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';

type SortableRowData = { kind: 'row'; rowId: string };
type SortableColumnData = { kind: 'column'; rowId: string; columnId: string };
type SortableBlockData = {
	kind: 'block';
	rowId: string;
	columnId: string;
};

const MAX_COLUMNS = 12;
const BUILDER_UI_MODE_KEY = 'hooshpro_builder_ui_mode';

type BuilderUiMode = 'clean' | 'detailed';

function parseBuilderUiMode(value: string | null): BuilderUiMode {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'detailed' ? 'detailed' : 'clean';
}

function clampColumnsCount(value: number): number {
	if (!Number.isFinite(value)) return 1;
	return Math.max(1, Math.min(MAX_COLUMNS, Math.round(value)));
}

function defaultColumnSizes(count: number): number[] {
	const safe = clampColumnsCount(count);
	const base = Math.floor((100 / safe) * 100) / 100;
	const sizes = Array.from({ length: safe }).map(() => base);
	const used = base * (safe - 1);
	sizes[safe - 1] = Math.round((100 - used) * 100) / 100;
	return sizes;
}

function normalizeColumnSizes(value: unknown, count: number): number[] | null {
	if (!Array.isArray(value)) return null;
	if (value.length !== count) return null;
	const nums = value.map((v) => (typeof v === 'number' ? v : Number.NaN));
	if (!nums.every((n) => Number.isFinite(n) && n > 0)) return null;
	const sum = nums.reduce((acc, v) => acc + v, 0);
	if (!Number.isFinite(sum) || sum <= 0) return null;
	const scaled = nums.map((v) => Math.round(((v / sum) * 100) * 100) / 100);
	const scaledSum = scaled.reduce((acc, v) => acc + v, 0);
	if (scaled.length > 0) {
		scaled[scaled.length - 1] =
			Math.round((scaled[scaled.length - 1] + (100 - scaledSum)) * 100) / 100;
	}
	return scaled;
}

function sizesAlmostEqual(a: number[], b: number[], epsilon = 0.25): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (Math.abs(a[i] - b[i]) > epsilon) return false;
	}
	return true;
}

function ensureRowColumns(row: PageRow, count: number): PageRow {
	count = clampColumnsCount(count);
	const current = row.columns.length;
	const sizes = defaultColumnSizes(count);
	if (current === count) {
		const existingSizes = normalizeColumnSizes(row.settings?.sizes ?? null, count);
		return {
			...row,
			settings: {
				...(row.settings ?? {}),
				columns: count,
				sizes: existingSizes ?? sizes,
			},
		};
	}

	if (current < count) {
		const extra = Array.from({ length: count - current }).map(() => ({
			id: createId('col'),
			blocks: [],
		}));
		return {
			...row,
			settings: { ...(row.settings ?? {}), columns: count, sizes },
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
		settings: { ...(row.settings ?? {}), columns: count, sizes },
		columns: [{ ...kept[0], blocks: mergedBlocks }, ...kept.slice(1)],
	};
}

function describeBlock(block: PageBlock): string {
	if (block.type === 'unknown') return block.data.originalType;
	if (block.type === 'shadcn') return `shadcn/${block.data.component || 'component'}`;
	return block.type;
}

function SortableRow({
	row,
	disabled,
	compact,
	onRemoveRow,
	onSetColumns,
	children,
}: {
	row: PageRow;
	disabled: boolean;
	compact: boolean;
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
			<div
				className={cn(
					'rounded-md border bg-background',
					compact && 'group/row border-dashed hover:ring-2 hover:ring-ring'
				)}>
				{compact ? (
					<div className='p-4 pt-9 relative'>
						<div className='absolute top-3 left-3 flex items-center gap-2 opacity-0 pointer-events-none transition-opacity group-hover/row:opacity-100 group-hover/row:pointer-events-auto group-focus-within/row:opacity-100 group-focus-within/row:pointer-events-auto'>
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

							<Select
								value={String(columnsCount)}
								onValueChange={(v) => onSetColumns(row.id, clampColumnsCount(Number(v)))}
								disabled={disabled}>
								<SelectTrigger className='w-[110px] h-8'>
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
								size='icon'
								onClick={() => onRemoveRow(row.id)}
								disabled={disabled}>
								<Trash2 className='h-4 w-4' />
								<span className='sr-only'>Remove row</span>
							</Button>
						</div>

						{children}
					</div>
				) : (
					<>
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
									onValueChange={(v) =>
										onSetColumns(row.id, clampColumnsCount(Number(v)))
									}
									disabled={disabled}>
									<SelectTrigger className='w-[110px]'>
										<SelectValue placeholder='Columns' />
									</SelectTrigger>
									<SelectContent>
										{Array.from({ length: MAX_COLUMNS }, (_, i) => i + 1).map(
											(n) => (
												<SelectItem
													key={n}
													value={String(n)}>
													{n} col
												</SelectItem>
											)
										)}
									</SelectContent>
								</Select>

								<Button
									type='button'
									variant='outline'
									size='icon'
									onClick={() => onRemoveRow(row.id)}
									disabled={disabled}>
									<Trash2 className='h-4 w-4' />
									<span className='sr-only'>Remove row</span>
								</Button>
							</div>
						</div>

						<div className='p-4'>{children}</div>
					</>
				)}
			</div>
		</section>
	);
}

function ColumnFrame({
	disabled,
	compact,
	isDragging,
	isOver,
	setActivatorNodeRef,
	listeners,
	attributes,
	onAddBlock,
	children,
}: {
	disabled: boolean;
	compact: boolean;
	isDragging: boolean;
	isOver: boolean;
	setActivatorNodeRef: (node: HTMLElement | null) => void;
	listeners: ReturnType<typeof useSortable>['listeners'];
	attributes: ReturnType<typeof useSortable>['attributes'];
	onAddBlock: () => void;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				'h-full',
				isDragging && 'opacity-70',
				isOver && 'ring-2 ring-ring rounded-md'
			)}>
			<div
				className={cn(
					'rounded-md border min-h-[120px] h-full transition-colors',
					compact
						? 'relative p-3 pt-9 group/col border-dashed bg-muted/5 hover:bg-muted/10 hover:ring-2 hover:ring-ring/20'
						: 'p-3 space-y-3 bg-background'
				)}>
				{compact ? (
					<>
						<div className='absolute top-3 left-3 right-3 flex items-center justify-between gap-2 opacity-0 pointer-events-none transition-opacity group-hover/col:opacity-100 group-hover/col:pointer-events-auto group-focus-within/col:opacity-100 group-focus-within/col:pointer-events-auto'>
							<Button
								type='button'
								variant='ghost'
								size='icon'
								className='cursor-grab active:cursor-grabbing touch-none'
								ref={setActivatorNodeRef}
								disabled={disabled}
											{...attributes}
											{...listeners}>
								<GripVertical className='h-4 w-4' />
								<span className='sr-only'>Drag column</span>
							</Button>

							<Button
								type='button'
								variant='outline'
								size='icon'
								onClick={onAddBlock}
								disabled={disabled}>
								<Plus className='h-4 w-4' />
								<span className='sr-only'>Add component</span>
							</Button>
						</div>

						<div className='space-y-3'>{children}</div>
					</>
				) : (
					<>
						<div className='flex items-center justify-between gap-2'>
							<div className='flex items-center gap-2'>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									className='cursor-grab active:cursor-grabbing touch-none'
									ref={setActivatorNodeRef}
									disabled={disabled}
									{...attributes}
									{...listeners}>
									<GripVertical className='h-4 w-4' />
									<span className='sr-only'>Drag column</span>
								</Button>
								<span className='text-xs text-muted-foreground'>Column</span>
							</div>

							<Button
								type='button'
								variant='outline'
								size='icon'
								onClick={onAddBlock}
								disabled={disabled}>
								<Plus className='h-4 w-4' />
								<span className='sr-only'>Add component</span>
							</Button>
						</div>

						{children}
					</>
				)}
			</div>
		</div>
	);
}

function SortableResizableColumnPanel({
	column,
	rowId,
	disabled,
	compact,
	defaultSize,
	onAddBlock,
	children,
}: {
	column: PageColumn;
	rowId: string;
	disabled: boolean;
	compact: boolean;
	defaultSize: number;
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
		<ResizablePanel
			id={column.id}
			elementRef={setNodeRef}
			style={style}
			defaultSize={defaultSize}
			minSize={5}>
			<ColumnFrame
				disabled={disabled}
				compact={compact}
				isDragging={isDragging}
				isOver={isOver}
				setActivatorNodeRef={setActivatorNodeRef}
				listeners={listeners}
				attributes={attributes}
				onAddBlock={onAddBlock}>
				{children}
			</ColumnFrame>
		</ResizablePanel>
	);
}

function SortableBlock({
	block,
	rowId,
	columnId,
	disabled,
	compact,
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
	compact: boolean;
	activeBlockId: string | null;
	setActiveBlockId: (id: string | null) => void;
	activeBlockRef: React.RefObject<HTMLDivElement | null>;
	onRemove: () => void;
	onUpdate: (next: PageBlock) => void;
}) {
	const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
	const shadcnProps = useMemo(() => {
		if (block.type !== 'shadcn') return {};
		return isRecord(block.data.props) ? block.data.props : {};
	}, [block]);
	const shadcnPropsSerialized = useMemo(
		() => JSON.stringify(shadcnProps, null, 2),
		[shadcnProps]
	);
	const [shadcnPropsJson, setShadcnPropsJson] = useState(shadcnPropsSerialized);
	const [shadcnPropsJsonError, setShadcnPropsJsonError] = useState<string | null>(null);

	useEffect(() => {
		const t = setTimeout(() => {
			setShadcnPropsJson(shadcnPropsSerialized);
			setShadcnPropsJsonError(null);
		}, 0);
		return () => clearTimeout(t);
	}, [shadcnPropsSerialized]);
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
	const label = describeBlock(block);

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={isDragging ? 'opacity-70' : ''}
			{...attributes}>
			<div className={cn('rounded-md border bg-background', compact && 'group/block')}>
				{compact ? (
					<div className='p-3 pt-9 relative'>
						<div className='absolute top-3 left-3 right-3 flex items-center justify-between gap-2 opacity-0 pointer-events-none transition-opacity group-hover/block:opacity-100 group-hover/block:pointer-events-auto group-focus-within/block:opacity-100 group-focus-within/block:pointer-events-auto'>
							<div className='flex items-center gap-2 min-w-0'>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									className='cursor-grab active:cursor-grabbing touch-none shrink-0'
									ref={setActivatorNodeRef}
									disabled={disabled}
									{...listeners}>
									<GripVertical className='h-4 w-4' />
									<span className='sr-only'>Drag component</span>
								</Button>
								<span className='text-xs text-muted-foreground truncate'>{label}</span>
							</div>

							<div className='flex items-center gap-2 shrink-0'>
								{block.type === 'editor' && isActive ? (
									<Button
										type='button'
										variant='outline'
										size='icon'
										onClick={() => setActiveBlockId(null)}
										disabled={disabled}>
										<Check className='h-4 w-4' />
										<span className='sr-only'>Done</span>
									</Button>
								) : null}

								<Button
									type='button'
									variant='outline'
									size='icon'
									onClick={onRemove}
									disabled={disabled}>
									<Trash2 className='h-4 w-4' />
									<span className='sr-only'>Remove component</span>
								</Button>
							</div>
						</div>

						<div ref={isActive ? activeBlockRef : undefined}>
							{renderBlockBody({
								block,
								isActive,
								disabled,
								compact,
								setActiveBlockId,
								setMediaPickerOpen,
								mediaPickerOpen,
								shadcnPropsJson,
								setShadcnPropsJson,
								shadcnPropsJsonError,
								setShadcnPropsJsonError,
								onUpdate,
							})}
						</div>
					</div>
				) : (
					<>
						<div className='flex items-center justify-between gap-2 p-2 border-b'>
							<div className='flex items-center gap-2 min-w-0'>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									className='cursor-grab active:cursor-grabbing touch-none shrink-0'
									ref={setActivatorNodeRef}
									disabled={disabled}
									{...listeners}>
									<GripVertical className='h-4 w-4' />
									<span className='sr-only'>Drag component</span>
								</Button>
								<span className='text-xs text-muted-foreground truncate'>{label}</span>
							</div>

							<div className='flex items-center gap-2 shrink-0'>
								{block.type === 'editor' && isActive ? (
									<Button
										type='button'
										variant='outline'
										size='icon'
										onClick={() => setActiveBlockId(null)}
										disabled={disabled}>
										<Check className='h-4 w-4' />
										<span className='sr-only'>Done</span>
									</Button>
								) : null}

								<Button
									type='button'
									variant='outline'
									size='icon'
									onClick={onRemove}
									disabled={disabled}>
									<Trash2 className='h-4 w-4' />
									<span className='sr-only'>Remove component</span>
								</Button>
							</div>
						</div>

						<div
							ref={isActive ? activeBlockRef : undefined}
							className='p-3'>
							{renderBlockBody({
								block,
								isActive,
								disabled,
								compact,
								setActiveBlockId,
								setMediaPickerOpen,
								mediaPickerOpen,
								shadcnPropsJson,
								setShadcnPropsJson,
								shadcnPropsJsonError,
								setShadcnPropsJsonError,
								onUpdate,
							})}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function renderBlockBody({
	block,
	isActive,
	disabled,
	compact,
	setActiveBlockId,
	mediaPickerOpen,
	setMediaPickerOpen,
	shadcnPropsJson,
	setShadcnPropsJson,
	shadcnPropsJsonError,
	setShadcnPropsJsonError,
	onUpdate,
}: {
	block: PageBlock;
	isActive: boolean;
	disabled: boolean;
	compact: boolean;
	setActiveBlockId: (id: string | null) => void;
	mediaPickerOpen: boolean;
	setMediaPickerOpen: (open: boolean) => void;
	shadcnPropsJson?: string;
	setShadcnPropsJson?: (next: string) => void;
	shadcnPropsJsonError?: string | null;
	setShadcnPropsJsonError?: (next: string | null) => void;
	onUpdate: (next: PageBlock) => void;
}) {
	return (
		<>
			{block.type === 'editor' ? (
				isActive ? (
					<EditorBlock
						value={block.data}
						onChange={(next: EditorValue) => onUpdate({ ...block, data: next })}
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
					<details
						open={!compact ? true : undefined}
						className={cn(
							'rounded-lg border bg-muted/10 p-3',
							compact &&
								'opacity-0 pointer-events-none transition-opacity [&[open]]:opacity-100 [&[open]]:pointer-events-auto group-hover/block:opacity-100 group-hover/block:pointer-events-auto group-focus-within/block:opacity-100 group-focus-within/block:pointer-events-auto'
						)}>
						<summary className='text-sm font-medium cursor-pointer select-none'>
							Settings
						</summary>
						<div className='mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3'>
							<div className='space-y-1'>
								<Label className='text-xs'>Label</Label>
								<Input
									value={block.data.label}
									onChange={(e) =>
										onUpdate({
											...block,
											data: { ...block.data, label: e.target.value },
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
											data: { ...block.data, href: e.target.value },
										})
									}
									disabled={disabled}
								/>
							</div>
							<div className='space-y-1'>
								<Label className='text-xs'>Variant</Label>
								<Select
									value={
										block.data.variant &&
										[
											'default',
											'secondary',
											'outline',
											'destructive',
											'ghost',
											'link',
										].includes(block.data.variant)
											? block.data.variant
											: 'default'
									}
									onValueChange={(v) =>
										onUpdate({
											...block,
											data: {
												...block.data,
												variant: v as
													| 'default'
													| 'secondary'
													| 'outline'
													| 'destructive'
													| 'ghost'
													| 'link',
											},
										})
									}
									disabled={disabled}>
									<SelectTrigger className='h-8'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{[
											'default',
											'secondary',
											'outline',
											'destructive',
											'ghost',
											'link',
										].map((variant) => (
											<SelectItem
												key={variant}
												value={variant}>
												{variant}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</details>
				</div>
			) : null}

			{block.type === 'card' ? (
				<div className='space-y-3'>
					{renderBlockPreview(block)}
					<details
						open={!compact ? true : undefined}
						className={cn(
							'rounded-lg border bg-muted/10 p-3',
							compact &&
								'opacity-0 pointer-events-none transition-opacity [&[open]]:opacity-100 [&[open]]:pointer-events-auto group-hover/block:opacity-100 group-hover/block:pointer-events-auto group-focus-within/block:opacity-100 group-focus-within/block:pointer-events-auto'
						)}>
						<summary className='text-sm font-medium cursor-pointer select-none'>
							Settings
						</summary>
						<div className='mt-3 space-y-2'>
							<div className='space-y-1'>
								<Label className='text-xs'>Title</Label>
								<Input
									value={block.data.title ?? ''}
									onChange={(e) =>
										onUpdate({
											...block,
											data: { ...block.data, title: e.target.value },
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
											data: { ...block.data, body: e.target.value },
										})
									}
									disabled={disabled}
								/>
							</div>
						</div>
					</details>
				</div>
			) : null}

			{block.type === 'separator' ? renderBlockPreview(block) : null}

			{block.type === 'image' ? (
				<div className='space-y-3'>
					{renderBlockPreview(block)}
					<details
						open={!compact ? true : undefined}
						className={cn(
							'rounded-lg border bg-muted/10 p-3',
							compact &&
								'opacity-0 pointer-events-none transition-opacity [&[open]]:opacity-100 [&[open]]:pointer-events-auto group-hover/block:opacity-100 group-hover/block:pointer-events-auto group-focus-within/block:opacity-100 group-focus-within/block:pointer-events-auto'
						)}>
						<summary className='text-sm font-medium cursor-pointer select-none'>
							Settings
						</summary>
						<div className='mt-3 space-y-3'>
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
											data: { ...block.data, alt: e.target.value },
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
					</details>
				</div>
			) : null}

			{block.type === 'shadcn' ? (
				(() => {
					const shadcnBlock = block as Extract<PageBlock, { type: 'shadcn' }>;
					const componentId = (shadcnBlock.data.component || '').trim().toLowerCase();
					const props = isRecord(shadcnBlock.data.props) ? shadcnBlock.data.props : {};
					const docsUrl = componentId ? shadcnDocsUrl(componentId) : null;

					function updateProps(nextPartial: Record<string, unknown>) {
						onUpdate({
							...shadcnBlock,
							data: {
								...shadcnBlock.data,
								props: {
									...props,
									...nextPartial,
								},
							},
						});
					}

					return (
						<div className='space-y-3'>
							{renderBlockPreview(block)}
							<details
								open={!compact ? true : undefined}
								className={cn(
									'rounded-lg border bg-muted/10 p-3',
									compact &&
										'opacity-0 pointer-events-none transition-opacity [&[open]]:opacity-100 [&[open]]:pointer-events-auto group-hover/block:opacity-100 group-hover/block:pointer-events-auto group-focus-within/block:opacity-100 group-focus-within/block:pointer-events-auto'
								)}>
								<summary className='text-sm font-medium cursor-pointer select-none'>
									Settings
								</summary>
								<div className='mt-3 space-y-4'>
									{docsUrl ? (
										<p className='text-xs text-muted-foreground'>
											Docs:{' '}
											<a
												href={docsUrl}
												target='_blank'
												rel='noreferrer'
												className='underline underline-offset-4'>
												{docsUrl}
											</a>
										</p>
									) : null}

									{componentId === 'alert' ? (
										<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
											<div className='space-y-1'>
												<Label className='text-xs'>Variant</Label>
												<Select
													value={
														typeof props['variant'] === 'string' &&
														['default', 'destructive'].includes(
															props['variant']
														)
															? (props['variant'] as string)
															: 'default'
													}
													onValueChange={(v) => updateProps({ variant: v })}
													disabled={disabled}>
													<SelectTrigger className='h-8'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='default'>default</SelectItem>
														<SelectItem value='destructive'>destructive</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className='space-y-1 sm:col-span-2'>
												<Label className='text-xs'>Title</Label>
												<Input
													value={
														typeof props['title'] === 'string'
															? props['title']
															: ''
													}
													onChange={(e) =>
														updateProps({ title: e.target.value })
													}
													disabled={disabled}
												/>
											</div>
											<div className='space-y-1 sm:col-span-2'>
												<Label className='text-xs'>Description</Label>
												<Input
													value={
														typeof props['description'] === 'string'
															? props['description']
															: ''
													}
													onChange={(e) =>
														updateProps({ description: e.target.value })
													}
													disabled={disabled}
												/>
											</div>
										</div>
									) : null}

									{componentId === 'typography' ? (
										(() => {
											const variant =
												typeof props['variant'] === 'string' &&
												[
													'h1',
													'h2',
													'h3',
													'h4',
													'p',
													'blockquote',
													'table',
													'list',
													'code',
													'lead',
													'large',
													'small',
													'muted',
												].includes(props['variant'])
													? (props['variant'] as string)
													: 'p';

											const items =
												Array.isArray(props['items']) &&
												props['items'].every((x) => typeof x === 'string')
													? (props['items'] as string[])
													: [];

											return (
												<div className='space-y-3'>
													<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
														<div className='space-y-1'>
															<Label className='text-xs'>Variant</Label>
															<Select
																value={variant}
																onValueChange={(v) =>
																	updateProps({ variant: v })
																}
																disabled={disabled}>
																<SelectTrigger className='h-8'>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	{[
																		'h1',
																		'h2',
																		'h3',
																		'h4',
																		'p',
																		'lead',
																		'large',
																		'small',
																		'muted',
																		'blockquote',
																		'code',
																		'list',
																		'table',
																	].map((v) => (
																		<SelectItem
																			key={v}
																			value={v}>
																			{v}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
														</div>
														<div className='space-y-1 sm:col-span-2'>
															<Label className='text-xs'>Text</Label>
															<Textarea
																value={
																	typeof props['text'] === 'string'
																		? props['text']
																		: ''
																}
																onChange={(e) =>
																	updateProps({ text: e.target.value })
																}
																className='min-h-[84px]'
																disabled={disabled}
															/>
														</div>
													</div>

													{variant === 'list' ? (
														<div className='space-y-1'>
															<Label className='text-xs'>List items (one per line)</Label>
															<Textarea
																value={items.join('\n')}
																onChange={(e) =>
																	updateProps({
																		items: e.target.value
																			.split('\n')
																			.map((x) => x.trim())
																			.filter(Boolean),
																	})
																}
																className='min-h-[84px] font-mono text-xs'
																disabled={disabled}
															/>
														</div>
													) : null}
												</div>
											);
										})()
									) : null}

									{componentId === 'button' ? (
										<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
											<div className='space-y-1 sm:col-span-2'>
												<Label className='text-xs'>Label</Label>
												<Input
													value={
														typeof props['label'] === 'string'
															? props['label']
															: ''
													}
													onChange={(e) =>
														updateProps({ label: e.target.value })
													}
													disabled={disabled}
												/>
											</div>
											<div className='space-y-1 sm:col-span-2'>
												<Label className='text-xs'>Href</Label>
												<Input
													value={
														typeof props['href'] === 'string'
															? props['href']
															: ''
													}
													onChange={(e) =>
														updateProps({ href: e.target.value })
													}
													disabled={disabled}
												/>
											</div>
											<div className='space-y-1'>
												<Label className='text-xs'>Variant</Label>
												<Select
													value={
														typeof props['variant'] === 'string' &&
														[
															'default',
															'secondary',
															'outline',
															'destructive',
															'ghost',
															'link',
														].includes(props['variant'])
															? (props['variant'] as string)
															: 'default'
													}
													onValueChange={(v) => updateProps({ variant: v })}
													disabled={disabled}>
													<SelectTrigger className='h-8'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{[
															'default',
															'secondary',
															'outline',
															'destructive',
															'ghost',
															'link',
														].map((v) => (
															<SelectItem
																key={v}
																value={v}>
																{v}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className='space-y-1'>
												<Label className='text-xs'>Size</Label>
												<Select
													value={
														typeof props['size'] === 'string' &&
														[
															'default',
															'sm',
															'lg',
															'icon',
															'icon-sm',
															'icon-lg',
														].includes(props['size'])
															? (props['size'] as string)
															: 'default'
													}
													onValueChange={(v) => updateProps({ size: v })}
													disabled={disabled}>
													<SelectTrigger className='h-8'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{[
															'default',
															'sm',
															'lg',
															'icon',
															'icon-sm',
															'icon-lg',
														].map((v) => (
															<SelectItem
																key={v}
																value={v}>
																{v}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										</div>
									) : null}

									{componentId === 'badge' ? (
										<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
											<div className='space-y-1 sm:col-span-2'>
												<Label className='text-xs'>Text</Label>
												<Input
													value={
														typeof props['text'] === 'string'
															? props['text']
															: ''
													}
													onChange={(e) =>
														updateProps({ text: e.target.value })
													}
													disabled={disabled}
												/>
											</div>
											<div className='space-y-1'>
												<Label className='text-xs'>Variant</Label>
												<Select
													value={
														typeof props['variant'] === 'string' &&
														[
															'default',
															'secondary',
															'outline',
															'destructive',
														].includes(props['variant'])
															? (props['variant'] as string)
															: 'default'
													}
													onValueChange={(v) => updateProps({ variant: v })}
													disabled={disabled}>
													<SelectTrigger className='h-8'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{['default', 'secondary', 'outline', 'destructive'].map((v) => (
															<SelectItem
																key={v}
																value={v}>
																{v}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										</div>
									) : null}

									{componentId !== 'alert' &&
									componentId !== 'typography' &&
									componentId !== 'button' &&
									componentId !== 'badge' ? (
										<div className='space-y-2'>
											<p className='text-xs text-muted-foreground'>
												No settings UI yet for <code>shadcn/{componentId || 'component'}</code>. You can still edit raw props below.
											</p>
										</div>
									) : null}

									<div className='space-y-1'>
										<Label className='text-xs'>Props (JSON)</Label>
										<Textarea
											value={shadcnPropsJson ?? JSON.stringify(props, null, 2)}
											onChange={(e) => {
												setShadcnPropsJson?.(e.target.value);
												setShadcnPropsJsonError?.(null);
											}}
											onBlur={() => {
												try {
													const raw = (shadcnPropsJson ?? '').trim();
													const parsed = raw ? JSON.parse(raw) : {};
													if (!isRecord(parsed)) {
														setShadcnPropsJsonError?.('Props JSON must be an object.');
														return;
													}
													setShadcnPropsJsonError?.(null);
													onUpdate({
														...shadcnBlock,
														data: {
															...shadcnBlock.data,
															props: parsed,
														},
													});
												} catch (e) {
													setShadcnPropsJsonError?.(
														e instanceof Error ? e.message : String(e)
													);
												}
											}}
											className='min-h-[120px] font-mono text-xs'
											disabled={disabled}
										/>
										{shadcnPropsJsonError ? (
											<p className='text-xs text-red-600'>{shadcnPropsJsonError}</p>
										) : null}
										<p className='text-xs text-muted-foreground'>
											Stored as <code>data.props</code> for this component instance.
										</p>
									</div>
								</div>
							</details>
						</div>
					);
				})()
			) : null}

			{block.type !== 'editor' &&
			block.type !== 'button' &&
			block.type !== 'card' &&
			block.type !== 'separator' &&
			block.type !== 'image' &&
			block.type !== 'shadcn'
				? renderBlockPreview(block)
				: null}
		</>
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
			rawVariant &&
			['default', 'secondary', 'outline', 'destructive', 'ghost', 'link'].includes(rawVariant)
				? (rawVariant as 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link')
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
		let props: Record<string, unknown> | undefined;
		if (isRecord(d['props'])) {
			props = d['props'] as Record<string, unknown>;
		} else {
			const rest: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(d)) {
				if (k === 'component') continue;
				rest[k] = v;
			}
			if (Object.keys(rest).length > 0) props = rest;
		}
		return {
			id: createId('blk'),
			type: 'shadcn',
			data: props ? { component: componentId, props } : { component: componentId },
		};
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
	const [mounted, setMounted] = useState(false);
	const [uiMode, setUiMode] = useState<BuilderUiMode>(() => {
		if (typeof window === 'undefined') return 'clean';
		try {
			return parseBuilderUiMode(localStorage.getItem(BUILDER_UI_MODE_KEY));
		} catch {
			return 'clean';
		}
	});

	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setMounted(true));
		return () => window.cancelAnimationFrame(frame);
	}, []);

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

	function setRowSizes(rowId: string, sizes: number[]) {
		if (disabledFlag) return;
		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== rowId) return r;
				const columnsCount = clampColumnsCount(r.settings?.columns ?? r.columns.length);
				const normalized = normalizeColumnSizes(sizes, columnsCount);
				if (!normalized) return r;

				const existing = normalizeColumnSizes(r.settings?.sizes ?? null, columnsCount);
				if (existing && sizesAlmostEqual(existing, normalized)) return r;

				if (!existing) {
					const defaults = defaultColumnSizes(columnsCount);
					if (sizesAlmostEqual(defaults, normalized)) return r;
				}

				return {
					...r,
					settings: {
						...(r.settings ?? {}),
						columns: columnsCount,
						sizes: normalized,
					},
				};
			}),
		});
	}

	function addRow() {
		const nextRow: PageRow = {
			id: createId('row'),
			settings: { columns: 1, sizes: defaultColumnSizes(1) },
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
				settings: { columns: 1, sizes: defaultColumnSizes(1) },
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
								settings: { columns: 1, sizes: defaultColumnSizes(1) },
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

			const nextSizes =
				row.settings?.sizes && row.settings.sizes.length === row.columns.length
					? arrayMove(row.settings.sizes, oldIndex, newIndex)
					: row.settings?.sizes;

			const nextRows = [...value.rows];
			nextRows[rowIndex] = {
				...row,
				columns: arrayMove(row.columns, oldIndex, newIndex),
				settings: row.settings
					? { ...row.settings, sizes: nextSizes }
					: nextSizes
						? { columns: row.columns.length, sizes: nextSizes }
						: undefined,
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
	const compact = uiMode === 'clean';

	function updateUiMode(next: BuilderUiMode) {
		setUiMode(next);
		try {
			localStorage.setItem(BUILDER_UI_MODE_KEY, next);
		} catch {
			// ignore
		}
	}

	if (!mounted) {
		return (
			<div className='rounded-md border bg-muted/10 p-6 text-sm text-muted-foreground'>
				Loading editor…
			</div>
		);
	}

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<p className='text-sm text-muted-foreground'>
					Rows / columns grid. Drag rows, columns, and components to reorder.
				</p>
				<div className='flex items-center gap-2'>
					<Button
						type='button'
						variant={uiMode === 'clean' ? 'secondary' : 'outline'}
						size='icon'
						onClick={() => updateUiMode('clean')}
						disabled={disabledFlag}
						title='Clean UI'>
						<Sparkles className='h-4 w-4' />
						<span className='sr-only'>Clean UI</span>
					</Button>
					<Button
						type='button'
						variant={uiMode === 'detailed' ? 'secondary' : 'outline'}
						size='icon'
						onClick={() => updateUiMode('detailed')}
						disabled={disabledFlag}
						title='Detailed UI'>
						<List className='h-4 w-4' />
						<span className='sr-only'>Detailed UI</span>
					</Button>
					<Separator
						orientation='vertical'
						className='h-8'
					/>
					<Button
						type='button'
						variant='outline'
						size='icon'
						onClick={addRow}
						disabled={disabledFlag}
						title='Add row'>
						<Plus className='h-4 w-4' />
						<span className='sr-only'>Add row</span>
					</Button>
					<Button
						type='button'
						variant='outline'
						size='icon'
						onClick={addEditorSection}
						disabled={disabledFlag}
						title='Add editor section'>
						<Type className='h-4 w-4' />
						<span className='sr-only'>Add editor section</span>
					</Button>
					<Button
						type='button'
						variant='outline'
						size='icon'
						onClick={() => setBlockTemplatePickerOpen(true)}
						disabled={disabledFlag}
						title='Insert block template'>
						<LayoutTemplate className='h-4 w-4' />
						<span className='sr-only'>Insert block template</span>
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
							const sizes =
								normalizeColumnSizes(row.settings?.sizes ?? null, columnsCount) ??
								defaultColumnSizes(columnsCount);

							return (
								<SortableRow
									key={row.id}
									row={row}
									disabled={disabledFlag}
									compact={compact}
									onRemoveRow={removeRow}
									onSetColumns={setColumns}>
									<SortableContext
										items={columnIds}
										strategy={horizontalListSortingStrategy}>
										<ResizablePanelGroup
											direction='horizontal'
											className='w-full'
											onLayoutChange={(layout) => {
												const ordered = row.columns.map((c) => layout[c.id]);
												if (!ordered.every((n) => typeof n === 'number')) return;
												setRowSizes(row.id, ordered as number[]);
											}}>
											{row.columns.map((col, idx) => (
												<Fragment key={col.id}>
													<SortableResizableColumnPanel
														column={col}
														rowId={row.id}
														disabled={disabledFlag}
														compact={compact}
														defaultSize={sizes[idx] ?? 100}
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
																		compact={compact}
																		activeBlockId={activeBlockId}
																		setActiveBlockId={setActiveBlockId}
																		activeBlockRef={activeBlockRef}
																		onRemove={() =>
																			removeBlock(row.id, col.id, b.id)
																		}
																		onUpdate={(next) =>
																			updateBlock(row.id, col.id, b.id, next)
																		}
																	/>
																))}
															</div>
														</SortableContext>
													</SortableResizableColumnPanel>
													{idx < row.columns.length - 1 ? (
														<ResizableHandle
															withHandle
															className={cn(
																'[&>div]:transition-opacity hover:bg-muted/20',
																compact &&
																	'[&>div]:opacity-0 group-hover/row:[&>div]:opacity-100 group-focus-within/row:[&>div]:opacity-100',
																disabledFlag && 'pointer-events-none opacity-60'
															)}
														/>
													) : null}
												</Fragment>
											))}
										</ResizablePanelGroup>
									</SortableContext>
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

export { PageRenderer } from './page-renderer';
