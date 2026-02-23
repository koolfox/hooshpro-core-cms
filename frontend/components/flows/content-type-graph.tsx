'use client';

import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	ReactFlow,
	type Edge,
	type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ContentField, ContentType } from '@/lib/types';

function makeNodes(contentType: ContentType, fields: ContentField[]): Node[] {
	const centerX = 420;
	const centerY = 220;

	const root: Node = {
		id: 'content-type',
		position: { x: centerX, y: centerY },
		data: {
			label: (
				<div className='space-y-1'>
					<div className='text-xs uppercase tracking-wide text-muted-foreground'>Collection</div>
					<div className='text-sm font-semibold'>{contentType.title}</div>
					<div className='text-xs text-muted-foreground'>/{contentType.slug}</div>
				</div>
			),
		},
		style: {
			minWidth: 220,
			borderRadius: 14,
			border: '1px solid hsl(var(--ring))',
			boxShadow: '0 8px 24px rgb(59 130 246 / 0.16)',
			background: 'hsl(var(--card))',
			padding: 12,
		},
	};

	const out: Node[] = [root];
	const sorted = fields.slice().sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));

	for (let i = 0; i < sorted.length; i += 1) {
		const f = sorted[i];
		const col = i % 2;
		const row = Math.floor(i / 2);
		const x = col === 0 ? centerX - 320 : centerX + 320;
		const y = 60 + row * 120;

		out.push({
			id: `field-${f.id}`,
			position: { x, y },
			data: {
				label: (
					<div className='space-y-1'>
						<div className='text-sm font-medium'>{f.label}</div>
						<div className='text-xs text-muted-foreground'>
							{f.slug} · {f.field_type}
							{f.required ? ' · required' : ''}
						</div>
					</div>
				),
			},
			style: {
				minWidth: 210,
				borderRadius: 12,
				border: '1px solid hsl(var(--border))',
				boxShadow: '0 6px 20px rgb(15 23 42 / 0.07)',
				background: 'hsl(var(--card))',
				padding: 10,
			},
		});
	}

	return out;
}

function makeEdges(fields: ContentField[]): Edge[] {
	return fields
		.slice()
		.sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id))
		.map((f, idx) => ({
			id: `e-${idx}-${f.id}`,
			source: 'content-type',
			target: `field-${f.id}`,
			type: 'smoothstep',
			animated: false,
			style: {
				strokeWidth: 1.6,
				stroke: 'hsl(var(--muted-foreground))',
			},
		}));
}

export function ContentTypeGraph({
	contentType,
	fields,
}: {
	contentType: ContentType;
	fields: ContentField[];
}) {
	const nodes = makeNodes(contentType, fields);
	const edges = makeEdges(fields);

	return (
		<div className='h-[420px] w-full overflow-hidden rounded-xl border bg-muted/10'>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				fitView
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable
				proOptions={{ hideAttribution: true }}
				defaultEdgeOptions={{ type: 'smoothstep' }}>
				<MiniMap pannable zoomable className='!bg-background !border-border !border' />
				<Controls showInteractive={false} position='bottom-left' />
				<Background id='major' gap={24} size={1} variant={BackgroundVariant.Lines} color='hsl(var(--border))' />
				<Background id='minor' gap={12} size={1} variant={BackgroundVariant.Dots} color='hsl(var(--muted-foreground) / 0.25)' />
			</ReactFlow>
		</div>
	);
}
