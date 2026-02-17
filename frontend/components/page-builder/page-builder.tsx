'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Box, Container, Flex, Grid, Section, Theme } from '@radix-ui/themes';
import {
	DndContext,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
	type DragMoveEvent,
	type DragEndEvent,
	type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, Columns3, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Circle, Copy, EyeOff, ImagePlus, LayoutGrid, ListTree, Maximize2, Minimize2, Minus, Monitor, MoreHorizontal, MousePointer2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, RectangleHorizontal, Redo2, RotateCcw, SlidersHorizontal, Smartphone, Tablet, Trash2, Type, Undo2, ZoomIn, ZoomOut } from 'lucide-react';

import type {
	BuilderBreakpoint,
	NodeMeta,
	NodeFrame,
	FrameBlock,
	PageBlock,
	PageBuilderState,
	PageNode,
	ShapeKind,
	TextVariant,
} from '@/lib/page-builder';
import {
	cloneNodesWithNewIds,
	comparableJsonFromState,
	createId,
	emptyEditorValue,
	isRecord,
	parsePageBuilderState,
} from '@/lib/page-builder';
import type { BlockTemplate, ComponentDef, MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';
import { shadcnComponentMeta } from '@/lib/shadcn-meta';

import { EditorBlock } from '@/components/editor-block';
import { ComponentDataEditor } from '@/components/components/component-data-editor';
import { MediaPickerDialog } from '@/components/media/media-picker-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

import { BlockPickerDialog, type ComponentPickerItem } from './block-picker-dialog';
import { BlockTemplateBrowser } from './block-template-browser';
import { BlockTemplatePickerDialog } from './block-template-picker-dialog';
import { PageBuilderOutline } from './page-outline';
import { renderBlockPreview } from './page-renderer';

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type ResizeState = {
	nodeId: string;
	handle: ResizeHandle;
	breakpoint: BuilderBreakpoint;
	startClientX: number;
	startClientY: number;
	startFrame: NodeFrame;
	parentWidth: number;
	parentHeight: number;
	isRoot: boolean;
};

const ROOT_DROPPABLE_ID = 'canvas-root';
const NODE_PREFIX = 'node:';
const CONTAINER_PREFIX = 'container:';
const MIN_NODE_W = 40;
const MIN_NODE_H = 32;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const HISTORY_LIMIT = 120;

const GRID_CELL_PX = 5;
const GRID_MAJOR_PX = GRID_CELL_PX * 10;
// Use `hsl(var(--foreground) / a)` so the editor grid is readable in both light/dark themes.
const GRID_CHECKER_COLOR = 'hsl(var(--foreground) / 0.04)';
const GRID_MINOR_COLOR = 'hsl(var(--foreground) / 0.08)';
const GRID_MAJOR_COLOR = 'hsl(var(--foreground) / 0.14)';
const RULER_MINOR_COLOR = 'hsl(var(--foreground) / 0.18)';
const RULER_MAJOR_COLOR = 'hsl(var(--foreground) / 0.28)';
const GRID_BACKGROUND_IMAGE = [
	// subtle checker fill for a "square matrix" feel
	`linear-gradient(45deg, ${GRID_CHECKER_COLOR} 25%, transparent 25%, transparent 75%, ${GRID_CHECKER_COLOR} 75%, ${GRID_CHECKER_COLOR})`,
	`linear-gradient(45deg, ${GRID_CHECKER_COLOR} 25%, transparent 25%, transparent 75%, ${GRID_CHECKER_COLOR} 75%, ${GRID_CHECKER_COLOR})`,
	// minor grid
	`linear-gradient(to right, ${GRID_MINOR_COLOR} 1px, transparent 1px)`,
	`linear-gradient(to bottom, ${GRID_MINOR_COLOR} 1px, transparent 1px)`,
	// major grid
	`linear-gradient(to right, ${GRID_MAJOR_COLOR} 1px, transparent 1px)`,
	`linear-gradient(to bottom, ${GRID_MAJOR_COLOR} 1px, transparent 1px)`,
].join(', ');
const GRID_BACKGROUND_SIZE = `${GRID_CELL_PX * 2}px ${GRID_CELL_PX * 2}px, ${GRID_CELL_PX * 2}px ${GRID_CELL_PX * 2}px, ${GRID_CELL_PX}px ${GRID_CELL_PX}px, ${GRID_CELL_PX}px ${GRID_CELL_PX}px, ${GRID_MAJOR_PX}px ${GRID_MAJOR_PX}px, ${GRID_MAJOR_PX}px ${GRID_MAJOR_PX}px`;
const GRID_BACKGROUND_POSITION = `0 0, ${GRID_CELL_PX}px ${GRID_CELL_PX}px, 0 0, 0 0, 0 0, 0 0`;

const RULER_SIZE_PX = 32;
const RULER_MINOR_PX = GRID_CELL_PX;
const RULER_MAJOR_PX = GRID_MAJOR_PX;
const RULER_LABEL_PX = GRID_MAJOR_PX * 2;

type FrameLayoutKind = NonNullable<FrameBlock['data']['layout']>;

type BuilderTool =
	| 'select'
	| 'frame'
	| 'shape'
	| 'pen'
	| 'pencil'
	| 'media'
	| 'text'
	| 'comment';

type CanvasViewportMode = 'single' | 'frames';
const BREAKPOINT_LABELS: Record<BuilderBreakpoint, string> = {
	mobile: 'Mobile',
	tablet: 'Tablet',
	desktop: 'Desktop',
};

const TOOL_LABELS: Record<BuilderTool, string> = {
	select: 'Select',
	frame: 'Frame',
	shape: 'Shape',
	pen: 'Pen',
	pencil: 'Pencil',
	media: 'Media',
	text: 'Text',
	comment: 'Comment',
};

type DrawState = {
	mode: 'frame' | 'shape';
	breakpoint: BuilderBreakpoint;
	pointerId: number;
	parentId: string | null;
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	frameLayout?: FrameLayoutKind;
	shapeKind?: ShapeKind;
};

type MarqueeState = {
	pointerId: number;
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	additive: boolean;
};

const FRAME_LAYOUT_PRESETS: Array<{
	layout: FrameLayoutKind;
	label: string;
	slug: string;
	props: Record<string, unknown>;
}> = [
	{ layout: 'grid', label: 'Grid', slug: 'layout-grid', props: { columns: '3', gap: '3' } },
	{ layout: 'flex', label: 'Flex', slug: 'layout-flex', props: { direction: 'row', gap: '3' } },
	{ layout: 'box', label: 'Box', slug: 'layout-box', props: {} },
	{ layout: 'container', label: 'Container', slug: 'layout-container', props: { size: '4', align: 'center' } },
	{ layout: 'section', label: 'Section', slug: 'layout-section', props: { size: '2' } },
] as const;

function clampPositive(n: number): number {
	return Number.isFinite(n) && n > 0 ? n : 0;
}

function makeRulerRange(start: number, end: number, step: number): number[] {
	const safeStep = clampPositive(step) || 1;
	const safeStart = Number.isFinite(start) ? start : 0;
	const safeEnd = Number.isFinite(end) ? end : safeStart;
	const first = Math.floor(safeStart / safeStep) * safeStep;
	const values: number[] = [];
	for (let v = first; v <= safeEnd + safeStep; v += safeStep) values.push(v);
	return values;
}

const RADIX_CONTAINER_MAX_WIDTH_PX: Record<string, number> = {
	'1': 448,
	'2': 688,
	'3': 880,
	'4': 1136,
};

const RADIX_SECTION_PADDING_Y_PX: Record<string, number> = {
	'1': 24,
	'2': 40,
	'3': 64,
	'4': 80,
};

type DragDelta = { x: number; y: number };
type SelectModifierEvent = { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean };

function clampZoom(value: number): number {
	if (!Number.isFinite(value)) return 1;
	const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
	return Math.round(clamped * 100) / 100;
}

function renderFrameLayoutHost(node: Extract<PageNode, { type: 'frame' }>, children: ReactNode) {
	const className = (node.data.className || '').trim();
	const mergedClassName = className ? `relative w-full h-full ${className}` : 'relative w-full h-full';

	const props = isRecord(node.data.props) ? (node.data.props as Record<string, unknown>) : {};
	const rest = { ...props, className: mergedClassName } as Record<string, unknown> & { children?: unknown };
	delete rest.children;
	delete rest.asChild;

	const layout = node.data.layout;
	const asBoxProps = (p: Record<string, unknown>) => p as unknown as ComponentProps<typeof Box>;
	const asFlexProps = (p: Record<string, unknown>) => p as unknown as ComponentProps<typeof Flex>;
	const asGridProps = (p: Record<string, unknown>) => p as unknown as ComponentProps<typeof Grid>;
	const asContainerProps = (p: Record<string, unknown>) => p as unknown as ComponentProps<typeof Container>;
	const asSectionProps = (p: Record<string, unknown>) => p as unknown as ComponentProps<typeof Section>;

	if (layout === 'flex') return <Flex {...asFlexProps(rest)}>{children}</Flex>;
	if (layout === 'grid') return <Grid {...asGridProps(rest)}>{children}</Grid>;
	if (layout === 'container') return <Container {...asContainerProps(rest)}>{children}</Container>;
	if (layout === 'section') return <Section {...asSectionProps(rest)}>{children}</Section>;
	if (layout === 'box') return <Box {...asBoxProps(rest)}>{children}</Box>;

	return <div className={mergedClassName}>{children}</div>;
}

function parseNodeDragId(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	if (!value.startsWith(NODE_PREFIX)) return null;
	return value.slice(NODE_PREFIX.length);
}

function parseContainerDropId(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	if (!value.startsWith(CONTAINER_PREFIX)) return null;
	return value.slice(CONTAINER_PREFIX.length);
}

function canContainChildren(node: PageNode | null | undefined): node is PageNode & { nodes: PageNode[] } {
	return !!node && Array.isArray(node.nodes);
}

function countNodeOccurrences(nodes: PageNode[], nodeId: string): number {
	let count = 0;
	function walk(list: PageNode[]) {
		for (const node of list) {
			if (node.id === nodeId) count += 1;
			if (Array.isArray(node.nodes)) walk(node.nodes);
		}
	}
	walk(nodes);
	return count;
}

function normalizeDropParentId(params: {
	index: ReturnType<typeof buildIndex>;
	nodeId: string;
	candidateParentId: string | null;
	originalParentId: string | null;
	effectiveEditRootId: string | null;
}): string | null {
	const { index, nodeId, originalParentId, effectiveEditRootId } = params;
	let parentId = params.candidateParentId;

	if (parentId && (parentId === nodeId || isDescendant(index.parentById, parentId, nodeId))) {
		parentId = originalParentId;
	}

	if (parentId && !canContainChildren(index.byId.get(parentId))) {
		parentId = originalParentId;
	}

	const editRoot = effectiveEditRootId && index.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;
	if (editRoot) {
		const withinEditRoot = (id: string | null): boolean => {
			if (!id) return false;
			return id === editRoot || isDescendant(index.parentById, id, editRoot);
		};
		if (!withinEditRoot(parentId)) {
			parentId = withinEditRoot(originalParentId) ? originalParentId : editRoot;
		}
	}

	if (parentId && !canContainChildren(index.byId.get(parentId))) {
		return originalParentId && canContainChildren(index.byId.get(originalParentId))
			? originalParentId
			: null;
	}

	return parentId;
}

function uniqueParentCandidates(candidates: Array<string | null>): Array<string | null> {
	const out: Array<string | null> = [];
	const seen = new Set<string>();
	for (const id of candidates) {
		const key = id ?? '__root__';
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(id);
	}
	return out;
}

function snapTo(value: number, step: number): number {
	const safe = Number.isFinite(step) && step > 0 ? step : 1;
	return Math.round(value / safe) * safe;
}

function clampMin(value: number, min: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.max(min, value);
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	const hasMin = Number.isFinite(min);
	const hasMax = Number.isFinite(max);
	if (hasMin && hasMax) return Math.max(min, Math.min(max, value));
	if (hasMin) return Math.max(min, value);
	if (hasMax) return Math.min(max, value);
	return value;
}

function isTypingTarget(el: Element | null): boolean {
	if (!el) return false;
	const tag = el.tagName.toLowerCase();
	if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
	if ((el as HTMLElement).isContentEditable) return true;
	if ((el as HTMLElement).closest?.('[contenteditable="true"]')) return true;
	return false;
}

function computeBottom(nodes: PageNode[], breakpoint: BuilderBreakpoint): number {
	function walk(list: PageNode[]): number {
		let max = 0;
		for (const n of list) {
			const f = n.frames[breakpoint];
			const childMax = Array.isArray(n.nodes) ? walk(n.nodes) : 0;
			max = Math.max(max, f.y + Math.max(f.h, childMax));
		}
		return max;
	}
	return walk(nodes);
}

function updateNodeInTree(
	nodes: PageNode[],
	nodeId: string,
	updater: (node: PageNode) => PageNode
): PageNode[] {
	let changed = false;
	const next = nodes.map((n) => {
		if (n.id === nodeId) {
			changed = true;
			return updater(n);
		}
		if (Array.isArray(n.nodes)) {
			const childNext = updateNodeInTree(n.nodes, nodeId, updater);
			if (childNext !== n.nodes) {
				changed = true;
				return { ...n, nodes: childNext };
			}
		}
		return n;
	});
	return changed ? next : nodes;
}

function removeNodeFromTree(
	nodes: PageNode[],
	nodeId: string
): { nodes: PageNode[]; removed: PageNode | null } {
	let removed: PageNode | null = null;
	const filtered: PageNode[] = [];

	for (const n of nodes) {
		if (n.id === nodeId) {
			removed = n;
			continue;
		}
		if (Array.isArray(n.nodes) && !removed) {
			const out = removeNodeFromTree(n.nodes, nodeId);
			if (out.removed) {
				removed = out.removed;
				filtered.push({ ...n, nodes: out.nodes });
				continue;
			}
		}
		filtered.push(n);
	}

	return removed ? { nodes: filtered, removed } : { nodes, removed: null };
}

function insertNodeIntoTree(
	nodes: PageNode[],
	parentId: string | null,
	node: PageNode
): PageNode[] {
	if (!parentId) return [...nodes, node];
	return updateNodeInTree(nodes, parentId, (parent) => {
		const list = Array.isArray(parent.nodes) ? parent.nodes : [];
		return { ...parent, nodes: [...list, node] };
	});
}

function offsetNodes(nodes: PageNode[], dx: number, dy: number): PageNode[] {
	function offsetFrame(f: NodeFrame): NodeFrame {
		return { ...f, x: f.x + dx, y: f.y + dy };
	}
	function walk(list: PageNode[]): PageNode[] {
		return list.map((n) => {
			const next: PageNode = {
				...n,
				frames: {
					mobile: offsetFrame(n.frames.mobile),
					tablet: offsetFrame(n.frames.tablet),
					desktop: offsetFrame(n.frames.desktop),
				},
			};
			if (Array.isArray(n.nodes)) next.nodes = walk(n.nodes);
			return next;
		});
	}
	return walk(nodes);
}

function buildIndex(nodes: PageNode[], breakpoint: BuilderBreakpoint) {
	const byId = new Map<string, PageNode>();
	const parentById = new Map<string, string | null>();
	const globalById = new Map<string, { x: number; y: number }>();

	function walk(list: PageNode[], parentId: string | null, ox: number, oy: number) {
		for (const n of list) {
			byId.set(n.id, n);
			parentById.set(n.id, parentId);
			const f = n.frames[breakpoint];
			const gx = ox + f.x;
			const gy = oy + f.y;
			globalById.set(n.id, { x: gx, y: gy });
			if (Array.isArray(n.nodes)) walk(n.nodes, n.id, gx, gy);
		}
	}
	walk(nodes, null, 0, 0);

	return { byId, parentById, globalById };
}

function isDescendant(
	parentById: Map<string, string | null>,
	nodeId: string,
	ancestorId: string
): boolean {
	let cursor: string | null = nodeId;
	while (cursor) {
		if (cursor === ancestorId) return true;
		cursor = parentById.get(cursor) ?? null;
	}
	return false;
}

function topLevelSelectedIds(selectedIds: string[], idx: ReturnType<typeof buildIndex>): string[] {
	const selectedSet = new Set(selectedIds);
	return selectedIds.filter((id) => {
		let parent = idx.parentById.get(id) ?? null;
		while (parent) {
			if (selectedSet.has(parent)) return false;
			parent = idx.parentById.get(parent) ?? null;
		}
		return true;
	});
}

function isLockedForEdit(
	idx: ReturnType<typeof buildIndex>,
	nodeId: string,
	lockedIds: Set<string>,
	effectiveEditRootId: string | null
): boolean {
	const editRoot = effectiveEditRootId && idx.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;
	let cursor: string | null = nodeId;
	while (cursor) {
		// Template lock should not lock descendants inside the edit root slot.
		if (editRoot && cursor === editRoot && nodeId !== editRoot) break;
		if (lockedIds.has(cursor)) return true;
		cursor = idx.parentById.get(cursor) ?? null;
	}
	return false;
}

function isWithinEditRoot(
	idx: ReturnType<typeof buildIndex>,
	nodeId: string,
	effectiveEditRootId: string | null
): boolean {
	const editRoot = effectiveEditRootId && idx.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;
	if (!editRoot) return true;
	return nodeId === editRoot || isDescendant(idx.parentById, nodeId, editRoot);
}

type DragAssist = {
	snapDx: number;
	snapDy: number;
	guideX: number | null;
	guideY: number | null;
};

function computeDragAssist(params: {
	index: ReturnType<typeof buildIndex>;
	nodeId: string;
	delta: DragDelta;
	breakpoint: BuilderBreakpoint;
	canvasWidth: number;
	rootHeight: number;
	scopeParentId: string | null;
	thresholdPx?: number;
}): DragAssist | null {
	const {
		index,
		nodeId,
		delta,
		breakpoint,
		canvasWidth,
		rootHeight,
		scopeParentId,
		thresholdPx = 6,
	} = params;

	const node = index.byId.get(nodeId);
	const startGlobal = index.globalById.get(nodeId);
	if (!node || !startGlobal) return null;

	const f = node.frames[breakpoint];
	const nextLeft = startGlobal.x + delta.x;
	const nextTop = startGlobal.y + delta.y;
	const nextRight = nextLeft + f.w;
	const nextBottom = nextTop + f.h;
	const nextCenterX = nextLeft + f.w / 2;
	const nextCenterY = nextTop + f.h / 2;

	const draggedX = [nextLeft, nextCenterX, nextRight];
	const draggedY = [nextTop, nextCenterY, nextBottom];

	let parentLeft = 0;
	let parentTop = 0;
	let parentW = canvasWidth;
	let parentH = rootHeight;

	if (scopeParentId) {
		const parentNode = index.byId.get(scopeParentId);
		const parentGlobal = index.globalById.get(scopeParentId);
		if (parentNode && parentGlobal) {
			const pf = parentNode.frames[breakpoint];
			parentLeft = parentGlobal.x;
			parentTop = parentGlobal.y;
			parentW = pf.w;
			parentH = pf.h;
		}
	}

	const refX: number[] = [
		parentLeft,
		parentLeft + parentW / 2,
		parentLeft + parentW,
	];
	const refY: number[] = [
		parentTop,
		parentTop + parentH / 2,
		parentTop + parentH,
	];

	for (const [id, parent] of index.parentById.entries()) {
		if (id === nodeId) continue;
		if (parent !== scopeParentId) continue;
		const other = index.byId.get(id);
		const og = index.globalById.get(id);
		if (!other || !og) continue;
		const of = other.frames[breakpoint];
		refX.push(og.x, og.x + of.w / 2, og.x + of.w);
		refY.push(og.y, og.y + of.h / 2, og.y + of.h);
	}

	let bestX: { abs: number; delta: number; guide: number } | null = null;
	for (const gx of refX) {
		for (const dx of draggedX) {
			const d = gx - dx;
			const abs = Math.abs(d);
			if (abs > thresholdPx) continue;
			if (!bestX || abs < bestX.abs) bestX = { abs, delta: d, guide: gx };
		}
	}

	let bestY: { abs: number; delta: number; guide: number } | null = null;
	for (const gy of refY) {
		for (const dy of draggedY) {
			const d = gy - dy;
			const abs = Math.abs(d);
			if (abs > thresholdPx) continue;
			if (!bestY || abs < bestY.abs) bestY = { abs, delta: d, guide: gy };
		}
	}

	return {
		snapDx: bestX?.delta ?? 0,
		snapDy: bestY?.delta ?? 0,
		guideX: bestX?.guide ?? null,
		guideY: bestY?.guide ?? null,
	};
}

function getParentSize(
	state: PageBuilderState,
	index: ReturnType<typeof buildIndex>,
	nodeId: string,
	breakpoint: BuilderBreakpoint
): { width: number; height: number } {
	const parentId = index.parentById.get(nodeId) ?? null;
	if (!parentId) {
		const rootHeight = Math.max(state.canvas.minHeightPx, computeBottom(state.nodes, breakpoint) + 80);
		return { width: state.canvas.widths[breakpoint], height: rootHeight };
	}
	const parent = index.byId.get(parentId);
	if (!parent) {
		const rootHeight = Math.max(state.canvas.minHeightPx, computeBottom(state.nodes, breakpoint) + 80);
		return { width: state.canvas.widths[breakpoint], height: rootHeight };
	}
	const f = parent.frames[breakpoint];
	return { width: f.w, height: f.h };
}

function createBlockFromComponent(component: ComponentDef): PageBlock {
	const type = (component.type || '').trim();
	const data = component.data;
	const id = createId('node');

	if (type === 'editor') {
		return { id, type: 'editor', data: emptyEditorValue() };
	}

	if (type === 'slot') {
		const d = isRecord(data) ? data : {};
		const name = typeof d['name'] === 'string' ? d['name'] : undefined;
		return { id, type: 'slot', data: { name } };
	}

	if (type === 'menu') {
		const d = isRecord(data) ? data : {};
		const menu = typeof d['menu'] === 'string' ? d['menu'] : 'main';
		const kindRaw = typeof d['kind'] === 'string' ? d['kind'].trim().toLowerCase() : undefined;
		const kind =
			kindRaw === 'footer' || kindRaw === 'top'
				? (kindRaw as 'top' | 'footer')
				: undefined;

		return { id, type: 'menu', data: { menu, kind } };
	}

	if (type === 'frame') {
		const d = isRecord(data) ? data : {};
		const label = typeof d['label'] === 'string' ? d['label'] : component.title || 'Frame';
		const className = typeof d['className'] === 'string' ? d['className'] : undefined;
		const paddingPx = typeof d['paddingPx'] === 'number' ? d['paddingPx'] : 24;
		const layoutRaw = typeof d['layout'] === 'string' ? d['layout'].trim().toLowerCase() : '';
		const layout =
			layoutRaw === 'box' || layoutRaw === 'flex' || layoutRaw === 'grid' || layoutRaw === 'container' || layoutRaw === 'section'
				? (layoutRaw as FrameBlock['data']['layout'])
				: undefined;
		const props = isRecord(d['props']) ? (d['props'] as Record<string, unknown>) : undefined;
		return { id, type: 'frame', data: { label, className, paddingPx, layout, props } };
	}

	if (type === 'separator') {
		return { id, type: 'separator', data: {} };
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
		return { id, type: 'button', data: { label, href, variant } };
	}

	if (type === 'card') {
		const d = isRecord(data) ? data : {};
		const title = typeof d['title'] === 'string' ? d['title'] : 'Card';
		const body = typeof d['body'] === 'string' ? d['body'] : '';
		return { id, type: 'card', data: { title, body } };
	}

	if (type === 'image') {
		const d = isRecord(data) ? data : {};
		const url = typeof d['url'] === 'string' ? d['url'] : '';
		const alt = typeof d['alt'] === 'string' ? d['alt'] : '';
		const mediaId = typeof d['media_id'] === 'number' ? d['media_id'] : undefined;
		return { id, type: 'image', data: { url, alt, media_id: mediaId } };
	}

	if (type === 'collection-list') {
		const d = isRecord(data) ? data : {};
		const typeSlug = typeof d['type_slug'] === 'string' ? d['type_slug'].trim() : '';
		const limit = typeof d['limit'] === 'number' ? Math.max(1, Math.min(100, Math.round(d['limit']))) : 6;
		const columns = typeof d['columns'] === 'number' ? Math.max(1, Math.min(12, Math.round(d['columns']))) : 3;
		const sort = typeof d['sort'] === 'string' ? d['sort'].trim() : 'published_at';
		const dirRaw = typeof d['dir'] === 'string' ? d['dir'].trim().toLowerCase() : 'desc';
		const dir = dirRaw === 'asc' ? 'asc' : 'desc';
		const imageField = typeof d['image_field'] === 'string' ? d['image_field'].trim() : '';
		const subtitleField = typeof d['subtitle_field'] === 'string' ? d['subtitle_field'].trim() : '';

		return {
			id,
			type: 'collection-list',
			data: {
				type_slug: typeSlug,
				limit,
				sort,
				dir,
				columns,
				image_field: imageField || undefined,
				subtitle_field: subtitleField || undefined,
			},
		};
	}

	if (type === 'shadcn') {
		const d = isRecord(data) ? data : {};
		const componentId = typeof d['component'] === 'string' ? d['component'] : component.slug;
		const normalizedId = String(componentId).trim().toLowerCase();

		let props: Record<string, unknown> | undefined;
		if (isRecord(d['props'])) {
			props = d['props'] as Record<string, unknown>;
		} else {
			// Back-compat: allow flat props directly on the component `data`.
			const rest: Record<string, unknown> = { ...(d as Record<string, unknown>) };
			delete rest['component'];
			delete rest['props'];
			if (Object.keys(rest).length) props = rest;
		}

		const meta = shadcnComponentMeta(normalizedId);
		const canWrapChildren = meta?.canWrapChildren ?? false;
		return {
			id,
			type: 'shadcn',
			data: props ? { component: normalizedId, props } : { component: normalizedId },
			children: canWrapChildren ? [] : undefined,
		};
	}

	return {
		id,
		type: 'unknown',
		data: { originalType: type || component.slug || 'unknown', data },
	};
}

function createNodeFromBlock(
	block: PageBlock,
	state: PageBuilderState,
	y: number,
	parentWidths: Record<BuilderBreakpoint, number> = state.canvas.widths
): PageNode {
	const padding = 24;
	const h =
		block.type === 'menu'
			? 96
			: block.type === 'frame'
				? 520
			: block.type === 'button'
				? 64
				: block.type === 'separator'
					? 24
					: block.type === 'image'
						? 240
						: block.type === 'collection-list'
							? 420
						: block.type === 'editor'
							? 320
							: block.type === 'slot'
								? 420
								: 220;

	function frameForWidth(width: number): NodeFrame {
		const safeWidth = Math.max(1, Math.round(width));
		const isFullWidth = block.type === 'menu' || block.type === 'frame' || block.type === 'slot';

		const x = isFullWidth ? 0 : clamp(padding, 0, Math.max(0, safeWidth - 1));
		const maxW = Math.max(1, safeWidth - x);
		const minW = Math.min(MIN_NODE_W, maxW);

		const baseW = isFullWidth
			? safeWidth
			: Math.min(safeWidth - x * 2, Math.max(Math.max(240, minW), Math.round(safeWidth * 0.6)));

		const w = clamp(baseW, minW, maxW);
		return { x, y, w, h: Math.max(MIN_NODE_H, h) };
	}

	const node: PageNode = {
		...(block as PageNode),
		frames: {
			mobile: frameForWidth(parentWidths.mobile),
			tablet: frameForWidth(parentWidths.tablet),
			desktop: frameForWidth(parentWidths.desktop),
		},
	};

	if (node.type === 'frame') {
		node.nodes = [];
	}
	if (node.type === 'shape') {
		node.nodes = [];
	}
	if (node.type === 'shadcn') {
		const meta = shadcnComponentMeta((node.data.component || '').trim());
		if (meta?.canWrapChildren) node.nodes = [];
	}

	return node;
}

function buttonToPrimitiveTree(node: Extract<PageNode, { type: 'button' }>): PageNode {
	const variant = node.data.variant ?? 'default';
	const href = typeof node.data.href === 'string' && node.data.href.trim() ? node.data.href.trim() : undefined;

	let fill: string | undefined;
	let stroke: string | undefined;
	let strokeWidth: number | undefined;
	let labelClassName = 'h-full w-full flex items-center justify-center text-xs font-medium';

	if (variant === 'default') {
		fill = 'hsl(var(--primary))';
		labelClassName += ' text-primary-foreground';
	} else if (variant === 'secondary') {
		fill = 'hsl(var(--secondary))';
		labelClassName += ' text-secondary-foreground';
	} else if (variant === 'destructive') {
		fill = 'hsl(var(--destructive))';
		labelClassName += ' text-destructive-foreground';
	} else if (variant === 'outline') {
		fill = 'transparent';
		stroke = 'hsl(var(--border))';
		strokeWidth = 1;
		labelClassName += ' text-foreground';
	} else if (variant === 'ghost') {
		fill = 'transparent';
		labelClassName += ' text-foreground';
	} else if (variant === 'link') {
		fill = 'transparent';
		labelClassName += ' text-primary underline underline-offset-4';
	}

	const labelId = createId('node');
	const labelNode: PageNode = {
		id: labelId,
		type: 'text',
		meta: { name: 'Label' },
		data: {
			text: node.data.label || 'Button',
			variant: 'small',
			className: labelClassName,
		},
		frames: {
			mobile: { x: 0, y: 0, w: node.frames.mobile.w, h: node.frames.mobile.h },
			tablet: { x: 0, y: 0, w: node.frames.tablet.w, h: node.frames.tablet.h },
			desktop: { x: 0, y: 0, w: node.frames.desktop.w, h: node.frames.desktop.h },
		},
	};

	const meta = node.meta ?? {};
	const nextMeta = meta.name?.trim()
		? meta
		: {
				...meta,
				name: node.data.label?.trim() ? `Button/${node.data.label.trim()}` : 'Button',
			};

	return {
		id: node.id,
		type: 'shape',
		meta: nextMeta,
		data: {
			kind: 'rect',
			fill,
			stroke,
			strokeWidth,
			radiusPx: 12,
			href,
		},
		frames: node.frames,
		nodes: [labelNode],
	};
}

function cardToPrimitiveTree(node: Extract<PageNode, { type: 'card' }>): PageNode {
	const titleText = (node.data.title ?? 'Card title').trim();
	const bodyText = (node.data.body ?? 'Card body…').trim();

	const paddingX = 18;
	const paddingY = 16;
	const titleH = 36;
	const gap = 10;

	function inner(bp: BuilderBreakpoint) {
		const f = node.frames[bp];
		const innerW = Math.max(1, f.w - paddingX * 2);
		const bodyY = paddingY + titleH + gap;
		const bodyH = Math.max(32, f.h - bodyY - paddingY);
		return {
			title: { x: paddingX, y: paddingY, w: innerW, h: titleH },
			body: { x: paddingX, y: bodyY, w: innerW, h: bodyH },
		};
	}

	const titleId = createId('node');
	const bodyId = createId('node');
	const titleNode: PageNode = {
		id: titleId,
		type: 'text',
		meta: { name: 'Title' },
		data: {
			text: titleText,
			variant: 'h3',
			className: 'h-full w-full flex items-center font-semibold leading-tight',
		},
		frames: {
			mobile: inner('mobile').title,
			tablet: inner('tablet').title,
			desktop: inner('desktop').title,
		},
	};

	const bodyNode: PageNode = {
		id: bodyId,
		type: 'text',
		meta: { name: 'Body' },
		data: {
			text: bodyText,
			variant: 'p',
			className: 'h-full w-full text-sm leading-relaxed text-muted-foreground',
		},
		frames: {
			mobile: inner('mobile').body,
			tablet: inner('tablet').body,
			desktop: inner('desktop').body,
		},
	};

	const meta = node.meta ?? {};
	const nextMeta = meta.name?.trim()
		? meta
		: {
				...meta,
				name: titleText ? `Card/${titleText}` : 'Card',
			};

	return {
		id: node.id,
		type: 'shape',
		meta: nextMeta,
		data: {
			kind: 'rect',
			fill: 'hsl(var(--card))',
			stroke: 'hsl(var(--border))',
			strokeWidth: 1,
			radiusPx: 14,
		},
		frames: node.frames,
		nodes: [titleNode, bodyNode],
	};
}

function canConvertShadcnToPrimitives(node: Extract<PageNode, { type: 'shadcn' }>): boolean {
	const componentId = (node.data.component || '').trim().toLowerCase();
	if (!componentId) return false;
	if (Array.isArray(node.nodes) && node.nodes.length > 0) return false;
	if (Array.isArray(node.children) && node.children.length > 0) return false;
	return (
		componentId === 'button' ||
		componentId === 'card' ||
		componentId === 'badge' ||
		componentId === 'separator' ||
		componentId === 'typography'
	);
}

function shadcnToPrimitiveTree(node: Extract<PageNode, { type: 'shadcn' }>): PageNode | null {
	const componentId = (node.data.component || '').trim().toLowerCase();
	if (!componentId) return null;
	if (!canConvertShadcnToPrimitives(node)) return null;

	const props = isRecord(node.data.props) ? (node.data.props as Record<string, unknown>) : {};

	if (componentId === 'separator') {
		const meta = node.meta ?? {};
		const nextMeta = meta.name?.trim() ? meta : { ...meta, name: 'Separator' };
		return {
			id: node.id,
			type: 'shape',
			meta: nextMeta,
			data: {
				kind: 'line',
				stroke: 'hsl(var(--border))',
				strokeWidth: 2,
			},
			frames: node.frames,
			nodes: [],
		};
	}

	if (componentId === 'typography') {
		const meta = node.meta ?? {};
		const nextMeta = meta.name?.trim() ? meta : { ...meta, name: 'Text' };
		return {
			id: node.id,
			type: 'text',
			meta: nextMeta,
			data: {
				text: typeof props['text'] === 'string' ? String(props['text']) : 'Text',
				variant: 'p',
			},
			frames: node.frames,
		};
	}

	if (componentId === 'badge') {
		const labelId = createId('node');
		const labelNode: PageNode = {
			id: labelId,
			type: 'text',
			meta: { name: 'Label' },
			data: {
				text: typeof props['label'] === 'string' ? String(props['label']) : 'Badge',
				variant: 'small',
				className: 'h-full w-full flex items-center justify-center text-xs font-medium text-secondary-foreground',
			},
			frames: {
				mobile: { x: 0, y: 0, w: node.frames.mobile.w, h: node.frames.mobile.h },
				tablet: { x: 0, y: 0, w: node.frames.tablet.w, h: node.frames.tablet.h },
				desktop: { x: 0, y: 0, w: node.frames.desktop.w, h: node.frames.desktop.h },
			},
		};

		const meta = node.meta ?? {};
		const nextMeta = meta.name?.trim() ? meta : { ...meta, name: 'Badge' };
		return {
			id: node.id,
			type: 'shape',
			meta: nextMeta,
			data: {
				kind: 'rect',
				fill: 'hsl(var(--secondary))',
				radiusPx: 999,
			},
			frames: node.frames,
			nodes: [labelNode],
		};
	}

	if (componentId === 'button') {
		const rawVariant = typeof props['variant'] === 'string' ? String(props['variant']).trim() : '';
		const variant =
			rawVariant === 'secondary' ||
			rawVariant === 'outline' ||
			rawVariant === 'destructive' ||
			rawVariant === 'ghost' ||
			rawVariant === 'link' ||
			rawVariant === 'default'
				? (rawVariant as 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link')
				: undefined;

		const buttonNode: PageNode = {
			id: node.id,
			type: 'button',
			meta: node.meta,
			data: {
				label: typeof props['label'] === 'string' ? String(props['label']) : 'Button',
				href: typeof props['href'] === 'string' ? String(props['href']) : undefined,
				variant,
			},
			frames: node.frames,
		};

		return buttonToPrimitiveTree(buttonNode);
	}

	if (componentId === 'card') {
		const cardNode: PageNode = {
			id: node.id,
			type: 'card',
			meta: node.meta,
			data: {
				title: typeof props['title'] === 'string' ? String(props['title']) : 'Card title',
				body: typeof props['body'] === 'string' ? String(props['body']) : 'Card body…',
			},
			frames: node.frames,
		};
		return cardToPrimitiveTree(cardNode);
	}

	return null;
}

function ResizeHandleButton({
	handle,
	onPointerDown,
}: {
	handle: ResizeHandle;
	onPointerDown: (handle: ResizeHandle, e: React.PointerEvent) => void;
}) {
	const base = 'absolute z-20 h-2.5 w-2.5 rounded-full border bg-background shadow-sm';
	const positions: Record<ResizeHandle, string> = {
		n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
		s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
		e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
		w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
		ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
		nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
		se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
		sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
	};

	return (
		<div
			role='button'
			tabIndex={0}
			className={cn(base, positions[handle])}
			onPointerDown={(e) => onPointerDown(handle, e)}
		/>
	);
}

function CanvasNode({
	node,
	breakpoint,
	selectedId,
	selectedIds,
	draggingId,
	dragPreviewDelta,
	disabled,
	interactionsEnabled,
	lockedIds,
	editRootId,
	ancestorLocked = false,
	ancestorHidden = false,
	onSelect,
	onUpdateNode,
	onStartResize,
}: {
	node: PageNode;
	breakpoint: BuilderBreakpoint;
	selectedId: string | null;
	selectedIds: Set<string>;
	draggingId: string | null;
	dragPreviewDelta: DragDelta | null;
	disabled: boolean;
	interactionsEnabled: boolean;
	lockedIds: Set<string>;
	editRootId: string | null;
	ancestorLocked?: boolean;
	ancestorHidden?: boolean;
	onSelect: (id: string, e: SelectModifierEvent) => void;
	onUpdateNode: (id: string, updater: (n: PageNode) => PageNode) => void;
	onStartResize: (nodeId: string, handle: ResizeHandle, e: React.PointerEvent) => void;
}) {
	const isSelected = selectedIds.has(node.id);
	const isPrimarySelected = selectedId === node.id;
	const selfHidden = node.meta?.hidden === true;
	const templateLocked = lockedIds.has(node.id);
	const hidden = ancestorHidden || selfHidden;
	const locked = ancestorLocked || templateLocked;
	const isEditRoot = !!editRootId && node.id === editRootId;
	const dragId = `${NODE_PREFIX}${node.id}`;

	const canContain = Array.isArray(node.nodes);
	const isFrame = node.type === 'frame';
	const droppableId = `${CONTAINER_PREFIX}${node.id}`;
	const { setNodeRef: setDroppableRef, isOver } = useDroppable({
		id: droppableId,
		disabled: disabled || hidden || !canContain,
	});

	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: dragId,
		disabled: disabled || locked || !interactionsEnabled,
	});

	if (hidden && !isSelected) return null;
	const f = node.frames[breakpoint];

	const isActiveDrag = isDragging && draggingId === node.id;
	const dragTransform =
		isActiveDrag && dragPreviewDelta
			? `translate3d(${Math.round(dragPreviewDelta.x)}px, ${Math.round(dragPreviewDelta.y)}px, 0)`
			: transform
				? CSS.Translate.toString(transform)
				: undefined;
	const zIndexRaw = typeof f.z === 'number' && Number.isFinite(f.z) ? Math.round(f.z) : 1;
	const zIndex = Math.max(1, zIndexRaw);
	const visualZIndex = isActiveDrag ? 9999 : zIndex;

	const style: CSSProperties = {
		position: 'absolute',
		left: Math.round(f.x),
		top: Math.round(f.y),
		width: Math.max(0, Math.round(f.w)),
		height: Math.max(0, Math.round(f.h)),
		transform: dragTransform,
		zIndex: visualZIndex,
	};

	const containerStyle: CSSProperties | undefined = canContain
		? {
				backgroundImage: GRID_BACKGROUND_IMAGE,
				backgroundSize: GRID_BACKGROUND_SIZE,
				backgroundPosition: GRID_BACKGROUND_POSITION,
			}
		: undefined;

	const frameLayout = isFrame ? node.data.layout : undefined;
	const frameProps = isFrame && isRecord(node.data.props) ? (node.data.props as Record<string, unknown>) : null;
	const clipContents = isFrame && node.data.clip === true;
	const showOverflowWhileDragging = !!draggingId;
	const containerOverflowClass = showOverflowWhileDragging
		? 'overflow-visible'
		: canContain
			? 'overflow-visible'
		: isFrame
			? clipContents
				? 'overflow-hidden'
				: 'overflow-visible'
			: 'overflow-hidden';

	let containerHint: ReactNode = null;
	if (isFrame && frameLayout === 'container') {
		const sizeRaw = frameProps && typeof frameProps['size'] === 'string' ? frameProps['size'] : '4';
		const alignRaw = frameProps && typeof frameProps['align'] === 'string' ? frameProps['align'] : 'center';
		const maxW = RADIX_CONTAINER_MAX_WIDTH_PX[String(sizeRaw).trim()] ?? RADIX_CONTAINER_MAX_WIDTH_PX['4'];
		const innerW = Math.max(1, Math.min(Math.round(f.w), Math.round(maxW)));
		const left =
			String(alignRaw).trim() === 'left'
				? 0
				: String(alignRaw).trim() === 'right'
					? Math.max(0, Math.round(f.w - innerW))
					: Math.max(0, Math.round((f.w - innerW) / 2));
		containerHint = (
			<div className='pointer-events-none absolute inset-0'>
				<div
					className='absolute inset-y-2 rounded-md border border-dashed border-muted-foreground/30'
					style={{ left, width: innerW }}
				/>
			</div>
		);
	} else if (isFrame && frameLayout === 'section') {
		const sizeRaw = frameProps && typeof frameProps['size'] === 'string' ? frameProps['size'] : '2';
		const padY = RADIX_SECTION_PADDING_Y_PX[String(sizeRaw).trim()] ?? RADIX_SECTION_PADDING_Y_PX['2'];
		const top = Math.max(0, Math.round(padY));
		const bottom = Math.max(0, Math.round(f.h - padY));
		containerHint = (
			<div className='pointer-events-none absolute inset-0'>
				<div className='absolute left-0 right-0 top-0 h-px bg-muted-foreground/20' />
				<div className='absolute left-0 right-0 h-px bg-muted-foreground/20' style={{ top }} />
				<div className='absolute left-0 right-0 h-px bg-muted-foreground/20' style={{ top: bottom }} />
				<div className='absolute left-0 right-0 bottom-0 h-px bg-muted-foreground/20' />
			</div>
		);
	} else if (isFrame && frameLayout === 'grid') {
		const colsRaw = frameProps && typeof frameProps['columns'] === 'string' ? frameProps['columns'] : '';
		const rowsRaw = frameProps && typeof frameProps['rows'] === 'string' ? frameProps['rows'] : '';
		const cols = colsRaw ? Number.parseInt(colsRaw, 10) : NaN;
		const rows = rowsRaw ? Number.parseInt(rowsRaw, 10) : NaN;
		const colLines =
			Number.isFinite(cols) && cols > 1
				? Array.from({ length: cols - 1 }, (_, i) => {
						const left = Math.round((f.w / cols) * (i + 1));
						return (
							<div
								key={`col-${i}`}
								className='absolute top-0 bottom-0 w-px bg-muted-foreground/15'
								style={{ left }}
							/>
						);
					})
				: null;
		const rowLines =
			Number.isFinite(rows) && rows > 1
				? Array.from({ length: rows - 1 }, (_, i) => {
						const top = Math.round((f.h / rows) * (i + 1));
						return (
							<div
								key={`row-${i}`}
								className='absolute left-0 right-0 h-px bg-muted-foreground/15'
								style={{ top }}
							/>
						);
					})
				: null;
		if (colLines || rowLines) {
			containerHint = (
				<div className='pointer-events-none absolute inset-0'>
					{colLines}
					{rowLines}
				</div>
			);
		}
	}

	const childNodes = canContain
		? node.nodes!.map((child) => (
				<CanvasNode
					key={child.id}
					node={child}
					breakpoint={breakpoint}
					selectedId={selectedId}
					selectedIds={selectedIds}
					draggingId={draggingId}
					dragPreviewDelta={dragPreviewDelta}
					disabled={disabled}
					interactionsEnabled={interactionsEnabled}
					lockedIds={lockedIds}
					editRootId={editRootId}
					ancestorLocked={isEditRoot ? false : locked}
					ancestorHidden={hidden}
					onSelect={onSelect}
					onUpdateNode={onUpdateNode}
					onStartResize={onStartResize}
				/>
			))
		: null;

	const nodeContent = hidden ? (
		<div className='flex h-full w-full items-center justify-center gap-2 text-xs text-muted-foreground'>
			<EyeOff className='h-4 w-4' />
			Hidden
		</div>
	) : isFrame && canContain ? (
		renderFrameLayoutHost(node, (
			<>
				{node.nodes?.length === 0 ? (
					<Empty
						className='h-full w-full border-0 bg-transparent md:p-8'
						aria-hidden='true'>
						<EmptyHeader>
							<EmptyMedia variant='icon'>
								<LayoutGrid />
							</EmptyMedia>
							<EmptyTitle>
								{node.data.label?.trim()
									? node.data.label.trim()
									: node.data.layout
										? `Empty ${node.data.layout}`
										: 'Empty row'}
							</EmptyTitle>
							<EmptyDescription>
								Drop components here, or select the row and click “Component”.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : null}
				{childNodes}
			</>
		))
	) : (
		<>
			<div
				className={cn(
					'absolute inset-0 overflow-auto',
					interactionsEnabled &&
						(node.type !== 'editor' || !isPrimarySelected) &&
						'pointer-events-none'
				)}>
				{node.type === 'editor' ? (
					<EditorBlock
						value={node.data}
						onChange={(v) => onUpdateNode(node.id, (n) => ({ ...n, type: 'editor', data: v }))}
						disabled={disabled}
					/>
				) : (
					renderBlockPreview(node)
				)}
			</div>

			{canContain ? <div className='absolute inset-0'>{childNodes}</div> : null}
		</>
	);

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			onPointerDown={(e) => {
				if (!interactionsEnabled) return;
				e.stopPropagation();
				onSelect(node.id, e);

				if (disabled || locked) return;
				if (isTypingTarget(e.target as Element | null)) return;
				const fn = (listeners as unknown as { onPointerDown?: (event: React.PointerEvent) => void } | undefined)
					?.onPointerDown;
				if (typeof fn === 'function') fn(e);
			}}
			className={cn('group/node', isSelected ? 'ring-2 ring-ring ring-offset-2' : 'ring-0')}>
			<div
				ref={setDroppableRef}
				style={containerStyle}
				className={cn(
					'relative h-full w-full rounded-md border',
					containerOverflowClass,
					isFrame ? 'border-dashed bg-background/40 shadow-none' : 'bg-background/70 shadow-sm',
					canContain && 'bg-muted/10',
					isOver && draggingId && draggingId !== node.id && 'ring-2 ring-primary',
					isDragging && 'ring-2 ring-ring'
				)}>
				{interactionsEnabled ? (
					<div className='pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1 opacity-0 transition-opacity group-hover/node:opacity-100 group-focus-within/node:opacity-100'>
						<span className='rounded-md border bg-background/95 px-2 py-1 text-[10px] text-muted-foreground shadow'>
							{node.type === 'frame'
								? node.data.label || node.data.layout || 'frame'
								: node.type === 'menu'
									? `menu/${node.data.kind || 'top'}:${node.data.menu}`
									: node.type === 'slot'
										? `slot/${node.data.name || 'page'}`
										: node.type === 'shadcn'
											? `shadcn/${node.data.component || 'component'}`
											: node.type}
						</span>
					</div>
				) : null}

				{containerHint}

				<div className='absolute inset-0'>{nodeContent}</div>

				{isPrimarySelected && interactionsEnabled && !disabled && !locked ? (
					<>
						<ResizeHandleButton handle='n' onPointerDown={(h, e) => onStartResize(node.id, h, e)} />
						<ResizeHandleButton handle='s' onPointerDown={(h, e) => onStartResize(node.id, h, e)} />
						<ResizeHandleButton handle='e' onPointerDown={(h, e) => onStartResize(node.id, h, e)} />
						<ResizeHandleButton handle='w' onPointerDown={(h, e) => onStartResize(node.id, h, e)} />
						<ResizeHandleButton handle='ne' onPointerDown={(h, e) => onStartResize(node.id, h, e)} />
						<ResizeHandleButton handle='nw' onPointerDown={(h, e) => onStartResize(node.id, h, e)} />
						<ResizeHandleButton handle='se' onPointerDown={(h, e) => onStartResize(node.id, h, e)} />
						<ResizeHandleButton handle='sw' onPointerDown={(h, e) => onStartResize(node.id, h, e)} />
					</>
				) : null}
			</div>
		</div>
	);
}

function CanvasRootDroppable({
	disabled,
	draggingId,
	onRootEl,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
	className,
	style,
	children,
}: {
	disabled: boolean;
	draggingId: string | null;
	onRootEl: (el: HTMLDivElement | null) => void;
	onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
	onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
	onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
	onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void;
	className?: string;
	style?: CSSProperties;
	children: ReactNode;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: ROOT_DROPPABLE_ID,
		disabled,
	});

	const setRef = useCallback(
		(el: HTMLDivElement | null) => {
			onRootEl(el);
			setNodeRef(el);
		},
		[onRootEl, setNodeRef]
	);

	return (
		<div
			ref={setRef}
			className={cn(className, isOver && draggingId ? 'ring-2 ring-primary' : null)}
			style={style}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}>
			{children}
		</div>
	);
}

function PreviewNode({
	node,
	breakpoint,
	selectedIds,
	lockedIds,
	ancestorLocked = false,
	ancestorHidden = false,
}: {
	node: PageNode;
	breakpoint: BuilderBreakpoint;
	selectedIds: Set<string>;
	lockedIds: Set<string>;
	ancestorLocked?: boolean;
	ancestorHidden?: boolean;
}) {
	const isSelected = selectedIds.has(node.id);
	const selfHidden = node.meta?.hidden === true;
	const templateLocked = lockedIds.has(node.id);
	const hidden = ancestorHidden || selfHidden;
	const locked = ancestorLocked || templateLocked;
	if (hidden && !isSelected) return null;

	const f = node.frames[breakpoint];
	const zIndexRaw = typeof f.z === 'number' && Number.isFinite(f.z) ? Math.round(f.z) : 1;
	const zIndex = Math.max(1, zIndexRaw);

	const style: CSSProperties = {
		position: 'absolute',
		left: Math.round(f.x),
		top: Math.round(f.y),
		width: Math.max(0, Math.round(f.w)),
		height: Math.max(0, Math.round(f.h)),
		zIndex,
	};

	const canContain = Array.isArray(node.nodes);
	const isFrame = node.type === 'frame';

	const childNodes = canContain
		? node.nodes!.map((child) => (
				<PreviewNode
					key={child.id}
					node={child}
					breakpoint={breakpoint}
					selectedIds={selectedIds}
					lockedIds={lockedIds}
					ancestorLocked={locked}
					ancestorHidden={hidden}
				/>
			))
		: null;

	const nodeContent = hidden ? (
		<div className='flex h-full w-full items-center justify-center gap-2 text-xs text-muted-foreground'>
			<EyeOff className='h-4 w-4' />
			Hidden
		</div>
	) : isFrame && canContain ? (
		renderFrameLayoutHost(node, <>{childNodes}</>)
	) : (
		<>
			<div className='absolute inset-0 overflow-auto'>{renderBlockPreview(node)}</div>
			{canContain ? <div className='absolute inset-0'>{childNodes}</div> : null}
		</>
	);

	return (
		<div
			style={style}
			className={cn('group/node', isSelected ? 'ring-2 ring-ring ring-offset-2' : 'ring-0')}>
			<div
				className={cn(
					'relative h-full w-full rounded-md border',
					isFrame ? 'border-dashed bg-background/40 shadow-none' : 'bg-background/70 shadow-sm',
					canContain && 'bg-muted/10',
					locked && 'opacity-90'
				)}>
				<div className='absolute inset-0'>{nodeContent}</div>
			</div>
		</div>
	);
}

function CanvasFramePreview({
	nodes,
	breakpoint,
	height,
	width,
	selectedIds,
	lockedIds,
	showGridOverlay,
	className,
}: {
	nodes: PageNode[];
	breakpoint: BuilderBreakpoint;
	height: number;
	width: number;
	selectedIds: Set<string>;
	lockedIds: Set<string>;
	showGridOverlay: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn('relative rounded-md bg-background', className)}
			style={{ width, height }}>
			{showGridOverlay ? (
				<div
					className='pointer-events-none absolute inset-0 z-0'
					style={{
						backgroundImage: GRID_BACKGROUND_IMAGE,
						backgroundSize: GRID_BACKGROUND_SIZE,
						backgroundPosition: GRID_BACKGROUND_POSITION,
					}}
				/>
			) : null}
			{nodes.map((n) => (
				<PreviewNode
					key={n.id}
					node={n}
					breakpoint={breakpoint}
					selectedIds={selectedIds}
					lockedIds={lockedIds}
				/>
			))}
		</div>
	);
}

export function PageBuilder({
	value,
	onChange,
	disabled,
	lockedNodeIds,
	editRootId,
	fullHeight = true,
	className,
}: {
	value: PageBuilderState;
	onChange: (next: PageBuilderState) => void;
	disabled?: boolean;
	lockedNodeIds?: Iterable<string>;
	editRootId?: string | null;
	fullHeight?: boolean;
	className?: string;
}) {
	const disabledFlag = !!disabled;
	const lockedIds = useMemo(() => {
		if (!lockedNodeIds) return new Set<string>();
		return new Set(Array.from(lockedNodeIds));
	}, [lockedNodeIds]);
	const effectiveEditRootId =
		typeof editRootId === 'string' && editRootId.trim() ? editRootId.trim() : null;
	const valueRef = useRef<PageBuilderState>(value);
	const [undoStack, setUndoStack] = useState<PageBuilderState[]>([]);
	const [redoStack, setRedoStack] = useState<PageBuilderState[]>([]);
	const applyingHistoryRef = useRef(false);
	const lastValueSnapshotRef = useRef(comparableJsonFromState(value));
	const previousValueRef = useRef<PageBuilderState>(value);
	useEffect(() => {
		valueRef.current = value;
	}, [value]);

	useEffect(() => {
		const snapshot = comparableJsonFromState(value);

		if (applyingHistoryRef.current) {
			applyingHistoryRef.current = false;
			previousValueRef.current = value;
			lastValueSnapshotRef.current = snapshot;
			return;
		}

		if (snapshot === lastValueSnapshotRef.current) {
			previousValueRef.current = value;
			return;
		}

		setUndoStack((prev) => {
			const next = [...prev, previousValueRef.current];
			if (next.length > HISTORY_LIMIT) {
				next.splice(0, next.length - HISTORY_LIMIT);
			}
			return next;
		});
		setRedoStack([]);
		previousValueRef.current = value;
		lastValueSnapshotRef.current = snapshot;
	}, [value]);

	const viewportRef = useRef<HTMLDivElement | null>(null);
	const rootElRef = useRef<HTMLDivElement | null>(null);
	const [rootClientWidth, setRootClientWidth] = useState<number | null>(null);
	const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
	const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

	const [breakpoint, setBreakpoint] = useState<BuilderBreakpoint>('desktop');
	const [zoom, setZoom] = useState(1);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const selectedId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [dragDelta, setDragDelta] = useState<DragDelta | null>(null);
	const [dragOverParentId, setDragOverParentId] = useState<string | null>(null);
	const [resizeState, setResizeState] = useState<ResizeState | null>(null);

	const [tool, setTool] = useState<BuilderTool>('select');
	const [frameToolLayout, setFrameToolLayout] = useState<FrameLayoutKind>('box');
	const [shapeToolKind, setShapeToolKind] = useState<ShapeKind>('rect');
	const [drawState, setDrawState] = useState<DrawState | null>(null);
	const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
	const [viewportMode, setViewportMode] = useState<CanvasViewportMode>('frames');
	const [showGridOverlay, setShowGridOverlay] = useState(true);

	const [blockPickerOpen, setBlockPickerOpen] = useState(false);
	const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
	const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
	const [mediaTargetId, setMediaTargetId] = useState<string | null>(null);
	const [outlineOpen, setOutlineOpen] = useState(false);
	const [inspectorOpen, setInspectorOpen] = useState(false);
	const [insertOpen, setInsertOpen] = useState(false);
	const [leftDockMode, setLeftDockMode] = useState<'outline' | 'insert'>('outline');
	const [insertTab, setInsertTab] = useState<'blocks' | 'libraries'>('blocks');
	const [showLeftDock, setShowLeftDock] = useState(true);
	const [showRightDock, setShowRightDock] = useState(true);
	const [focusMode, setFocusMode] = useState(false);
	const [detachingMenu, setDetachingMenu] = useState(false);
	const [detachMenuError, setDetachMenuError] = useState<string | null>(null);

	const zoomRef = useRef(zoom);
	const pendingZoomScrollRef = useRef<{ left: number; top: number } | null>(null);
	useEffect(() => {
		zoomRef.current = zoom;
	}, [zoom]);

	const [spaceDown, setSpaceDown] = useState(false);
	const [isPanning, setIsPanning] = useState(false);
	const spaceDownRef = useRef(false);
	const panRef = useRef<{
		active: boolean;
		startClientX: number;
		startClientY: number;
		startLeft: number;
		startTop: number;
		pointerId: number;
	}>({
		active: false,
		startClientX: 0,
		startClientY: 0,
		startLeft: 0,
		startTop: 0,
		pointerId: 0,
	});

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
	const index = useMemo(() => buildIndex(value.nodes, breakpoint), [value.nodes, breakpoint]);
	const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const selectedNode = selectedId ? index.byId.get(selectedId) ?? null : null;
	const selectedFrameProps =
		selectedNode?.type === 'frame' && isRecord(selectedNode.data.props)
			? (selectedNode.data.props as Record<string, unknown>)
			: {};

	const pendingFocusIdRef = useRef<string | null>(null);
	const requestFocus = useCallback(
		(nodeId: string) => {
			pendingFocusIdRef.current = nodeId;
			setSelectedIds([nodeId]);
		},
		[]
	);

	const selectNode = useCallback(
		(nodeId: string, e?: SelectModifierEvent) => {
			if (disabledFlag) return;

			const wantsToggle = !!e && (e.metaKey || e.ctrlKey);
			const wantsAdditive = !!e && e.shiftKey;

			setSelectedIds((prev) => {
				if (!wantsToggle && !wantsAdditive) return [nodeId];

				const isSelected = prev.includes(nodeId);

				if (wantsToggle) {
					if (isSelected) return prev.filter((id) => id !== nodeId);
					return [...prev, nodeId];
				}

				// Shift: additive (keeps selection) and makes `nodeId` primary.
				if (isSelected) {
					const next = prev.filter((id) => id !== nodeId);
					next.push(nodeId);
					return next;
				}
				return [...prev, nodeId];
			});
		},
		[disabledFlag]
	);

	const canUndo = undoStack.length > 0;
	const canRedo = redoStack.length > 0;

	const undo = useCallback(() => {
		if (disabledFlag) return;
		if (!undoStack.length) return;
		const previous = undoStack[undoStack.length - 1];
		if (!previous) return;

		setUndoStack((prev) => prev.slice(0, -1));
		setRedoStack((prev) => {
			const next = [valueRef.current, ...prev];
			if (next.length > HISTORY_LIMIT) next.splice(HISTORY_LIMIT);
			return next;
		});
		applyingHistoryRef.current = true;
		onChange(previous);
		setSelectedIds([]);
	}, [disabledFlag, onChange, undoStack]);

	const redo = useCallback(() => {
		if (disabledFlag) return;
		if (!redoStack.length) return;
		const nextState = redoStack[0];
		if (!nextState) return;

		setRedoStack((prev) => prev.slice(1));
		setUndoStack((prev) => {
			const next = [...prev, valueRef.current];
			if (next.length > HISTORY_LIMIT) {
				next.splice(0, next.length - HISTORY_LIMIT);
			}
			return next;
		});
		applyingHistoryRef.current = true;
		onChange(nextState);
		setSelectedIds([]);
	}, [disabledFlag, onChange, redoStack]);
	const rootHeight = useMemo(() => {
		const desktop = Math.max(value.canvas.minHeightPx, computeBottom(value.nodes, 'desktop') + 80);
		const tablet = Math.max(value.canvas.minHeightPx, computeBottom(value.nodes, 'tablet') + 80);
		const mobile = Math.max(value.canvas.minHeightPx, computeBottom(value.nodes, 'mobile') + 80);

		if (viewportMode === 'frames') return Math.max(desktop, tablet, mobile);
		return breakpoint === 'mobile' ? mobile : breakpoint === 'tablet' ? tablet : desktop;
	}, [value.nodes, value.canvas.minHeightPx, breakpoint, viewportMode]);

	const setRootRef = useCallback((el: HTMLDivElement | null) => {
		rootElRef.current = el;
	}, []);

	const dragDeltaRafRef = useRef<number | null>(null);
	const dragDeltaRef = useRef<DragDelta>({ x: 0, y: 0 });

	useEffect(() => {
		const el = rootElRef.current;
		if (!el) return;

		const update = () => {
			const zoomValue = zoomRef.current || 1;
			const w = Math.round(el.getBoundingClientRect().width / zoomValue);
			setRootClientWidth(Number.isFinite(w) && w > 0 ? w : null);
		};

		update();

		if (typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => update());
		ro.observe(el);
		return () => ro.disconnect();
	}, [breakpoint, zoom]);

	useEffect(() => {
		const el = viewportRef.current;
		if (!el) return;

		let raf = 0;
		const updateScroll = () => {
			if (raf) return;
			raf = window.requestAnimationFrame(() => {
				raf = 0;
				setViewportScroll({ left: el.scrollLeft, top: el.scrollTop });
			});
		};

		const updateSize = () => {
			setViewportSize({ width: el.clientWidth, height: el.clientHeight });
		};

		updateScroll();
		updateSize();

		el.addEventListener('scroll', updateScroll, { passive: true });

		if (typeof ResizeObserver !== 'undefined') {
			const ro = new ResizeObserver(() => updateSize());
			ro.observe(el);
			return () => {
				el.removeEventListener('scroll', updateScroll);
				ro.disconnect();
				if (raf) window.cancelAnimationFrame(raf);
			};
		}

		return () => {
			el.removeEventListener('scroll', updateScroll);
			if (raf) window.cancelAnimationFrame(raf);
		};
	}, []);

	function setZoomAtClientPoint(nextZoom: number, clientX: number, clientY: number) {
		const el = viewportRef.current;
		const next = clampZoom(nextZoom);
		if (!el) {
			setZoom(next);
			return;
		}

		const rect = el.getBoundingClientRect();
		const vx = clientX - rect.left;
		const vy = clientY - rect.top;
		const current = zoomRef.current || 1;
		const canvasX = (el.scrollLeft + vx - RULER_SIZE_PX) / current;
		const canvasY = (el.scrollTop + vy - RULER_SIZE_PX) / current;

		const nextLeft = canvasX * next + RULER_SIZE_PX - vx;
		const nextTop = canvasY * next + RULER_SIZE_PX - vy;

		pendingZoomScrollRef.current = { left: Math.max(0, nextLeft), top: Math.max(0, nextTop) };
		setZoom(next);
	}

	function setZoomCentered(nextZoom: number) {
		const el = viewportRef.current;
		const next = clampZoom(nextZoom);
		if (!el) {
			setZoom(next);
			return;
		}

		const rect = el.getBoundingClientRect();
		const canvasCenterX = RULER_SIZE_PX + (el.clientWidth - RULER_SIZE_PX) / 2;
		const canvasCenterY = RULER_SIZE_PX + (el.clientHeight - RULER_SIZE_PX) / 2;
		setZoomAtClientPoint(next, rect.left + canvasCenterX, rect.top + canvasCenterY);
	}

	useEffect(() => {
		const el = viewportRef.current;
		if (!el) return;

		const onWheel = (e: WheelEvent) => {
			const wantsZoom = e.ctrlKey || e.metaKey;
			if (!wantsZoom) return;
			e.preventDefault();

			const direction = e.deltaY > 0 ? -1 : 1;
			const factor = direction > 0 ? 1.08 : 0.92;
			const current = zoomRef.current || 1;
			setZoomAtClientPoint(current * factor, e.clientX, e.clientY);
		};

		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, []);

	useEffect(() => {
		const pending = pendingZoomScrollRef.current;
		if (!pending) return;
		const el = viewportRef.current;
		if (!el) return;
		el.scrollTo(pending);
		pendingZoomScrollRef.current = null;
	}, [zoom]);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.code !== 'Space') return;
			if (isTypingTarget(document.activeElement)) return;
			spaceDownRef.current = true;
			setSpaceDown(true);
			e.preventDefault();
		}

		function onKeyUp(e: KeyboardEvent) {
			if (e.code !== 'Space') return;
			spaceDownRef.current = false;
			setSpaceDown(false);
		}

		function onBlur() {
			spaceDownRef.current = false;
			setSpaceDown(false);
			setIsPanning(false);
			panRef.current.active = false;
		}

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
		};
	}, []);

	const onViewportPointerDownCapture = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (disabledFlag) return;
			if (!spaceDownRef.current) return;
			if (e.button !== 0) return;

			const el = viewportRef.current;
			if (!el) return;

			panRef.current = {
				active: true,
				startClientX: e.clientX,
				startClientY: e.clientY,
				startLeft: el.scrollLeft,
				startTop: el.scrollTop,
				pointerId: e.pointerId,
			};
			setIsPanning(true);
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			e.preventDefault();
			e.stopPropagation();
		},
		[disabledFlag]
	);

	const onViewportPointerMoveCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		const el = viewportRef.current;
		if (!el) return;
		if (!panRef.current.active) return;
		if (!spaceDownRef.current) return;
		if (panRef.current.pointerId !== e.pointerId) return;

		const dx = e.clientX - panRef.current.startClientX;
		const dy = e.clientY - panRef.current.startClientY;
		el.scrollLeft = panRef.current.startLeft - dx;
		el.scrollTop = panRef.current.startTop - dy;
		e.preventDefault();
	}, []);

	const onViewportPointerUpCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		if (!panRef.current.active) return;
		if (panRef.current.pointerId !== e.pointerId) return;
		panRef.current.active = false;
		setIsPanning(false);
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
	}, []);

	const frameBoard = useMemo(() => {
		const gap = 96;
		const widths = value.canvas.widths;
		const order: BuilderBreakpoint[] = ['desktop', 'tablet', 'mobile'];

		const offsets: Record<BuilderBreakpoint, number> = {
			desktop: 0,
			tablet: widths.desktop + gap,
			mobile: widths.desktop + gap + widths.tablet + gap,
		};

		return {
			order,
			gap,
			widths,
			offsets,
			totalWidth: widths.desktop + widths.tablet + widths.mobile + gap * 2,
			activeOffsetX: offsets[breakpoint],
		};
	}, [value.canvas.widths, breakpoint]);

	useEffect(() => {
		const nodeId = pendingFocusIdRef.current;
		if (!nodeId) return;

		const el = viewportRef.current;
		const node = index.byId.get(nodeId);
		const global = index.globalById.get(nodeId);

		if (!el || !node || !global) {
			pendingFocusIdRef.current = null;
			return;
		}

		const frame = node.frames[breakpoint];
		const viewportW = Math.max(1, el.clientWidth);
		const viewportH = Math.max(1, el.clientHeight);

		const zoomValue = zoomRef.current || 1;
		const offsetX = viewportMode === 'frames' ? frameBoard.activeOffsetX : 0;
		const targetLeft = Math.max(0, RULER_SIZE_PX + (offsetX + global.x + frame.w / 2) * zoomValue - viewportW / 2);
		const targetTop = Math.max(0, RULER_SIZE_PX + (global.y + frame.h / 2) * zoomValue - viewportH / 2);

		el.scrollTo({
			left: targetLeft,
			top: targetTop,
			behavior: 'smooth',
		});

		pendingFocusIdRef.current = null;
	}, [index, breakpoint, viewportMode, frameBoard.activeOffsetX]);

	const updateNode = useCallback(
		(nodeId: string, updater: (n: PageNode) => PageNode) => {
			if (disabledFlag) return;
			if (lockedIds.has(nodeId)) return;
			onChange({
				...valueRef.current,
				nodes: updateNodeInTree(valueRef.current.nodes, nodeId, updater),
			});
		},
		[disabledFlag, lockedIds, onChange]
	);

	const patchNodeMeta = useCallback(
		(nodeId: string, patch: Partial<NodeMeta>) => {
			updateNode(nodeId, (n) => {
				const prev = n.meta ?? {};
				const next: NodeMeta = { ...prev, ...patch };

				const cleaned: NodeMeta = {};
				const name = typeof next.name === 'string' ? next.name.trim() : '';
				if (name) cleaned.name = name;
				if (next.locked) cleaned.locked = true;
				if (next.hidden) cleaned.hidden = true;
				if (next.collapsed) cleaned.collapsed = true;

				return { ...n, meta: Object.keys(cleaned).length ? cleaned : undefined };
			});
		},
		[updateNode]
	);

	const updateFrame = useCallback(
		(nodeId: string, updater: (f: NodeFrame) => NodeFrame) => {
			updateNode(nodeId, (n) => ({
				...n,
				frames: {
					...n.frames,
					[breakpoint]: updater(n.frames[breakpoint]),
				},
			}));
		},
		[updateNode, breakpoint]
	);

	function onDragStart(event: DragStartEvent) {
		const id = parseNodeDragId(event.active?.id);
		if (!id) return;
		if (!selectedIdsSet.has(id)) setSelectedIds([id]);
		setDraggingId(id);
		setDragDelta({ x: 0, y: 0 });
		setDragOverParentId(index.parentById.get(id) ?? null);
		dragDeltaRef.current = { x: 0, y: 0 };
		if (dragDeltaRafRef.current) {
			window.cancelAnimationFrame(dragDeltaRafRef.current);
			dragDeltaRafRef.current = null;
		}
	}

	function onDragMove(event: DragMoveEvent) {
		const id = parseNodeDragId(event.active?.id);
		if (!id) return;

		const zoomValue = zoomRef.current || 1;
		const deltaX = (event.delta?.x ?? 0) / zoomValue;
		const deltaY = (event.delta?.y ?? 0) / zoomValue;
		if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;

		dragDeltaRef.current = { x: deltaX, y: deltaY };

		const overId = event.over?.id;
		const overNodeId = parseNodeDragId(overId);
		const rawNextParent =
			!overId || overId === ROOT_DROPPABLE_ID
				? null
				: parseContainerDropId(overId) ?? (overNodeId ? index.parentById.get(overNodeId) ?? null : null);
		const originalParent = index.parentById.get(id) ?? null;
		const nextParent = normalizeDropParentId({
			index,
			nodeId: id,
			candidateParentId: rawNextParent,
			originalParentId: originalParent,
			effectiveEditRootId,
		});

		setDragOverParentId(nextParent);

		if (dragDeltaRafRef.current) return;
		dragDeltaRafRef.current = window.requestAnimationFrame(() => {
			dragDeltaRafRef.current = null;
			setDragDelta(dragDeltaRef.current);
		});
	}

	function onDragCancel() {
		setDraggingId(null);
		setDragDelta(null);
		setDragOverParentId(null);
		if (dragDeltaRafRef.current) {
			window.cancelAnimationFrame(dragDeltaRafRef.current);
			dragDeltaRafRef.current = null;
		}
	}

	function onDragEnd(event: DragEndEvent) {
		const nodeId = parseNodeDragId(event.active?.id);
		const dragOverParentAtDrop = dragOverParentId;
		setDraggingId(null);
		setDragDelta(null);
		setDragOverParentId(null);
		if (dragDeltaRafRef.current) {
			window.cancelAnimationFrame(dragDeltaRafRef.current);
			dragDeltaRafRef.current = null;
		}

		if (!nodeId) return;

		const zoomValue = zoomRef.current || 1;
		const deltaX = (event.delta?.x ?? 0) / zoomValue;
		const deltaY = (event.delta?.y ?? 0) / zoomValue;
		if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;

		const current = valueRef.current;
		const idx = buildIndex(current.nodes, breakpoint);
		const startGlobal = idx.globalById.get(nodeId);
		if (!startGlobal) return;

		const originalParentId = idx.parentById.get(nodeId) ?? null;

		const overId = event.over?.id;
		const rawTargetContainer = parseContainerDropId(overId) ?? null;
		const targetIsRoot = overId === ROOT_DROPPABLE_ID || !overId;
		const rawTargetParentId = targetIsRoot ? null : rawTargetContainer ?? dragOverParentAtDrop ?? null;
		const normalizedTargetParentId = normalizeDropParentId({
			index: idx,
			nodeId,
			candidateParentId: rawTargetParentId,
			originalParentId,
			effectiveEditRootId,
		});

		const snap = current.canvas.snapPx;
		const computedRootHeight = Math.max(current.canvas.minHeightPx, computeBottom(current.nodes, breakpoint) + 80);

		const removedOut = removeNodeFromTree(current.nodes, nodeId);
		if (!removedOut.removed) return;

		const afterRemovalIndex = buildIndex(removedOut.nodes, breakpoint);
		const fallbackOriginalParentId =
			originalParentId && afterRemovalIndex.byId.has(originalParentId) ? originalParentId : null;
		const parentCandidates = uniqueParentCandidates([
			normalizedTargetParentId,
			fallbackOriginalParentId,
			null,
		]);

		let committedNodes: PageNode[] | null = null;
		let committedFrame: NodeFrame | null = null;
		let committedTargetGlobal: { x: number; y: number } | null = null;

		for (const parentCandidate of parentCandidates) {
			const targetParentId = normalizeDropParentId({
				index: afterRemovalIndex,
				nodeId,
				candidateParentId: parentCandidate,
				originalParentId: fallbackOriginalParentId,
				effectiveEditRootId,
			});
			if (targetParentId && !canContainChildren(afterRemovalIndex.byId.get(targetParentId))) continue;

			const targetGlobal = targetParentId
				? afterRemovalIndex.globalById.get(targetParentId) ?? { x: 0, y: 0 }
				: { x: 0, y: 0 };

			const assist = computeDragAssist({
				index: idx,
				nodeId,
				delta: { x: deltaX, y: deltaY },
				breakpoint,
				canvasWidth: current.canvas.widths[breakpoint],
				rootHeight: computedRootHeight,
				scopeParentId: targetParentId,
				thresholdPx: 6 / zoomValue,
			});

			const globalX = startGlobal.x + deltaX + (assist?.snapDx ?? 0);
			const globalY = startGlobal.y + deltaY + (assist?.snapDy ?? 0);
			const nextX = snapTo(globalX - targetGlobal.x, snap);
			const nextY = snapTo(globalY - targetGlobal.y, snap);

			const movedFrame = removedOut.removed.frames[breakpoint];
			const parentWidth = targetParentId
				? afterRemovalIndex.byId.get(targetParentId)?.frames[breakpoint].w ?? current.canvas.widths[breakpoint]
				: rootClientWidth ?? current.canvas.widths[breakpoint];
			const parentHeight = targetParentId
				? afterRemovalIndex.byId.get(targetParentId)?.frames[breakpoint].h ?? current.canvas.minHeightPx
				: Math.max(current.canvas.minHeightPx, computeBottom(removedOut.nodes, breakpoint) + 80);

			const maxX = Math.max(0, parentWidth - movedFrame.w);
			const clampedX = clamp(nextX, 0, maxX);
			const editRoot =
				effectiveEditRootId && afterRemovalIndex.byId.has(effectiveEditRootId)
					? effectiveEditRootId
					: null;
			const allowOverflowY = !!editRoot && targetParentId === editRoot;
			const clampedY =
				targetParentId && !allowOverflowY
					? clamp(nextY, 0, Math.max(0, parentHeight - movedFrame.h))
					: clamp(nextY, 0, Number.POSITIVE_INFINITY);

			const siblings = targetParentId
				? afterRemovalIndex.byId.get(targetParentId)?.nodes ?? []
				: removedOut.nodes;
			const maxSiblingZ = siblings.reduce((max, n) => {
				const zRaw = n.frames[breakpoint].z;
				const z = typeof zRaw === 'number' && Number.isFinite(zRaw) ? zRaw : 1;
				return Math.max(max, z);
			}, 1);
			const nextZ = Math.max(
				1,
				Math.round(
					Math.max(
						typeof movedFrame.z === 'number' && Number.isFinite(movedFrame.z) ? movedFrame.z : 1,
						maxSiblingZ + 1
					)
				)
			);

			const moved: PageNode = {
				...removedOut.removed,
				frames: {
					...removedOut.removed.frames,
					[breakpoint]: { ...removedOut.removed.frames[breakpoint], x: clampedX, y: clampedY, z: nextZ },
				},
			};

			const candidateNodes = insertNodeIntoTree(removedOut.nodes, targetParentId, moved);
			if (countNodeOccurrences(candidateNodes, nodeId) !== 1) continue;

			const candidateIndex = buildIndex(candidateNodes, breakpoint);
			if (!candidateIndex.byId.has(nodeId)) continue;
			if ((candidateIndex.parentById.get(nodeId) ?? null) !== targetParentId) continue;

			committedNodes = candidateNodes;
			committedFrame = moved.frames[breakpoint];
			committedTargetGlobal = targetGlobal;
			break;
		}

		if (!committedNodes || !committedFrame || !committedTargetGlobal) {
			return;
		}

		onChange({ ...current, nodes: committedNodes });

		// If a drop lands outside the current viewport (common when dragging while panning/zoomed),
		// auto-focus the moved node so it never feels like it "vanished".
		const viewport = viewportRef.current;
		if (viewport) {
			const zoomAtDrop = zoomRef.current || 1;
			const offsetX = viewportMode === 'frames' ? frameBoard.activeOffsetX : 0;
			const visibleX0 = (viewport.scrollLeft - RULER_SIZE_PX) / zoomAtDrop - offsetX;
			const visibleY0 = (viewport.scrollTop - RULER_SIZE_PX) / zoomAtDrop;
			const visibleX1 = visibleX0 + viewport.clientWidth / zoomAtDrop;
			const visibleY1 = visibleY0 + viewport.clientHeight / zoomAtDrop;

			const newGlobalX = committedTargetGlobal.x + committedFrame.x;
			const newGlobalY = committedTargetGlobal.y + committedFrame.y;
			const newGlobalX1 = newGlobalX + committedFrame.w;
			const newGlobalY1 = newGlobalY + committedFrame.h;

			const margin = 24;
			const outOfView =
				newGlobalX1 < visibleX0 + margin ||
				newGlobalX > visibleX1 - margin ||
				newGlobalY1 < visibleY0 + margin ||
				newGlobalY > visibleY1 - margin;

			if (outOfView) pendingFocusIdRef.current = nodeId;
		}
	}

	function startResize(nodeId: string, handle: ResizeHandle, e: React.PointerEvent) {
		if (disabledFlag) return;
		if (lockedIds.has(nodeId)) return;
		e.stopPropagation();
		e.preventDefault();

		const node = index.byId.get(nodeId);
		if (!node) return;

		const startFrame = node.frames[breakpoint];
		const parentId = index.parentById.get(nodeId) ?? null;
		const isRoot = parentId === null;
		const parent = parentId
			? getParentSize(valueRef.current, index, nodeId, breakpoint)
			: {
					width: rootClientWidth ?? valueRef.current.canvas.widths[breakpoint],
					height: rootHeight,
				};

		setResizeState({
			nodeId,
			handle,
			breakpoint,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startFrame,
			parentWidth: parent.width,
			parentHeight: parent.height,
			isRoot,
		});
	}

	useEffect(() => {
		if (!resizeState) return;
		const active = resizeState;

		function onMove(ev: PointerEvent) {
			const snap = valueRef.current.canvas.snapPx;
			const zoomValue = zoomRef.current || 1;
			const dx = (ev.clientX - active.startClientX) / zoomValue;
			const dy = (ev.clientY - active.startClientY) / zoomValue;

			const wantsN = active.handle.includes('n');
			const wantsS = active.handle.includes('s');
			const wantsW = active.handle.includes('w');
			const wantsE = active.handle.includes('e');

			const parentW = Math.max(0, active.parentWidth);
			const parentH = active.isRoot ? Number.POSITIVE_INFINITY : Math.max(0, active.parentHeight);

			const minW = Math.min(MIN_NODE_W, parentW > 0 ? parentW : MIN_NODE_W);
			const minH = Math.min(MIN_NODE_H, Number.isFinite(parentH) && parentH > 0 ? parentH : MIN_NODE_H);

			const startLeft = Math.max(0, active.startFrame.x);
			const startTop = Math.max(0, active.startFrame.y);
			const startRight = parentW > 0 ? Math.min(parentW, active.startFrame.x + active.startFrame.w) : active.startFrame.x + active.startFrame.w;
			const startBottom = Number.isFinite(parentH) ? Math.min(parentH, active.startFrame.y + active.startFrame.h) : active.startFrame.y + active.startFrame.h;

			let left = startLeft;
			let right = startRight;
			let top = startTop;
			let bottom = startBottom;

			if (wantsW) {
				const desired = snapTo(startLeft + dx, snap);
				left = clamp(desired, 0, Math.max(0, right - minW));
			} else if (wantsE) {
				const desired = snapTo(startRight + dx, snap);
				right = clamp(desired, left + minW, parentW);
			} else {
				const w = clampMin(active.startFrame.w, minW);
				left = clamp(active.startFrame.x, 0, Math.max(0, parentW - w));
				right = left + w;
			}

			if (wantsN) {
				const desired = snapTo(startTop + dy, snap);
				top = clamp(desired, 0, Math.max(0, bottom - minH));
			} else if (wantsS) {
				const desired = snapTo(startBottom + dy, snap);
				bottom = clamp(desired, top + minH, parentH);
			} else {
				const h = clampMin(active.startFrame.h, minH);
				top = Math.max(0, active.startFrame.y);
				bottom = top + h;
			}

			updateFrame(active.nodeId, () => ({
				...active.startFrame,
				x: snapTo(left, snap),
				y: snapTo(top, snap),
				w: clampMin(snapTo(right - left, snap), minW),
				h: clampMin(snapTo(bottom - top, snap), minH),
			}));
		}

		function onUp() {
			setResizeState(null);
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp, { once: true });
		return () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		};
	}, [resizeState, updateFrame]);

	const removeSelected = useCallback(() => {
		if (disabledFlag) return;
		if (!selectedIds.length) return;

		const current = valueRef.current;
		const idx = buildIndex(current.nodes, breakpoint);
		const targets = topLevelSelectedIds(selectedIds, idx).filter(
			(id) =>
				isWithinEditRoot(idx, id, effectiveEditRootId) &&
				!isLockedForEdit(idx, id, lockedIds, effectiveEditRootId)
		);
		if (!targets.length) return;

		let nodes = current.nodes;
		for (const id of targets) {
			const out = removeNodeFromTree(nodes, id);
			nodes = out.nodes;
		}

		onChange({ ...current, nodes });
		setSelectedIds([]);
	}, [breakpoint, disabledFlag, onChange, selectedIds, lockedIds, effectiveEditRootId]);

	const duplicateSelected = useCallback(() => {
		if (disabledFlag) return;
		if (!selectedIds.length) return;

		const current = valueRef.current;
		const idx = buildIndex(current.nodes, breakpoint);
		const targets = topLevelSelectedIds(selectedIds, idx).filter(
			(id) =>
				isWithinEditRoot(idx, id, effectiveEditRootId) &&
				!isLockedForEdit(idx, id, lockedIds, effectiveEditRootId)
		);
		if (!targets.length) return;

		let nodes = current.nodes;
		const clonedIds: string[] = [];

		for (const id of targets) {
			const node = idx.byId.get(id);
			if (!node) continue;
			const cloned = offsetNodes(cloneNodesWithNewIds([node]), 24, 24)[0]!;
			clonedIds.push(cloned.id);
			nodes = insertNodeIntoTree(nodes, idx.parentById.get(id) ?? null, cloned);
		}

		if (!clonedIds.length) return;
		onChange({ ...current, nodes });
		pendingFocusIdRef.current = clonedIds[clonedIds.length - 1] ?? null;
		setSelectedIds(clonedIds);
	}, [breakpoint, disabledFlag, onChange, selectedIds, lockedIds, effectiveEditRootId]);

	const nudgeSelected = useCallback(
		(dx: number, dy: number) => {
			if (disabledFlag) return;
			if (!selectedIds.length) return;

			const current = valueRef.current;
			const idx = buildIndex(current.nodes, breakpoint);
			const targets = topLevelSelectedIds(selectedIds, idx).filter(
				(id) =>
					isWithinEditRoot(idx, id, effectiveEditRootId) &&
					!isLockedForEdit(idx, id, lockedIds, effectiveEditRootId)
			);
			if (!targets.length) return;

			const snap = current.canvas.snapPx;
			const updates = new Map<string, { x: number; y: number }>();

			for (const id of targets) {
				const node = idx.byId.get(id);
				if (!node) continue;
				const frame = node.frames[breakpoint];
				const parentSize = getParentSize(current, idx, id, breakpoint);

				const nextX = snapTo(frame.x + dx, snap);
				const nextY = snapTo(frame.y + dy, snap);

				const clampedX = clamp(nextX, 0, Math.max(0, parentSize.width - frame.w));
				const clampedY =
					(idx.parentById.get(id) ?? null) === null
						? clamp(nextY, 0, Number.POSITIVE_INFINITY)
						: clamp(nextY, 0, Math.max(0, parentSize.height - frame.h));

				updates.set(id, { x: clampedX, y: clampedY });
			}

			let nodes = current.nodes;
			for (const [id, pos] of updates) {
				nodes = updateNodeInTree(nodes, id, (n) => ({
					...n,
					frames: { ...n.frames, [breakpoint]: { ...n.frames[breakpoint], x: pos.x, y: pos.y } },
				}));
			}

			onChange({ ...current, nodes });
		},
		[breakpoint, disabledFlag, onChange, selectedIds, lockedIds, effectiveEditRootId]
	);

	type ZOrderAction = 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward';

	const reorderZ = useCallback(
		(action: ZOrderAction) => {
			if (disabledFlag) return;
			if (!selectedId) return;

			const current = valueRef.current;
			const idx = buildIndex(current.nodes, breakpoint);
			if (!idx.byId.has(selectedId)) return;
			if (!isWithinEditRoot(idx, selectedId, effectiveEditRootId)) return;
			if (isLockedForEdit(idx, selectedId, lockedIds, effectiveEditRootId)) return;

			const parentId = idx.parentById.get(selectedId) ?? null;
			const siblings = parentId ? idx.byId.get(parentId)?.nodes ?? [] : current.nodes;
			if (siblings.length < 2) return;

			const ordered = siblings
				.map((n) => {
					const zRaw = n.frames[breakpoint].z;
					const z = typeof zRaw === 'number' && Number.isFinite(zRaw) ? zRaw : 1;
					return { id: n.id, z };
				})
				.sort((a, b) => (a.z - b.z) || a.id.localeCompare(b.id))
				.map((n) => n.id);

			const from = ordered.indexOf(selectedId);
			if (from === -1) return;

			const next = [...ordered];
			if (action === 'bringForward' && from < next.length - 1) {
				[next[from], next[from + 1]] = [next[from + 1]!, next[from]!];
			} else if (action === 'sendBackward' && from > 0) {
				[next[from], next[from - 1]] = [next[from - 1]!, next[from]!];
			} else if (action === 'bringToFront' && from < next.length - 1) {
				next.splice(from, 1);
				next.push(selectedId);
			} else if (action === 'sendToBack' && from > 0) {
				next.splice(from, 1);
				next.unshift(selectedId);
			} else {
				return;
			}

			let nodes = current.nodes;
			for (let i = 0; i < next.length; i += 1) {
				const id = next[i]!;
				nodes = updateNodeInTree(nodes, id, (n) => ({
					...n,
					frames: {
						...n.frames,
						[breakpoint]: { ...n.frames[breakpoint], z: i + 1 },
					},
				}));
			}

			onChange({ ...current, nodes });
		},
		[breakpoint, disabledFlag, onChange, selectedId, lockedIds, effectiveEditRootId]
	);

	const reorderLayers = useCallback(
		(activeId: string, overId: string) => {
			if (disabledFlag) return;
			if (!activeId || !overId || activeId === overId) return;

			const current = valueRef.current;
			const idx = buildIndex(current.nodes, breakpoint);
			if (!idx.byId.has(activeId) || !idx.byId.has(overId)) return;

			const parentA = idx.parentById.get(activeId) ?? null;
			const parentB = idx.parentById.get(overId) ?? null;
			if (parentA !== parentB) return;

			if (
				!isWithinEditRoot(idx, activeId, effectiveEditRootId) ||
				!isWithinEditRoot(idx, overId, effectiveEditRootId)
			)
				return;
			if (isLockedForEdit(idx, activeId, lockedIds, effectiveEditRootId)) return;

			const siblings = parentA ? idx.byId.get(parentA)?.nodes ?? [] : current.nodes;
			if (siblings.length < 2) return;

			const ordered = siblings
				.map((n) => {
					const zRaw = n.frames[breakpoint].z;
					const z = typeof zRaw === 'number' && Number.isFinite(zRaw) ? zRaw : 1;
					return { id: n.id, z };
				})
				.sort((a, b) => (b.z - a.z) || a.id.localeCompare(b.id))
				.map((n) => n.id);

			const from = ordered.indexOf(activeId);
			const to = ordered.indexOf(overId);
			if (from === -1 || to === -1) return;

			const next = [...ordered];
			next.splice(from, 1);
			const toIndex = from < to ? to - 1 : to;
			next.splice(toIndex, 0, activeId);

			let nodes = current.nodes;
			for (let i = 0; i < next.length; i += 1) {
				const id = next[i]!;
				const z = next.length - i;
				nodes = updateNodeInTree(nodes, id, (n) => ({
					...n,
					frames: {
						...n.frames,
						[breakpoint]: { ...n.frames[breakpoint], z },
					},
				}));
			}

			onChange({ ...current, nodes });
		},
		[breakpoint, disabledFlag, onChange, lockedIds, effectiveEditRootId]
	);

	useEffect(() => {
		function isTypingTarget(el: Element | null): boolean {
			if (!el) return false;
			const tag = el.tagName.toLowerCase();
			if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
			if ((el as HTMLElement).isContentEditable) return true;
			if ((el as HTMLElement).closest?.('[contenteditable="true"]')) return true;
			return false;
		}

		function onKeyDown(e: KeyboardEvent) {
			if (disabledFlag) return;
			if (isTypingTarget(document.activeElement)) return;

			const isMod = (navigator.platform || '').toLowerCase().includes('mac') ? e.metaKey : e.ctrlKey;
			if (isMod && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				if (e.shiftKey) {
					redo();
				} else {
					undo();
				}
				return;
			}
			if (isMod && e.key.toLowerCase() === 'y') {
				e.preventDefault();
				redo();
				return;
			}

			if (!isMod && e.key.toLowerCase() === 'g') {
				e.preventDefault();
				setShowGridOverlay((prev) => !prev);
				return;
			}

			if (!isMod && e.key.toLowerCase() === 'i') {
				e.preventDefault();
				setInsertTab('blocks');
				if (window.matchMedia('(min-width: 1024px)').matches) {
					setFocusMode(false);
					setShowLeftDock(true);
					setLeftDockMode('insert');
				} else {
					setInsertOpen(true);
				}
				return;
			}

			if (!isMod && e.key.toLowerCase() === 'l') {
				e.preventDefault();
				if (window.matchMedia('(min-width: 1024px)').matches) {
					setFocusMode(false);
					setShowLeftDock(true);
					setLeftDockMode('outline');
				} else {
					setOutlineOpen(true);
				}
				return;
			}

			if (!isMod && e.key === '\\') {
				e.preventDefault();
				setFocusMode((prev) => !prev);
				return;
			}

			if (!selectedIds.length) return;

			const snap = valueRef.current.canvas.snapPx;
			const step = e.shiftKey ? snap * 10 : snap;

			if (e.key === 'Escape') {
				e.preventDefault();
				setSelectedIds([]);
				return;
			}

			if (e.key === 'Backspace' || e.key === 'Delete') {
				e.preventDefault();
				removeSelected();
				return;
			}

			if (isMod && e.key.toLowerCase() === 'd') {
				e.preventDefault();
				duplicateSelected();
				return;
			}

			if (isMod && (e.key === '[' || e.key === ']')) {
				e.preventDefault();
				if (e.key === ']') {
					reorderZ(e.shiftKey ? 'bringToFront' : 'bringForward');
				} else {
					reorderZ(e.shiftKey ? 'sendToBack' : 'sendBackward');
				}
				return;
			}

			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				nudgeSelected(-step, 0);
				return;
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				nudgeSelected(step, 0);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				nudgeSelected(0, -step);
				return;
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				nudgeSelected(0, step);
				return;
			}
		}

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [disabledFlag, selectedIds, nudgeSelected, removeSelected, duplicateSelected, reorderZ, undo, redo]);

	function addComponent(component: ComponentPickerItem) {
		if (disabledFlag) return;

		const editRoot = effectiveEditRootId && index.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;
		const selectedParentId = selectedNode && Array.isArray(selectedNode.nodes) ? selectedNode.id : null;

		const withinEditRoot = (parentId: string | null): boolean => {
			if (!editRoot) return true;
			if (!parentId) return false;
			return parentId === editRoot || isDescendant(index.parentById, parentId, editRoot);
		};

		const targetParentId = withinEditRoot(selectedParentId) ? selectedParentId : editRoot;
		const parentNode = targetParentId ? index.byId.get(targetParentId) ?? null : null;

		const y = parentNode
			? computeBottom(parentNode.nodes ?? [], breakpoint) + 24
			: computeBottom(valueRef.current.nodes, breakpoint) + 24;

		const base = createBlockFromComponent(component);
		const parentWidths = parentNode
			? {
					mobile: parentNode.frames.mobile.w,
					tablet: parentNode.frames.tablet.w,
					desktop: parentNode.frames.desktop.w,
				}
			: valueRef.current.canvas.widths;
		const rawNode = createNodeFromBlock(base, valueRef.current, y, parentWidths);

		// V5 primitives: insert common items as editable primitives by default.
		const node =
			rawNode.type === 'button'
				? buttonToPrimitiveTree(rawNode)
				: rawNode.type === 'card'
					? cardToPrimitiveTree(rawNode)
					: rawNode.type === 'shadcn'
						? shadcnToPrimitiveTree(rawNode) ?? rawNode
					: rawNode;

		const inserted = insertNodeIntoTree(valueRef.current.nodes, targetParentId ?? null, node);
		onChange({ ...valueRef.current, nodes: inserted });
		requestFocus(node.id);
		setBlockPickerOpen(false);
	}

	const framesFromRect = useCallback(
		(
			rect: { x: number; y: number; w: number; h: number },
			bounds?: { widths: Record<BuilderBreakpoint, number>; heights?: Record<BuilderBreakpoint, number> }
		): Record<BuilderBreakpoint, NodeFrame> => {
			const widths = bounds?.widths ?? valueRef.current.canvas.widths;
			const heights = bounds?.heights;

			const clampFor = (bp: BuilderBreakpoint): NodeFrame => {
				const parentW = Math.max(1, widths[bp]);
				const parentHRaw = heights ? heights[bp] : undefined;
				const parentH = typeof parentHRaw === 'number' && Number.isFinite(parentHRaw) ? Math.max(1, parentHRaw) : null;

				const w = clamp(rect.w, MIN_NODE_W, Math.max(MIN_NODE_W, parentW));
				const x = clamp(rect.x, 0, Math.max(0, parentW - w));
				const h = Math.max(MIN_NODE_H, rect.h);
				const maxY = parentH ? Math.max(0, parentH - h) : Number.POSITIVE_INFINITY;
				const y = clamp(rect.y, 0, maxY);
				return {
					x,
					y,
					w,
					h,
				};
			};

			return {
				mobile: clampFor('mobile'),
				tablet: clampFor('tablet'),
				desktop: clampFor('desktop'),
			};
		},
		[valueRef]
	);

	const addTypographyAt = useCallback((x: number, y: number) => {
		if (disabledFlag) return;

		const editRoot = effectiveEditRootId && index.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;
		const selectedParentId = selectedNode && Array.isArray(selectedNode.nodes) ? selectedNode.id : null;
		const withinEditRoot = (parentId: string | null): boolean => {
			if (!editRoot) return true;
			if (!parentId) return false;
			return parentId === editRoot || isDescendant(index.parentById, parentId, editRoot);
		};
		const targetParentId = withinEditRoot(selectedParentId) ? selectedParentId : editRoot;
		const parentNode = targetParentId ? index.byId.get(targetParentId) ?? null : null;
		const parentGlobal = targetParentId ? index.globalById.get(targetParentId) ?? { x: 0, y: 0 } : { x: 0, y: 0 };

		const snap = valueRef.current.canvas.snapPx;
		const w = 360;
		const h = 140;
		const rect = {
			x: snapTo(x - parentGlobal.x, snap),
			y: snapTo(y - parentGlobal.y, snap),
			w: snapTo(w, snap),
			h: snapTo(h, snap),
		};

		const node: PageNode = {
			id: createId('node'),
			type: 'text',
			data: { variant: 'p', text: 'Text' },
			frames: framesFromRect(
				rect,
				parentNode
					? {
							widths: {
								mobile: parentNode.frames.mobile.w,
								tablet: parentNode.frames.tablet.w,
								desktop: parentNode.frames.desktop.w,
							},
							heights: {
								mobile: parentNode.frames.mobile.h,
								tablet: parentNode.frames.tablet.h,
								desktop: parentNode.frames.desktop.h,
							},
						}
					: undefined
			),
		};

		const inserted = insertNodeIntoTree(valueRef.current.nodes, targetParentId ?? null, node);
		onChange({ ...valueRef.current, nodes: inserted });
		requestFocus(node.id);
	}, [disabledFlag, effectiveEditRootId, framesFromRect, index.byId, index.globalById, index.parentById, onChange, requestFocus, selectedNode, valueRef]);

	const addImageAt = useCallback((x: number, y: number) => {
		if (disabledFlag) return;

		const editRoot = effectiveEditRootId && index.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;
		const selectedParentId = selectedNode && Array.isArray(selectedNode.nodes) ? selectedNode.id : null;
		const withinEditRoot = (parentId: string | null): boolean => {
			if (!editRoot) return true;
			if (!parentId) return false;
			return parentId === editRoot || isDescendant(index.parentById, parentId, editRoot);
		};
		const targetParentId = withinEditRoot(selectedParentId) ? selectedParentId : editRoot;
		const parentNode = targetParentId ? index.byId.get(targetParentId) ?? null : null;
		const parentGlobal = targetParentId ? index.globalById.get(targetParentId) ?? { x: 0, y: 0 } : { x: 0, y: 0 };

		const snap = valueRef.current.canvas.snapPx;
		const w = 520;
		const h = 360;
		const rect = {
			x: snapTo(x - parentGlobal.x, snap),
			y: snapTo(y - parentGlobal.y, snap),
			w: snapTo(w, snap),
			h: snapTo(h, snap),
		};

		const node: PageNode = {
			id: createId('node'),
			type: 'image',
			data: { url: '', alt: '' },
			frames: framesFromRect(
				rect,
				parentNode
					? {
							widths: {
								mobile: parentNode.frames.mobile.w,
								tablet: parentNode.frames.tablet.w,
								desktop: parentNode.frames.desktop.w,
							},
							heights: {
								mobile: parentNode.frames.mobile.h,
								tablet: parentNode.frames.tablet.h,
								desktop: parentNode.frames.desktop.h,
							},
						}
					: undefined
			),
		};

		const inserted = insertNodeIntoTree(valueRef.current.nodes, targetParentId ?? null, node);
		onChange({ ...valueRef.current, nodes: inserted });
		requestFocus(node.id);
		setMediaTargetId(node.id);
		setMediaPickerOpen(true);
	}, [disabledFlag, effectiveEditRootId, framesFromRect, index.byId, index.globalById, index.parentById, onChange, requestFocus, selectedNode, valueRef]);

	function insertTemplate(block: BlockTemplate) {
		if (disabledFlag) return;
		const parsed = parsePageBuilderState(block.definition);
		const cloned = cloneNodesWithNewIds(parsed.nodes);
		if (cloned.length === 0) {
			setTemplatePickerOpen(false);
			return;
		}

		const editRoot = effectiveEditRootId && index.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;
		const selectedParentId = selectedNode && Array.isArray(selectedNode.nodes) ? selectedNode.id : null;
		const withinEditRoot = (parentId: string | null): boolean => {
			if (!editRoot) return true;
			if (!parentId) return false;
			return parentId === editRoot || isDescendant(index.parentById, parentId, editRoot);
		};
		const targetParentId = withinEditRoot(selectedParentId) ? selectedParentId : editRoot;
		const parentNode = targetParentId ? index.byId.get(targetParentId) ?? null : null;

		const y = parentNode
			? computeBottom(parentNode.nodes ?? [], breakpoint) + 60
			: computeBottom(valueRef.current.nodes, breakpoint) + 60;
		const next = offsetNodes(cloned, 0, y);

		const inserted = targetParentId
			? updateNodeInTree(valueRef.current.nodes, targetParentId, (parent) => {
					const list = Array.isArray(parent.nodes) ? parent.nodes : [];
					return { ...parent, nodes: [...list, ...next] };
				})
			: [...valueRef.current.nodes, ...next];

		onChange({ ...valueRef.current, nodes: inserted });
		requestFocus(next[0]!.id);
		setTemplatePickerOpen(false);
	}

	function fillParentWidth(node: PageNode) {
		const parentId = index.parentById.get(node.id) ?? null;
		const parent = parentId
			? getParentSize(valueRef.current, index, node.id, breakpoint)
			: { width: rootClientWidth ?? valueRef.current.canvas.widths[breakpoint], height: rootHeight };

		updateFrame(node.id, (f) => ({
			...f,
			x: 0,
			w: Math.max(MIN_NODE_W, Math.round(parent.width)),
		}));
	}

	function setFrameProp(nodeId: string, key: string, value: unknown) {
		updateNode(nodeId, (n) => {
			if (n.type !== 'frame') return n;
			const next = isRecord(n.data.props) ? { ...(n.data.props as Record<string, unknown>) } : {};
			const shouldRemove = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
			if (shouldRemove) delete next[key];
			else next[key] = value;
			return { ...n, data: { ...n.data, props: next } };
		});
	}

	function beginPickMedia(nodeId: string) {
		setMediaTargetId(nodeId);
		setMediaPickerOpen(true);
	}

	const detachSelectedMenuToPrimitives = useCallback(async () => {
		if (disabledFlag) return;
		if (!selectedNode || selectedNode.type !== 'menu') return;
		if (detachingMenu) return;

		setDetachMenuError(null);
		setDetachingMenu(true);

		try {
			const menuSlug = (selectedNode.data.menu || 'main').trim() || 'main';
			const kind = selectedNode.data.kind === 'footer' ? 'footer' : 'top';

			let items: Array<{ label: string; href: string }> = [];
			if (Array.isArray(selectedNode.data.items) && selectedNode.data.items.length) {
				items = selectedNode.data.items
					.map((it) => ({
						label: String(it.label ?? '').trim(),
						href: String(it.href ?? '').trim(),
					}))
					.filter((it) => it.label && it.href);
			} else {
				const res = await fetch(`/api/public/menus/${encodeURIComponent(menuSlug)}`, { cache: 'no-store' });
				if (!res.ok) throw new Error(`Failed to load menu '${menuSlug}' (${res.status})`);
				const json = (await res.json()) as unknown;
				if (isRecord(json) && Array.isArray((json as Record<string, unknown>)['items'])) {
					items = ((json as Record<string, unknown>)['items'] as unknown[])
						.map((it) => ({
							label: isRecord(it) ? String(it['label'] ?? '').trim() : '',
							href: isRecord(it) ? String(it['href'] ?? '').trim() : '',
						}))
						.filter((it) => it.label && it.href);
				}
			}

			if (items.length === 0) {
				throw new Error('Menu has no items. Add embedded items or create items in the Menu manager first.');
			}

			const pad = 16;
			const gap = 12;
			const itemH = 36;
			const itemW = 132;
			const logoH = 44;
			const logoW = 160;

			const parentFrames = { ...selectedNode.frames };

			function computeLayout(bp: BuilderBreakpoint) {
				const parentW = Math.max(1, parentFrames[bp].w);
				const parentH = Math.max(1, parentFrames[bp].h);

				const totalLinksW = items.length * itemW + Math.max(0, items.length - 1) * gap;
				const canRow =
					kind === 'top' && pad * 3 + logoW + gap + totalLinksW <= parentW;

				if (canRow) {
					const logo = {
						x: pad,
						y: Math.round((parentH - logoH) / 2),
						w: Math.min(logoW, Math.max(80, parentW - pad * 2)),
						h: logoH,
					};
					const links = {
						x: Math.max(pad, Math.round(parentW - pad - totalLinksW)),
						y: Math.round((parentH - itemH) / 2),
						w: totalLinksW,
						h: itemH,
						mode: 'row' as const,
					};
					return { logo, links, requiredH: parentH };
				}

				// Fallback: stacked layout (mobile, narrow widths, footers)
				const contentW = Math.max(60, parentW - pad * 2);
				const logo = {
					x: pad,
					y: pad,
					w: contentW,
					h: logoH,
				};
				const linksH = items.length * itemH + Math.max(0, items.length - 1) * gap;
				const links = {
					x: pad,
					y: pad + logoH + gap,
					w: contentW,
					h: linksH,
					mode: 'stack' as const,
				};
				const requiredH = Math.max(parentH, links.y + links.h + pad);
				return { logo, links, requiredH };
			}

			const layout = {
				mobile: computeLayout('mobile'),
				tablet: computeLayout('tablet'),
				desktop: computeLayout('desktop'),
			} as const;

			for (const bp of ['mobile', 'tablet', 'desktop'] as const) {
				parentFrames[bp] = { ...parentFrames[bp], h: Math.max(parentFrames[bp].h, layout[bp].requiredH) };
			}

			const logoShapeId = createId('node');
			const linksGroupId = createId('node');

			const logoTextId = createId('node');
			const logoText: PageNode = {
				id: logoTextId,
				type: 'text',
				data: {
					text: 'Logo',
					variant: 'small',
					className: 'h-full w-full flex items-center px-2 font-semibold tracking-[0.22em] uppercase',
				},
				frames: {
					mobile: { x: 0, y: 0, w: layout.mobile.logo.w, h: layout.mobile.logo.h },
					tablet: { x: 0, y: 0, w: layout.tablet.logo.w, h: layout.tablet.logo.h },
					desktop: { x: 0, y: 0, w: layout.desktop.logo.w, h: layout.desktop.logo.h },
				},
			};

			const logoShape: PageNode = {
				id: logoShapeId,
				type: 'shape',
				meta: { name: 'Logo' },
				data: {
					kind: 'rect',
					stroke: 'hsl(var(--border))',
					strokeWidth: 1,
					radiusPx: 10,
				},
				frames: {
					mobile: { ...layout.mobile.logo },
					tablet: { ...layout.tablet.logo },
					desktop: { ...layout.desktop.logo },
				},
				nodes: [logoText],
			};

			const linkNodes: PageNode[] = items.map((it, idx) => {
				const linkId = createId('node');
				const labelId = createId('node');

				const frames = {
					mobile:
						layout.mobile.links.mode === 'row'
							? {
									x: idx * (itemW + gap),
									y: 0,
									w: itemW,
									h: itemH,
								}
							: {
									x: 0,
									y: idx * (itemH + gap),
									w: layout.mobile.links.w,
									h: itemH,
								},
					tablet:
						layout.tablet.links.mode === 'row'
							? {
									x: idx * (itemW + gap),
									y: 0,
									w: itemW,
									h: itemH,
								}
							: {
									x: 0,
									y: idx * (itemH + gap),
									w: layout.tablet.links.w,
									h: itemH,
								},
					desktop:
						layout.desktop.links.mode === 'row'
							? {
									x: idx * (itemW + gap),
									y: 0,
									w: itemW,
									h: itemH,
								}
							: {
									x: 0,
									y: idx * (itemH + gap),
									w: layout.desktop.links.w,
									h: itemH,
								},
				} satisfies Record<BuilderBreakpoint, NodeFrame>;

				const labelNode: PageNode = {
					id: labelId,
					type: 'text',
					meta: { name: 'Label' },
					data: {
						text: it.label,
						variant: 'small',
						className:
							'h-full w-full flex items-center justify-center text-xs font-medium tracking-[0.22em] uppercase',
					},
					frames: {
						mobile: { x: 0, y: 0, w: frames.mobile.w, h: frames.mobile.h },
						tablet: { x: 0, y: 0, w: frames.tablet.w, h: frames.tablet.h },
						desktop: { x: 0, y: 0, w: frames.desktop.w, h: frames.desktop.h },
					},
				};

				return {
					id: linkId,
					type: 'shape',
					meta: { name: `Link/${it.label}` },
					data: {
						kind: 'rect',
						stroke: 'hsl(var(--border))',
						strokeWidth: 1,
						radiusPx: 10,
						href: it.href,
					},
					frames,
					nodes: [labelNode],
				};
			});

			const linksGroup: PageNode = {
				id: linksGroupId,
				type: 'shape',
				meta: { name: 'Links' },
				data: {
					kind: 'rect',
					stroke: 'hsl(var(--border))',
					strokeWidth: 1,
					radiusPx: 14,
				},
				frames: {
					mobile: { x: layout.mobile.links.x, y: layout.mobile.links.y, w: layout.mobile.links.w, h: layout.mobile.links.h },
					tablet: { x: layout.tablet.links.x, y: layout.tablet.links.y, w: layout.tablet.links.w, h: layout.tablet.links.h },
					desktop: { x: layout.desktop.links.x, y: layout.desktop.links.y, w: layout.desktop.links.w, h: layout.desktop.links.h },
				},
				nodes: linkNodes,
			};

			const wrapper: PageNode = {
				id: selectedNode.id,
				type: 'frame',
				meta: selectedNode.meta,
				data: {
					label: kind === 'footer' ? `Footer nav/${menuSlug}` : `Top nav/${menuSlug}`,
					layout: 'box',
					className: kind === 'footer' ? 'bg-background border-t border-border' : 'bg-background border-b border-border',
					paddingPx: 0,
					props: {},
				},
				frames: parentFrames,
				nodes: [logoShape, linksGroup],
			};

			updateNode(selectedNode.id, () => wrapper);
			requestFocus(selectedNode.id);
		} catch (e) {
			setDetachMenuError(e instanceof Error ? e.message : String(e));
		} finally {
			setDetachingMenu(false);
		}
	}, [detachingMenu, disabledFlag, requestFocus, selectedNode, updateNode]);

	const detachSelectedButtonToPrimitives = useCallback(() => {
		if (disabledFlag) return;
		if (!selectedNode || selectedNode.type !== 'button') return;
		updateNode(selectedNode.id, (n) => {
			if (n.type !== 'button') return n;
			return buttonToPrimitiveTree(n);
		});
		requestFocus(selectedNode.id);
	}, [disabledFlag, requestFocus, selectedNode, updateNode]);

	const detachSelectedCardToPrimitives = useCallback(() => {
		if (disabledFlag) return;
		if (!selectedNode || selectedNode.type !== 'card') return;
		updateNode(selectedNode.id, (n) => {
			if (n.type !== 'card') return n;
			return cardToPrimitiveTree(n);
		});
		requestFocus(selectedNode.id);
	}, [disabledFlag, requestFocus, selectedNode, updateNode]);

	const detachSelectedShadcnToPrimitives = useCallback(() => {
		if (disabledFlag) return;
		if (!selectedNode || selectedNode.type !== 'shadcn') return;
		updateNode(selectedNode.id, (n) => {
			if (n.type !== 'shadcn') return n;
			const converted = shadcnToPrimitiveTree(n);
			return converted ?? n;
		});
		requestFocus(selectedNode.id);
	}, [disabledFlag, requestFocus, selectedNode, updateNode]);

	function onPickMedia(media: MediaAsset) {
		if (!mediaTargetId) return;
		updateNode(mediaTargetId, (n) => {
			if (n.type !== 'image') return n;
			return {
				...n,
				data: {
					...n.data,
					url: media.url,
					alt: n.data.alt ?? media.original_name,
					media_id: media.id,
				},
			};
		});
		setMediaPickerOpen(false);
		setMediaTargetId(null);
	}

	const interactionsEnabled = tool === 'select' && !drawState && !disabledFlag;

	const clientToCanvas = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
		const el = rootElRef.current;
		if (!el) return null;
		const zoomValue = zoomRef.current || 1;
		const rect = el.getBoundingClientRect();
		const x = (clientX - rect.left) / zoomValue;
		const y = (clientY - rect.top) / zoomValue;
		if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
		return { x, y };
	}, []);

	const onCanvasPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (disabledFlag) return;
			if (e.button !== 0) return;

			const pt = clientToCanvas(e.clientX, e.clientY);
			if (!pt) return;

			if (tool === 'select') {
				const additive = e.shiftKey || e.ctrlKey || e.metaKey;
				setMarqueeState({
					pointerId: e.pointerId,
					startX: pt.x,
					startY: pt.y,
					currentX: pt.x,
					currentY: pt.y,
					additive,
				});
				if (!additive) setSelectedIds([]);
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			if (tool === 'text') {
				addTypographyAt(pt.x, pt.y);
				e.preventDefault();
				return;
			}

			if (tool === 'media') {
				addImageAt(pt.x, pt.y);
				e.preventDefault();
				return;
			}

			if (tool === 'frame' || tool === 'shape') {
				setSelectedIds([]);
				setDrawState({
					mode: tool,
					breakpoint,
					pointerId: e.pointerId,
					parentId: effectiveEditRootId,
					startX: pt.x,
					startY: pt.y,
					currentX: pt.x,
					currentY: pt.y,
					frameLayout: tool === 'frame' ? frameToolLayout : undefined,
					shapeKind: tool === 'shape' ? shapeToolKind : undefined,
				});
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			// pen/pencil/comment are UI placeholders for now
		},
		[addImageAt, addTypographyAt, breakpoint, clientToCanvas, disabledFlag, effectiveEditRootId, frameToolLayout, shapeToolKind, tool]
	);

	const onCanvasPointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (marqueeState) {
				if (marqueeState.pointerId !== e.pointerId) return;
				const pt = clientToCanvas(e.clientX, e.clientY);
				if (!pt) return;
				setMarqueeState((prev) => (prev ? { ...prev, currentX: pt.x, currentY: pt.y } : prev));
				e.preventDefault();
				return;
			}

			if (!drawState) return;
			if (drawState.pointerId !== e.pointerId) return;

			const pt = clientToCanvas(e.clientX, e.clientY);
			if (!pt) return;

			setDrawState((prev) => (prev ? { ...prev, currentX: pt.x, currentY: pt.y } : prev));
			e.preventDefault();
		},
		[clientToCanvas, drawState, marqueeState]
	);

	const onCanvasPointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (marqueeState) {
				if (marqueeState.pointerId !== e.pointerId) return;
				(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

				const pt = clientToCanvas(e.clientX, e.clientY);
				const endX = pt?.x ?? marqueeState.currentX;
				const endY = pt?.y ?? marqueeState.currentY;

				const left = Math.min(marqueeState.startX, endX);
				const top = Math.min(marqueeState.startY, endY);
				const right = Math.max(marqueeState.startX, endX);
				const bottom = Math.max(marqueeState.startY, endY);
				const w = right - left;
				const h = bottom - top;

				// Tiny drag == background click; selection was already handled on pointer down.
				if (w >= 3 && h >= 3) {
					const current = valueRef.current;
					const idx = buildIndex(current.nodes, breakpoint);
					const editRoot =
						effectiveEditRootId && idx.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;

					const picked: string[] = [];
					for (const [id, node] of idx.byId) {
						if (editRoot && !(id === editRoot || isDescendant(idx.parentById, id, editRoot))) continue;
						const global = idx.globalById.get(id);
						if (!global) continue;
						const frame = node.frames[breakpoint];
						const nodeLeft = global.x;
						const nodeTop = global.y;
						const nodeRight = global.x + frame.w;
						const nodeBottom = global.y + frame.h;
						const contained =
							nodeLeft >= left &&
							nodeTop >= top &&
							nodeRight <= right &&
							nodeBottom <= bottom;
						if (contained) picked.push(id);
					}

					if (picked.length) {
						setSelectedIds((prev) => {
							if (!marqueeState.additive) return picked;
							const next = [...prev];
							const set = new Set(prev);
							for (const id of picked) {
								if (set.has(id)) continue;
								set.add(id);
								next.push(id);
							}
							return next;
						});
					} else if (!marqueeState.additive) {
						setSelectedIds([]);
					}
				}

				setMarqueeState(null);
				e.preventDefault();
				return;
			}

			if (!drawState) return;
			if (drawState.pointerId !== e.pointerId) return;

			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

			const current = valueRef.current;
			const snap = current.canvas.snapPx;
			const idx = buildIndex(current.nodes, breakpoint);
			const editRoot = effectiveEditRootId && idx.byId.has(effectiveEditRootId) ? effectiveEditRootId : null;
			const withinEditRoot = (parentId: string | null): boolean => {
				if (!editRoot) return true;
				if (!parentId) return false;
				return parentId === editRoot || isDescendant(idx.parentById, parentId, editRoot);
			};
			let targetParentId =
				drawState.parentId && idx.byId.has(drawState.parentId) ? drawState.parentId : null;
			if (!withinEditRoot(targetParentId)) targetParentId = editRoot;
			const parentNode = targetParentId ? idx.byId.get(targetParentId) ?? null : null;
			const parentGlobal = targetParentId
				? idx.globalById.get(targetParentId) ?? { x: 0, y: 0 }
				: { x: 0, y: 0 };

			const rawLeft = Math.min(drawState.startX, drawState.currentX);
			const rawTop = Math.min(drawState.startY, drawState.currentY);
			const rawW = Math.abs(drawState.currentX - drawState.startX);
			const rawH = Math.abs(drawState.currentY - drawState.startY);

			const isClick = rawW < 4 && rawH < 4;
			const defaultW = drawState.mode === 'frame' ? 900 : drawState.shapeKind === 'line' || drawState.shapeKind === 'arrow' ? 420 : 320;
			const defaultH = drawState.mode === 'frame' ? 520 : drawState.shapeKind === 'line' || drawState.shapeKind === 'arrow' ? 80 : 220;

			const rect = isClick
				? {
						x: drawState.startX - defaultW / 2,
						y: drawState.startY - defaultH / 2,
						w: defaultW,
						h: defaultH,
					}
				: { x: rawLeft, y: rawTop, w: rawW, h: rawH };

			const localRect = {
				x: rect.x - parentGlobal.x,
				y: rect.y - parentGlobal.y,
				w: rect.w,
				h: rect.h,
			};

			const snappedRect = {
				x: snapTo(localRect.x, snap),
				y: snapTo(localRect.y, snap),
				w: snapTo(Math.max(MIN_NODE_W, localRect.w), snap),
				h: snapTo(Math.max(MIN_NODE_H, localRect.h), snap),
			};

			const id = createId('node');
			let node: PageNode | null = null;

			if (drawState.mode === 'frame') {
				const layout = drawState.frameLayout ?? 'box';
				const preset =
					FRAME_LAYOUT_PRESETS.find((p) => p.layout === layout) ??
					FRAME_LAYOUT_PRESETS[FRAME_LAYOUT_PRESETS.length - 1];
				node = {
					id,
					type: 'frame',
					data: { label: preset.label, paddingPx: 24, layout: preset.layout, props: { ...preset.props } },
					frames: framesFromRect(
						snappedRect,
						parentNode
							? {
									widths: {
										mobile: parentNode.frames.mobile.w,
										tablet: parentNode.frames.tablet.w,
										desktop: parentNode.frames.desktop.w,
									},
									heights: {
										mobile: parentNode.frames.mobile.h,
										tablet: parentNode.frames.tablet.h,
										desktop: parentNode.frames.desktop.h,
									},
								}
							: undefined
					),
					nodes: [],
				};
			} else if (drawState.mode === 'shape') {
				const kind = drawState.shapeKind ?? 'rect';
				const isLine = kind === 'line' || kind === 'arrow';
				node = {
					id,
					type: 'shape',
					data: {
						kind,
						fill: isLine ? undefined : 'rgb(255 255 255 / 0.08)',
						stroke: 'rgb(255 255 255 / 0.22)',
						strokeWidth: 2,
						radiusPx: kind === 'rect' ? 8 : undefined,
					},
					frames: framesFromRect(
						snappedRect,
						parentNode
							? {
									widths: {
										mobile: parentNode.frames.mobile.w,
										tablet: parentNode.frames.tablet.w,
										desktop: parentNode.frames.desktop.w,
									},
									heights: {
										mobile: parentNode.frames.mobile.h,
										tablet: parentNode.frames.tablet.h,
										desktop: parentNode.frames.desktop.h,
									},
								}
							: undefined
					),
					nodes: [],
				};
			}

			if (node) {
				const inserted = insertNodeIntoTree(current.nodes, targetParentId ?? null, node);
				onChange({ ...current, nodes: inserted });
				requestFocus(node.id);
			}

			setDrawState(null);
			e.preventDefault();
		},
		[breakpoint, clientToCanvas, drawState, effectiveEditRootId, framesFromRect, marqueeState, onChange, requestFocus]
	);

	const parentSizeForUi = useMemo(() => {
		if (!selectedId) return null;
		const node = index.byId.get(selectedId);
		if (!node) return null;
		const base = getParentSize(value, index, node.id, breakpoint);
		const isRootChild = (index.parentById.get(node.id) ?? null) === null;
		if (isRootChild && rootClientWidth) return { width: rootClientWidth, height: base.height };
		return base;
	}, [selectedId, value, index, breakpoint, rootClientWidth]);

	const pctW = selectedNode && parentSizeForUi && parentSizeForUi.width > 0 ? (selectedNode.frames[breakpoint].w / parentSizeForUi.width) * 100 : null;
	const pctH = selectedNode && parentSizeForUi && parentSizeForUi.height > 0 ? (selectedNode.frames[breakpoint].h / parentSizeForUi.height) * 100 : null;

	const resizingNode = resizeState ? index.byId.get(resizeState.nodeId) ?? null : null;
	const resizingFrame = resizingNode ? resizingNode.frames[breakpoint] : null;
	const resizingGlobal = resizeState ? index.globalById.get(resizeState.nodeId) ?? null : null;
	const resizingParent = useMemo(() => {
		const id = resizeState?.nodeId;
		if (!id) return null;
		const node = index.byId.get(id);
		if (!node) return null;
		const base = getParentSize(value, index, node.id, breakpoint);
		const isRootChild = (index.parentById.get(node.id) ?? null) === null;
		if (isRootChild && rootClientWidth) return { width: rootClientWidth, height: base.height };
		return base;
	}, [resizeState?.nodeId, value, index, breakpoint, rootClientWidth]);
	const resizingPctW =
		resizingFrame && resizingParent && resizingParent.width > 0
			? (resizingFrame.w / resizingParent.width) * 100
			: null;
	const resizingPctH =
		resizingFrame && resizingParent && resizingParent.height > 0
			? (resizingFrame.h / resizingParent.height) * 100
			: null;

	const rulerCanvasWidth = Math.max(0, viewportSize.width - RULER_SIZE_PX);
	const rulerCanvasHeight = Math.max(0, viewportSize.height - RULER_SIZE_PX);
	const rulerCanvasWidthUnits = rulerCanvasWidth / (zoom || 1);
	const rulerCanvasHeightUnits = rulerCanvasHeight / (zoom || 1);
	const scrollLeftUnits = viewportScroll.left / (zoom || 1);
	const scrollTopUnits = viewportScroll.top / (zoom || 1);
	const zoomValue = zoom || 1;
	const canvasWidthUnits = viewportMode === 'frames' ? frameBoard.totalWidth : value.canvas.widths[breakpoint];
	const scaledCanvasWidth = canvasWidthUnits * zoomValue;
	const scaledCanvasHeight = rootHeight * zoomValue;
	const rulerMinorPxScaled = Math.max(1, RULER_MINOR_PX * zoomValue);
	const rulerMajorPxScaled = Math.max(1, RULER_MAJOR_PX * zoomValue);

	const rulerXLabels = useMemo(() => {
		return makeRulerRange(scrollLeftUnits, scrollLeftUnits + rulerCanvasWidthUnits, RULER_LABEL_PX);
	}, [scrollLeftUnits, rulerCanvasWidthUnits]);

	const rulerYLabels = useMemo(() => {
		return makeRulerRange(scrollTopUnits, scrollTopUnits + rulerCanvasHeightUnits, RULER_LABEL_PX);
	}, [scrollTopUnits, rulerCanvasHeightUnits]);

	const dragAssist = useMemo(() => {
		if (!draggingId || !dragDelta) return null;
		const originalParentId = index.parentById.get(draggingId) ?? null;
		const scopeParentId = normalizeDropParentId({
			index,
			nodeId: draggingId,
			candidateParentId: dragOverParentId ?? originalParentId,
			originalParentId,
			effectiveEditRootId,
		});
		return computeDragAssist({
			index,
			nodeId: draggingId,
			delta: dragDelta,
			breakpoint,
			canvasWidth: value.canvas.widths[breakpoint],
			rootHeight,
			scopeParentId,
			thresholdPx: 6 / zoomValue,
		});
	}, [draggingId, dragDelta, dragOverParentId, index, breakpoint, value.canvas.widths, rootHeight, zoomValue, effectiveEditRootId]);

	const dragPreviewDelta = useMemo(() => {
		if (!draggingId || !dragDelta) return null;
		const node = index.byId.get(draggingId);
		const startGlobal = index.globalById.get(draggingId);
		if (!node || !startGlobal) return null;

		const originalParentId = index.parentById.get(draggingId) ?? null;
		const scopeParentId = normalizeDropParentId({
			index,
			nodeId: draggingId,
			candidateParentId: dragOverParentId ?? originalParentId,
			originalParentId,
			effectiveEditRootId,
		});

		const targetGlobal = scopeParentId ? index.globalById.get(scopeParentId) ?? { x: 0, y: 0 } : { x: 0, y: 0 };
		const nodeFrame = node.frames[breakpoint];
		const assistDx = dragAssist?.snapDx ?? 0;
		const assistDy = dragAssist?.snapDy ?? 0;

		const globalX = startGlobal.x + dragDelta.x + assistDx;
		const globalY = startGlobal.y + dragDelta.y + assistDy;

		const snap = value.canvas.snapPx;
		let nextX = snapTo(globalX - targetGlobal.x, snap);
		let nextY = snapTo(globalY - targetGlobal.y, snap);

		const parentWidth = scopeParentId
			? index.byId.get(scopeParentId)?.frames[breakpoint].w ?? value.canvas.widths[breakpoint]
			: rootClientWidth ?? value.canvas.widths[breakpoint];
		const parentHeight = scopeParentId
			? index.byId.get(scopeParentId)?.frames[breakpoint].h ?? rootHeight
			: rootHeight;

		nextX = clamp(nextX, 0, Math.max(0, parentWidth - nodeFrame.w));
		nextY = scopeParentId ? clamp(nextY, 0, Math.max(0, parentHeight - nodeFrame.h)) : clamp(nextY, 0, Number.POSITIVE_INFINITY);

		const snappedGlobalX = targetGlobal.x + nextX;
		const snappedGlobalY = targetGlobal.y + nextY;
		return { x: snappedGlobalX - startGlobal.x, y: snappedGlobalY - startGlobal.y };
	}, [
		draggingId,
		dragDelta,
		dragOverParentId,
		dragAssist,
		index,
		breakpoint,
		value.canvas.snapPx,
		value.canvas.widths,
		rootClientWidth,
		rootHeight,
		effectiveEditRootId,
	]);

	const ShapeToolIcon =
		shapeToolKind === 'ellipse'
			? Circle
			: shapeToolKind === 'line'
				? Minus
				: shapeToolKind === 'arrow'
					? ArrowRight
					: RectangleHorizontal;

	const drawPreviewRect = useMemo(() => {
		if (!drawState) return null;
		const snap = value.canvas.snapPx;
		const left = snapTo(Math.min(drawState.startX, drawState.currentX), snap);
		const top = snapTo(Math.min(drawState.startY, drawState.currentY), snap);
		const w = Math.max(1, snapTo(Math.abs(drawState.currentX - drawState.startX), snap));
		const h = Math.max(1, snapTo(Math.abs(drawState.currentY - drawState.startY), snap));
		return { x: left, y: top, w: Math.max(MIN_NODE_W, w), h: Math.max(MIN_NODE_H, h) };
	}, [drawState, value.canvas.snapPx]);

	const marqueePreviewRect = useMemo(() => {
		if (!marqueeState) return null;
		const left = Math.min(marqueeState.startX, marqueeState.currentX);
		const top = Math.min(marqueeState.startY, marqueeState.currentY);
		const w = Math.abs(marqueeState.currentX - marqueeState.startX);
		const h = Math.abs(marqueeState.currentY - marqueeState.startY);
		return { x: left, y: top, w, h };
	}, [marqueeState]);

	const showPanCursor = !disabledFlag && spaceDown;
	const viewportCursorClass = showPanCursor
		? isPanning
			? 'cursor-grabbing'
			: 'cursor-grab'
		: !disabledFlag && (tool === 'frame' || tool === 'shape')
			? 'cursor-crosshair'
			: !disabledFlag && tool === 'text'
				? 'cursor-text'
				: !disabledFlag && tool === 'media'
					? 'cursor-copy'
					: null;

	const selectedCount = selectedIds.length;
	const breakpointLabel = BREAKPOINT_LABELS[breakpoint];
	const activeToolLabel =
		tool === 'frame'
			? `${TOOL_LABELS.frame} (${frameToolLayout})`
			: tool === 'shape'
				? `${TOOL_LABELS.shape} (${shapeToolKind})`
				: TOOL_LABELS[tool];
	const leftDockVisible = showLeftDock && !focusMode;
	const rightDockVisible = showRightDock && !focusMode;

	function toggleTool(next: BuilderTool) {
		setTool((prev) => (prev === next ? 'select' : next));
	}

	const openInsertPanel = useCallback((tab: 'blocks' | 'libraries' = 'blocks') => {
		setInsertTab(tab);
		if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
			setFocusMode(false);
			setShowLeftDock(true);
			setLeftDockMode('insert');
			return;
		}
		setInsertOpen(true);
	}, []);

	const openOutlinePanel = useCallback(() => {
		if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
			setFocusMode(false);
			setShowLeftDock(true);
			setLeftDockMode('outline');
			return;
		}
		setOutlineOpen(true);
	}, []);

	const outlineTree = (
		<PageBuilderOutline
			state={value}
			breakpoint={breakpoint}
			selectedId={selectedId}
			selectedIds={selectedIdsSet}
			lockedIds={lockedIds}
			onSelect={(id, e) => {
				pendingFocusIdRef.current = id;
				selectNode(id, e);
				if (!e.metaKey && !e.ctrlKey && !e.shiftKey) setInspectorOpen(true);
			}}
			onInspect={(id) => {
				requestFocus(id);
				setInspectorOpen(true);
			}}
			onReorder={reorderLayers}
			onPatchMeta={patchNodeMeta}
			onOpenComponentPicker={() => openInsertPanel('libraries')}
			onOpenBlockPicker={() => openInsertPanel('blocks')}
		/>
	);

	const insertPanel = (
		<div className='flex h-full flex-col'>
			<div className='flex items-center justify-between gap-2 border-b px-4 py-3'>
				<div className='text-sm font-semibold'>Insert</div>
				<div className='inline-flex rounded-md border bg-background p-0.5'>
					<button
						type='button'
						onClick={() => setInsertTab('blocks')}
						className={cn(
							'rounded-sm px-2 py-1 text-xs font-medium',
							insertTab === 'blocks' ? 'bg-muted' : 'text-muted-foreground hover:bg-muted/40'
						)}>
						Blocks
					</button>
					<button
						type='button'
						onClick={() => setInsertTab('libraries')}
						className={cn(
							'rounded-sm px-2 py-1 text-xs font-medium',
							insertTab === 'libraries' ? 'bg-muted' : 'text-muted-foreground hover:bg-muted/40'
						)}>
						Libraries
					</button>
				</div>
			</div>

			<div className='flex-1 overflow-hidden p-4'>
				{insertTab === 'blocks' ? (
					<BlockTemplateBrowser
						onPick={insertTemplate}
						showInsertButton={false}
						className='h-full'
						itemsClassName='max-h-none h-full'
					/>
				) : (
					<div className='flex h-full flex-col gap-3'>
						<div className='rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground'>
							Libraries are your reusable component presets. Pick a component to configure and insert it.
						</div>
						<Button
							type='button'
							variant='outline'
							onClick={() => setBlockPickerOpen(true)}>
							Open component library…
						</Button>
					</div>
				)}
			</div>
		</div>
	);

	const inspectorInner = (
		<>
			<div className='border-b p-4'>
				<div className='flex items-start justify-between gap-2'>
					<div className='space-y-1 min-w-0'>
						<h4 className='text-sm font-semibold'>Inspector</h4>
						<p className='text-xs text-muted-foreground truncate'>
							{selectedNode ? `${selectedNode.type} · ${selectedNode.id}` : 'Select a node'}
						</p>
					</div>
					{selectedNode ? (
						<div className='flex items-center gap-1'>
							<Button type='button' variant='outline' size='icon' onClick={duplicateSelected} disabled={disabledFlag}>
								<Copy className='h-4 w-4' />
								<span className='sr-only'>Duplicate</span>
							</Button>
							<Button type='button' variant='destructive' size='icon' onClick={removeSelected} disabled={disabledFlag}>
								<Trash2 className='h-4 w-4' />
								<span className='sr-only'>Delete</span>
							</Button>
						</div>
					) : null}
				</div>
			</div>

			<div className='flex-1 overflow-auto p-4 space-y-4'>
				{selectedNode ? (
					<>
						<div className='grid grid-cols-2 gap-3'>
							<div className='space-y-1'>
								<Label>X</Label>
								<Input type='number' value={Math.round(selectedNode.frames[breakpoint].x)} onChange={(e) => updateFrame(selectedNode.id, (f) => ({ ...f, x: Number(e.target.value) }))} disabled={disabledFlag} />
							</div>
							<div className='space-y-1'>
								<Label>Y</Label>
								<Input type='number' value={Math.round(selectedNode.frames[breakpoint].y)} onChange={(e) => updateFrame(selectedNode.id, (f) => ({ ...f, y: Number(e.target.value) }))} disabled={disabledFlag} />
							</div>
							<div className='space-y-1'>
								<Label>W</Label>
								<Input type='number' value={Math.round(selectedNode.frames[breakpoint].w)} onChange={(e) => updateFrame(selectedNode.id, (f) => ({ ...f, w: clampMin(Number(e.target.value), MIN_NODE_W) }))} disabled={disabledFlag} />
							</div>
							<div className='space-y-1'>
								<Label>H</Label>
								<Input type='number' value={Math.round(selectedNode.frames[breakpoint].h)} onChange={(e) => updateFrame(selectedNode.id, (f) => ({ ...f, h: clampMin(Number(e.target.value), MIN_NODE_H) }))} disabled={disabledFlag} />
							</div>
						</div>
						{pctW !== null && pctH !== null ? (
							<p className='text-xs text-muted-foreground'>Size: {Math.round(pctW * 10) / 10}% w · {Math.round(pctH * 10) / 10}% h of parent</p>
						) : null}
						{parentSizeForUi ? (
							<div className='flex items-center gap-2'>
								<Button type='button' variant='outline' size='sm' onClick={() => fillParentWidth(selectedNode)} disabled={disabledFlag}>
									Fill width
								</Button>
								<span className='text-xs text-muted-foreground'>
									Parent: {Math.round(parentSizeForUi.width)}px
								</span>
							</div>
						) : null}

						<div className='space-y-2'>
							<Label>Order</Label>
							<div className='flex items-center gap-1'>
								<Button
									type='button'
									variant='outline'
									size='icon'
									onClick={() => reorderZ('sendToBack')}
									disabled={
										disabledFlag ||
										isLockedForEdit(index, selectedNode.id, lockedIds, effectiveEditRootId) ||
										!isWithinEditRoot(index, selectedNode.id, effectiveEditRootId)
									}>
									<ChevronsDown className='h-4 w-4' />
									<span className='sr-only'>Send to back</span>
								</Button>
								<Button
									type='button'
									variant='outline'
									size='icon'
									onClick={() => reorderZ('sendBackward')}
									disabled={
										disabledFlag ||
										isLockedForEdit(index, selectedNode.id, lockedIds, effectiveEditRootId) ||
										!isWithinEditRoot(index, selectedNode.id, effectiveEditRootId)
									}>
									<ChevronDown className='h-4 w-4' />
									<span className='sr-only'>Send backward</span>
								</Button>
								<Button
									type='button'
									variant='outline'
									size='icon'
									onClick={() => reorderZ('bringForward')}
									disabled={
										disabledFlag ||
										isLockedForEdit(index, selectedNode.id, lockedIds, effectiveEditRootId) ||
										!isWithinEditRoot(index, selectedNode.id, effectiveEditRootId)
									}>
									<ChevronUp className='h-4 w-4' />
									<span className='sr-only'>Bring forward</span>
								</Button>
								<Button
									type='button'
									variant='outline'
									size='icon'
									onClick={() => reorderZ('bringToFront')}
									disabled={
										disabledFlag ||
										isLockedForEdit(index, selectedNode.id, lockedIds, effectiveEditRootId) ||
										!isWithinEditRoot(index, selectedNode.id, effectiveEditRootId)
									}>
									<ChevronsUp className='h-4 w-4' />
									<span className='sr-only'>Bring to front</span>
								</Button>
							</div>
						</div>

						{selectedNode.type === 'frame' ? (
							<>
								<Separator />
								<div className='space-y-2'>
									<Label>Label</Label>
									<Input value={selectedNode.data.label ?? ''} onChange={(e) => updateNode(selectedNode.id, (n) => ({ ...n, type: 'frame', data: { ...n.data, label: e.target.value } }))} disabled={disabledFlag} />
								</div>
								<div className='space-y-2'>
									<Label>ClassName</Label>
									<Input value={selectedNode.data.className ?? ''} onChange={(e) => updateNode(selectedNode.id, (n) => ({ ...n, type: 'frame', data: { ...n.data, className: e.target.value } }))} disabled={disabledFlag} />
								</div>
								<div className='space-y-2'>
									<Label>Padding (px)</Label>
									<Input type='number' value={selectedNode.data.paddingPx ?? 0} onChange={(e) => updateNode(selectedNode.id, (n) => ({ ...n, type: 'frame', data: { ...n.data, paddingPx: Math.max(0, Math.round(Number(e.target.value))) } }))} disabled={disabledFlag} />
								</div>
								<div className='flex items-center gap-2'>
									<Checkbox
										id='frame-clip-contents'
										checked={selectedNode.data.clip ?? false}
										onCheckedChange={(checked) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'frame') return n;
												return { ...n, data: { ...n.data, clip: checked === true ? true : undefined } };
											})
										}
										disabled={disabledFlag}
									/>
									<Label htmlFor='frame-clip-contents'>Clip contents</Label>
								</div>
								<div className='space-y-2'>
									<Label>Layout</Label>
									<Select
										value={selectedNode.data.layout ?? 'none'}
										onValueChange={(v) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'frame') return n;
												const nextLayout =
													v === 'box' || v === 'flex' || v === 'grid' || v === 'container' || v === 'section'
														? (v as FrameBlock['data']['layout'])
														: undefined;
												return { ...n, data: { ...n.data, layout: nextLayout } };
											})
										}
										disabled={disabledFlag}>
										<SelectTrigger>
											<SelectValue placeholder='Layout' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='none'>None</SelectItem>
											<SelectItem value='grid'>Grid</SelectItem>
											<SelectItem value='flex'>Flex</SelectItem>
											<SelectItem value='box'>Box</SelectItem>
											<SelectItem value='container'>Container</SelectItem>
											<SelectItem value='section'>Section</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{selectedNode.data.layout === 'flex' ? (
									<>
										<div className='space-y-2'>
											<Label>Direction</Label>
											<Select
												value={String(selectedFrameProps['direction'] ?? 'row')}
												onValueChange={(v) => setFrameProp(selectedNode.id, 'direction', v)}
												disabled={disabledFlag}>
												<SelectTrigger>
													<SelectValue placeholder='Direction' />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='row'>Row</SelectItem>
													<SelectItem value='column'>Column</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className='space-y-2'>
											<Label>Align</Label>
											<Select
												value={String(selectedFrameProps['align'] ?? 'start')}
												onValueChange={(v) => setFrameProp(selectedNode.id, 'align', v)}
												disabled={disabledFlag}>
												<SelectTrigger>
													<SelectValue placeholder='Align' />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='start'>Start</SelectItem>
													<SelectItem value='center'>Center</SelectItem>
													<SelectItem value='end'>End</SelectItem>
													<SelectItem value='stretch'>Stretch</SelectItem>
													<SelectItem value='baseline'>Baseline</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className='space-y-2'>
											<Label>Justify</Label>
											<Select
												value={String(selectedFrameProps['justify'] ?? 'start')}
												onValueChange={(v) => setFrameProp(selectedNode.id, 'justify', v)}
												disabled={disabledFlag}>
												<SelectTrigger>
													<SelectValue placeholder='Justify' />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='start'>Start</SelectItem>
													<SelectItem value='center'>Center</SelectItem>
													<SelectItem value='end'>End</SelectItem>
													<SelectItem value='between'>Between</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</>
								) : null}

								{selectedNode.data.layout === 'grid' ? (
									<>
										<div className='space-y-2'>
											<Label>Columns</Label>
											<Input value={String(selectedFrameProps['columns'] ?? '')} onChange={(e) => setFrameProp(selectedNode.id, 'columns', e.target.value)} disabled={disabledFlag} />
										</div>
										<div className='space-y-2'>
											<Label>Rows</Label>
											<Input value={String(selectedFrameProps['rows'] ?? '')} onChange={(e) => setFrameProp(selectedNode.id, 'rows', e.target.value)} disabled={disabledFlag} />
										</div>
									</>
								) : null}

								{selectedNode.data.layout === 'container' ? (
									<>
										<div className='space-y-2'>
											<Label>Size</Label>
											<Select
												value={String(selectedFrameProps['size'] ?? '4')}
												onValueChange={(v) => setFrameProp(selectedNode.id, 'size', v)}
												disabled={disabledFlag}>
												<SelectTrigger>
													<SelectValue placeholder='Size' />
												</SelectTrigger>
												<SelectContent>
													{Object.keys(RADIX_CONTAINER_MAX_WIDTH_PX).map((s) => (
														<SelectItem key={s} value={s}>
															{s}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className='space-y-2'>
											<Label>Align</Label>
											<Select
												value={String(selectedFrameProps['align'] ?? 'center')}
												onValueChange={(v) => setFrameProp(selectedNode.id, 'align', v)}
												disabled={disabledFlag}>
												<SelectTrigger>
													<SelectValue placeholder='Align' />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='left'>Left</SelectItem>
													<SelectItem value='center'>Center</SelectItem>
													<SelectItem value='right'>Right</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</>
								) : null}

								{selectedNode.data.layout === 'section' ? (
									<>
										<div className='space-y-2'>
											<Label>Size</Label>
											<Select
												value={String(selectedFrameProps['size'] ?? '2')}
												onValueChange={(v) => setFrameProp(selectedNode.id, 'size', v)}
												disabled={disabledFlag}>
												<SelectTrigger>
													<SelectValue placeholder='Size' />
												</SelectTrigger>
												<SelectContent>
													{Object.keys(RADIX_SECTION_PADDING_Y_PX).map((s) => (
														<SelectItem key={s} value={s}>
															{s}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</>
								) : null}
							</>
						) : null}

						{selectedNode.type === 'shape' ? (
							<>
								<Separator />
								<div className='space-y-2'>
									<Label>Kind</Label>
									<Select
										value={selectedNode.data.kind}
										onValueChange={(v) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'shape') return n;
												if (v === 'rect' || v === 'ellipse' || v === 'line' || v === 'arrow' || v === 'polygon' || v === 'star') {
													return { ...n, data: { ...n.data, kind: v } };
												}
												return n;
											})
										}
										disabled={disabledFlag}>
										<SelectTrigger>
											<SelectValue placeholder='Kind' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='rect'>Rect</SelectItem>
											<SelectItem value='ellipse'>Ellipse</SelectItem>
											<SelectItem value='line'>Line</SelectItem>
											<SelectItem value='arrow'>Arrow</SelectItem>
											<SelectItem value='polygon'>Polygon</SelectItem>
											<SelectItem value='star'>Star</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className='grid grid-cols-2 gap-3'>
									<div className='space-y-1'>
										<Label>Stroke (px)</Label>
										<Input
											type='number'
											value={selectedNode.data.strokeWidth ?? 0}
											onChange={(e) =>
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'shape') return n;
													return { ...n, data: { ...n.data, strokeWidth: Math.max(0, Math.round(Number(e.target.value))) } };
												})
											}
											disabled={disabledFlag}
										/>
									</div>
									<div className='space-y-1'>
										<Label>Radius (px)</Label>
										<Input
											type='number'
											value={selectedNode.data.radiusPx ?? 0}
											onChange={(e) =>
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'shape') return n;
													return { ...n, data: { ...n.data, radiusPx: Math.max(0, Math.round(Number(e.target.value))) } };
												})
											}
											disabled={disabledFlag}
										/>
									</div>
								</div>

								<div className='grid grid-cols-2 gap-3'>
									<div className='space-y-1'>
										<Label>Fill</Label>
										<Input
											value={selectedNode.data.fill ?? ''}
											onChange={(e) =>
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'shape') return n;
													return { ...n, data: { ...n.data, fill: e.target.value } };
												})
											}
											disabled={disabledFlag}
										/>
									</div>
									<div className='space-y-1'>
										<Label>Stroke</Label>
										<Input
											value={selectedNode.data.stroke ?? ''}
											onChange={(e) =>
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'shape') return n;
													return { ...n, data: { ...n.data, stroke: e.target.value } };
												})
											}
											disabled={disabledFlag}
										/>
									</div>
								</div>

								<div className='space-y-2'>
									<Label>Href</Label>
									<Input
										value={selectedNode.data.href ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'shape') return n;
												const href = e.target.value;
												return { ...n, data: { ...n.data, href: href.trim() ? href : undefined } };
											})
										}
										placeholder='/path or #anchor'
										disabled={disabledFlag}
									/>
									<p className='text-xs text-muted-foreground'>
										If set, public rendering wraps this shape (and its children) in a link.
									</p>
								</div>
							</>
						) : null}

						{selectedNode.type === 'text' ? (
							<>
								<Separator />
								<div className='space-y-2'>
									<Label>Text</Label>
									<Textarea
										value={selectedNode.data.text ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'text') return n;
												return { ...n, data: { ...n.data, text: e.target.value } };
											})
										}
										rows={4}
										disabled={disabledFlag}
									/>
								</div>
								<div className='space-y-2'>
									<Label>Variant</Label>
									<Select
										value={selectedNode.data.variant ?? 'p'}
										onValueChange={(v) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'text') return n;
												return { ...n, data: { ...n.data, variant: v as TextVariant } };
											})
										}
										disabled={disabledFlag}>
										<SelectTrigger>
											<SelectValue placeholder='Variant' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='p'>p</SelectItem>
											<SelectItem value='h1'>h1</SelectItem>
											<SelectItem value='h2'>h2</SelectItem>
											<SelectItem value='h3'>h3</SelectItem>
											<SelectItem value='h4'>h4</SelectItem>
											<SelectItem value='lead'>lead</SelectItem>
											<SelectItem value='large'>large</SelectItem>
											<SelectItem value='small'>small</SelectItem>
											<SelectItem value='muted'>muted</SelectItem>
											<SelectItem value='code'>code</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className='space-y-2'>
									<Label>ClassName</Label>
									<Input
										value={selectedNode.data.className ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'text') return n;
												return { ...n, data: { ...n.data, className: e.target.value } };
											})
										}
										placeholder='optional Tailwind classes'
										disabled={disabledFlag}
									/>
								</div>
							</>
						) : null}

						{selectedNode.type === 'button' ? (
							<>
								<Separator />
								<div className='space-y-2'>
									<Button type='button' variant='outline' size='sm' onClick={detachSelectedButtonToPrimitives} disabled={disabledFlag}>
										Convert button to shapes + text
									</Button>
									<p className='text-xs text-muted-foreground'>
										This detaches the button into editable primitives (shape wrapper + label). It will no longer be a “button” node.
									</p>
								</div>
								<div className='space-y-2'>
									<Label>Label</Label>
									<Input
										value={selectedNode.data.label ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'button') return n;
												return { ...n, data: { ...n.data, label: e.target.value } };
											})
										}
										disabled={disabledFlag}
									/>
								</div>
								<div className='space-y-2'>
									<Label>Href</Label>
									<Input
										value={selectedNode.data.href ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'button') return n;
												return { ...n, data: { ...n.data, href: e.target.value } };
											})
										}
										placeholder='https://... or /path'
										disabled={disabledFlag}
									/>
								</div>
								<div className='space-y-2'>
									<Label>Variant</Label>
									<Select
										value={selectedNode.data.variant ?? 'default'}
										onValueChange={(v) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'button') return n;
												if (
													v !== 'default' &&
													v !== 'secondary' &&
													v !== 'outline' &&
													v !== 'destructive' &&
													v !== 'ghost' &&
													v !== 'link'
												) {
													return n;
												}
												return { ...n, data: { ...n.data, variant: v } };
											})
										}
										disabled={disabledFlag}>
										<SelectTrigger>
											<SelectValue placeholder='Variant' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='default'>default</SelectItem>
											<SelectItem value='secondary'>secondary</SelectItem>
											<SelectItem value='outline'>outline</SelectItem>
											<SelectItem value='destructive'>destructive</SelectItem>
											<SelectItem value='ghost'>ghost</SelectItem>
											<SelectItem value='link'>link</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</>
						) : null}

						{selectedNode.type === 'card' ? (
							<>
								<Separator />
								<div className='space-y-2'>
									<Button type='button' variant='outline' size='sm' onClick={detachSelectedCardToPrimitives} disabled={disabledFlag}>
										Convert card to shapes + text
									</Button>
									<p className='text-xs text-muted-foreground'>
										This detaches the card into editable primitives (shape wrapper + title/body text). It will no longer be a “card” node.
									</p>
								</div>
								<div className='space-y-2'>
									<Label>Title</Label>
									<Input
										value={selectedNode.data.title ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'card') return n;
												return { ...n, data: { ...n.data, title: e.target.value } };
											})
										}
										disabled={disabledFlag}
									/>
								</div>
								<div className='space-y-2'>
									<Label>Body</Label>
									<Textarea
										value={selectedNode.data.body ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'card') return n;
												return { ...n, data: { ...n.data, body: e.target.value } };
											})
										}
										rows={5}
										disabled={disabledFlag}
									/>
								</div>
							</>
						) : null}

						{selectedNode.type === 'menu' ? (
							<>
								<Separator />
								<div className='space-y-2'>
									<Button
										type='button'
										variant='outline'
										size='sm'
										onClick={detachSelectedMenuToPrimitives}
										disabled={disabledFlag || detachingMenu}>
										{detachingMenu ? 'Converting…' : 'Convert menu to shapes + text'}
									</Button>
									<p className='text-xs text-muted-foreground'>
										This detaches the menu into editable primitives (wrapper → logo → links → labels). It no longer syncs with the DB menu.
									</p>
									{detachMenuError ? <p className='text-xs text-red-600'>{detachMenuError}</p> : null}
								</div>

								<div className='space-y-2'>
									<Label>Menu slug</Label>
									<Input
										value={selectedNode.data.menu ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'menu') return n;
												return { ...n, data: { ...n.data, menu: e.target.value } };
											})
										}
										placeholder='e.g. main'
										disabled={disabledFlag}
									/>
									<p className='text-xs text-muted-foreground'>
										References a DB menu. Enable embedded items below to render without fetching.
									</p>
								</div>
								<div className='space-y-2'>
									<Label>Kind</Label>
									<Select
										value={selectedNode.data.kind === 'footer' ? 'footer' : 'top'}
										onValueChange={(v) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'menu') return n;
												if (v !== 'top' && v !== 'footer') return n;
												return { ...n, data: { ...n.data, kind: v } };
											})
										}
										disabled={disabledFlag}>
										<SelectTrigger>
											<SelectValue placeholder='Kind' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='top'>top</SelectItem>
											<SelectItem value='footer'>footer</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className='flex items-center gap-2'>
									<Checkbox
										checked={Array.isArray(selectedNode.data.items)}
										onCheckedChange={(checked) => {
											const on = checked === true;
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'menu') return n;
												if (on) {
													const existing = Array.isArray(n.data.items) ? n.data.items : [];
													if (existing.length) return n;
													return {
														...n,
														data: {
															...n.data,
															items: [{ id: createId('menuitem'), label: 'Home', href: '/' }],
														},
													};
												}
												const nextData = { ...n.data };
												delete (nextData as { items?: unknown }).items;
												return { ...n, data: nextData };
											});
										}}
										disabled={disabledFlag}
									/>
									<span className='text-sm'>Use embedded items</span>
								</div>

								{Array.isArray(selectedNode.data.items) ? (
									<div className='space-y-2'>
										<Label>Items</Label>
										<div className='space-y-2'>
											{selectedNode.data.items.map((it, idx) => (
												<div key={it.id ?? idx} className='rounded-md border bg-muted/10 p-2 space-y-2'>
													<div className='grid grid-cols-2 gap-2'>
														<div className='space-y-1'>
															<Label className='text-xs'>Label</Label>
															<Input
																value={it.label ?? ''}
																onChange={(e) => {
																	const v = e.target.value;
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'menu') return n;
																		const items = Array.isArray(n.data.items) ? [...n.data.items] : [];
																		if (!items[idx]) return n;
																		items[idx] = { ...items[idx], label: v };
																		return { ...n, data: { ...n.data, items } };
																	});
																}}
																disabled={disabledFlag}
															/>
														</div>
														<div className='space-y-1'>
															<Label className='text-xs'>Href</Label>
															<Input
																value={it.href ?? ''}
																onChange={(e) => {
																	const v = e.target.value;
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'menu') return n;
																		const items = Array.isArray(n.data.items) ? [...n.data.items] : [];
																		if (!items[idx]) return n;
																		items[idx] = { ...items[idx], href: v };
																		return { ...n, data: { ...n.data, items } };
																	});
																}}
																disabled={disabledFlag}
															/>
														</div>
													</div>
													<div className='flex items-center justify-end gap-2'>
														<Button
															type='button'
															size='sm'
															variant='outline'
															onClick={() => {
																updateNode(selectedNode.id, (n) => {
																	if (n.type !== 'menu') return n;
																	const items = Array.isArray(n.data.items) ? [...n.data.items] : [];
																	if (!items[idx]) return n;
																	if (idx > 0) {
																		const tmp = items[idx - 1];
																		items[idx - 1] = items[idx];
																		items[idx] = tmp;
																	}
																	return { ...n, data: { ...n.data, items } };
																});
															}}
															disabled={disabledFlag || idx === 0}>
															Up
														</Button>
														<Button
															type='button'
															size='sm'
															variant='outline'
															onClick={() => {
																updateNode(selectedNode.id, (n) => {
																	if (n.type !== 'menu') return n;
																	const items = Array.isArray(n.data.items) ? [...n.data.items] : [];
																	if (!items[idx]) return n;
																	if (idx < items.length - 1) {
																		const tmp = items[idx + 1];
																		items[idx + 1] = items[idx];
																		items[idx] = tmp;
																	}
																	return { ...n, data: { ...n.data, items } };
																});
															}}
															disabled={disabledFlag || idx >= (selectedNode.data.items?.length ?? 0) - 1}>
															Down
														</Button>
														<Button
															type='button'
															size='sm'
															variant='destructive'
															onClick={() => {
																updateNode(selectedNode.id, (n) => {
																	if (n.type !== 'menu') return n;
																	const items = Array.isArray(n.data.items) ? [...n.data.items] : [];
																	items.splice(idx, 1);
																	return { ...n, data: { ...n.data, items } };
																});
															}}
															disabled={disabledFlag}>
															Remove
														</Button>
													</div>
												</div>
											))}
										</div>
										<Button
											type='button'
											variant='outline'
											size='sm'
											onClick={() => {
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'menu') return n;
													const items = Array.isArray(n.data.items) ? [...n.data.items] : [];
													items.push({ id: createId('menuitem'), label: 'Link', href: '#' });
													return { ...n, data: { ...n.data, items } };
												});
											}}
											disabled={disabledFlag}>
											Add item
										</Button>
									</div>
								) : null}
							</>
						) : null}

						{selectedNode.type === 'image' ? (
							<>
								<Separator />
								<div className='space-y-2'>
									<Label>URL</Label>
									<Input
										value={selectedNode.data.url ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'image') return n;
												return { ...n, data: { ...n.data, url: e.target.value } };
											})
										}
										disabled={disabledFlag}
									/>
								</div>
								<div className='space-y-2'>
									<Label>Alt</Label>
									<Input
										value={selectedNode.data.alt ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'image') return n;
												return { ...n, data: { ...n.data, alt: e.target.value } };
											})
										}
										disabled={disabledFlag}
									/>
								</div>
								<Button type='button' variant='outline' onClick={() => beginPickMedia(selectedNode.id)} disabled={disabledFlag}>
									Choose from library
								</Button>
							</>
						) : null}

						{selectedNode.type === 'collection-list' ? (
							<>
								<Separator />
								<div className='space-y-2'>
									<Label>Collection type slug</Label>
									<Input
										value={selectedNode.data.type_slug ?? ''}
										onChange={(e) =>
											updateNode(selectedNode.id, (n) => {
												if (n.type !== 'collection-list') return n;
												return { ...n, data: { ...n.data, type_slug: e.target.value } };
											})
										}
										placeholder='e.g. products'
										disabled={disabledFlag}
									/>
									<p className='text-xs text-muted-foreground'>
										Matches backend <code>content_types.slug</code>.
									</p>
								</div>
								<div className='grid grid-cols-2 gap-3'>
									<div className='space-y-1'>
										<Label>Limit</Label>
										<Input
											type='number'
											value={selectedNode.data.limit ?? 6}
											onChange={(e) =>
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'collection-list') return n;
													const next = Math.max(1, Math.round(Number(e.target.value) || 1));
													return { ...n, data: { ...n.data, limit: next } };
												})
											}
											disabled={disabledFlag}
										/>
									</div>
									<div className='space-y-1'>
										<Label>Columns</Label>
										<Input
											type='number'
											value={selectedNode.data.columns ?? 3}
											onChange={(e) =>
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'collection-list') return n;
													const next = Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1)));
													return { ...n, data: { ...n.data, columns: next } };
												})
											}
											disabled={disabledFlag}
										/>
									</div>
								</div>
								<div className='grid grid-cols-2 gap-3'>
									<div className='space-y-1'>
										<Label>Sort</Label>
										<Input
											value={selectedNode.data.sort ?? 'created_at'}
											onChange={(e) =>
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'collection-list') return n;
													return { ...n, data: { ...n.data, sort: e.target.value } };
												})
											}
											placeholder='created_at'
											disabled={disabledFlag}
										/>
									</div>
									<div className='space-y-1'>
										<Label>Dir</Label>
										<Select
											value={selectedNode.data.dir ?? 'desc'}
											onValueChange={(v) =>
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'collection-list') return n;
													if (v !== 'asc' && v !== 'desc') return n;
													return { ...n, data: { ...n.data, dir: v } };
												})
											}
											disabled={disabledFlag}>
											<SelectTrigger>
												<SelectValue placeholder='Dir' />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='desc'>Desc</SelectItem>
												<SelectItem value='asc'>Asc</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</>
						) : null}

						{selectedNode.type === 'shadcn' ? (
							<>
								<Separator />
								{canConvertShadcnToPrimitives(selectedNode) ? (
									<div className='space-y-2'>
										<Button
											type='button'
											variant='outline'
											size='sm'
											onClick={detachSelectedShadcnToPrimitives}
											disabled={disabledFlag}>
											Convert to primitives
										</Button>
										<p className='text-xs text-muted-foreground'>
											Supported: button, card, badge, separator, typography. Other shadcn components remain rendered components.
										</p>
									</div>
								) : null}
								<ComponentDataEditor
									type='shadcn'
									value={selectedNode.data}
									onChange={(next) =>
										updateNode(selectedNode.id, (n) => {
											if (n.type !== 'shadcn') return n;
											if (!isRecord(next)) return n;
											const rec = next as Record<string, unknown>;
											const component = typeof rec['component'] === 'string' ? String(rec['component']) : n.data.component;
											const props = isRecord(rec['props']) ? (rec['props'] as Record<string, unknown>) : (n.data.props ?? {});
											return { ...n, data: { ...n.data, component, props } };
										})
									}
									disabled={disabledFlag}
								/>
								<div className='space-y-2'>
									<Label>Children (JSON)</Label>
									<Textarea
										value={selectedNode.children ? JSON.stringify(selectedNode.children, null, 2) : ''}
										onChange={(e) => {
											const raw = e.target.value;
												try {
													const parsed = raw.trim() ? JSON.parse(raw) : null;
													if (!parsed) {
														updateNode(selectedNode.id, (n) => {
															if (n.type !== 'shadcn') return n;
															return { ...n, children: undefined };
														});
														return;
													}
												if (!Array.isArray(parsed)) return;
												updateNode(selectedNode.id, (n) => {
													if (n.type !== 'shadcn') return n;
													return { ...n, children: parsed };
												});
											} catch {
												// ignore invalid JSON while typing
											}
										}}
										disabled={disabledFlag}
										rows={6}
									/>
									<p className='text-xs text-muted-foreground'>
										Used for structural components (e.g. tabs, accordion) to host other components.
									</p>
								</div>
							</>
						) : null}
					</>
				) : (
					<div className='text-sm text-muted-foreground'>
						Select a node on the canvas or in the outline.
					</div>
				)}
			</div>
		</>
	);

	return (
		<Theme
			asChild
			hasBackground={false}>
			<div className={cn('hooshpro-builder flex w-full flex-col min-h-0 overflow-hidden', fullHeight ? 'min-h-[100svh]' : 'h-full', className)}>
			{/* Legacy toolbar (deprecated)
			<div className='hidden'>
				<div className='flex items-center gap-2'>
					<Button type='button' variant='outline' size='sm' onClick={() => setBlockPickerOpen(true)} disabled={disabledFlag}>
						<Plus className='h-4 w-4 mr-1' />
						Component
					</Button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type='button' variant='outline' size='sm' disabled={disabledFlag}>
								<Plus className='h-4 w-4 mr-1' />
								Row
								<ChevronDown className='h-4 w-4 ml-1 opacity-60' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='start'>
							{FRAME_LAYOUT_PRESETS.map((preset) => (
								<DropdownMenuItem
									key={preset.slug}
									onSelect={() => addFrame(preset.layout)}>
									<div className='flex flex-col'>
										<span className='font-medium'>{preset.label}</span>
										<span className='text-xs text-muted-foreground'>/{preset.slug} · frame</span>
									</div>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					<Button type='button' variant='outline' size='sm' onClick={() => setTemplatePickerOpen(true)} disabled={disabledFlag}>
						<Plus className='h-4 w-4 mr-1' />
						Block
					</Button>
				</div>

				<div className='flex items-center gap-2'>
					<Button
						type='button'
						variant='outline'
						size='icon'
						onClick={() => setOutlineOpen(true)}
						disabled={disabledFlag}>
						<ListTree className='h-4 w-4' />
						<span className='sr-only'>Outline</span>
					</Button>
					<Popover
						open={inspectorOpen}
						onOpenChange={setInspectorOpen}>
						<PopoverTrigger asChild>
							<Button
								type='button'
								variant='outline'
								size='icon'
								disabled={disabledFlag}>
								<SlidersHorizontal className='h-4 w-4' />
								<span className='sr-only'>Inspector</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent
							side='bottom'
							align='end'
							className='w-[420px] max-w-[90vw] p-0'
							onOpenAutoFocus={(e) => e.preventDefault()}>
							<div className='flex max-h-[70vh] flex-col'>
								<div className='border-b p-4'>
									<div className='flex items-start justify-between gap-2'>
										<div className='space-y-1 min-w-0'>
											<h4 className='text-sm font-semibold'>Inspector</h4>
											<p className='text-xs text-muted-foreground truncate'>
												{selectedNode ? `${selectedNode.type} · ${selectedNode.id}` : 'Select a node'}
											</p>
										</div>
										{selectedNode ? (
											<div className='flex items-center gap-1'>
												<Button type='button' variant='outline' size='icon' onClick={duplicateSelected} disabled={disabledFlag}>
													<Copy className='h-4 w-4' />
													<span className='sr-only'>Duplicate</span>
												</Button>
												<Button type='button' variant='destructive' size='icon' onClick={removeSelected} disabled={disabledFlag}>
													<Trash2 className='h-4 w-4' />
													<span className='sr-only'>Delete</span>
												</Button>
											</div>
										) : null}
									</div>
								</div>

								<div className='flex-1 overflow-auto p-4 space-y-4'>
									{selectedNode ? (
										<>
											<div className='grid grid-cols-2 gap-3'>
												<div className='space-y-1'>
													<Label>X</Label>
													<Input type='number' value={Math.round(selectedNode.frames[breakpoint].x)} onChange={(e) => updateFrame(selectedNode.id, (f) => ({ ...f, x: Number(e.target.value) }))} disabled={disabledFlag} />
												</div>
												<div className='space-y-1'>
													<Label>Y</Label>
													<Input type='number' value={Math.round(selectedNode.frames[breakpoint].y)} onChange={(e) => updateFrame(selectedNode.id, (f) => ({ ...f, y: Number(e.target.value) }))} disabled={disabledFlag} />
												</div>
												<div className='space-y-1'>
													<Label>W</Label>
													<Input type='number' value={Math.round(selectedNode.frames[breakpoint].w)} onChange={(e) => updateFrame(selectedNode.id, (f) => ({ ...f, w: clampMin(Number(e.target.value), MIN_NODE_W) }))} disabled={disabledFlag} />
												</div>
												<div className='space-y-1'>
													<Label>H</Label>
													<Input type='number' value={Math.round(selectedNode.frames[breakpoint].h)} onChange={(e) => updateFrame(selectedNode.id, (f) => ({ ...f, h: clampMin(Number(e.target.value), MIN_NODE_H) }))} disabled={disabledFlag} />
												</div>
											</div>
											{pctW !== null && pctH !== null ? (
												<p className='text-xs text-muted-foreground'>Size: {Math.round(pctW * 10) / 10}% w · {Math.round(pctH * 10) / 10}% h of parent</p>
											) : null}
											{parentSizeForUi ? (
												<div className='flex items-center gap-2'>
													<Button type='button' variant='outline' size='sm' onClick={() => fillParentWidth(selectedNode)} disabled={disabledFlag}>
														Fill width
													</Button>
													<span className='text-xs text-muted-foreground'>
														Parent: {Math.round(parentSizeForUi.width)}px
													</span>
												</div>
											) : null}

											{selectedNode.type === 'frame' ? (
												<>
													<Separator />
													<div className='space-y-2'>
														<Label>Label</Label>
														<Input value={selectedNode.data.label ?? ''} onChange={(e) => updateNode(selectedNode.id, (n) => ({ ...n, type: 'frame', data: { ...n.data, label: e.target.value } }))} disabled={disabledFlag} />
													</div>
													<div className='space-y-2'>
														<Label>ClassName</Label>
														<Input value={selectedNode.data.className ?? ''} onChange={(e) => updateNode(selectedNode.id, (n) => ({ ...n, type: 'frame', data: { ...n.data, className: e.target.value } }))} disabled={disabledFlag} />
													</div>
													<div className='space-y-2'>
														<Label>Padding (px)</Label>
														<Input type='number' value={selectedNode.data.paddingPx ?? 0} onChange={(e) => updateNode(selectedNode.id, (n) => ({ ...n, type: 'frame', data: { ...n.data, paddingPx: Math.max(0, Math.round(Number(e.target.value))) } }))} disabled={disabledFlag} />
													</div>
													<div className='flex items-center gap-2'>
														<Checkbox
															id='frame-clip-contents'
															checked={selectedNode.data.clip ?? false}
															onCheckedChange={(checked) =>
																updateNode(selectedNode.id, (n) => {
																	if (n.type !== 'frame') return n;
																	return { ...n, data: { ...n.data, clip: checked === true ? true : undefined } };
																})
															}
															disabled={disabledFlag}
														/>
														<Label htmlFor='frame-clip-contents'>Clip contents</Label>
													</div>
													<div className='space-y-2'>
														<Label>Layout</Label>
														<Select
															value={selectedNode.data.layout ?? 'none'}
															onValueChange={(v) =>
																updateNode(selectedNode.id, (n) => {
																	if (n.type !== 'frame') return n;
																	const nextLayout =
																		v === 'box' || v === 'flex' || v === 'grid' || v === 'container' || v === 'section'
																			? (v as FrameBlock['data']['layout'])
																			: undefined;
																	return { ...n, data: { ...n.data, layout: nextLayout } };
																})
															}
															disabled={disabledFlag}>
															<SelectTrigger>
																<SelectValue placeholder='none' />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value='none'>none</SelectItem>
																<SelectItem value='box'>Box</SelectItem>
																<SelectItem value='flex'>Flex</SelectItem>
																<SelectItem value='grid'>Grid</SelectItem>
																<SelectItem value='container'>Container</SelectItem>
																<SelectItem value='section'>Section</SelectItem>
															</SelectContent>
														</Select>
													</div>
													{selectedNode.data.layout ? (
														<div className='grid grid-cols-2 gap-3'>
															{selectedNode.data.layout === 'section' ? (
																<>
																	<div className='space-y-2'>
																		<Label>Section size</Label>
																		<Select
																			value={typeof selectedFrameProps['size'] === 'string' ? String(selectedFrameProps['size']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'size', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='1'>1</SelectItem>
																				<SelectItem value='2'>2</SelectItem>
																				<SelectItem value='3'>3</SelectItem>
																				<SelectItem value='4'>4</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Section display</Label>
																		<Select
																			value={typeof selectedFrameProps['display'] === 'string' ? String(selectedFrameProps['display']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'display', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='initial'>initial</SelectItem>
																				<SelectItem value='none'>none</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																</>
															) : null}

															{selectedNode.data.layout === 'container' ? (
																<>
																	<div className='space-y-2'>
																		<Label>Container display</Label>
																		<Select
																			value={typeof selectedFrameProps['display'] === 'string' ? String(selectedFrameProps['display']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'display', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='initial'>initial</SelectItem>
																				<SelectItem value='none'>none</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Container size</Label>
																		<Select
																			value={typeof selectedFrameProps['size'] === 'string' ? String(selectedFrameProps['size']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'size', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='1'>1</SelectItem>
																				<SelectItem value='2'>2</SelectItem>
																				<SelectItem value='3'>3</SelectItem>
																				<SelectItem value='4'>4</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Container align</Label>
																		<Select
																			value={typeof selectedFrameProps['align'] === 'string' ? String(selectedFrameProps['align']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'align', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='left'>left</SelectItem>
																				<SelectItem value='center'>center</SelectItem>
																				<SelectItem value='right'>right</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																</>
															) : null}

															{selectedNode.data.layout === 'flex' ? (
																<>
																	<div className='space-y-2'>
																		<Label>Flex display</Label>
																		<Select
																			value={typeof selectedFrameProps['display'] === 'string' ? String(selectedFrameProps['display']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'display', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='flex'>flex</SelectItem>
																				<SelectItem value='inline-flex'>inline-flex</SelectItem>
																				<SelectItem value='none'>none</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Flex direction</Label>
																		<Select
																			value={typeof selectedFrameProps['direction'] === 'string' ? String(selectedFrameProps['direction']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'direction', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='row'>row</SelectItem>
																				<SelectItem value='column'>column</SelectItem>
																				<SelectItem value='row-reverse'>row-reverse</SelectItem>
																				<SelectItem value='column-reverse'>column-reverse</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Flex wrap</Label>
																		<Select
																			value={typeof selectedFrameProps['wrap'] === 'string' ? String(selectedFrameProps['wrap']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'wrap', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='nowrap'>nowrap</SelectItem>
																				<SelectItem value='wrap'>wrap</SelectItem>
																				<SelectItem value='wrap-reverse'>wrap-reverse</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Flex gap</Label>
																		<Input
																			value={typeof selectedFrameProps['gap'] === 'string' ? String(selectedFrameProps['gap']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'gap', e.target.value)}
																			placeholder='0-9 or 12px'
																			disabled={disabledFlag}
																		/>
																	</div>
																	<div className='space-y-2'>
																		<Label>Flex gapX</Label>
																		<Input
																			value={typeof selectedFrameProps['gapX'] === 'string' ? String(selectedFrameProps['gapX']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'gapX', e.target.value)}
																			placeholder='0-9 or 12px'
																			disabled={disabledFlag}
																		/>
																	</div>
																	<div className='space-y-2'>
																		<Label>Flex gapY</Label>
																		<Input
																			value={typeof selectedFrameProps['gapY'] === 'string' ? String(selectedFrameProps['gapY']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'gapY', e.target.value)}
																			placeholder='0-9 or 12px'
																			disabled={disabledFlag}
																		/>
																	</div>
																	<div className='space-y-2'>
																		<Label>Flex align</Label>
																		<Select
																			value={typeof selectedFrameProps['align'] === 'string' ? String(selectedFrameProps['align']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'align', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='start'>start</SelectItem>
																				<SelectItem value='center'>center</SelectItem>
																				<SelectItem value='end'>end</SelectItem>
																				<SelectItem value='baseline'>baseline</SelectItem>
																				<SelectItem value='stretch'>stretch</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Flex justify</Label>
																		<Select
																			value={typeof selectedFrameProps['justify'] === 'string' ? String(selectedFrameProps['justify']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'justify', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='start'>start</SelectItem>
																				<SelectItem value='center'>center</SelectItem>
																				<SelectItem value='end'>end</SelectItem>
																				<SelectItem value='between'>between</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																</>
															) : null}

															{selectedNode.data.layout === 'grid' ? (
																<>
																	<div className='space-y-2'>
																		<Label>Grid display</Label>
																		<Select
																			value={typeof selectedFrameProps['display'] === 'string' ? String(selectedFrameProps['display']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'display', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='grid'>grid</SelectItem>
																				<SelectItem value='inline-grid'>inline-grid</SelectItem>
																				<SelectItem value='none'>none</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Grid columns</Label>
																		<Input
																			value={typeof selectedFrameProps['columns'] === 'string' ? String(selectedFrameProps['columns']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'columns', e.target.value)}
																			placeholder='1-9 or 100px 1fr'
																			disabled={disabledFlag}
																		/>
																	</div>
																	<div className='space-y-2'>
																		<Label>Grid rows</Label>
																		<Input
																			value={typeof selectedFrameProps['rows'] === 'string' ? String(selectedFrameProps['rows']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'rows', e.target.value)}
																			placeholder='1-9 or 100px 1fr'
																			disabled={disabledFlag}
																		/>
																	</div>
																	<div className='space-y-2'>
																		<Label>Grid gap</Label>
																		<Input
																			value={typeof selectedFrameProps['gap'] === 'string' ? String(selectedFrameProps['gap']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'gap', e.target.value)}
																			placeholder='0-9 or 12px'
																			disabled={disabledFlag}
																		/>
																	</div>
																	<div className='space-y-2'>
																		<Label>Grid gapX</Label>
																		<Input
																			value={typeof selectedFrameProps['gapX'] === 'string' ? String(selectedFrameProps['gapX']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'gapX', e.target.value)}
																			placeholder='0-9 or 12px'
																			disabled={disabledFlag}
																		/>
																	</div>
																	<div className='space-y-2'>
																		<Label>Grid gapY</Label>
																		<Input
																			value={typeof selectedFrameProps['gapY'] === 'string' ? String(selectedFrameProps['gapY']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'gapY', e.target.value)}
																			placeholder='0-9 or 12px'
																			disabled={disabledFlag}
																		/>
																	</div>
																	<div className='space-y-2'>
																		<Label>Grid flow</Label>
																		<Select
																			value={typeof selectedFrameProps['flow'] === 'string' ? String(selectedFrameProps['flow']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'flow', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='row'>row</SelectItem>
																				<SelectItem value='column'>column</SelectItem>
																				<SelectItem value='dense'>dense</SelectItem>
																				<SelectItem value='row-dense'>row-dense</SelectItem>
																				<SelectItem value='column-dense'>column-dense</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Grid align</Label>
																		<Select
																			value={typeof selectedFrameProps['align'] === 'string' ? String(selectedFrameProps['align']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'align', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='start'>start</SelectItem>
																				<SelectItem value='center'>center</SelectItem>
																				<SelectItem value='end'>end</SelectItem>
																				<SelectItem value='baseline'>baseline</SelectItem>
																				<SelectItem value='stretch'>stretch</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Grid justify</Label>
																		<Select
																			value={typeof selectedFrameProps['justify'] === 'string' ? String(selectedFrameProps['justify']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'justify', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='start'>start</SelectItem>
																				<SelectItem value='center'>center</SelectItem>
																				<SelectItem value='end'>end</SelectItem>
																				<SelectItem value='between'>between</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2 col-span-2'>
																		<Label>Grid areas</Label>
																		<Textarea
																			value={typeof selectedFrameProps['areas'] === 'string' ? String(selectedFrameProps['areas']) : ''}
																			onChange={(e) => setFrameProp(selectedNode.id, 'areas', e.target.value.trim() ? e.target.value : undefined)}
																			placeholder={'\"header header\"\\n\"sidebar content\"'}
																			rows={3}
																			disabled={disabledFlag}
																			className='font-mono text-xs'
																		/>
																	</div>
																</>
															) : null}

															{selectedNode.data.layout === 'box' ? (
																<>
																	<div className='space-y-2'>
																		<Label>Box as</Label>
																		<Select
																			value={typeof selectedFrameProps['as'] === 'string' ? String(selectedFrameProps['as']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'as', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='div'>div</SelectItem>
																				<SelectItem value='span'>span</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																	<div className='space-y-2'>
																		<Label>Box display</Label>
																		<Select
																			value={typeof selectedFrameProps['display'] === 'string' ? String(selectedFrameProps['display']) : 'default'}
																			onValueChange={(v) => setFrameProp(selectedNode.id, 'display', v === 'default' ? undefined : v)}
																			disabled={disabledFlag}>
																			<SelectTrigger>
																				<SelectValue placeholder='default' />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value='default'>default</SelectItem>
																				<SelectItem value='none'>none</SelectItem>
																				<SelectItem value='inline'>inline</SelectItem>
																				<SelectItem value='inline-block'>inline-block</SelectItem>
																				<SelectItem value='block'>block</SelectItem>
																				<SelectItem value='contents'>contents</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>
																</>
															) : null}
														</div>
													) : null}
													<div className='space-y-2'>
														<Label>Layout props (JSON)</Label>
														<Textarea
															value={JSON.stringify(selectedNode.data.props ?? {}, null, 2)}
															onChange={(e) => {
																try {
																	const raw = e.target.value.trim();
																	const parsed = raw ? JSON.parse(raw) : {};
																	if (!isRecord(parsed)) return;
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'frame') return n;
																		return { ...n, data: { ...n.data, props: parsed } };
																	});
																} catch {
																	// ignore invalid JSON while typing
																}
															}}
															rows={6}
															disabled={disabledFlag}
															className='font-mono text-xs'
														/>
													</div>
												</>
											) : null}

											{selectedNode.type === 'shape' ? (
												<>
													<Separator />
													<div className='grid grid-cols-2 gap-3'>
														<div className='space-y-1'>
															<Label>Kind</Label>
															<Select
																value={selectedNode.data.kind ?? 'rect'}
																onValueChange={(v) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'shape') return n;
																		return { ...n, data: { ...n.data, kind: v as ShapeKind } };
																	})
																}
																disabled={disabledFlag}>
																<SelectTrigger>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem value='rect'>rect</SelectItem>
																	<SelectItem value='ellipse'>ellipse</SelectItem>
																	<SelectItem value='line'>line</SelectItem>
																	<SelectItem value='arrow'>arrow</SelectItem>
																	<SelectItem value='polygon'>polygon</SelectItem>
																	<SelectItem value='star'>star</SelectItem>
																</SelectContent>
															</Select>
														</div>
														<div className='space-y-1'>
															<Label>Stroke width</Label>
															<Input
																type='number'
																value={selectedNode.data.strokeWidth ?? 2}
																onChange={(e) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'shape') return n;
																		const next = Math.max(0, Math.min(50, Number(e.target.value) || 0));
																		return { ...n, data: { ...n.data, strokeWidth: next } };
																	})
																}
																disabled={disabledFlag}
															/>
														</div>
													</div>

													<div className='grid grid-cols-2 gap-3'>
														<div className='space-y-1'>
															<Label>Fill</Label>
															<Input
																value={selectedNode.data.fill ?? ''}
																onChange={(e) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'shape') return n;
																		const v = e.target.value.trim();
																		return { ...n, data: { ...n.data, fill: v || undefined } };
																	})
																}
																placeholder='transparent or #...'
																disabled={disabledFlag}
															/>
														</div>
														<div className='space-y-1'>
															<Label>Stroke</Label>
															<Input
																value={selectedNode.data.stroke ?? ''}
																onChange={(e) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'shape') return n;
																		const v = e.target.value.trim();
																		return { ...n, data: { ...n.data, stroke: v || undefined } };
																	})
																}
																placeholder='#...'
																disabled={disabledFlag}
															/>
														</div>
													</div>

													{(selectedNode.data.kind ?? 'rect') === 'rect' ? (
														<div className='space-y-1'>
															<Label>Radius (px)</Label>
															<Input
																type='number'
																value={selectedNode.data.radiusPx ?? 8}
																onChange={(e) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'shape') return n;
																		const next = Math.max(0, Math.min(500, Number(e.target.value) || 0));
																		return { ...n, data: { ...n.data, radiusPx: next } };
																	})
																}
																disabled={disabledFlag}
															/>
														</div>
													) : null}
												</>
											) : null}

											{selectedNode.type === 'image' ? (
												<>
													<Separator />
													<div className='space-y-2'>
														<Label>Alt</Label>
														<Input
															value={selectedNode.data.alt ?? ''}
															onChange={(e) =>
																updateNode(selectedNode.id, (n) => {
																	if (n.type !== 'image') return n;
																	return { ...n, data: { ...n.data, alt: e.target.value } };
																})
															}
															disabled={disabledFlag}
														/>
													</div>
													<div className='space-y-2'>
														<Label>URL</Label>
														<Input
															value={selectedNode.data.url ?? ''}
															onChange={(e) =>
																updateNode(selectedNode.id, (n) => {
																	if (n.type !== 'image') return n;
																	return { ...n, data: { ...n.data, url: e.target.value } };
																})
															}
															disabled={disabledFlag}
														/>
													</div>
													<Button type='button' variant='outline' onClick={() => beginPickMedia(selectedNode.id)} disabled={disabledFlag}>
														Pick from media…
													</Button>
												</>
											) : null}

											{selectedNode.type === 'collection-list' ? (
												<>
													<Separator />
													<div className='space-y-2'>
														<Label>Collection type slug</Label>
														<Input
															value={selectedNode.data.type_slug ?? ''}
															onChange={(e) =>
																updateNode(selectedNode.id, (n) => {
																	if (n.type !== 'collection-list') return n;
																	return { ...n, data: { ...n.data, type_slug: e.target.value } };
																})
															}
															placeholder='e.g. products'
															disabled={disabledFlag}
														/>
														<p className='text-xs text-muted-foreground'>
															Matches backend <code>content_types.slug</code>.
														</p>
													</div>

													<div className='grid grid-cols-2 gap-3'>
														<div className='space-y-1'>
															<Label>Columns</Label>
															<Input
																type='number'
																value={selectedNode.data.columns ?? 3}
																onChange={(e) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'collection-list') return n;
																		const next = Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1)));
																		return { ...n, data: { ...n.data, columns: next } };
																	})
																}
																disabled={disabledFlag}
															/>
														</div>
														<div className='space-y-1'>
															<Label>Limit</Label>
															<Input
																type='number'
																value={selectedNode.data.limit ?? 6}
																onChange={(e) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'collection-list') return n;
																		const next = Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1)));
																		return { ...n, data: { ...n.data, limit: next } };
																	})
																}
																disabled={disabledFlag}
															/>
														</div>
													</div>

													<div className='grid grid-cols-2 gap-3'>
														<div className='space-y-1'>
															<Label>Sort</Label>
															<Select
																value={selectedNode.data.sort ?? 'published_at'}
																onValueChange={(v) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'collection-list') return n;
																		return { ...n, data: { ...n.data, sort: v } };
																	})
																}
																disabled={disabledFlag}>
																<SelectTrigger>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem value='published_at'>published_at</SelectItem>
																	<SelectItem value='updated_at'>updated_at</SelectItem>
																	<SelectItem value='created_at'>created_at</SelectItem>
																	<SelectItem value='title'>title</SelectItem>
																	<SelectItem value='slug'>slug</SelectItem>
																	<SelectItem value='order_index'>order_index</SelectItem>
																	<SelectItem value='id'>id</SelectItem>
																</SelectContent>
															</Select>
														</div>
														<div className='space-y-1'>
															<Label>Dir</Label>
															<Select
																value={selectedNode.data.dir ?? 'desc'}
																onValueChange={(v) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'collection-list') return n;
																		return { ...n, data: { ...n.data, dir: v === 'asc' ? 'asc' : 'desc' } };
																	})
																}
																disabled={disabledFlag}>
																<SelectTrigger>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem value='desc'>desc</SelectItem>
																	<SelectItem value='asc'>asc</SelectItem>
																</SelectContent>
															</Select>
														</div>
													</div>

													<div className='grid grid-cols-2 gap-3'>
														<div className='space-y-1'>
															<Label>Image field</Label>
															<Input
																value={selectedNode.data.image_field ?? ''}
																onChange={(e) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'collection-list') return n;
																		const v = e.target.value.trim();
																		return { ...n, data: { ...n.data, image_field: v || undefined } };
																	})
																}
																placeholder='e.g. image'
																disabled={disabledFlag}
															/>
														</div>
														<div className='space-y-1'>
															<Label>Subtitle field</Label>
															<Input
																value={selectedNode.data.subtitle_field ?? ''}
																onChange={(e) =>
																	updateNode(selectedNode.id, (n) => {
																		if (n.type !== 'collection-list') return n;
																		const v = e.target.value.trim();
																		return { ...n, data: { ...n.data, subtitle_field: v || undefined } };
																	})
																}
																placeholder='e.g. price'
																disabled={disabledFlag}
															/>
														</div>
													</div>
												</>
											) : null}

											{selectedNode.type === 'shadcn' ? (
												<>
													<Separator />
													<ComponentDataEditor
														type='shadcn'
														value={{
															component: selectedNode.data.component ?? '',
															props: selectedNode.data.props ?? {},
														}}
														disabled={disabledFlag}
														onChange={(next) => {
															updateNode(selectedNode.id, (n) => {
																if (n.type !== 'shadcn') return n;
																const rec = isRecord(next) ? (next as Record<string, unknown>) : {};
																const component =
																	typeof rec['component'] === 'string'
																		? String(rec['component']).trim().toLowerCase()
																		: n.data.component;
																const props = isRecord(rec['props']) ? (rec['props'] as Record<string, unknown>) : undefined;
																return { ...n, data: props ? { component, props } : { component } };
															});
														}}
													/>
												</>
											) : null}
										</>
									) : (
										<div className='text-sm text-muted-foreground'>Select a node to edit its props.</div>
									)}
								</div>
							</div>
						</PopoverContent>
					</Popover>

					<span className='text-xs text-muted-foreground'>Zoom:</span>
					<Button
						type='button'
						variant='outline'
						size='icon'
						onClick={() => setZoomCentered(zoomValue / 1.08)}
						disabled={disabledFlag}>
						<ZoomOut className='h-4 w-4' />
						<span className='sr-only'>Zoom out</span>
					</Button>
					<div className='w-[72px] text-center text-xs tabular-nums text-muted-foreground'>
						{Math.round(zoomValue * 100)}%
					</div>
					<Button
						type='button'
						variant='outline'
						size='icon'
						onClick={() => setZoomCentered(zoomValue * 1.08)}
						disabled={disabledFlag}>
						<ZoomIn className='h-4 w-4' />
						<span className='sr-only'>Zoom in</span>
					</Button>
					<Button
						type='button'
						variant='outline'
						size='icon'
						onClick={() => setZoomCentered(1)}
						disabled={disabledFlag}>
						<RotateCcw className='h-4 w-4' />
						<span className='sr-only'>Reset zoom</span>
					</Button>

					<span className='text-xs text-muted-foreground'>Breakpoint:</span>
					<Button type='button' variant={breakpoint === 'mobile' ? 'secondary' : 'outline'} size='icon' onClick={() => setBreakpoint('mobile')} disabled={disabledFlag}>
						<Smartphone className='h-4 w-4' />
						<span className='sr-only'>Mobile</span>
					</Button>
					<Button type='button' variant={breakpoint === 'tablet' ? 'secondary' : 'outline'} size='icon' onClick={() => setBreakpoint('tablet')} disabled={disabledFlag}>
						<Tablet className='h-4 w-4' />
						<span className='sr-only'>Tablet</span>
					</Button>
					<Button type='button' variant={breakpoint === 'desktop' ? 'secondary' : 'outline'} size='icon' onClick={() => setBreakpoint('desktop')} disabled={disabledFlag}>
						<Monitor className='h-4 w-4' />
						<span className='sr-only'>Desktop</span>
					</Button>
				</div>
			</div>
			*/}

			<div className='shrink-0 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70'>
				<div className='flex h-10 items-center justify-between gap-2 px-3'>
					<div className='flex min-w-0 items-center gap-2'>
						<span className='text-xs font-semibold tracking-wide text-foreground'>Canvas</span>
						<span className='hidden sm:inline-flex rounded border px-2 py-0.5 text-[11px] text-muted-foreground'>Tool: {activeToolLabel}</span>
						<span className='hidden md:inline-flex rounded border px-2 py-0.5 text-[11px] text-muted-foreground'>Mode: {viewportMode === 'frames' ? 'Frames' : 'Single'}</span>
					</div>
					<div className='flex items-center gap-2 text-[11px] text-muted-foreground'>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							onClick={() => setShowGridOverlay((prev) => !prev)}
							disabled={disabledFlag}
							className='h-7 px-2'>
							{showGridOverlay ? 'Hide grid' : 'Show grid'}
						</Button>
						<Button
							type='button'
							variant='ghost'
							size='icon'
							onClick={() => {
								setFocusMode(false);
								setShowLeftDock((prev) => !prev);
							}}
							disabled={disabledFlag}
							className='hidden h-7 w-7 lg:inline-flex'
							title={leftDockVisible ? 'Hide left panel' : 'Show left panel'}>
							{leftDockVisible ? <PanelLeftClose className='h-4 w-4' /> : <PanelLeftOpen className='h-4 w-4' />}
							<span className='sr-only'>{leftDockVisible ? 'Hide left panel' : 'Show left panel'}</span>
						</Button>
						<Button
							type='button'
							variant='ghost'
							size='icon'
							onClick={() => {
								setFocusMode(false);
								setShowRightDock((prev) => !prev);
							}}
							disabled={disabledFlag}
							className='hidden h-7 w-7 xl:inline-flex'
							title={rightDockVisible ? 'Hide inspector' : 'Show inspector'}>
							{rightDockVisible ? <PanelRightClose className='h-4 w-4' /> : <PanelRightOpen className='h-4 w-4' />}
							<span className='sr-only'>{rightDockVisible ? 'Hide inspector' : 'Show inspector'}</span>
						</Button>
						<Button
							type='button'
							variant={focusMode ? 'secondary' : 'ghost'}
							size='icon'
							onClick={() => setFocusMode((prev) => !prev)}
							disabled={disabledFlag}
							className='h-7 w-7'
							title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}>
							{focusMode ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}
							<span className='sr-only'>{focusMode ? 'Exit focus mode' : 'Enter focus mode'}</span>
						</Button>
						<span className='hidden md:inline'>{breakpointLabel}</span>
						<span>{selectedCount} selected</span>
						<span className='hidden xl:inline'>I Insert · L Layers · G Grid · \ Focus</span>
					</div>
				</div>
			</div>

			<div className='flex flex-1 min-h-0 min-w-0 overflow-hidden'>
				{leftDockVisible ? (
					<aside
						className={cn(
							'hidden lg:flex shrink-0 border-r bg-background/70 backdrop-blur',
							leftDockMode === 'insert' ? 'w-[560px]' : 'w-[340px]'
						)}>
						<div className='flex h-full w-full'>
							<div className='w-12 shrink-0 border-r bg-background/50 flex flex-col items-center py-2 gap-1'>
								<Button
									type='button'
									variant={leftDockMode === 'insert' ? 'secondary' : 'ghost'}
									size='icon'
									onClick={() => setLeftDockMode('insert')}
									disabled={disabledFlag}>
									<Plus className='h-4 w-4' />
									<span className='sr-only'>Insert</span>
								</Button>
								<Button
									type='button'
									variant={leftDockMode === 'outline' ? 'secondary' : 'ghost'}
									size='icon'
									onClick={() => setLeftDockMode('outline')}
									disabled={disabledFlag}>
									<ListTree className='h-4 w-4' />
									<span className='sr-only'>Layers</span>
								</Button>
							</div>
							<div className='flex-1 h-full overflow-hidden'>
								{leftDockMode === 'insert' ? (
									<div className='h-full'>{insertPanel}</div>
								) : (
									<div className='h-full w-full overflow-auto p-4'>{outlineTree}</div>
								)}
							</div>
						</div>
					</aside>
				) : null}

				<section className={cn('flex-1 min-h-0 min-w-0 rounded-md border bg-background/95 shadow-sm overflow-hidden', fullHeight ? null : 'h-full')}>
				<div className='relative h-full w-full'>
					<div
						ref={viewportRef}
						className={cn(
							'absolute inset-0 overflow-auto',
							viewportCursorClass
						)}
						onPointerDownCapture={onViewportPointerDownCapture}
						onPointerMoveCapture={onViewportPointerMoveCapture}
						onPointerUpCapture={onViewportPointerUpCapture}
						onPointerCancelCapture={onViewportPointerUpCapture}>
						<div
							style={{
								paddingLeft: RULER_SIZE_PX,
								paddingTop: RULER_SIZE_PX,
								minWidth: '100%',
								minHeight: '100%',
							}}>
							<DndContext
								sensors={sensors}
								collisionDetection={pointerWithin}
								onDragStart={onDragStart}
								onDragMove={onDragMove}
								onDragCancel={onDragCancel}
								onDragEnd={onDragEnd}>
								<div
									className='relative mx-auto'
									style={{
										width: Math.max(1, scaledCanvasWidth),
										height: Math.max(1, scaledCanvasHeight),
									}}>
									<div
											style={{
												width: canvasWidthUnits,
												height: rootHeight,
												transform: `scale(${zoomValue})`,
												transformOrigin: '0 0',
											}}>
										{viewportMode === 'frames' ? (
											<div
												className='relative'
												style={{ width: canvasWidthUnits, height: rootHeight }}>
												{frameBoard.order.map((bp) => {
													const isActive = bp === breakpoint;
													const frameWidth = frameBoard.widths[bp];
													const frameLeft = frameBoard.offsets[bp];
													const label = bp === 'desktop' ? 'Desktop' : bp === 'tablet' ? 'Tablet' : 'Mobile';

													const frameShellClass = cn(
														'relative rounded-md border bg-background shadow-sm',
														isActive ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : 'opacity-90'
													);

													const frameLabel = (
														<div className='pointer-events-none absolute left-2 top-2 z-50 flex items-center gap-2 rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow'>
															<span className='font-medium'>{label}</span>
															<span className='tabular-nums text-muted-foreground'>{Math.round(frameWidth)}px</span>
															{isActive ? (
																<span className='text-primary'>editing</span>
															) : (
																<span className='text-muted-foreground'>click to edit</span>
															)}
														</div>
													);

													return (
														<div
															key={bp}
															className='absolute top-0'
															style={{
																left: frameLeft,
																width: frameWidth,
																height: rootHeight,
															}}>
															{isActive ? (
																<CanvasRootDroppable
																	disabled={disabledFlag}
																	draggingId={draggingId}
																	onRootEl={setRootRef}
																	className={frameShellClass}
																	style={{
																		width: frameWidth,
																		height: rootHeight,
																	}}
																	onPointerDown={onCanvasPointerDown}
																	onPointerMove={onCanvasPointerMove}
																	onPointerUp={onCanvasPointerUp}
																	onPointerCancel={onCanvasPointerUp}>
											{frameLabel}
											{showGridOverlay ? (
												<div
													className='pointer-events-none absolute inset-0 z-0'
													style={{
														backgroundImage: GRID_BACKGROUND_IMAGE,
														backgroundSize: GRID_BACKGROUND_SIZE,
														backgroundPosition: GRID_BACKGROUND_POSITION,
													}}
												/>
											) : null}

																	{dragAssist && dragAssist.guideX !== null ? (
																		<>
																			<div
																				className='pointer-events-none absolute inset-y-0 z-40 w-px bg-primary/70'
																				style={{ left: Math.round(dragAssist.guideX) }}
																			/>
																			<div
																				className='pointer-events-none absolute z-50 -translate-x-1/2 rounded-md border bg-background/95 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground shadow'
																				style={{ left: Math.round(dragAssist.guideX), top: 6 }}>
																				x {Math.round(dragAssist.guideX)}
																			</div>
																		</>
																	) : null}
																	{dragAssist && dragAssist.guideY !== null ? (
																		<>
																			<div
																				className='pointer-events-none absolute inset-x-0 z-40 h-px bg-primary/70'
																				style={{ top: Math.round(dragAssist.guideY) }}
																			/>
																			<div
																				className='pointer-events-none absolute z-50 -translate-y-1/2 rounded-md border bg-background/95 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground shadow'
																				style={{ left: 6, top: Math.round(dragAssist.guideY) }}>
																				y {Math.round(dragAssist.guideY)}
																			</div>
																		</>
																	) : null}

																	{drawPreviewRect ? (
																		<div
																			className='pointer-events-none absolute z-50 rounded-sm border border-primary/70 bg-primary/10'
																			style={{
																				left: Math.round(drawPreviewRect.x),
																				top: Math.round(drawPreviewRect.y),
																				width: Math.round(drawPreviewRect.w),
																				height: Math.round(drawPreviewRect.h),
																			}}
																		/>
																	) : null}

																	{marqueePreviewRect ? (
																		<div
																			className='pointer-events-none absolute z-50 rounded-sm border border-primary/60 bg-primary/5'
																			style={{
																				left: Math.round(marqueePreviewRect.x),
																				top: Math.round(marqueePreviewRect.y),
																				width: Math.round(marqueePreviewRect.w),
																				height: Math.round(marqueePreviewRect.h),
																			}}
																		/>
																	) : null}

																	{value.nodes.map((n) => (
																		<CanvasNode
																			key={n.id}
																			node={n}
																			breakpoint={breakpoint}
																			selectedId={selectedId}
																			selectedIds={selectedIdsSet}
																			draggingId={draggingId}
																			dragPreviewDelta={dragPreviewDelta}
																			disabled={disabledFlag}
																			interactionsEnabled={interactionsEnabled}
																			lockedIds={lockedIds}
																			editRootId={effectiveEditRootId}
																			onSelect={selectNode}
																			onUpdateNode={updateNode}
																			onStartResize={startResize}
																		/>
																	))}

																	{resizeState && resizingFrame && resizingGlobal ? (
																		<div
																			className='pointer-events-none absolute z-50'
																			style={{
																				left: resizingGlobal.x,
																				top: resizingGlobal.y,
																			}}>
																			<div className='-translate-y-full translate-x-2 rounded-md border bg-background/95 px-2 py-1 text-xs shadow'>
																				{resizingPctW !== null ? `${Math.round(resizingPctW * 10) / 10}% w` : `${Math.round(resizingFrame.w)}px w`}
																				{' · '}
																				{resizingPctH !== null ? `${Math.round(resizingPctH * 10) / 10}% h` : `${Math.round(resizingFrame.h)}px h`}
																			</div>
																		</div>
																	) : null}
																</CanvasRootDroppable>
															) : (
																<div className='relative h-full w-full'>
																	{frameLabel}
																	<CanvasFramePreview
																		nodes={value.nodes}
																		breakpoint={bp}
																		height={rootHeight}
																		width={frameWidth}
																		selectedIds={selectedIdsSet}
																		lockedIds={lockedIds}
												showGridOverlay={showGridOverlay}
												className={cn(frameShellClass, 'pointer-events-none')}
																	/>
																	<button
																		type='button'
																		className='absolute inset-0 z-40'
																		onClick={() => setBreakpoint(bp)}
																		disabled={disabledFlag}
																		aria-label={`Edit ${label} breakpoint`}
																	/>
																</div>
															)}
														</div>
													);
												})}
											</div>
										) : (
											<CanvasRootDroppable
												disabled={disabledFlag}
												draggingId={draggingId}
												onRootEl={setRootRef}
												className={cn('relative rounded-md border bg-background shadow-sm')}
												style={{
													width: value.canvas.widths[breakpoint],
													height: rootHeight,
												}}
												onPointerDown={onCanvasPointerDown}
												onPointerMove={onCanvasPointerMove}
												onPointerUp={onCanvasPointerUp}
											onPointerCancel={onCanvasPointerUp}>
											{showGridOverlay ? (
												<div
													className='pointer-events-none absolute inset-0 z-0'
													style={{
														backgroundImage: GRID_BACKGROUND_IMAGE,
														backgroundSize: GRID_BACKGROUND_SIZE,
														backgroundPosition: GRID_BACKGROUND_POSITION,
													}}
												/>
											) : null}
										

												{dragAssist && dragAssist.guideX !== null ? (
													<>
														<div
															className='pointer-events-none absolute inset-y-0 z-40 w-px bg-primary/70'
															style={{ left: Math.round(dragAssist.guideX) }}
														/>
														<div
															className='pointer-events-none absolute z-50 -translate-x-1/2 rounded-md border bg-background/95 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground shadow'
															style={{ left: Math.round(dragAssist.guideX), top: 6 }}>
															x {Math.round(dragAssist.guideX)}
														</div>
													</>
												) : null}
												{dragAssist && dragAssist.guideY !== null ? (
													<>
														<div
															className='pointer-events-none absolute inset-x-0 z-40 h-px bg-primary/70'
															style={{ top: Math.round(dragAssist.guideY) }}
														/>
														<div
															className='pointer-events-none absolute z-50 -translate-y-1/2 rounded-md border bg-background/95 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground shadow'
															style={{ left: 6, top: Math.round(dragAssist.guideY) }}>
															y {Math.round(dragAssist.guideY)}
														</div>
													</>
												) : null}

												{drawPreviewRect ? (
													<div
														className='pointer-events-none absolute z-50 rounded-sm border border-primary/70 bg-primary/10'
														style={{
															left: Math.round(drawPreviewRect.x),
															top: Math.round(drawPreviewRect.y),
															width: Math.round(drawPreviewRect.w),
															height: Math.round(drawPreviewRect.h),
														}}
													/>
												) : null}

												{marqueePreviewRect ? (
													<div
														className='pointer-events-none absolute z-50 rounded-sm border border-primary/60 bg-primary/5'
														style={{
															left: Math.round(marqueePreviewRect.x),
															top: Math.round(marqueePreviewRect.y),
															width: Math.round(marqueePreviewRect.w),
															height: Math.round(marqueePreviewRect.h),
														}}
													/>
												) : null}

												{value.nodes.map((n) => (
													<CanvasNode
														key={n.id}
														node={n}
														breakpoint={breakpoint}
														selectedId={selectedId}
														selectedIds={selectedIdsSet}
														draggingId={draggingId}
														dragPreviewDelta={dragPreviewDelta}
														disabled={disabledFlag}
														interactionsEnabled={interactionsEnabled}
														lockedIds={lockedIds}
														editRootId={effectiveEditRootId}
														onSelect={selectNode}
														onUpdateNode={updateNode}
														onStartResize={startResize}
													/>
												))}

												{resizeState && resizingFrame && resizingGlobal ? (
													<div
														className='pointer-events-none absolute z-50'
														style={{
															left: resizingGlobal.x,
															top: resizingGlobal.y,
														}}>
														<div className='-translate-y-full translate-x-2 rounded-md border bg-background/95 px-2 py-1 text-xs shadow'>
															{resizingPctW !== null ? `${Math.round(resizingPctW * 10) / 10}% w` : `${Math.round(resizingFrame.w)}px w`}
															{' · '}
															{resizingPctH !== null ? `${Math.round(resizingPctH * 10) / 10}% h` : `${Math.round(resizingFrame.h)}px h`}
														</div>
													</div>
												) : null}
											</CanvasRootDroppable>
										)}
									</div>
								</div>
							</DndContext>
						</div>
					</div>

					<div
						className='pointer-events-none absolute left-0 top-0 border-b border-r bg-background/95'
						style={{
							height: RULER_SIZE_PX,
							width: RULER_SIZE_PX,
						}}
					/>
					<div
						className='pointer-events-none absolute right-0 top-0 border-b bg-background/95'
						style={{
							left: RULER_SIZE_PX,
							height: RULER_SIZE_PX,
							backgroundImage: [
								`repeating-linear-gradient(to right, transparent 0, transparent ${rulerMinorPxScaled - 1}px, ${RULER_MINOR_COLOR} ${rulerMinorPxScaled - 1}px, ${RULER_MINOR_COLOR} ${rulerMinorPxScaled}px)`,
								`repeating-linear-gradient(to right, transparent 0, transparent ${rulerMajorPxScaled - 1}px, ${RULER_MAJOR_COLOR} ${rulerMajorPxScaled - 1}px, ${RULER_MAJOR_COLOR} ${rulerMajorPxScaled}px)`,
							].join(', '),
							backgroundPositionX: `${-viewportScroll.left}px`,
							backgroundSize: `${rulerMinorPxScaled}px 100%, ${rulerMajorPxScaled}px 100%`,
						}}>
						{rulerXLabels.map((x) => (
							<div
								key={x}
								className='absolute top-1 text-[10px] text-muted-foreground'
								style={{ left: x * zoomValue - viewportScroll.left + 2 }}>
								{Math.round(x)}
							</div>
						))}
					</div>

					<div
						className='pointer-events-none absolute bottom-0 left-0 border-r bg-background/95'
						style={{
							top: RULER_SIZE_PX,
							width: RULER_SIZE_PX,
							backgroundImage: [
								`repeating-linear-gradient(to bottom, transparent 0, transparent ${rulerMinorPxScaled - 1}px, ${RULER_MINOR_COLOR} ${rulerMinorPxScaled - 1}px, ${RULER_MINOR_COLOR} ${rulerMinorPxScaled}px)`,
								`repeating-linear-gradient(to bottom, transparent 0, transparent ${rulerMajorPxScaled - 1}px, ${RULER_MAJOR_COLOR} ${rulerMajorPxScaled - 1}px, ${RULER_MAJOR_COLOR} ${rulerMajorPxScaled}px)`,
							].join(', '),
							backgroundPositionY: `${-viewportScroll.top}px`,
							backgroundSize: `100% ${rulerMinorPxScaled}px, 100% ${rulerMajorPxScaled}px`,
						}}>
						{rulerYLabels.map((y) => (
							<div
								key={y}
								className='absolute left-1 text-[10px] text-muted-foreground'
								style={{ top: y * zoomValue - viewportScroll.top + 2, transform: 'rotate(-90deg)', transformOrigin: 'left top' }}>
								{Math.round(y)}
							</div>
						))}
					</div>
				</div>
				</section>

				{rightDockVisible ? (
					<aside className='hidden xl:flex w-[360px] shrink-0 border-l bg-background/80'>
						<div className='flex h-full flex-col'>{inspectorInner}</div>
					</aside>
				) : null}
			</div>

			<div className='shrink-0 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70'>
				<div className='flex h-14 items-center px-2 overflow-x-auto overflow-y-hidden'>
					<div className='flex w-full min-w-max items-center gap-2'>
					<Button type='button' variant='ghost' size='icon' onClick={openOutlinePanel} disabled={disabledFlag} className='lg:hidden'>
						<ListTree className='h-4 w-4' />
						<span className='sr-only'>Outline</span>
					</Button>
					<Button
						type='button'
						variant='ghost'
						size='icon'
						onClick={() => openInsertPanel('blocks')}
						disabled={disabledFlag}
						className='lg:hidden'>
						<Plus className='h-4 w-4' />
						<span className='sr-only'>Insert</span>
					</Button>

					<Popover open={inspectorOpen} onOpenChange={setInspectorOpen}>
						<PopoverTrigger asChild>
							<Button type='button' variant='ghost' size='icon' disabled={disabledFlag} className='xl:hidden'>
								<SlidersHorizontal className='h-4 w-4' />
								<span className='sr-only'>Inspector</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent
							side='top'
							align='end'
							className='w-[420px] max-w-[90vw] p-0'
							onOpenAutoFocus={(e) => e.preventDefault()}>
							<div className='flex max-h-[70vh] flex-col'>{inspectorInner}</div>
						</PopoverContent>
					</Popover>

					<Separator orientation='vertical' className='h-6' />

					<div className='flex items-center gap-1'>
						<Button type='button' variant={tool === 'select' ? 'secondary' : 'ghost'} size='icon' onClick={() => setTool('select')} disabled={disabledFlag}>
							<MousePointer2 className='h-4 w-4' />
							<span className='sr-only'>Select</span>
						</Button>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type='button' variant={tool === 'frame' ? 'secondary' : 'ghost'} size='icon' disabled={disabledFlag}>
									<LayoutGrid className='h-4 w-4' />
									<span className='sr-only'>Frame</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='start'>
								{FRAME_LAYOUT_PRESETS.map((preset) => (
									<DropdownMenuItem
										key={preset.slug}
										onSelect={() => {
											setFrameToolLayout(preset.layout);
											setTool('frame');
										}}>
										<div className='flex flex-col'>
											<span className='font-medium'>{preset.label}</span>
											<span className='text-xs text-muted-foreground'>/{preset.slug} · frame</span>
										</div>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type='button' variant={tool === 'shape' ? 'secondary' : 'ghost'} size='icon' disabled={disabledFlag}>
									<ShapeToolIcon className='h-4 w-4' />
									<span className='sr-only'>Shape</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='start'>
								<DropdownMenuItem
									onSelect={() => {
										setShapeToolKind('rect');
										setTool('shape');
									}}>
									<div className='flex items-center gap-2'>
										<RectangleHorizontal className='h-4 w-4' />
										<span>Rect</span>
									</div>
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => {
										setShapeToolKind('ellipse');
										setTool('shape');
									}}>
									<div className='flex items-center gap-2'>
										<Circle className='h-4 w-4' />
										<span>Ellipse</span>
									</div>
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => {
										setShapeToolKind('line');
										setTool('shape');
									}}>
									<div className='flex items-center gap-2'>
										<Minus className='h-4 w-4' />
										<span>Line</span>
									</div>
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => {
										setShapeToolKind('arrow');
										setTool('shape');
									}}>
									<div className='flex items-center gap-2'>
										<ArrowRight className='h-4 w-4' />
										<span>Arrow</span>
									</div>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Button type='button' variant={tool === 'text' ? 'secondary' : 'ghost'} size='icon' onClick={() => toggleTool('text')} disabled={disabledFlag}>
							<Type className='h-4 w-4' />
							<span className='sr-only'>Text</span>
						</Button>
						<Button type='button' variant={tool === 'media' ? 'secondary' : 'ghost'} size='icon' onClick={() => toggleTool('media')} disabled={disabledFlag}>
							<ImagePlus className='h-4 w-4' />
							<span className='sr-only'>Media</span>
						</Button>
					</div>

					<Separator orientation='vertical' className='h-6' />

					<Button
						type='button'
						variant='ghost'
						size='icon'
						onClick={() => openInsertPanel('blocks')}
						disabled={disabledFlag}>
						<Plus className='h-4 w-4' />
						<span className='sr-only'>Insert</span>
					</Button>
					<Button
						type='button'
						variant={showGridOverlay ? 'secondary' : 'ghost'}
						size='icon'
						onClick={() => setShowGridOverlay((prev) => !prev)}
						disabled={disabledFlag}
						title={showGridOverlay ? 'Hide grid overlay' : 'Show grid overlay'}>
						<LayoutGrid className='h-4 w-4' />
						<span className='sr-only'>Toggle grid overlay</span>
					</Button>

					<Separator orientation='vertical' className='h-6' />

					<Button
						type='button'
						variant='ghost'
						size='icon'
						onClick={undo}
						disabled={disabledFlag || !canUndo}
						title='Undo (Ctrl/Cmd+Z)'>
						<Undo2 className='h-4 w-4' />
						<span className='sr-only'>Undo</span>
					</Button>
					<Button
						type='button'
						variant='ghost'
						size='icon'
						onClick={redo}
						disabled={disabledFlag || !canRedo}
						title='Redo (Shift+Ctrl/Cmd+Z or Ctrl+Y)'>
						<Redo2 className='h-4 w-4' />
						<span className='sr-only'>Redo</span>
					</Button>

					<div className='ml-auto flex items-center gap-2'>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type='button' variant='ghost' size='icon' disabled={disabledFlag} className='md:hidden'>
									<MoreHorizontal className='h-4 w-4' />
									<span className='sr-only'>View</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end' side='top'>
								<DropdownMenuLabel>Zoom</DropdownMenuLabel>
								<DropdownMenuItem onSelect={() => setZoomCentered(zoomValue / 1.08)}>Zoom out</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setZoomCentered(zoomValue * 1.08)}>Zoom in</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setZoomCentered(1)}>Reset zoom</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuLabel>Viewport</DropdownMenuLabel>
								<DropdownMenuItem onSelect={() => setViewportMode('frames')}>Frames</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setViewportMode('single')}>Single</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuLabel>Breakpoint</DropdownMenuLabel>
								<DropdownMenuItem onSelect={() => setBreakpoint('mobile')}>Mobile</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setBreakpoint('tablet')}>Tablet</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setBreakpoint('desktop')}>Desktop</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

					<div className='hidden md:flex items-center gap-1'>
						<Button
							type='button'
							variant='ghost'
							size='icon'
							onClick={() => setZoomCentered(zoomValue / 1.08)}
							disabled={disabledFlag}>
							<ZoomOut className='h-4 w-4' />
							<span className='sr-only'>Zoom out</span>
						</Button>
						<div className='w-[64px] text-center text-xs tabular-nums text-muted-foreground'>
							{Math.round(zoomValue * 100)}%
						</div>
						<Button
							type='button'
							variant='ghost'
							size='icon'
							onClick={() => setZoomCentered(zoomValue * 1.08)}
							disabled={disabledFlag}>
							<ZoomIn className='h-4 w-4' />
							<span className='sr-only'>Zoom in</span>
						</Button>
						<Button
							type='button'
							variant='ghost'
							size='icon'
							onClick={() => setZoomCentered(1)}
							disabled={disabledFlag}>
							<RotateCcw className='h-4 w-4' />
							<span className='sr-only'>Reset zoom</span>
						</Button>
					</div>

					<Separator orientation='vertical' className='h-6 hidden md:block' />

					<div className='hidden md:flex items-center gap-1'>
						<Button
							type='button'
							variant={viewportMode === 'frames' ? 'secondary' : 'ghost'}
							size='icon'
							onClick={() => setViewportMode((prev) => (prev === 'frames' ? 'single' : 'frames'))}
							disabled={disabledFlag}>
							<Columns3 className='h-4 w-4' />
							<span className='sr-only'>Toggle multi-frame view</span>
						</Button>
						<Separator orientation='vertical' className='h-6' />
						<Button type='button' variant={breakpoint === 'mobile' ? 'secondary' : 'ghost'} size='icon' onClick={() => setBreakpoint('mobile')} disabled={disabledFlag}>
							<Smartphone className='h-4 w-4' />
							<span className='sr-only'>Mobile</span>
						</Button>
						<Button type='button' variant={breakpoint === 'tablet' ? 'secondary' : 'ghost'} size='icon' onClick={() => setBreakpoint('tablet')} disabled={disabledFlag}>
							<Tablet className='h-4 w-4' />
							<span className='sr-only'>Tablet</span>
						</Button>
						<Button type='button' variant={breakpoint === 'desktop' ? 'secondary' : 'ghost'} size='icon' onClick={() => setBreakpoint('desktop')} disabled={disabledFlag}>
							<Monitor className='h-4 w-4' />
							<span className='sr-only'>Desktop</span>
						</Button>
					</div>
					</div>
					</div>
				</div>
			</div>

			<Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
				<SheetContent side='left'>
					<SheetHeader>
						<SheetTitle>Outline</SheetTitle>
					</SheetHeader>
					<div className='flex-1 overflow-auto px-4 pb-4'>
						<PageBuilderOutline
							state={value}
							breakpoint={breakpoint}
							selectedId={selectedId}
							selectedIds={selectedIdsSet}
							lockedIds={lockedIds}
							onSelect={(id) => {
								pendingFocusIdRef.current = id;
								setSelectedIds([id]);
								setOutlineOpen(false);
							}}
							onInspect={(id) => {
								requestFocus(id);
								setOutlineOpen(false);
								setInspectorOpen(true);
							}}
							onReorder={reorderLayers}
							onPatchMeta={patchNodeMeta}
							onOpenComponentPicker={() => openInsertPanel('libraries')}
							onOpenBlockPicker={() => openInsertPanel('blocks')}
						/>
					</div>
				</SheetContent>
			</Sheet>

			<Sheet open={insertOpen} onOpenChange={setInsertOpen}>
				<SheetContent side='left' className='w-[92vw] sm:max-w-[560px]'>
					<SheetHeader>
						<SheetTitle>Insert</SheetTitle>
					</SheetHeader>
					<div className='flex-1 overflow-hidden pt-2'>{insertPanel}</div>
				</SheetContent>
			</Sheet>

			<BlockPickerDialog open={blockPickerOpen} onOpenChange={setBlockPickerOpen} onPick={addComponent} />
			<BlockTemplatePickerDialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} onPick={insertTemplate} />
			<MediaPickerDialog
				open={mediaPickerOpen}
				onOpenChange={(open) => {
					setMediaPickerOpen(open);
					if (!open) setMediaTargetId(null);
				}}
				onPick={onPickMedia}
			/>
			</div>
		</Theme>
	);
}

export { PageRenderer, PageRendererWithSlot } from './page-renderer';
