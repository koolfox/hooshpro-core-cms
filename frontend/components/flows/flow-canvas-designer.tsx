'use client';

import { useMemo } from 'react';
import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	ReactFlow,
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export type FlowDraftNode = {
	id: string;
	kind: 'trigger' | 'action';
	label: string;
	event: string;
	operation: 'noop' | 'set_output' | 'upsert_option' | 'create_entry';
	payloadJson: string;
	position?: { x: number; y: number };
};

export type FlowDraftEdge = {
	source: string;
	target: string;
};

type CanvasMaps = {
	nodes: Node[];
	internalToDraft: Map<string, string>;
	internalToIndex: Map<string, number>;
	firstInternalByDraft: Map<string, string>;
};

function safeIdPart(value: string): string {
	const base = (value || '').trim();
	if (!base) return 'node';
	return base.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || 'node';
}

function toInternalId(draftIndex: number, draftId: string): string {
	return `n-${draftIndex}-${safeIdPart(draftId)}`;
}

function buildCanvasMaps(nodes: FlowDraftNode[]): CanvasMaps {
	const internalToDraft = new Map<string, string>();
	const internalToIndex = new Map<string, number>();
	const firstInternalByDraft = new Map<string, string>();

	const out: Node[] = nodes.map((n, idx) => {
		const fallbackX = 120 + (idx % 3) * 260;
		const fallbackY = 100 + Math.floor(idx / 3) * 170;
		const pos = n.position ?? { x: fallbackX, y: fallbackY };
		const subtitle = n.kind === 'trigger' ? n.event || 'trigger' : n.operation;
		const internalId = toInternalId(idx, n.id);

		internalToDraft.set(internalId, n.id);
		internalToIndex.set(internalId, idx);
		if (!firstInternalByDraft.has(n.id)) firstInternalByDraft.set(n.id, internalId);

		return {
			id: internalId,
			position: { x: pos.x, y: pos.y },
			data: {
				label: (
					<div className='space-y-1'>
						<div className='text-xs uppercase tracking-wide text-muted-foreground'>{n.kind}</div>
						<div className='text-sm font-medium leading-snug'>{n.label || n.id || `node-${idx + 1}`}</div>
						<div className='text-xs text-muted-foreground'>{subtitle}</div>
					</div>
				),
			},
			draggable: true,
			connectable: true,
			selectable: true,
			style: {
				minWidth: 170,
				borderRadius: 12,
				border: n.kind === 'trigger' ? '1px solid hsl(var(--ring))' : '1px solid hsl(var(--border))',
				boxShadow: n.kind === 'trigger' ? '0 8px 24px rgb(59 130 246 / 0.16)' : '0 8px 24px rgb(15 23 42 / 0.08)',
				background: 'hsl(var(--card))',
				color: 'hsl(var(--card-foreground))',
				padding: 10,
			},
		};
	});

	return { nodes: out, internalToDraft, internalToIndex, firstInternalByDraft };
}

function toCanvasEdges(edges: FlowDraftEdge[], firstInternalByDraft: Map<string, string>): Edge[] {
	const out: Edge[] = [];
	for (let idx = 0; idx < edges.length; idx += 1) {
		const e = edges[idx];
		const source = firstInternalByDraft.get(e.source);
		const target = firstInternalByDraft.get(e.target);
		if (!source || !target) continue;
		out.push({
			id: `e-${idx}-${source}->${target}`,
			source,
			target,
			type: 'smoothstep',
			animated: false,
			style: {
				strokeWidth: 1.8,
				stroke: 'hsl(var(--muted-foreground))',
			},
		});
	}
	return out;
}

function fromCanvasEdges(next: Edge[], internalToDraft: Map<string, string>): FlowDraftEdge[] {
	const uniq = new Set<string>();
	const out: FlowDraftEdge[] = [];
	for (const e of next) {
		if (!e.source || !e.target) continue;
		const source = internalToDraft.get(e.source);
		const target = internalToDraft.get(e.target);
		if (!source || !target) continue;
		const key = `${source}::${target}`;
		if (uniq.has(key)) continue;
		uniq.add(key);
		out.push({ source, target });
	}
	return out;
}

export function FlowCanvasDesigner({
	nodes,
	edges,
	onNodesChange,
	onEdgesChange,
	onSelectNode,
	disabled,
}: {
	nodes: FlowDraftNode[];
	edges: FlowDraftEdge[];
	onNodesChange: (nodes: FlowDraftNode[]) => void;
	onEdgesChange: (edges: FlowDraftEdge[]) => void;
	onSelectNode?: (selection: { id: string | null; index: number | null }) => void;
	disabled?: boolean;
}) {
	const canvasMaps = useMemo(() => buildCanvasMaps(nodes), [nodes]);
	const canvasNodes = canvasMaps.nodes;
	const canvasEdges = useMemo(
		() => toCanvasEdges(edges, canvasMaps.firstInternalByDraft),
		[edges, canvasMaps.firstInternalByDraft]
	);

	function handleNodeChanges(changes: NodeChange[]) {
		const changed = applyNodeChanges(changes, canvasNodes);
		const changedByInternal = new Map(changed.map((n) => [n.id, n]));
		const next = [...nodes];

		for (const [internalId, changedNode] of changedByInternal.entries()) {
			const idx = canvasMaps.internalToIndex.get(internalId);
			if (typeof idx !== 'number' || !next[idx]) continue;
			next[idx] = {
				...next[idx],
				position: {
					x: Math.round(changedNode.position.x),
					y: Math.round(changedNode.position.y),
				},
			};
		}

		onNodesChange(next);
	}

	function handleEdgeChanges(changes: EdgeChange[]) {
		const nextCanvasEdges = applyEdgeChanges(changes, canvasEdges);
		onEdgesChange(fromCanvasEdges(nextCanvasEdges, canvasMaps.internalToDraft));
	}

	function handleConnect(connection: Connection) {
		if (!connection.source || !connection.target) return;
		const source = canvasMaps.internalToDraft.get(connection.source);
		const target = canvasMaps.internalToDraft.get(connection.target);
		if (!source || !target) return;
		if (source === target) return;

		const nextCanvasEdges = addEdge(connection, canvasEdges);
		onEdgesChange(fromCanvasEdges(nextCanvasEdges, canvasMaps.internalToDraft));
	}

	return (
		<div className='h-[420px] w-full overflow-hidden rounded-xl border bg-muted/10'>
			<ReactFlow
				nodes={canvasNodes}
				edges={canvasEdges}
				onNodesChange={disabled ? undefined : handleNodeChanges}
				onEdgesChange={disabled ? undefined : handleEdgeChanges}
				onConnect={disabled ? undefined : handleConnect}
				onNodeClick={(_, node) => onSelectNode?.({ id: canvasMaps.internalToDraft.get(node.id) ?? null, index: canvasMaps.internalToIndex.get(node.id) ?? null })}
				onPaneClick={() => onSelectNode?.({ id: null, index: null })}
				fitView
				nodesDraggable={!disabled}
				nodesConnectable={!disabled}
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
