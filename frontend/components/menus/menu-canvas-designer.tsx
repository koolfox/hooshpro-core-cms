'use client';

import { useMemo, useState } from 'react';
import {
	applyNodeChanges,
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	ReactFlow,
	type Edge,
	type Node,
	type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export type MenuCanvasDraftItem = {
	key: string;
	id: number | null;
	type: 'page' | 'link';
	label: string;
	page_id: number | null;
	href: string;
	order_index: number;
};

type CanvasMaps = {
	nodes: Node[];
	edges: Edge[];
	internalToKey: Map<string, string>;
	internalToIndex: Map<string, number>;
};

function safeIdPart(value: string): string {
	const base = (value || '').trim();
	if (!base) return 'node';
	return base.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || 'node';
}

function toInternalId(itemIndex: number, key: string): string {
	return `item-${itemIndex}-${safeIdPart(key)}`;
}

function getDefaultPosition(index: number) {
	const cols = 3;
	const col = index % cols;
	const row = Math.floor(index / cols);
	return {
		x: 110 + col * 250,
		y: 180 + row * 170,
	};
}

function buildCanvasMaps(
	items: MenuCanvasDraftItem[],
	positions: Record<string, { x: number; y: number }>
): CanvasMaps {
	const internalToKey = new Map<string, string>();
	const internalToIndex = new Map<string, number>();

	const rootId = 'menu-root';
	const rootNode: Node = {
		id: rootId,
		position: { x: 360, y: 26 },
		data: {
			label: (
				<div className='space-y-1'>
					<div className='text-[10px] uppercase tracking-wide text-muted-foreground'>Menu Root</div>
					<div className='text-sm font-semibold'>Navigation Tree</div>
				</div>
			),
		},
		style: {
			minWidth: 220,
			borderRadius: 12,
			border: '1px solid hsl(var(--ring))',
			boxShadow: '0 8px 24px rgb(59 130 246 / 0.16)',
			background: 'hsl(var(--card))',
			padding: 10,
		},
		draggable: false,
		connectable: false,
	};

	const itemNodes: Node[] = items.map((item, idx) => {
		const internalId = toInternalId(idx, item.key);
		const fallback = getDefaultPosition(idx);
		const pos = positions[item.key] ?? fallback;

		internalToKey.set(internalId, item.key);
		internalToIndex.set(internalId, idx);

		return {
			id: internalId,
			position: pos,
			data: {
				label: (
					<div className='space-y-1'>
						<div className='text-[10px] uppercase tracking-wide text-muted-foreground'>{item.type}</div>
						<div className='text-sm font-medium leading-snug'>{item.label || item.key}</div>
						<div className='text-xs text-muted-foreground truncate'>
							{item.type === 'page'
								? `page_id=${item.page_id ?? 'unset'}`
								: item.href || 'href missing'}
						</div>
					</div>
				),
			},
			style: {
				minWidth: 200,
				borderRadius: 12,
				border: '1px solid hsl(var(--border))',
				boxShadow: '0 8px 24px rgb(15 23 42 / 0.08)',
				background: 'hsl(var(--card))',
				padding: 10,
			},
			draggable: true,
			connectable: false,
			selectable: true,
		};
	});

	const edges: Edge[] = itemNodes.map((node, idx) => ({
		id: `edge-${idx}-${node.id}`,
		source: rootId,
		target: node.id,
		type: 'smoothstep',
		animated: false,
		style: {
			strokeWidth: 1.8,
			stroke: 'hsl(var(--muted-foreground))',
		},
	}));

	return {
		nodes: [rootNode, ...itemNodes],
		edges,
		internalToKey,
		internalToIndex,
	};
}

function orderKeysByPosition(
	keys: string[],
	positions: Record<string, { x: number; y: number }>
): string[] {
	return [...keys].sort((a, b) => {
		const pa = positions[a] ?? { x: 0, y: 0 };
		const pb = positions[b] ?? { x: 0, y: 0 };
		if (pa.y !== pb.y) return pa.y - pb.y;
		return pa.x - pb.x;
	});
}

function haveSameOrder(a: string[], b: string[]) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

export function MenuCanvasDesigner({
	items,
	onItemsChange,
	onSelectItem,
	disabled,
}: {
	items: MenuCanvasDraftItem[];
	onItemsChange: (items: MenuCanvasDraftItem[]) => void;
	onSelectItem?: (selection: { key: string | null; index: number | null }) => void;
	disabled?: boolean;
}) {
	const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});


	const canvas = useMemo(() => buildCanvasMaps(items, positions), [items, positions]);

	function handleNodeChanges(changes: NodeChange[]) {
		const changed = applyNodeChanges(changes, canvas.nodes);
		const changedByInternal = new Map(changed.map((node) => [node.id, node]));

		const nextPositions: Record<string, { x: number; y: number }> = { ...positions };
		for (const [internalId, changedNode] of changedByInternal.entries()) {
			if (internalId === 'menu-root') continue;
			const key = canvas.internalToKey.get(internalId);
			if (!key) continue;
			nextPositions[key] = {
				x: Math.round(changedNode.position.x),
				y: Math.round(changedNode.position.y),
			};
		}
		setPositions(nextPositions);

		const currentKeys = items.map((item) => item.key);
		const sortedKeys = orderKeysByPosition(currentKeys, nextPositions);
		if (haveSameOrder(currentKeys, sortedKeys)) return;

		const byKey = new Map(items.map((item) => [item.key, item]));
		const nextItems = sortedKeys
			.map((key, index) => {
				const item = byKey.get(key);
				if (!item) return null;
				return {
					...item,
					order_index: index,
				};
			})
			.filter((item): item is MenuCanvasDraftItem => Boolean(item));
		if (nextItems.length === items.length) onItemsChange(nextItems);
	}

	return (
		<div className='h-[420px] w-full overflow-hidden rounded-xl border bg-muted/10'>
			<ReactFlow
				nodes={canvas.nodes}
				edges={canvas.edges}
				onNodesChange={disabled ? undefined : handleNodeChanges}
				onNodeClick={(_, node) => onSelectItem?.({ key: canvas.internalToKey.get(node.id) ?? null, index: canvas.internalToIndex.get(node.id) ?? null })}
				onPaneClick={() => onSelectItem?.({ key: null, index: null })}
				fitView
				nodesDraggable={!disabled}
				nodesConnectable={false}
				elementsSelectable={!disabled}
				proOptions={{ hideAttribution: true }}
				defaultEdgeOptions={{ type: 'smoothstep' }}>
				<MiniMap pannable zoomable className='!bg-background !border-border !border' />
				<Controls showInteractive={!disabled} position='bottom-left' />
				<Background id='major' gap={24} size={1} variant={BackgroundVariant.Lines} color='hsl(var(--border))' />
				<Background id='minor' gap={12} size={1} variant={BackgroundVariant.Dots} color='hsl(var(--muted-foreground) / 0.25)' />
			</ReactFlow>
		</div>
	);
}

