'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	GripVertical,
	Image as ImageIcon,
	LayoutGrid,
	Menu as MenuIcon,
	PenTool,
	Search,
	SlidersHorizontal,
	Square,
	Type as TypeIcon,
} from 'lucide-react';

import type { BuilderBreakpoint, NodeMeta, PageBuilderState, PageNode } from '@/lib/page-builder';
import { cn } from '@/lib/utils';

type PanelTab = 'layers' | 'assets';

function nodeLabel(node: PageNode): string {
	const named = node.meta?.name?.trim();
	if (named) return named;

	if (node.type === 'unknown') return node.data.originalType;
	if (node.type === 'editor') return 'Editor';
	if (node.type === 'text') {
		const t = (node.data.text || '').trim();
		if (!t) return 'Text';
		return t.length > 24 ? `Text/${t.slice(0, 24)}…` : `Text/${t}`;
	}
	if (node.type === 'image') return node.data.alt?.trim() ? `Image/${node.data.alt.trim()}` : 'Image';
	if (node.type === 'shape') return node.data.kind ? `Shape/${node.data.kind}` : 'Shape';
	if (node.type === 'menu') {
		const menu = node.data.menu?.trim() ? node.data.menu.trim() : 'main';
		const kind = node.data.kind === 'footer' ? 'footer' : 'top';
		return `Menu/${kind}:${menu}`;
	}
	if (node.type === 'slot') return node.data.name?.trim() ? `Slot/${node.data.name.trim()}` : 'Slot';
	if (node.type === 'collection-list') return node.data.type_slug?.trim() ? `Collection/${node.data.type_slug.trim()}` : 'Collection list';
	if (node.type === 'shadcn') return `shadcn/${node.data.component || 'component'}`;
	if (node.type === 'frame') {
		const label = node.data.label?.trim() ? node.data.label.trim() : '';
		const layout = node.data.layout?.trim() ? node.data.layout.trim() : '';
		if (layout) return label ? `${layout}/${label}` : `layout/${layout}`;
		return label ? `frame/${label}` : 'frame';
	}
	return node.type;
}

function nodeZ(node: PageNode, breakpoint: BuilderBreakpoint): number {
	const zRaw = node.frames[breakpoint].z;
	const z = typeof zRaw === 'number' && Number.isFinite(zRaw) ? zRaw : 1;
	return z;
}

function NodeTypeIcon({ type, primary }: { type: PageNode['type']; primary: boolean }) {
	const className = cn('h-3.5 w-3.5', primary ? 'text-foreground' : 'text-muted-foreground');

	switch (type) {
		case 'frame':
			return <Square className={className} />;
		case 'shape':
			return <PenTool className={className} />;
		case 'editor':
			return <TypeIcon className={className} />;
		case 'text':
			return <TypeIcon className={className} />;
		case 'image':
			return <ImageIcon className={className} />;
		case 'menu':
			return <MenuIcon className={className} />;
		case 'collection-list':
			return <LayoutGrid className={className} />;
		default:
			return <Square className={className} />;
	}
}

function countNodes(nodes: PageNode[]): number {
	let total = 0;
	for (const n of nodes) {
		total += 1;
		if (Array.isArray(n.nodes)) total += countNodes(n.nodes);
	}
	return total;
}

function LayerRow({
	node,
	breakpoint,
	depth,
	selected,
	primary,
	templateLocked,
	collapsed,
	canCollapse,
	renaming,
	renameValue,
	onSelect,
	onInspect,
	onRenameStart,
	onRenameValueChange,
	onRenameCommit,
	onRenameCancel,
	onToggleHidden,
	onToggleCollapsed,
}: {
	node: PageNode;
	breakpoint: BuilderBreakpoint;
	depth: number;
	selected: boolean;
	primary: boolean;
	templateLocked: boolean;
	collapsed: boolean;
	canCollapse: boolean;
	renaming: boolean;
	renameValue: string;
	onSelect?: (id: string, e: ReactMouseEvent<HTMLButtonElement>) => void;
	onInspect?: (id: string) => void;
	onRenameStart?: (id: string, initialValue: string) => void;
	onRenameValueChange?: (value: string) => void;
	onRenameCommit?: (id: string) => void;
	onRenameCancel?: () => void;
	onToggleHidden?: (id: string) => void;
	onToggleCollapsed?: (id: string) => void;
}) {
	const hidden = node.meta?.hidden === true;

	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: node.id,
		disabled: templateLocked,
	});

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : undefined,
	};

	const label = nodeLabel(node);
	const z = nodeZ(node, breakpoint);

	return (
		<div
			ref={setNodeRef}
			style={style}
			data-layer-id={node.id}
			className={cn(
				'flex items-center gap-1 rounded-md px-2 py-1 text-xs',
				selected ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
			)}>
			<div className='flex min-w-0 flex-1 items-center gap-1' style={{ paddingLeft: depth * 12 }}>
				<button
					type='button'
					aria-label={collapsed ? 'Expand' : 'Collapse'}
					className={cn(
						'rounded-sm p-1',
						canCollapse ? 'hover:bg-muted/60' : 'opacity-40 cursor-default'
					)}
					disabled={!canCollapse}
					onClick={(e) => {
						e.stopPropagation();
						if (!canCollapse) return;
						onToggleCollapsed?.(node.id);
					}}>
					{canCollapse ? (
						collapsed ? <ChevronRight className='h-3.5 w-3.5' /> : <ChevronDown className='h-3.5 w-3.5' />
					) : (
						<div className='h-3.5 w-3.5' />
					)}
				</button>
				<button
					ref={setActivatorNodeRef}
					type='button'
					aria-label='Drag to reorder'
					className={cn(
						'rounded-sm p-1',
						templateLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/60'
					)}
					disabled={templateLocked}
					{...attributes}
					{...listeners}
					onClick={(e) => e.stopPropagation()}>
					<GripVertical className='h-3.5 w-3.5' />
				</button>

				<NodeTypeIcon type={node.type} primary={primary} />

				{renaming ? (
					<input
						autoFocus
						value={renameValue}
						onChange={(e) => onRenameValueChange?.(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								onRenameCommit?.(node.id);
							} else if (e.key === 'Escape') {
								e.preventDefault();
								onRenameCancel?.();
							}
						}}
						onBlur={() => onRenameCommit?.(node.id)}
						className='h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs'
						placeholder='Name'
					/>
				) : (
					<button
						type='button'
						onClick={(e) => onSelect?.(node.id, e)}
						onDoubleClick={() => onRenameStart?.(node.id, label)}
						className={cn('min-w-0 flex-1 truncate text-left', primary ? 'font-medium text-foreground' : null)}
						title={`${label} (z=${z})`}>
						{label}
					</button>
				)}
			</div>

			<div className='ml-auto flex items-center gap-1'>
				<button
					type='button'
					aria-label={hidden ? 'Show' : 'Hide'}
					className={cn(
						'rounded-sm p-1',
						templateLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/60'
					)}
					disabled={templateLocked}
					onClick={(e) => {
						e.stopPropagation();
						onToggleHidden?.(node.id);
					}}>
					{hidden ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
				</button>

				{onInspect ? (
					<button
						type='button'
						aria-label='Inspect'
						className='rounded-sm p-1 hover:bg-muted/60'
						onClick={(e) => {
							e.stopPropagation();
							onInspect(node.id);
						}}>
						<SlidersHorizontal className='h-3.5 w-3.5' />
					</button>
				) : null}
			</div>
		</div>
	);
}

function LayerTree({
	nodes,
	breakpoint,
	depth,
	query,
	selectedIds,
	primaryId,
	lockedIds,
	renamingId,
	renameValue,
	onSelect,
	onInspect,
	onToggleHidden,
	onToggleCollapsed,
	onRenameStart,
	onRenameValueChange,
	onRenameCommit,
	onRenameCancel,
}: {
	nodes: PageNode[];
	breakpoint: BuilderBreakpoint;
	depth: number;
	query: string;
	selectedIds: Set<string>;
	primaryId: string | null;
	lockedIds: Set<string>;
	renamingId: string | null;
	renameValue: string;
	onSelect?: (id: string, e: ReactMouseEvent<HTMLButtonElement>) => void;
	onInspect?: (id: string) => void;
	onToggleHidden?: (id: string) => void;
	onToggleCollapsed?: (id: string) => void;
	onRenameStart?: (id: string, initialValue: string) => void;
	onRenameValueChange?: (value: string) => void;
	onRenameCommit?: (id: string) => void;
	onRenameCancel?: () => void;
}) {
	const q = query.trim().toLowerCase();
	const ordered = useMemo(() => {
		const list = [...nodes];
		list.sort((a, b) => nodeZ(b, breakpoint) - nodeZ(a, breakpoint));
		return list;
	}, [nodes, breakpoint]);

	const filtered = useMemo(() => {
		if (!q) return ordered;

		const visible = new Set<string>();
		const visit = (node: PageNode): boolean => {
			const label = nodeLabel(node).toLowerCase();
			const selfMatch = label.includes(q) || node.type.toLowerCase().includes(q) || node.id.toLowerCase().includes(q);
			const children = Array.isArray(node.nodes) ? node.nodes : [];
			let childMatch = false;
			for (const child of children) {
				if (visit(child)) childMatch = true;
			}
			const ok = selfMatch || childMatch;
			if (ok) visible.add(node.id);
			return ok;
		};

		for (const n of ordered) visit(n);
		return ordered.filter((n) => visible.has(n.id));
	}, [ordered, q]);

	const items = filtered.map((n) => n.id);

	return (
		<SortableContext items={items} strategy={verticalListSortingStrategy}>
			<div className='space-y-1'>
				{filtered.map((n) => {
					const nested = Array.isArray(n.nodes) ? n.nodes : [];
					const hasNested = nested.length > 0;
					const collapsed = n.meta?.collapsed === true;
					const showChildren = hasNested && (!collapsed || !!q);

					return (
						<div key={n.id}>
							<LayerRow
								node={n}
								breakpoint={breakpoint}
								depth={depth}
								selected={selectedIds.has(n.id)}
								primary={primaryId === n.id}
								templateLocked={lockedIds.has(n.id)}
								collapsed={collapsed}
								canCollapse={hasNested}
								renaming={renamingId === n.id}
								renameValue={renameValue}
								onSelect={onSelect}
								onInspect={onInspect}
								onRenameStart={onRenameStart}
								onRenameValueChange={onRenameValueChange}
								onRenameCommit={onRenameCommit}
								onRenameCancel={onRenameCancel}
								onToggleHidden={onToggleHidden}
								onToggleCollapsed={onToggleCollapsed}
							/>
							{showChildren ? (
								<div className='ml-4 border-l pl-2'>
									<LayerTree
										nodes={nested}
										breakpoint={breakpoint}
										depth={depth + 1}
										query={query}
										selectedIds={selectedIds}
										primaryId={primaryId}
										lockedIds={lockedIds}
										renamingId={renamingId}
										renameValue={renameValue}
										onSelect={onSelect}
										onInspect={onInspect}
										onToggleHidden={onToggleHidden}
										onToggleCollapsed={onToggleCollapsed}
										onRenameStart={onRenameStart}
										onRenameValueChange={onRenameValueChange}
										onRenameCommit={onRenameCommit}
										onRenameCancel={onRenameCancel}
									/>
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		</SortableContext>
	);
}

export function PageBuilderOutline({
	state,
	breakpoint = 'desktop',
	selectedId = null,
	selectedIds,
	lockedIds,
	onSelect,
	onInspect,
	onReorder,
	onPatchMeta,
	onOpenComponentPicker,
	onOpenBlockPicker,
	className,
}: {
	state: PageBuilderState;
	breakpoint?: BuilderBreakpoint;
	selectedId?: string | null;
	selectedIds?: Set<string>;
	lockedIds?: Set<string>;
	onSelect?: (id: string, e: ReactMouseEvent<HTMLButtonElement>) => void;
	onInspect?: (id: string) => void;
	onReorder?: (activeId: string, overId: string) => void;
	onPatchMeta?: (id: string, patch: Partial<NodeMeta>) => void;
	onOpenComponentPicker?: () => void;
	onOpenBlockPicker?: () => void;
	className?: string;
}) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const [tab, setTab] = useState<PanelTab>('layers');
	const [query, setQuery] = useState('');
	const selectedSet = selectedIds ?? new Set<string>();
	const lockedSet = lockedIds ?? new Set<string>();
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState('');

	const totals = useMemo(() => {
		const nodes = countNodes(state.nodes);
		return { nodes };
	}, [state.nodes]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			if (!onReorder) return;
			const activeId = typeof event.active?.id === 'string' ? event.active.id : null;
			const overId = typeof event.over?.id === 'string' ? event.over.id : null;
			if (!activeId || !overId || activeId === overId) return;
			onReorder(activeId, overId);
		},
		[onReorder]
	);

	const toggleHidden = useCallback(
		(id: string) => {
			const node = findNodeById(state.nodes, id);
			if (!node) return;
			onPatchMeta?.(id, { hidden: !(node.meta?.hidden === true) });
		},
		[state.nodes, onPatchMeta]
	);

	const toggleCollapsed = useCallback(
		(id: string) => {
			const node = findNodeById(state.nodes, id);
			if (!node) return;
			onPatchMeta?.(id, { collapsed: !(node.meta?.collapsed === true) });
		},
		[state.nodes, onPatchMeta]
	);

	const startRename = useCallback((id: string, initialValue: string) => {
		setRenamingId(id);
		setRenameValue(initialValue);
	}, []);

	const cancelRename = useCallback(() => {
		setRenamingId(null);
		setRenameValue('');
	}, []);

	const commitRename = useCallback(
		(id: string) => {
			if (renamingId !== id) return;
			const next = renameValue.trim();
			onPatchMeta?.(id, { name: next ? next : undefined });
			setRenamingId(null);
			setRenameValue('');
		},
		[onPatchMeta, renamingId, renameValue]
	);

	useEffect(() => {
		if (!selectedId) return;
		const root = rootRef.current;
		if (!root) return;
		const target = root.querySelector<HTMLElement>(`[data-layer-id="${selectedId}"]`);
		if (!target) return;
		target.scrollIntoView({ block: 'nearest' });
	}, [selectedId]);

	return (
		<div ref={rootRef} className={cn('space-y-3', className)}>
			<div className='space-y-1'>
				<div className='flex items-center gap-1'>
					<button
						type='button'
						onClick={() => setTab('layers')}
						className={cn(
							'rounded-md px-2 py-1 text-xs font-medium',
							tab === 'layers' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
						)}>
						Layers
					</button>
					<button
						type='button'
						onClick={() => setTab('assets')}
						className={cn(
							'rounded-md px-2 py-1 text-xs font-medium',
							tab === 'assets' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
						)}>
						Assets
					</button>
					<span className='ml-auto text-xs text-muted-foreground'>{totals.nodes}</span>
				</div>
				<div className='relative'>
					<Search className='pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground' />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder='Search…'
						className='h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs'
					/>
				</div>
			</div>

			<div className='border-t' />

			{tab === 'assets' ? (
				<div className='space-y-3'>
					<p className='text-xs text-muted-foreground'>
						Quick inserts (full library via “+ Insert” in the bottom toolbar).
					</p>
					<div className='flex flex-col gap-2'>
						<button
							type='button'
							onClick={() => onOpenComponentPicker?.()}
							className='rounded-md border bg-background px-3 py-2 text-left text-xs hover:bg-muted/40'>
							Component…
						</button>
						<button
							type='button'
							onClick={() => onOpenBlockPicker?.()}
							className='rounded-md border bg-background px-3 py-2 text-left text-xs hover:bg-muted/40'>
							Block…
						</button>
					</div>
				</div>
			) : state.nodes.length ? (
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
						<LayerTree
						nodes={state.nodes}
						breakpoint={breakpoint}
						depth={0}
						query={query}
						selectedIds={selectedSet}
						primaryId={selectedId ?? null}
						lockedIds={lockedSet}
						renamingId={renamingId}
						renameValue={renameValue}
						onSelect={onSelect}
						onInspect={onInspect}
						onToggleHidden={toggleHidden}
						onToggleCollapsed={toggleCollapsed}
						onRenameStart={startRename}
						onRenameValueChange={setRenameValue}
							onRenameCommit={commitRename}
							onRenameCancel={cancelRename}
						/>
				</DndContext>
			) : (
				<p className='text-xs text-muted-foreground italic'>Empty</p>
			)}
		</div>
	);
}

function findNodeById(nodes: PageNode[], id: string): PageNode | null {
	for (const n of nodes) {
		if (n.id === id) return n;
		if (Array.isArray(n.nodes)) {
			const found = findNodeById(n.nodes, id);
			if (found) return found;
		}
	}
	return null;
}
