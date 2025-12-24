'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	type DragEndEvent,
	useDroppable,
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
import {
	ArrowDown,
	ArrowUp,
	Check,
	GripVertical,
	LayoutTemplate,
	List,
	Plus,
	Sparkles,
	Trash2,
	Type,
} from 'lucide-react';

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
import { shadcnComponentMeta } from '@/lib/shadcn-meta';
import { useShadcnVariants } from '@/hooks/use-shadcn-variants';

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
	/** Path of container block ids; empty = column root. */
	containerPath: string[];
};
type SortableContainerDropData = {
	kind: 'container-drop';
	rowId: string;
	columnId: string;
	/** Path to the container's children list (includes the container block id). */
	containerPath: string[];
};

const MAX_COLUMNS = 12;
const BUILDER_UI_MODE_KEY = 'hooshpro_builder_ui_mode';
const MIN_ROW_HEIGHT_PX = 120;
const MAX_ROW_HEIGHT_PX = 8000;
const MIN_COLUMN_HEIGHT_PX = 120;
const MAX_COLUMN_HEIGHT_PX = 8000;
const MIN_ROW_WIDTH_PCT = 10;

type BuilderUiMode = 'clean' | 'detailed';
type ShadcnVariantsState = ReturnType<typeof useShadcnVariants>;

function parseBuilderUiMode(value: string | null): BuilderUiMode {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'detailed' ? 'detailed' : 'clean';
}

function formatSizePercent(value: number): string {
	if (!Number.isFinite(value)) return '0%';
	const clamped = Math.max(0, Math.min(100, value));
	const rounded = Math.round(clamped * 10) / 10;
	if (Math.abs(rounded - Math.round(rounded)) < 0.05) return `${Math.round(rounded)}%`;
	return `${rounded}%`;
}

function formatPx(value: number | null | undefined): string {
	if (typeof value !== 'number' || !Number.isFinite(value)) return 'auto';
	return `${Math.max(0, Math.round(value))}px`;
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
	onSetWrapper,
	onSetMinHeightPx,
	onSetMaxWidthPct,
	children,
}: {
	row: PageRow;
	disabled: boolean;
	compact: boolean;
	onRemoveRow: (rowId: string) => void;
	onSetColumns: (rowId: string, columns: number) => void;
	onSetWrapper: (rowId: string, wrapper: 'none' | 'card') => void;
	onSetMinHeightPx: (rowId: string, minHeightPx: number | null) => void;
	onSetMaxWidthPct: (rowId: string, maxWidthPct: number | null) => void;
	children: React.ReactNode;
}) {
	const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } =
		useSortable({
			id: row.id,
			data: { kind: 'row', rowId: row.id } satisfies SortableRowData,
			disabled,
		});

	const rowRef = useRef<HTMLElement | null>(null);
	const setRowRef = (node: HTMLElement | null) => {
		rowRef.current = node;
		setNodeRef(node);
	};

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const columnsCount = clampColumnsCount(row.settings?.columns ?? row.columns.length);
	const wrapper = row.settings?.wrapper === 'card' ? 'card' : 'none';
	const rowMinHeightPx =
		typeof row.settings?.minHeightPx === 'number' && Number.isFinite(row.settings.minHeightPx)
			? row.settings.minHeightPx
			: null;
	const rowMaxWidthPct =
		typeof row.settings?.maxWidthPct === 'number' && Number.isFinite(row.settings.maxWidthPct)
			? row.settings.maxWidthPct
			: null;

	const sectionStyle: CSSProperties = { ...style };
	if (rowMaxWidthPct && rowMaxWidthPct > 0 && rowMaxWidthPct < 100) {
		sectionStyle.maxWidth = `${Math.round(rowMaxWidthPct * 100) / 100}%`;
		sectionStyle.marginLeft = 'auto';
		sectionStyle.marginRight = 'auto';
	}

	const inner =
		wrapper === 'card' ? <div className='rounded-xl border bg-card p-4'>{children}</div> : children;

	const resizeRef = useRef<{
		startX: number;
		startY: number;
		containerWidthPx: number;
		startWidthPx: number;
		startHeightPx: number;
	} | null>(null);
	const [isResizing, setIsResizing] = useState(false);

	function stopResizing() {
		resizeRef.current = null;
		setIsResizing(false);
	}

	function onResizeStart(e: React.PointerEvent<HTMLButtonElement>) {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();

		const el = rowRef.current;
		const container = el?.parentElement;
		const rect = el?.getBoundingClientRect();
		const containerRect = container?.getBoundingClientRect();
		if (!rect || !containerRect) return;

		resizeRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			containerWidthPx: containerRect.width || rect.width,
			startWidthPx: rect.width,
			startHeightPx: rowMinHeightPx ?? rect.height,
		};
		setIsResizing(true);
		e.currentTarget.setPointerCapture(e.pointerId);
	}

	function onResizeMove(e: React.PointerEvent<HTMLButtonElement>) {
		if (!resizeRef.current || disabled) return;
		e.preventDefault();
		e.stopPropagation();

		const deltaX = e.clientX - resizeRef.current.startX;
		const deltaY = e.clientY - resizeRef.current.startY;

		const nextWidthPx = Math.max(0, resizeRef.current.startWidthPx + deltaX);
		const pctRaw = (nextWidthPx / resizeRef.current.containerWidthPx) * 100;
		const pct = Math.max(MIN_ROW_WIDTH_PCT, Math.min(100, pctRaw));
		onSetMaxWidthPct(row.id, Math.round(pct * 100) / 100);

		const nextHeight = Math.max(
			MIN_ROW_HEIGHT_PX,
			Math.min(MAX_ROW_HEIGHT_PX, resizeRef.current.startHeightPx + deltaY)
		);
		onSetMinHeightPx(row.id, Math.round(nextHeight));
	}

	function onResizeEnd(e: React.PointerEvent<HTMLButtonElement>) {
		if (!isResizing) return;
		e.preventDefault();
		e.stopPropagation();
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		stopResizing();
	}

	return (
		<section
			ref={setRowRef}
			style={sectionStyle}
			className={isDragging ? 'opacity-70' : ''}
			{...attributes}>
			<div
				className={cn(
					'rounded-md border bg-background relative',
					compact && 'group/row border-dashed hover:ring-2 hover:ring-ring'
				)}
				style={{
					minHeight: rowMinHeightPx ? Math.max(MIN_ROW_HEIGHT_PX, rowMinHeightPx) : undefined,
				}}>
				{compact ? (
					<div className='p-4 pt-9 relative'>
						<div
							className={cn(
								'absolute bottom-3 right-10 pointer-events-none select-none rounded-md border bg-background/85 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition-opacity',
								isResizing ? 'opacity-100' : 'opacity-0'
							)}>
							{formatSizePercent(rowMaxWidthPct ?? 100)} · {formatPx(rowMinHeightPx)}
						</div>

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

							<Select
								value={wrapper}
								onValueChange={(v) => onSetWrapper(row.id, v === 'card' ? 'card' : 'none')}
								disabled={disabled}>
								<SelectTrigger className='w-[110px] h-8'>
									<SelectValue placeholder='Wrapper' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>no wrapper</SelectItem>
									<SelectItem value='card'>card</SelectItem>
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

						{inner}

						<button
							type='button'
							aria-label='Resize row'
							title='Resize row (width + height)'
							className='absolute bottom-2 right-2 h-4 w-4 rounded-sm border bg-background/80 backdrop-blur cursor-nwse-resize touch-none opacity-0 pointer-events-none transition-opacity group-hover/row:opacity-100 group-hover/row:pointer-events-auto group-focus-within/row:opacity-100 group-focus-within/row:pointer-events-auto'
							disabled={disabled}
							onPointerDown={onResizeStart}
							onPointerMove={onResizeMove}
							onPointerUp={onResizeEnd}
							onPointerCancel={onResizeEnd}
						/>
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
								<span className='text-xs text-muted-foreground'>
									Row · {formatSizePercent(rowMaxWidthPct ?? 100)} · {formatPx(rowMinHeightPx)}
								</span>
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

								<Select
									value={wrapper}
									onValueChange={(v) =>
										onSetWrapper(row.id, v === 'card' ? 'card' : 'none')
									}
									disabled={disabled}>
									<SelectTrigger className='w-[130px]'>
										<SelectValue placeholder='Wrapper' />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>no wrapper</SelectItem>
										<SelectItem value='card'>card</SelectItem>
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

						<div className='p-4'>{inner}</div>

						<button
							type='button'
							aria-label='Resize row'
							title='Resize row (width + height)'
							className='absolute bottom-3 right-3 h-5 w-5 rounded-md border bg-background cursor-nwse-resize touch-none'
							disabled={disabled}
							onPointerDown={onResizeStart}
							onPointerMove={onResizeMove}
							onPointerUp={onResizeEnd}
							onPointerCancel={onResizeEnd}
						/>
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
	sizePercent,
	showSizePercent,
	minHeightPx,
	wrapper,
	setActivatorNodeRef,
	listeners,
	attributes,
	onAddBlock,
	onSetWrapper,
	onSetMinHeightPx,
	children,
}: {
	disabled: boolean;
	compact: boolean;
	isDragging: boolean;
	isOver: boolean;
	sizePercent: number;
	showSizePercent: boolean;
	minHeightPx: number | null;
	wrapper: 'none' | 'card';
	setActivatorNodeRef: (node: HTMLElement | null) => void;
	listeners: ReturnType<typeof useSortable>['listeners'];
	attributes: ReturnType<typeof useSortable>['attributes'];
	onAddBlock: () => void;
	onSetWrapper: (wrapper: 'none' | 'card') => void;
	onSetMinHeightPx: (minHeightPx: number | null) => void;
	children: React.ReactNode;
}) {
	const content =
		wrapper === 'card' ? <div className='rounded-xl border bg-card p-4'>{children}</div> : children;
	const effectiveMinHeightPx = Math.max(MIN_COLUMN_HEIGHT_PX, minHeightPx ?? 0);

	const frameRef = useRef<HTMLDivElement | null>(null);
	const resizeRef = useRef<{ startY: number; startHeightPx: number } | null>(null);
	const [isResizingHeight, setIsResizingHeight] = useState(false);

	function stopResizingHeight() {
		resizeRef.current = null;
		setIsResizingHeight(false);
	}

	function onHeightResizeStart(e: React.PointerEvent<HTMLButtonElement>) {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();

		const rect = frameRef.current?.getBoundingClientRect();
		const startHeightPx =
			typeof minHeightPx === 'number' && Number.isFinite(minHeightPx)
				? minHeightPx
				: rect?.height ?? effectiveMinHeightPx;

		resizeRef.current = { startY: e.clientY, startHeightPx };
		setIsResizingHeight(true);
		e.currentTarget.setPointerCapture(e.pointerId);
	}

	function onHeightResizeMove(e: React.PointerEvent<HTMLButtonElement>) {
		if (!resizeRef.current || disabled) return;
		e.preventDefault();
		e.stopPropagation();

		const deltaY = e.clientY - resizeRef.current.startY;
		const next = Math.max(
			MIN_COLUMN_HEIGHT_PX,
			Math.min(MAX_COLUMN_HEIGHT_PX, resizeRef.current.startHeightPx + deltaY)
		);
		onSetMinHeightPx(Math.round(next));
	}

	function onHeightResizeEnd(e: React.PointerEvent<HTMLButtonElement>) {
		if (!isResizingHeight) return;
		e.preventDefault();
		e.stopPropagation();
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		stopResizingHeight();
	}

	return (
		<div
			className={cn(
				'h-full',
				isDragging && 'opacity-70',
				isOver && 'ring-2 ring-ring rounded-md'
			)}>
			<div
				ref={frameRef}
				className={cn(
					'rounded-md border h-full transition-colors relative',
					compact
						? 'p-3 pt-9 group/col border-dashed bg-muted/5 hover:bg-muted/10 hover:ring-2 hover:ring-ring/20'
						: 'p-3 space-y-3 bg-background'
				)}
				style={{ minHeight: effectiveMinHeightPx }}>
				{compact ? (
					<>
						<div
							className={cn(
								'absolute top-3 right-3 pointer-events-none select-none rounded-md border bg-background/85 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition-opacity',
								showSizePercent ? 'opacity-100' : 'opacity-0',
								'group-hover/col:opacity-0 group-focus-within/col:opacity-0'
							)}>
							{formatSizePercent(sizePercent)}
						</div>

						<div
							className={cn(
								'absolute bottom-3 right-3 pointer-events-none select-none rounded-md border bg-background/85 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition-opacity',
								isResizingHeight ? 'opacity-100' : 'opacity-0'
							)}>
							{formatPx(minHeightPx ?? effectiveMinHeightPx)}
						</div>

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

							<Select
								value={wrapper}
								onValueChange={(v) => onSetWrapper(v === 'card' ? 'card' : 'none')}
								disabled={disabled}>
								<SelectTrigger className='w-[110px] h-8'>
									<SelectValue placeholder='Wrapper' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>no wrapper</SelectItem>
									<SelectItem value='card'>card</SelectItem>
								</SelectContent>
							</Select>

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

						<div className='space-y-3'>{content}</div>
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
								<span className='text-xs text-muted-foreground'>
									Column · {formatSizePercent(sizePercent)} · {formatPx(minHeightPx ?? effectiveMinHeightPx)}
								</span>
							</div>

							<div className='flex items-center gap-2'>
								<Select
									value={wrapper}
									onValueChange={(v) => onSetWrapper(v === 'card' ? 'card' : 'none')}
									disabled={disabled}>
									<SelectTrigger className='w-[130px] h-8'>
										<SelectValue placeholder='Wrapper' />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>no wrapper</SelectItem>
										<SelectItem value='card'>card</SelectItem>
									</SelectContent>
								</Select>

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
						</div>

						{content}
					</>
				)}

				<button
					type='button'
					aria-label='Resize column height'
					title='Resize column height'
					className={cn(
						'absolute bottom-2 right-2 h-4 w-4 rounded-sm border bg-background/80 backdrop-blur cursor-ns-resize touch-none',
						compact
							? 'opacity-0 pointer-events-none transition-opacity group-hover/col:opacity-100 group-hover/col:pointer-events-auto group-focus-within/col:opacity-100 group-focus-within/col:pointer-events-auto'
							: 'opacity-100'
					)}
					disabled={disabled}
					onPointerDown={onHeightResizeStart}
					onPointerMove={onHeightResizeMove}
					onPointerUp={onHeightResizeEnd}
					onPointerCancel={onHeightResizeEnd}
				/>
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
	sizePercent,
	showSizePercent,
	minHeightPx,
	onAddBlock,
	onSetWrapper,
	onSetMinHeightPx,
	children,
}: {
	column: PageColumn;
	rowId: string;
	disabled: boolean;
	compact: boolean;
	defaultSize: number;
	sizePercent: number;
	showSizePercent: boolean;
	minHeightPx: number | null;
	onAddBlock: () => void;
	onSetWrapper: (wrapper: 'none' | 'card') => void;
	onSetMinHeightPx: (minHeightPx: number | null) => void;
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
				sizePercent={sizePercent}
				showSizePercent={showSizePercent}
				minHeightPx={minHeightPx}
				wrapper={column.settings?.wrapper === 'card' ? 'card' : 'none'}
				setActivatorNodeRef={setActivatorNodeRef}
				listeners={listeners}
				attributes={attributes}
				onAddBlock={onAddBlock}
				onSetWrapper={onSetWrapper}
				onSetMinHeightPx={onSetMinHeightPx}>
				{children}
			</ColumnFrame>
		</ResizablePanel>
	);
}

function SortableBlock({
	block,
	rowId,
	columnId,
	containerPath,
	disabled,
	compact,
	activeBlockId,
	setActiveBlockId,
	activeBlockRef,
	openAddBlock,
	updateBlockAt,
	removeBlockAt,
	onAddChild,
	onRemove,
	onUpdate,
}: {
	block: PageBlock;
	rowId: string;
	columnId: string;
	containerPath: string[];
	disabled: boolean;
	compact: boolean;
	activeBlockId: string | null;
	setActiveBlockId: (id: string | null) => void;
	activeBlockRef: React.RefObject<HTMLDivElement | null>;
	openAddBlock: (rowId: string, columnId: string, containerPath?: string[]) => void;
	updateBlockAt: (rowId: string, columnId: string, containerPath: string[], blockId: string, next: PageBlock) => void;
	removeBlockAt: (rowId: string, columnId: string, containerPath: string[], blockId: string) => void;
	onAddChild?: () => void;
	onRemove: () => void;
	onUpdate: (next: PageBlock) => void;
}) {
	const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
	const shadcnProps = useMemo(() => {
		if (block.type !== 'shadcn') return {};
		return isRecord(block.data.props) ? block.data.props : {};
	}, [block]);
	const shadcnComponentId = useMemo(() => {
		if (block.type !== 'shadcn') return null;
		const raw = (block.data.component || '').trim().toLowerCase();
		return raw ? raw : null;
	}, [block]);
	const shadcnVariants = useShadcnVariants(shadcnComponentId);
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
			data: { kind: 'block', rowId, columnId, containerPath } satisfies SortableBlockData,
			disabled,
		});

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const isActive = activeBlockId === block.id;
	const label = describeBlock(block);

	const canWrapChildren = useMemo(() => {
		if (!shadcnComponentId) return false;
		const meta = shadcnComponentMeta(shadcnComponentId);
		return meta?.canWrapChildren ?? false;
	}, [shadcnComponentId]);

	const isContainerBlock = block.type === 'shadcn' && (canWrapChildren || Array.isArray(block.children));
	const containerChildPath = useMemo(() => [...containerPath, block.id], [containerPath, block.id]);
	const containerChildren =
		isContainerBlock && block.type === 'shadcn' ? (Array.isArray(block.children) ? block.children : []) : [];

	const { setNodeRef: setContainerDropRef, isOver: isContainerOver } = useDroppable({
		id: `drop:${block.id}`,
		data: {
			kind: 'container-drop',
			rowId,
			columnId,
			containerPath: containerChildPath,
		} satisfies SortableContainerDropData,
		disabled: disabled || !isContainerBlock,
	});

	const containerChildrenEditor = isContainerBlock ? (
		<div
			ref={setContainerDropRef}
			className={cn(
				'rounded-lg border bg-muted/5 p-3',
				compact ? 'border-dashed' : 'bg-background',
				isContainerOver && 'ring-2 ring-ring'
			)}>
			{containerChildren.length > 0 ? (
				<SortableBlockList
					blocks={containerChildren}
					rowId={rowId}
					columnId={columnId}
					containerPath={containerChildPath}
					disabled={disabled}
					compact={compact}
					activeBlockId={activeBlockId}
					setActiveBlockId={setActiveBlockId}
					activeBlockRef={activeBlockRef}
					openAddBlock={openAddBlock}
					updateBlockAt={updateBlockAt}
					removeBlockAt={removeBlockAt}
				/>
			) : (
				<p className='text-xs text-muted-foreground italic'>Drop components here</p>
			)}
		</div>
	) : null;

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={isDragging ? 'opacity-70' : ''}
			{...attributes}>
			<div
				className={cn(
					'rounded-md',
					compact
						? 'group/block border border-transparent bg-transparent hover:border-border hover:bg-muted/5 focus-within:border-border focus-within:bg-muted/5'
						: 'border bg-background'
				)}>
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

								{onAddChild ? (
									<Button
										type='button'
										variant='outline'
										size='icon'
										onClick={onAddChild}
										disabled={disabled}>
										<Plus className='h-4 w-4' />
										<span className='sr-only'>Add inside</span>
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
								shadcnVariants,
								shadcnPropsJson,
								setShadcnPropsJson,
								shadcnPropsJsonError,
								setShadcnPropsJsonError,
								containerChildrenEditor,
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

								{onAddChild ? (
									<Button
										type='button'
										variant='outline'
										size='icon'
										onClick={onAddChild}
										disabled={disabled}>
										<Plus className='h-4 w-4' />
										<span className='sr-only'>Add inside</span>
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
								shadcnVariants,
								shadcnPropsJson,
								setShadcnPropsJson,
								shadcnPropsJsonError,
								setShadcnPropsJsonError,
								containerChildrenEditor,
								onUpdate,
							})}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function SortableBlockList({
	blocks,
	rowId,
	columnId,
	containerPath,
	disabled,
	compact,
	activeBlockId,
	setActiveBlockId,
	activeBlockRef,
	openAddBlock,
	updateBlockAt,
	removeBlockAt,
}: {
	blocks: PageBlock[];
	rowId: string;
	columnId: string;
	containerPath: string[];
	disabled: boolean;
	compact: boolean;
	activeBlockId: string | null;
	setActiveBlockId: (id: string | null) => void;
	activeBlockRef: React.RefObject<HTMLDivElement | null>;
	openAddBlock: (rowId: string, columnId: string, containerPath?: string[]) => void;
	updateBlockAt: (
		rowId: string,
		columnId: string,
		containerPath: string[],
		blockId: string,
		next: PageBlock
	) => void;
	removeBlockAt: (rowId: string, columnId: string, containerPath: string[], blockId: string) => void;
}) {
	return (
		<SortableContext
			items={blocks.map((b) => b.id)}
			strategy={verticalListSortingStrategy}>
			<div className='space-y-3'>
				{blocks.map((b) => {
					const shadcnId =
						b.type === 'shadcn'
							? (b.data.component || '').trim().toLowerCase()
							: '';
					const isStructural =
						b.type === 'shadcn' &&
						((shadcnComponentMeta(shadcnId)?.canWrapChildren ?? false) ||
							Array.isArray(b.children));

					return (
						<SortableBlock
							key={b.id}
							block={b}
							rowId={rowId}
							columnId={columnId}
							containerPath={containerPath}
							disabled={disabled}
							compact={compact}
							activeBlockId={activeBlockId}
							setActiveBlockId={setActiveBlockId}
							activeBlockRef={activeBlockRef}
							openAddBlock={openAddBlock}
							updateBlockAt={updateBlockAt}
							removeBlockAt={removeBlockAt}
							onAddChild={
								isStructural
									? () => openAddBlock(rowId, columnId, [...containerPath, b.id])
									: undefined
							}
							onRemove={() =>
								removeBlockAt(rowId, columnId, containerPath, b.id)
							}
							onUpdate={(next) =>
								updateBlockAt(rowId, columnId, containerPath, b.id, next)
							}
						/>
					);
				})}
			</div>
		</SortableContext>
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
	shadcnVariants,
	shadcnPropsJson,
	setShadcnPropsJson,
	shadcnPropsJsonError,
	setShadcnPropsJsonError,
	containerChildrenEditor,
	onUpdate,
}: {
	block: PageBlock;
	isActive: boolean;
	disabled: boolean;
	compact: boolean;
	setActiveBlockId: (id: string | null) => void;
	mediaPickerOpen: boolean;
	setMediaPickerOpen: (open: boolean) => void;
	shadcnVariants?: ShadcnVariantsState;
	shadcnPropsJson?: string;
	setShadcnPropsJson?: (next: string) => void;
	shadcnPropsJsonError?: string | null;
	setShadcnPropsJsonError?: (next: string | null) => void;
	containerChildrenEditor?: React.ReactNode;
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

			{block.type === 'slot' ? (
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
								<Label className='text-xs'>Name</Label>
								<Input
									value={block.data.name ?? ''}
									onChange={(e) =>
										onUpdate({
											...block,
											data: { ...block.data, name: e.target.value },
										})
									}
									placeholder='e.g. Main content'
									disabled={disabled}
								/>
							</div>
						</div>
					</details>
				</div>
			) : null}

			{block.type === 'menu' ? (
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
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div className='space-y-1'>
									<Label className='text-xs'>Menu slug</Label>
									<Input
										value={block.data.menu ?? ''}
										onChange={(e) =>
											onUpdate({
												...block,
												data: { ...block.data, menu: e.target.value },
											})
										}
										placeholder='e.g. main'
										disabled={disabled}
									/>
								</div>
								<div className='space-y-1'>
									<Label className='text-xs'>Kind</Label>
									<Select
										value={block.data.kind === 'footer' ? 'footer' : 'top'}
										onValueChange={(v) =>
											onUpdate({
												...block,
												data: {
													...block.data,
													kind: v === 'footer' ? 'footer' : 'top',
												},
											})
										}
										disabled={disabled}>
										<SelectTrigger className='h-8'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='top'>top</SelectItem>
											<SelectItem value='footer'>footer</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							{(() => {
								const menuBlock = block as Extract<PageBlock, { type: 'menu' }>;
								const items = Array.isArray(menuBlock.data.items) ? menuBlock.data.items : [];

								function updateItems(nextItems: typeof items | undefined) {
									const itemsValue =
										Array.isArray(nextItems) && nextItems.length === 0 ? undefined : nextItems;
									onUpdate({
										...menuBlock,
										data: { ...menuBlock.data, items: itemsValue },
									});
								}

								return (
									<div className='space-y-2'>
										<div className='flex items-start justify-between gap-3'>
											<div className='space-y-0.5'>
												<p className='text-xs font-medium'>Items (optional)</p>
												<p className='text-xs text-muted-foreground'>
													If set, this menu renders from embedded items (no fetch).
												</p>
											</div>

											<div className='flex items-center gap-2 shrink-0'>
												{items.length ? (
													<Button
														type='button'
														variant='outline'
														size='sm'
														onClick={() => updateItems(undefined)}
														disabled={disabled}>
														Use slug
													</Button>
												) : null}
												<Button
													type='button'
													variant='outline'
													size='sm'
													onClick={() =>
														updateItems([
															...items,
															{ id: createId('mi'), label: 'New link', href: '/' },
														])
													}
													disabled={disabled}>
													<Plus className='h-4 w-4 mr-2' />
													Add item
												</Button>
											</div>
										</div>

										{items.length ? (
											<div className='space-y-2'>
												{items.map((it, idx) => (
													<div
														key={it.id}
														className='grid grid-cols-12 gap-2 items-end'>
														<div className='col-span-4 space-y-1'>
															<Label className='text-xs'>Label</Label>
															<Input
																value={it.label}
																onChange={(e) =>
																	updateItems(
																		items.map((x) =>
																			x.id === it.id
																				? { ...x, label: e.target.value }
																				: x
																		)
																	)
																}
																disabled={disabled}
															/>
														</div>
														<div className='col-span-6 space-y-1'>
															<Label className='text-xs'>Href</Label>
															<Input
																value={it.href}
																onChange={(e) =>
																	updateItems(
																		items.map((x) =>
																			x.id === it.id
																				? { ...x, href: e.target.value }
																				: x
																		)
																	)
																}
																disabled={disabled}
															/>
														</div>
														<div className='col-span-2 flex items-center justify-end gap-1'>
															<Button
																type='button'
																variant='outline'
																size='icon'
																onClick={() => updateItems(arrayMove(items, idx, idx - 1))}
																disabled={disabled || idx === 0}
																title='Move up'>
																<ArrowUp className='h-4 w-4' />
															</Button>
															<Button
																type='button'
																variant='outline'
																size='icon'
																onClick={() => updateItems(arrayMove(items, idx, idx + 1))}
																disabled={disabled || idx === items.length - 1}
																title='Move down'>
																<ArrowDown className='h-4 w-4' />
															</Button>
															<Button
																type='button'
																variant='destructive'
																size='icon'
																onClick={() => updateItems(items.filter((x) => x.id !== it.id))}
																disabled={disabled}
																title='Remove'>
																<Trash2 className='h-4 w-4' />
															</Button>
														</div>
													</div>
												))}
											</div>
										) : (
											<p className='text-xs text-muted-foreground italic'>
												No embedded items. Uses menu slug.
											</p>
										)}
									</div>
								);
							})()}
						</div>
					</details>
				</div>
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
					const variantGroups = shadcnVariants?.groups ?? [];
					const variantDefaults = shadcnVariants?.defaults ?? {};
					const shadcnMeta = shadcnComponentMeta(componentId);

					function updateProps(nextPartial: Record<string, unknown>) {
						const next = { ...props, ...nextPartial } as Record<string, unknown>;
						for (const [k, v] of Object.entries(next)) {
							if (v === undefined) delete next[k];
						}
						onUpdate({
							...shadcnBlock,
							data: {
								...shadcnBlock.data,
								props: next,
							},
						});
					}

					return (
						<div className='space-y-3'>
							{containerChildrenEditor ?? renderBlockPreview(block)}
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
									{shadcnMeta ? (
										<div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
											<span className='rounded bg-muted px-2 py-1'>kind: {shadcnMeta.kind}</span>
											{shadcnMeta.canWrapChildren ? (
												<span className='rounded bg-muted px-2 py-1'>structural wrapper</span>
											) : (
												<span className='rounded bg-muted px-2 py-1'>leaf</span>
											)}
										</div>
									) : null}

									{shadcnVariants &&
									!shadcnVariants.loading &&
									(shadcnVariants.title || shadcnVariants.description) ? (
										<div className='space-y-1'>
											{shadcnVariants.title ? (
												<p className='text-sm font-medium'>{shadcnVariants.title}</p>
											) : null}
											{shadcnVariants.description ? (
												<p className='text-xs text-muted-foreground'>
													{shadcnVariants.description}
												</p>
											) : null}
										</div>
									) : null}

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

									{shadcnVariants && !shadcnVariants.loading && shadcnVariants.exports.length > 0 ? (
										<div className='space-y-1'>
											<p className='text-xs text-muted-foreground'>Anatomy (exports)</p>
											<div className='flex flex-wrap gap-1'>
												{shadcnVariants.exports.map((e) => (
													<span
														key={e}
														className='rounded bg-muted px-2 py-1 text-xs font-mono'>
														{e}
													</span>
												))}
											</div>
										</div>
									) : null}

									{shadcnVariants && !shadcnVariants.loading && shadcnVariants.install.length > 0 ? (
										<div className='space-y-1'>
											<p className='text-xs text-muted-foreground'>Dependencies</p>
											<div className='flex flex-wrap gap-1'>
												{shadcnVariants.install.map((pkg) => (
													<span
														key={pkg}
														className='rounded bg-muted px-2 py-1 text-xs font-mono'>
														{pkg}
													</span>
												))}
											</div>
										</div>
									) : null}

									{shadcnVariants?.radix?.doc ? (
										<p className='text-xs text-muted-foreground'>
											Radix docs:{' '}
											<a
												href={shadcnVariants.radix.doc}
												target='_blank'
												rel='noreferrer'
												className='underline underline-offset-4'>
												{shadcnVariants.radix.doc}
											</a>
										</p>
									) : null}

									{shadcnVariants?.radix?.api ? (
										<p className='text-xs text-muted-foreground'>
											Radix API:{' '}
											<a
												href={shadcnVariants.radix.api}
												target='_blank'
												rel='noreferrer'
												className='underline underline-offset-4'>
												{shadcnVariants.radix.api}
											</a>
										</p>
									) : null}

									{shadcnVariants?.loading ? (
										<p className='text-xs text-muted-foreground'>Loading variants from docs…</p>
									) : shadcnVariants?.error ? (
										<p className='text-xs text-red-600'>Variants: {shadcnVariants.error}</p>
									) : null}

									{(() => {
										const hidden = new Set<string>();
										if (componentId === 'button') {
											hidden.add('variant');
											hidden.add('size');
										}
										if (componentId === 'badge' || componentId === 'alert') {
											hidden.add('variant');
										}

										const visible = variantGroups.filter((g) => !hidden.has(g.name));
										if (!visible.length) return null;

										return (
											<div className='space-y-2'>
												<p className='text-xs text-muted-foreground'>Variants (from docs)</p>
												<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
													{visible.map((group) => {
														const raw = props[group.name];
														const current =
															typeof raw === 'string' && group.options.includes(raw)
																? raw
																: null;
														const defaultValue =
															typeof variantDefaults[group.name] === 'string' &&
															group.options.includes(variantDefaults[group.name]!)
																? variantDefaults[group.name]!
																: null;
														const value = current ?? '__default__';
														const defaultLabel = defaultValue
															? `default (${defaultValue})`
															: 'default';

														return (
															<div
																key={group.name}
																className='space-y-1'>
																<Label className='text-xs'>{group.name}</Label>
																<Select
																	value={value}
																	onValueChange={(v) => {
																		if (v === '__default__') {
																			updateProps({ [group.name]: undefined });
																		} else {
																			updateProps({ [group.name]: v });
																		}
																	}}
																	disabled={disabled}>
																	<SelectTrigger className='h-8'>
																		<SelectValue placeholder={defaultLabel} />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value='__default__'>{defaultLabel}</SelectItem>
																		{group.options.map((opt) => (
																			<SelectItem
																				key={opt}
																				value={opt}>
																				{opt}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
															</div>
														);
													})}
												</div>
											</div>
										);
									})()}

									{componentId === 'alert' ? (
										<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
											<div className='space-y-1'>
												<Label className='text-xs'>Variant</Label>
												{(() => {
													const variantOptions =
														variantGroups.find((g) => g.name === 'variant')?.options ??
														['default', 'destructive'];
													const currentVariant =
														typeof props['variant'] === 'string' &&
														variantOptions.includes(props['variant'])
															? (props['variant'] as string)
															: 'default';

													return (
												<Select
													value={currentVariant}
													onValueChange={(v) => updateProps({ variant: v })}
													disabled={disabled}>
													<SelectTrigger className='h-8'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{variantOptions.map((v) => (
															<SelectItem key={v} value={v}>
																{v}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
													);
												})()}
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
										(() => {
											const variantOptions =
												variantGroups.find((g) => g.name === 'variant')?.options ??
												['default', 'secondary', 'outline', 'destructive', 'ghost', 'link'];
											const sizeOptions =
												variantGroups.find((g) => g.name === 'size')?.options ??
												['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'];

											const currentVariant =
												typeof props['variant'] === 'string' &&
												variantOptions.includes(props['variant'])
													? (props['variant'] as string)
													: 'default';
											const currentSize =
												typeof props['size'] === 'string' &&
												sizeOptions.includes(props['size'])
													? (props['size'] as string)
													: 'default';

											return (
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
															value={currentVariant}
															onValueChange={(v) => updateProps({ variant: v })}
															disabled={disabled}>
															<SelectTrigger className='h-8'>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{variantOptions.map((v) => (
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
															value={currentSize}
															onValueChange={(v) => updateProps({ size: v })}
															disabled={disabled}>
															<SelectTrigger className='h-8'>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{sizeOptions.map((v) => (
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
											);
										})()
									) : null}

									{componentId === 'badge' ? (
										(() => {
											const variantOptions =
												variantGroups.find((g) => g.name === 'variant')?.options ??
												['default', 'secondary', 'outline', 'destructive'];
											const currentVariant =
												typeof props['variant'] === 'string' &&
												variantOptions.includes(props['variant'])
													? (props['variant'] as string)
													: 'default';

											return (
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
															value={currentVariant}
															onValueChange={(v) => updateProps({ variant: v })}
															disabled={disabled}>
															<SelectTrigger className='h-8'>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{variantOptions.map((v) => (
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
											);
										})()
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
			block.type !== 'slot' &&
			block.type !== 'menu' &&
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

	if (type === 'slot') {
		const d = isRecord(data) ? data : {};
		const name = typeof d['name'] === 'string' ? d['name'] : undefined;
		return { id: createId('blk'), type: 'slot', data: { name } };
	}

	if (type === 'menu') {
		const d = isRecord(data) ? data : {};
		const menu = typeof d['menu'] === 'string' ? d['menu'] : 'main';
		const kindRaw = typeof d['kind'] === 'string' ? d['kind'].trim().toLowerCase() : undefined;
		const kind =
			kindRaw === 'footer' || kindRaw === 'top'
				? (kindRaw as 'top' | 'footer')
				: undefined;

		let items: Array<{ id: string; label: string; href: string }> | undefined;
		if (Array.isArray(d['items'])) {
			const parsed: Array<{ id: string; label: string; href: string }> = [];
			for (const [idx, it] of d['items'].entries()) {
				if (!isRecord(it)) continue;
				const label = typeof it['label'] === 'string' ? it['label'].trim() : '';
				const href = typeof it['href'] === 'string' ? it['href'].trim() : '';
				if (!label || !href) continue;
				const id = typeof it['id'] === 'string' && it['id'].trim() ? it['id'] : createId(`mi_${idx}`);
				parsed.push({ id, label, href });
			}
			items = parsed;
		}

		return {
			id: createId('blk'),
			type: 'menu',
			data: items ? { menu, kind, items } : { menu, kind },
		};
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
		const normalizedId = String(componentId).trim().toLowerCase();
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

		const meta = shadcnComponentMeta(normalizedId);
		const canWrapChildren = meta?.canWrapChildren ?? false;
		return {
			id: createId('blk'),
			type: 'shadcn',
			data: props ? { component: normalizedId, props } : { component: normalizedId },
			children: canWrapChildren ? [] : undefined,
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
	const [resizingRowId, setResizingRowId] = useState<string | null>(null);
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

	useEffect(() => {
		if (!resizingRowId) return;
		const clear = () => setResizingRowId(null);
		window.addEventListener('pointerup', clear);
		window.addEventListener('pointercancel', clear);
		return () => {
			window.removeEventListener('pointerup', clear);
			window.removeEventListener('pointercancel', clear);
		};
	}, [resizingRowId]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const [blockPickerOpen, setBlockPickerOpen] = useState(false);
	const [addTarget, setAddTarget] = useState<{
		rowId: string;
		columnId: string;
		containerPath: string[];
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

	function setWrapper(rowId: string, wrapper: 'none' | 'card') {
		if (disabledFlag) return;
		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== rowId) return r;
				const nextSettings = {
					...(r.settings ?? {}),
					wrapper: wrapper === 'none' ? undefined : wrapper,
				} satisfies PageRow['settings'];

				const hasAny =
					typeof nextSettings.columns === 'number' ||
					(Array.isArray(nextSettings.sizes) && nextSettings.sizes.length > 0) ||
					typeof nextSettings.wrapper === 'string' ||
					typeof nextSettings.minHeightPx === 'number' ||
					typeof nextSettings.maxWidthPct === 'number';

				return {
					...r,
					settings: hasAny ? nextSettings : undefined,
				};
			}),
		});
	}

	function setColumnWrapper(rowId: string, columnId: string, wrapper: 'none' | 'card') {
		if (disabledFlag) return;
		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== rowId) return r;
				return {
					...r,
					columns: r.columns.map((c) => {
						if (c.id !== columnId) return c;
						const nextSettings = {
							...(c.settings ?? {}),
							wrapper: wrapper === 'none' ? undefined : wrapper,
						} satisfies PageColumn['settings'];
						const hasAny =
							typeof nextSettings.wrapper === 'string' ||
							typeof nextSettings.minHeightPx === 'number';
						return { ...c, settings: hasAny ? nextSettings : undefined };
					}),
				};
			}),
		});
	}

	function setRowMinHeightPx(rowId: string, minHeightPx: number | null) {
		if (disabledFlag) return;
		const nextPx =
			typeof minHeightPx === 'number' && Number.isFinite(minHeightPx)
				? Math.max(MIN_ROW_HEIGHT_PX, Math.min(MAX_ROW_HEIGHT_PX, Math.round(minHeightPx)))
				: null;

		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== rowId) return r;
				const current =
					typeof r.settings?.minHeightPx === 'number' && Number.isFinite(r.settings.minHeightPx)
						? r.settings.minHeightPx
						: null;
				if (current === nextPx) return r;

				const nextSettings = {
					...(r.settings ?? {}),
					minHeightPx: nextPx ?? undefined,
				} satisfies PageRow['settings'];

				const hasAny =
					typeof nextSettings.columns === 'number' ||
					(Array.isArray(nextSettings.sizes) && nextSettings.sizes.length > 0) ||
					typeof nextSettings.wrapper === 'string' ||
					typeof nextSettings.minHeightPx === 'number' ||
					typeof nextSettings.maxWidthPct === 'number';

				return { ...r, settings: hasAny ? nextSettings : undefined };
			}),
		});
	}

	function setRowMaxWidthPct(rowId: string, maxWidthPct: number | null) {
		if (disabledFlag) return;
		const nextPct =
			typeof maxWidthPct === 'number' && Number.isFinite(maxWidthPct)
				? Math.max(MIN_ROW_WIDTH_PCT, Math.min(100, maxWidthPct))
				: null;

		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== rowId) return r;
				const current =
					typeof r.settings?.maxWidthPct === 'number' && Number.isFinite(r.settings.maxWidthPct)
						? r.settings.maxWidthPct
						: null;
				if (current === nextPct) return r;

				const nextSettings = {
					...(r.settings ?? {}),
					maxWidthPct: nextPct ?? undefined,
				} satisfies PageRow['settings'];

				const hasAny =
					typeof nextSettings.columns === 'number' ||
					(Array.isArray(nextSettings.sizes) && nextSettings.sizes.length > 0) ||
					typeof nextSettings.wrapper === 'string' ||
					typeof nextSettings.minHeightPx === 'number' ||
					typeof nextSettings.maxWidthPct === 'number';

				return { ...r, settings: hasAny ? nextSettings : undefined };
			}),
		});
	}

	function setColumnMinHeightPx(rowId: string, columnId: string, minHeightPx: number | null) {
		if (disabledFlag) return;
		const nextPx =
			typeof minHeightPx === 'number' && Number.isFinite(minHeightPx)
				? Math.max(MIN_COLUMN_HEIGHT_PX, Math.min(MAX_COLUMN_HEIGHT_PX, Math.round(minHeightPx)))
				: null;

		onChange({
			...value,
			rows: value.rows.map((r) => {
				if (r.id !== rowId) return r;
				return {
					...r,
					columns: r.columns.map((c) => {
						if (c.id !== columnId) return c;
						const current =
							typeof c.settings?.minHeightPx === 'number' && Number.isFinite(c.settings.minHeightPx)
								? c.settings.minHeightPx
								: null;
						if (current === nextPx) return c;

						const nextSettings = {
							...(c.settings ?? {}),
							minHeightPx: nextPx ?? undefined,
						} satisfies PageColumn['settings'];

						const hasAny =
							typeof nextSettings.wrapper === 'string' ||
							typeof nextSettings.minHeightPx === 'number';

						return { ...c, settings: hasAny ? nextSettings : undefined };
					}),
				};
			}),
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

	function openAddBlock(rowId: string, columnId: string, containerPath: string[] = []) {
		setAddTarget({ rowId, columnId, containerPath });
		setBlockPickerOpen(true);
	}

	function addBlock(component: ComponentPickerItem) {
		if (!addTarget) return;

		const nextBlock = createBlockFromComponent(component);
		onChange(
			updateStateAtLocation(
				value,
				{
					rowId: addTarget.rowId,
					columnId: addTarget.columnId,
					containerPath: addTarget.containerPath,
				},
				(blocks) => [...blocks, nextBlock]
			)
		);

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

	type BlockListLocation = { rowId: string; columnId: string; containerPath: string[] };

	function updateBlocksInList(
		blocks: PageBlock[],
		containerPath: string[],
		updater: (blocks: PageBlock[]) => PageBlock[]
	): PageBlock[] {
		if (containerPath.length === 0) return updater(blocks);

		const [head, ...rest] = containerPath;
		let changed = false;
		const next = blocks.map((b) => {
			if (b.id !== head) return b;
			if (b.type !== 'shadcn') return b;

			const children = Array.isArray(b.children) ? b.children : [];
			const nextChildren = updateBlocksInList(children, rest, updater);
			if (nextChildren === children) return b;

			changed = true;
			return { ...b, children: nextChildren };
		});

		return changed ? next : blocks;
	}

	function updateStateAtLocation(
		state: PageBuilderState,
		loc: BlockListLocation,
		updater: (blocks: PageBlock[]) => PageBlock[]
	): PageBuilderState {
		return {
			...state,
			rows: state.rows.map((r) => {
				if (r.id !== loc.rowId) return r;
				return {
					...r,
					columns: r.columns.map((c) => {
						if (c.id !== loc.columnId) return c;
						const nextBlocks = updateBlocksInList(c.blocks, loc.containerPath, updater);
						return nextBlocks === c.blocks ? c : { ...c, blocks: nextBlocks };
					}),
				};
			}),
		};
	}

	function getBlocksAtLocation(state: PageBuilderState, loc: BlockListLocation): PageBlock[] | null {
		const row = state.rows.find((r) => r.id === loc.rowId);
		const col = row?.columns.find((c) => c.id === loc.columnId);
		if (!col) return null;

		let blocks: PageBlock[] = col.blocks;
		for (const containerId of loc.containerPath) {
			const container = blocks.find((b) => b.id === containerId);
			if (!container || container.type !== 'shadcn') return null;
			blocks = Array.isArray(container.children) ? container.children : [];
		}
		return blocks;
	}

	function findBlockInBlocks(blocks: PageBlock[], blockId: string): PageBlock | null {
		for (const b of blocks) {
			if (b.id === blockId) return b;
			if (b.type === 'shadcn' && Array.isArray(b.children)) {
				const found = findBlockInBlocks(b.children, blockId);
				if (found) return found;
			}
		}
		return null;
	}

	function findBlock(state: PageBuilderState, blockId: string): PageBlock | null {
		for (const r of state.rows) {
			for (const c of r.columns) {
				const found = findBlockInBlocks(c.blocks, blockId);
				if (found) return found;
			}
		}
		return null;
	}

	function updateBlock(
		rowId: string,
		columnId: string,
		containerPath: string[],
		blockId: string,
		next: PageBlock
	) {
		onChange(
			updateStateAtLocation(value, { rowId, columnId, containerPath }, (blocks) =>
				blocks.map((b) => (b.id === blockId ? next : b))
			)
		);
	}

	function removeBlock(rowId: string, columnId: string, containerPath: string[], blockId: string) {
		onChange(
			updateStateAtLocation(value, { rowId, columnId, containerPath }, (blocks) =>
				blocks.filter((b) => b.id !== blockId)
			)
		);
		if (activeBlockId === blockId) setActiveBlockId(null);
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
			| SortableContainerDropData
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
			const fromLoc = {
				rowId: activeData.rowId,
				columnId: activeData.columnId,
				containerPath: activeData.containerPath ?? [],
			} satisfies BlockListLocation;
			const movingId = String(active.id);

			let toLoc: BlockListLocation | null = null;
			let toIndex: number | null = null;

			if (overData.kind === 'block') {
				toLoc = {
					rowId: overData.rowId,
					columnId: overData.columnId,
					containerPath: overData.containerPath ?? [],
				};
				const blocks = getBlocksAtLocation(value, toLoc);
				if (!blocks) return;
				const overIndex = blocks.findIndex((b) => b.id === String(over.id));
				if (overIndex === -1) return;
				toIndex = overIndex;
			} else if (overData.kind === 'column') {
				toLoc = { rowId: overData.rowId, columnId: overData.columnId, containerPath: [] };
				const blocks = getBlocksAtLocation(value, toLoc);
				if (!blocks) return;
				toIndex = blocks.length;
			} else if (overData.kind === 'container-drop') {
				toLoc = {
					rowId: overData.rowId,
					columnId: overData.columnId,
					containerPath: overData.containerPath ?? [],
				};
				const blocks = getBlocksAtLocation(value, toLoc);
				if (!blocks) return;
				toIndex = blocks.length;
			}

			if (!toLoc || toIndex === null) return;

			const fromBlocks = getBlocksAtLocation(value, fromLoc);
			if (!fromBlocks) return;
			const oldIndex = fromBlocks.findIndex((b) => b.id === movingId);
			if (oldIndex === -1) return;

			// Reorder within the same list.
			const sameList =
				fromLoc.rowId === toLoc.rowId &&
				fromLoc.columnId === toLoc.columnId &&
				fromLoc.containerPath.join('/') === toLoc.containerPath.join('/');

			if (sameList) {
				let newIndex = toIndex;
				if (overData.kind !== 'block') {
					newIndex = fromBlocks.length - 1;
				}
				if (oldIndex === newIndex) return;
				onChange(
					updateStateAtLocation(value, fromLoc, (blocks) => arrayMove(blocks, oldIndex, newIndex))
				);
				return;
			}

			const moving = findBlock(value, movingId);
			if (!moving) return;

			// Prevent moving a container into its own descendants.
			if (moving.type === 'shadcn') {
				const targetPath = toLoc.containerPath ?? [];
				if (targetPath.includes(movingId)) return;
			}

			// remove from source
			let next = updateStateAtLocation(value, fromLoc, (blocks) => blocks.filter((b) => b.id !== movingId));

			// insert into target
			next = updateStateAtLocation(next, toLoc, (blocks) => {
				const out = [...blocks];
				const safeIndex = Math.max(0, Math.min(toIndex ?? 0, out.length));
				out.splice(safeIndex, 0, moving);
				return out;
			});

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
							const showSizePercent = resizingRowId === row.id;

							return (
								<SortableRow
									key={row.id}
									row={row}
									disabled={disabledFlag}
									compact={compact}
									onRemoveRow={removeRow}
									onSetColumns={setColumns}
									onSetWrapper={setWrapper}
									onSetMinHeightPx={setRowMinHeightPx}
									onSetMaxWidthPct={setRowMaxWidthPct}>
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
														sizePercent={sizes[idx] ?? 0}
														showSizePercent={showSizePercent}
														minHeightPx={
															typeof col.settings?.minHeightPx === 'number' &&
															Number.isFinite(col.settings.minHeightPx)
																? col.settings.minHeightPx
																: null
														}
														onAddBlock={() => openAddBlock(row.id, col.id)}
														onSetWrapper={(w) => setColumnWrapper(row.id, col.id, w)}
														onSetMinHeightPx={(px) =>
															setColumnMinHeightPx(row.id, col.id, px)
														}>
														<SortableBlockList
															blocks={col.blocks}
															rowId={row.id}
															columnId={col.id}
															containerPath={[]}
															disabled={disabledFlag}
															compact={compact}
															activeBlockId={activeBlockId}
															setActiveBlockId={setActiveBlockId}
															activeBlockRef={activeBlockRef}
															openAddBlock={openAddBlock}
															updateBlockAt={updateBlock}
															removeBlockAt={removeBlock}
														/>
													</SortableResizableColumnPanel>
													{idx < row.columns.length - 1 ? (
														<ResizableHandle
															withHandle
															onPointerDown={() => setResizingRowId(row.id)}
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

export { PageRenderer, PageRendererWithSlot } from './page-renderer';
