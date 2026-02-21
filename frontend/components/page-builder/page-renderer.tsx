'use client';

import { useEffect, useMemo, useState, type ComponentProps, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Box, Container, Flex, Grid, Section, Theme } from '@radix-ui/themes';

import type { BuilderBreakpoint, PageBlock, PageBuilderState, PageNode } from '@/lib/page-builder';
import { resolveNodeStyle, type NodeStyleInteractionState } from '@/lib/node-style';
import { sanitizeRichHtml } from '@/lib/sanitize';
import { apiFetch } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { MediaAsset, PublicContentEntryListOut } from '@/lib/types';

import { PublicFooterNav } from '@/components/public/public-footer-nav';
import { PublicTopNav } from '@/components/public/public-top-nav';
import { ComponentPreview } from '@/components/components/component-preview';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type RenderOpts = {
	slot?: React.ReactNode;
	collectionsByNodeId?: Record<string, PublicContentEntryListOut>;
};

function computeStateHeight(state: PageBuilderState, breakpoint: BuilderBreakpoint): number {
	const base = computeCanvasHeight(state.nodes, breakpoint);
	return Math.max(state.canvas.minHeightPx, base);
}

function renderFrameHost(
	node: Extract<PageNode, { type: 'frame' }>,
	children: React.ReactNode,
	inspectorStyle?: CSSProperties
) {
	const className = (node.data.className || '').trim();
	const mergedClassName = className ? `relative w-full h-full ${className}` : 'relative w-full h-full';

	const props =
		typeof node.data.props === 'object' && node.data.props
			? (node.data.props as Record<string, unknown>)
			: {};

	const baseStyle =
		typeof props.style === 'object' && props.style
			? (props.style as CSSProperties)
			: undefined;
	const mergedStyle = inspectorStyle ? { ...(baseStyle ?? {}), ...inspectorStyle } : baseStyle;

	const rest = {
		...props,
		className: mergedClassName,
		style: mergedStyle,
	} as Record<string, unknown> & { children?: unknown };
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

	return (
		<div
			className={mergedClassName}
			style={{ boxSizing: 'border-box', ...(mergedStyle ?? {}) }}>
			{children}
		</div>
	);
}

function computeCanvasHeight(nodes: PageNode[], breakpoint: BuilderBreakpoint): number {
	function walk(list: PageNode[]): number {
		let max = 0;
		for (const n of list) {
			const f = n.frames[breakpoint];
			const childMax = Array.isArray(n.nodes) ? walk(n.nodes) : 0;
			const effectiveH = Math.max(f.h, childMax);
			max = Math.max(max, f.y + effectiveH);
		}
		return max;
	}
	return walk(nodes);
}

function CollectionListPreview({
	nodeId,
	typeSlug,
	limit,
	sort,
	dir,
	columns,
	imageField,
	subtitleField,
	initial,
}: {
	nodeId: string;
	typeSlug: string;
	limit: number;
	sort: string;
	dir: 'asc' | 'desc';
	columns: number;
	imageField?: string;
	subtitleField?: string;
	initial?: PublicContentEntryListOut;
}) {
	const requestKey = `${typeSlug}|${limit}|${sort}|${dir}`;

	const [loadedKey, setLoadedKey] = useState(() => (initial ? requestKey : ''));
	const [list, setList] = useState<PublicContentEntryListOut | null>(() => initial ?? null);
	const [loading, setLoading] = useState<boolean>(!initial);
	const [error, setError] = useState<string | null>(null);

	const [mediaById, setMediaById] = useState<Record<number, MediaAsset | null>>({});

	useEffect(() => {
		if (!typeSlug.trim()) {
			setLoadedKey('');
			setList(null);
			setLoading(false);
			setError(null);
			return;
		}

		if (loadedKey === requestKey && list) return;

		let canceled = false;
		const controller = new AbortController();

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams();
				params.set('limit', String(limit));
				params.set('offset', '0');
				if (sort) params.set('sort', sort);
				if (dir) params.set('dir', dir);

				const out = await apiFetch<PublicContentEntryListOut>(
					`/api/public/entries/${encodeURIComponent(typeSlug)}?${params.toString()}`,
					{ cache: 'no-store', nextPath: window.location.pathname, signal: controller.signal }
				);

				if (canceled) return;
				setList(out);
				setLoadedKey(requestKey);
			} catch (e) {
				if (canceled || controller.signal.aborted) return;
				setError(e instanceof Error ? e.message : String(e));
				setList(null);
				setLoadedKey('');
			} finally {
				if (!canceled && !controller.signal.aborted) setLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
			controller.abort();
		};
	}, [typeSlug, limit, sort, dir, requestKey, loadedKey, list]);

	const items = useMemo(() => list?.items ?? [], [list]);

	const mediaIds = useMemo(() => {
		const key = imageField?.trim();
		if (!key) return [] as number[];
		const ids = new Set<number>();
		for (const it of items) {
			const v = (it.data as Record<string, unknown>)[key];
			if (typeof v === 'number' && Number.isFinite(v) && v > 0) ids.add(Math.round(v));
		}
		return Array.from(ids);
	}, [items, imageField]);

	useEffect(() => {
		if (mediaIds.length === 0) return;

		const missing = mediaIds.filter((id) => !(id in mediaById));
		if (missing.length === 0) return;

		let canceled = false;

		async function load() {
			const results = await Promise.all(
				missing.map(async (id) => {
					try {
						const out = await apiFetch<MediaAsset>(`/api/public/media/${id}`, {
							cache: 'no-store',
							nextPath: window.location.pathname,
						});
						return [id, out] as const;
					} catch {
						return [id, null] as const;
					}
				})
			);

			if (canceled) return;
			setMediaById((prev) => {
				const next = { ...prev };
				for (const [id, out] of results) next[id] = out;
				return next;
			});
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [mediaIds, mediaById]);

	if (!typeSlug.trim()) {
		return (
			<div className='rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground'>
				Collection list: set <code>type_slug</code> in the inspector.
			</div>
		);
	}

	if (loading && items.length === 0) {
		return (
			<div className='rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground'>
				Loading collection…
			</div>
		);
	}

	if (error) {
		return (
			<div className='rounded-lg border bg-muted/10 p-4 text-sm text-red-600'>
				{error}
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className='rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground'>
				No published entries in <code>{typeSlug}</code>.
			</div>
		);
	}

	const cols = Math.max(1, Math.min(6, Math.round(columns)));
	const gridCols =
		cols === 1
			? 'grid-cols-1'
			: cols === 2
				? 'grid-cols-1 sm:grid-cols-2'
				: cols === 3
					? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
					: cols === 4
						? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
						: cols === 5
							? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
							: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-6';

	return (
		<div className={`grid gap-4 ${gridCols}`}>
			{items.map((it) => {
				const data = it.data as Record<string, unknown>;
				const imgKey = imageField?.trim();
				const subKey = subtitleField?.trim();

				let imageUrl: string | null = null;
				if (imgKey) {
					const v = data[imgKey];
					if (typeof v === 'string' && v.trim()) imageUrl = v.trim();
					else if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
						imageUrl = mediaById[Math.round(v)]?.url ?? null;
					}
				}

				const subtitle = subKey && data[subKey] != null ? String(data[subKey]) : null;

				return (
					<Card key={`${nodeId}:${it.id}`}>
						{imageUrl ? (
							<div className='relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-muted/20'>
								<Image
									src={imageUrl}
									alt=''
									fill
									unoptimized
									sizes='(min-width: 1024px) 25vw, 80vw'
									className='object-cover'
								/>
							</div>
						) : null}
						<CardHeader className='py-3'>
							<CardTitle className='text-sm'>{it.title}</CardTitle>
						</CardHeader>
						<CardContent className='pb-3'>
							{subtitle ? (
								<p className='text-sm text-muted-foreground'>{subtitle}</p>
							) : (
								<p className='text-xs text-muted-foreground'>/{it.slug}</p>
							)}
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

export function renderBlockPreview(block: PageBlock, opts?: RenderOpts) {
	const slot = opts?.slot;
	const collectionsByNodeId = opts?.collectionsByNodeId;

	function labelForAccordionItem(b: PageBlock): string {
		if (b.type === 'unknown') return b.data.originalType;
		if (b.type === 'button') return b.data.label || 'Button';
		if (b.type === 'card') return b.data.title || 'Card';
		if (b.type === 'image') return b.data.alt?.trim() ? b.data.alt.trim() : 'Image';
		if (b.type === 'text') return b.data.text?.trim() ? b.data.text.trim() : 'Text';
		if (b.type === 'collection-list') return `collection/${b.data.type_slug || 'type'}`;
		if (b.type === 'menu') return `menu/${b.data.menu || 'main'}`;
		if (b.type === 'separator') return 'Divider';
		if (b.type === 'slot') return b.data.name?.trim() ? b.data.name.trim() : 'Slot';
		if (b.type === 'frame') return b.data.label?.trim() ? b.data.label.trim() : 'Frame';
		if (b.type === 'editor') return 'Text';
		return 'Component';
	}

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

	if (block.type === 'text') {
		const variant = (block.data.variant || 'p').trim().toLowerCase();
		const text = block.data.text ?? '';
		const userClassName = (block.data.className || '').trim();

		const base = 'whitespace-pre-wrap break-words';
		const variantClass =
			variant === 'h1'
				? 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl'
				: variant === 'h2'
					? 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0'
					: variant === 'h3'
						? 'scroll-m-20 text-2xl font-semibold tracking-tight'
						: variant === 'h4'
							? 'scroll-m-20 text-xl font-semibold tracking-tight'
							: variant === 'lead'
								? 'text-xl text-muted-foreground'
								: variant === 'large'
									? 'text-lg font-semibold'
									: variant === 'small'
										? 'text-sm font-medium leading-none'
										: variant === 'muted'
											? 'text-sm text-muted-foreground'
											: variant === 'code'
												? 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'
												: 'text-sm leading-6';

		const className = cn(base, variantClass, userClassName || undefined);

		if (variant === 'h1') return <h1 className={className}>{text}</h1>;
		if (variant === 'h2') return <h2 className={className}>{text}</h2>;
		if (variant === 'h3') return <h3 className={className}>{text}</h3>;
		if (variant === 'h4') return <h4 className={className}>{text}</h4>;
		if (variant === 'code') return <code className={className}>{text}</code>;
		return <p className={className}>{text}</p>;
	}

	if (block.type === 'slot') {
		if (slot) return <>{slot}</>;
		return (
			<div className='rounded-md border border-dashed bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground'>
				Page content slot
			</div>
		);
	}

	if (block.type === 'frame') {
		return null;
	}

	if (block.type === 'menu') {
		const id = block.data.menu?.trim() || 'main';
		if (id === 'none') return null;
		const items =
			Array.isArray(block.data.items) && block.data.items.length ? block.data.items : undefined;
		return block.data.kind === 'footer' ? (
			<PublicFooterNav menuId={id} items={items} />
		) : (
			<PublicTopNav menuId={id} items={items} />
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
			<div className='relative h-full w-full overflow-hidden rounded-lg bg-muted/30'>
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

	if (block.type === 'collection-list') {
		const typeSlug = (block.data.type_slug || '').trim();
		const limit = Number.isFinite(block.data.limit) ? Math.max(1, Math.min(100, Math.round(block.data.limit as number))) : 6;
		const sort = (block.data.sort || 'published_at').trim();
		const dir = block.data.dir === 'asc' ? 'asc' : 'desc';
		const columns = Number.isFinite(block.data.columns) ? Math.max(1, Math.min(12, Math.round(block.data.columns as number))) : 3;

		return (
			<CollectionListPreview
				nodeId={block.id}
				typeSlug={typeSlug}
				limit={limit}
				sort={sort}
				dir={dir}
				columns={columns}
				imageField={block.data.image_field}
				subtitleField={block.data.subtitle_field}
				initial={collectionsByNodeId ? collectionsByNodeId[block.id] : undefined}
			/>
		);
	}

	if (block.type === 'shape') {
		const kindRaw = (block.data.kind || 'rect').trim().toLowerCase();
		const kind =
			kindRaw === 'ellipse' ||
			kindRaw === 'line' ||
			kindRaw === 'arrow' ||
			kindRaw === 'polygon' ||
			kindRaw === 'star'
				? kindRaw
				: 'rect';

		const fill = (block.data.fill || '').trim();
		const stroke = (block.data.stroke || '').trim();
		const strokeWidthRaw = block.data.strokeWidth;
		const strokeWidth =
			typeof strokeWidthRaw === 'number' && Number.isFinite(strokeWidthRaw) ? Math.max(0, Math.min(50, strokeWidthRaw)) : 2;
		const radiusRaw = block.data.radiusPx;
		const radiusPx =
			typeof radiusRaw === 'number' && Number.isFinite(radiusRaw) ? Math.max(0, Math.min(500, radiusRaw)) : 8;

		if (kind === 'line' || kind === 'arrow') {
			return (
				<svg
					className='h-full w-full'
					viewBox='0 0 100 100'
					preserveAspectRatio='none'
					aria-hidden='true'>
					<line
						x1='0'
						y1='50'
						x2='100'
						y2='50'
						stroke={stroke || 'currentColor'}
						strokeWidth={strokeWidth}
						vectorEffect='non-scaling-stroke'
					/>
					{kind === 'arrow' ? (
						<polyline
							points='88,42 100,50 88,58'
							fill='none'
							stroke={stroke || 'currentColor'}
							strokeWidth={strokeWidth}
							strokeLinejoin='round'
							strokeLinecap='round'
							vectorEffect='non-scaling-stroke'
						/>
					) : null}
				</svg>
			);
		}

		if (kind === 'ellipse') {
			return (
				<div
					className='h-full w-full'
					style={{
						borderRadius: 9999,
						background: fill || 'transparent',
						border: stroke ? `${strokeWidth}px solid ${stroke}` : undefined,
						boxSizing: 'border-box',
					}}
				/>
			);
		}

		if (kind === 'polygon' || kind === 'star') {
			return (
				<div className='h-full w-full rounded-md border bg-muted/10 grid place-items-center text-xs text-muted-foreground'>
					{kind} (todo)
				</div>
			);
		}

		return (
			<div
				className='h-full w-full'
				style={{
					borderRadius: radiusPx,
					background: fill || 'transparent',
					border: stroke ? `${strokeWidth}px solid ${stroke}` : undefined,
					boxSizing: 'border-box',
				}}
			/>
		);
	}

	if (block.type === 'unknown') {
		return (
			<div className='rounded-lg border p-3 text-sm text-muted-foreground'>
				Unknown component: <code>{block.data.originalType}</code>
			</div>
		);
	}

	if (block.type === 'shadcn') {
		return (
			<div className='rounded-lg border p-3 text-sm text-muted-foreground'>
				Legacy component: <code>{block.data.component || 'shadcn'}</code>
			</div>
		);
	}

	return null;
}

export function PageRenderer({ state, collectionsByNodeId }: { state: PageBuilderState; collectionsByNodeId?: Record<string, PublicContentEntryListOut> }) {
	return <PageRendererWithSlot state={state} collectionsByNodeId={collectionsByNodeId} />;
}

function RenderNode({
	node,
	breakpoint,
	opts,
}: {
	node: PageNode;
	breakpoint: BuilderBreakpoint;
	opts?: RenderOpts;
}) {
	if (node.meta?.hidden) return null;

	const [interactionState, setInteractionState] = useState<NodeStyleInteractionState>('default');
	const frame = node.frames[breakpoint];
	const z = typeof frame.z === 'number' && Number.isFinite(frame.z) ? frame.z : undefined;

	const nodeStyle: CSSProperties = {
		position: 'absolute',
		left: Math.round(frame.x),
		top: Math.round(frame.y),
		width: Math.max(0, Math.round(frame.w)),
		height: Math.max(0, Math.round(frame.h)),
		zIndex: z,
	};

	const resolvedVisualStyle = resolveNodeStyle(node.style, breakpoint, interactionState) as CSSProperties;

	const childNodes = Array.isArray(node.nodes)
		? node.nodes.map((c: PageNode) => <RenderNode key={c.id} node={c} breakpoint={breakpoint} opts={opts} />)
		: null;

	const interactionHandlers = {
		onPointerEnter: () => setInteractionState((prev) => (prev === 'active' ? prev : 'hover')),
		onPointerLeave: () => setInteractionState('default' as NodeStyleInteractionState),
		onPointerDown: () => setInteractionState('active' as NodeStyleInteractionState),
		onPointerUp: () => setInteractionState('hover' as NodeStyleInteractionState),
		onFocusCapture: () => setInteractionState('focus' as NodeStyleInteractionState),
		onBlurCapture: () => setInteractionState('default' as NodeStyleInteractionState),
	};

	if (node.type === 'frame') {
		return (
			<div
				style={nodeStyle}
				className={node.data.clip ? 'overflow-hidden' : 'overflow-visible'}
				tabIndex={-1}
				{...interactionHandlers}>
				{renderFrameHost(node, childNodes, resolvedVisualStyle)}
			</div>
		);
	}

	const content = renderBlockPreview(node, opts);

	if (node.type === 'shape' && typeof node.data.href === 'string' && node.data.href.trim()) {
		const href = node.data.href.trim();
		return (
			<div
				style={nodeStyle}
				className='overflow-visible'
				tabIndex={-1}
				{...interactionHandlers}>
				<Link href={href} className='relative block h-full w-full'>
					{content ? <div className='absolute inset-0' style={resolvedVisualStyle}>{content}</div> : null}
					{childNodes}
				</Link>
			</div>
		);
	}

	return (
		<div
			style={nodeStyle}
			className='overflow-visible'
			tabIndex={-1}
			{...interactionHandlers}>
			<div className='relative w-full h-full'>
				{content ? <div className='absolute inset-0' style={resolvedVisualStyle}>{content}</div> : null}
				{childNodes}
			</div>
		</div>
	);
}

export function PageRendererWithSlot({
	state,
	slot,
	slotState,
	collectionsByNodeId,
}: {
	state: PageBuilderState;
	slot?: React.ReactNode;
	/** When rendering a template with a `slot`, pass the page state so the renderer can size the slot and place footer nodes after the content. */
	slotState?: PageBuilderState;
	collectionsByNodeId?: Record<string, PublicContentEntryListOut>;
}) {
	const baseHeight = computeCanvasHeight(state.nodes, 'desktop');
	const minHeight = Math.max(state.canvas.minHeightPx, baseHeight);

	function renderBreakpoint(bp: BuilderBreakpoint, className: string) {
		let nodes = state.nodes;
		let height = Math.max(state.canvas.minHeightPx, computeCanvasHeight(nodes, bp));
		const width = state.canvas.widths[bp];
		const opts: RenderOpts = { slot, collectionsByNodeId };

		// Templates use a `slot` placeholder; the slot node's stored height is static,
		// but the page content height is dynamic (canvas). When `slotState` is provided,
		// resize the slot and shift any nodes that were below it (e.g. footer) so they
		// never overlap the page content.
		if (slot && slotState) {
			const rootSlot = nodes.find((n) => n.type === 'slot');
			if (rootSlot) {
				const desiredSlotH = Math.max(1, Math.round(computeStateHeight(slotState, bp)));
				const originalSlot = rootSlot.frames[bp];
				const originalBottom = originalSlot.y + originalSlot.h;
				const delta = desiredSlotH - originalSlot.h;

				if (delta !== 0) {
					nodes = nodes.map((n) => {
						const f = n.frames[bp];
						if (n.type === 'slot') {
							return {
								...n,
								frames: { ...n.frames, [bp]: { ...f, h: desiredSlotH } },
							};
						}

						if (f.y >= originalBottom) {
							return {
								...n,
								frames: { ...n.frames, [bp]: { ...f, y: f.y + delta } },
							};
						}

						return n;
					});

					height = Math.max(state.canvas.minHeightPx, computeCanvasHeight(nodes, bp));
				}
			}
		}

		return (
			<div className={className}>
				<div
					className='relative mx-auto'
					style={{
						width,
						maxWidth: '100%',
						height,
					}}>
					{nodes.map((n) => <RenderNode key={n.id} node={n} breakpoint={bp} opts={opts} />)}
				</div>
			</div>
		);
	}

	return (
		<Theme
			asChild
			hasBackground={false}>
			<div
				className='w-full'
				style={{ minHeight }}>
				{renderBreakpoint('mobile', 'block md:hidden')}
				{renderBreakpoint('tablet', 'hidden md:block lg:hidden')}
				{renderBreakpoint('desktop', 'hidden lg:block')}
			</div>
		</Theme>
	);
}

