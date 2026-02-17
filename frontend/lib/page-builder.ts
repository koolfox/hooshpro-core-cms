import type { JSONContent } from '@tiptap/core';

export type EditorValue = { doc: JSONContent; html: string };

export type NodeMeta = {
	/** Optional user-friendly name shown in Layers panel. */
	name?: string;
	/** Deprecated in V5 (no locks); kept for backward compatibility. */
	locked?: boolean;
	/** When true, node is hidden (not rendered) unless explicitly selected in the editor. */
	hidden?: boolean;
	/** When true, children are collapsed in the Layers panel. */
	collapsed?: boolean;
};

export type PageTemplateSettings = {
	id: string;
	menu: string;
	footer: string;
};

export type BuilderBreakpoint = 'mobile' | 'tablet' | 'desktop';

export type NodeFrame = {
	/** x/y/w/h are in pixels, relative to the parent container. */
	x: number;
	y: number;
	w: number;
	h: number;
	/** Optional z-index (higher renders on top). */
	z?: number;
};

export type NodeFrames = Record<BuilderBreakpoint, NodeFrame>;

export type CanvasSettings = {
	/** Snap step for drag/resize, in px. */
	snapPx: number;
	/** Design canvas widths per breakpoint (px). */
	widths: Record<BuilderBreakpoint, number>;
	/** Minimum canvas height (px). */
	minHeightPx: number;
};

export type PageBuilderState = {
	template: PageTemplateSettings;
	canvas: CanvasSettings;
	nodes: PageNode[];
};

export type PageRow = {
	id: string;
	columns: PageColumn[];
	settings?: {
		columns?: number;
		sizes?: number[];
		wrapper?: 'none' | 'card';
		/** Minimum row height in pixels (editor + renderer). */
		minHeightPx?: number;
		/** Row max-width as a percent of the page container. */
		maxWidthPct?: number;
	};
};

export type PageColumn = {
	id: string;
	blocks: PageBlock[];
	settings?: {
		wrapper?: 'none' | 'card';
		/** Minimum column height in pixels (editor + renderer). */
		minHeightPx?: number;
	};
};

export type PageBlock =
	| EditorBlock
	| TextBlock
	| SlotBlock
	| MenuBlock
	| FrameBlock
	| SeparatorBlock
	| ButtonBlock
	| CardBlock
	| ImageBlock
	| CollectionListBlock
	| ShapeBlock
	| ShadcnBlock
	| UnknownBlock;

export type PageNode = PageBlock & {
	frames: NodeFrames;
	/** Layout children (positioned inside this node). */
	nodes?: PageNode[];
};

export type EditorBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'editor';
	data: EditorValue;
};

export type TextVariant =
	| 'p'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'h4'
	| 'lead'
	| 'large'
	| 'small'
	| 'muted'
	| 'code';

export type TextBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'text';
	data: {
		text: string;
		variant?: TextVariant;
		className?: string;
	};
};

export type SlotBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'slot';
	data: {
		name?: string;
	};
};

export type MenuBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'menu';
	data: {
		menu: string;
		kind?: 'top' | 'footer';
		/**
		 * Optional embedded menu items (preferred). When present, public rendering
		 * uses these items directly without fetching `/api/public/menus/:slug`.
		 */
		items?: Array<{ id: string; label: string; href: string }>;
	};
};

export type FrameBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'frame';
	data: {
		label?: string;
		className?: string;
		paddingPx?: number;
		/** When true, children are clipped to the frame bounds (Figma-style “Clip content”). */
		clip?: boolean;
		/**
		 * Structural layout component (Radix Themes layout primitives).
		 * When omitted, the frame behaves as a generic container.
		 */
		layout?: 'box' | 'flex' | 'grid' | 'container' | 'section';
		/**
		 * Props forwarded to the underlying layout component.
		 * Stored as JSON (inspector edits).
		 */
		props?: Record<string, unknown>;
	};
};

export type SeparatorBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'separator';
	data: Record<string, never>;
};

export type ButtonBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'button';
	data: {
		label: string;
		href?: string;
		variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
	};
};

export type CardBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'card';
	data: {
		title?: string;
		body?: string;
	};
};

export type ImageBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'image';
	data: {
		url: string;
		alt?: string;
		media_id?: number;
	};
};

export type CollectionListBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'collection-list';
	data: {
		/** Content type slug, e.g. "products". */
		type_slug: string;
		limit?: number;
		sort?: string;
		dir?: 'asc' | 'desc';
		columns?: number;
		image_field?: string;
		subtitle_field?: string;
	};
};

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star';

export type ShapeBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'shape';
	data: {
		kind: ShapeKind;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		radiusPx?: number;
		/** Optional link behavior for this shape (turns it into a clickable container in public rendering). */
		href?: string;
	};
};

export type ShadcnBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'shadcn';
	data: {
		component: string;
		props?: Record<string, unknown>;
	};
	/**
	 * Optional nested children for "structural" shadcn components (e.g. Card).
	 * If present (even as an empty array), the block is treated as a container.
	 */
	children?: PageBlock[];
};

export type UnknownBlock = {
	id: string;
	meta?: NodeMeta;
	type: 'unknown';
	data: {
		originalType: string;
		data?: unknown;
	};
};

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function createId(prefix: string): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	if (uuid) return `${prefix}_${uuid}`;
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function stableId(prefix: string, ...parts: Array<string | number>): string {
	const suffix = parts
		.map((p) => String(p).trim())
		.filter(Boolean)
		.join('_')
		.replace(/[^a-zA-Z0-9_-]/g, '_');
	return suffix ? `${prefix}_${suffix}` : prefix;
}

function deepClone<T>(value: T): T {
	const sc = (globalThis as unknown as { structuredClone?: (v: unknown) => unknown })
		.structuredClone;
	if (typeof sc === 'function') {
		try {
			return sc(value) as T;
		} catch {
			// fall through
		}
	}
	return JSON.parse(JSON.stringify(value)) as T;
}

function escapeHtml(input: string): string {
	return input
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function emptyEditorValue(): EditorValue {
	return {
		doc: { type: 'doc', content: [{ type: 'paragraph' }] },
		html: '<p></p>',
	};
}

function parseEditorValue(value: unknown): EditorValue | null {
	if (!isRecord(value)) return null;
	if (!isRecord(value['doc'])) return null;
	if (typeof value['html'] !== 'string') return null;

	const doc = value['doc'];
	if (!isRecord(doc)) return null;
	if (typeof doc['type'] !== 'string') return null;

	return { doc: doc as JSONContent, html: value['html'] };
}

function parsePageTemplateSettings(value: unknown): PageTemplateSettings {
	const fallback: PageTemplateSettings = { id: 'default', menu: 'main', footer: 'none' };
	if (!isRecord(value)) return fallback;
	const id = typeof value['id'] === 'string' && value['id'].trim() ? value['id'] : fallback.id;
	const menu =
		typeof value['menu'] === 'string' && value['menu'].trim()
			? value['menu']
			: fallback.menu;
	const footer =
		typeof value['footer'] === 'string' && value['footer'].trim()
			? value['footer']
			: fallback.footer;
	return { id, menu, footer };
}

function normalizeSizeList(values: number[]): number[] {
	const clean = values
		.map((v) => (Number.isFinite(v) ? Number(v) : 0))
		.map((v) => (v > 0 ? v : 0));
	const sum = clean.reduce((acc, v) => acc + v, 0);
	if (!Number.isFinite(sum) || sum <= 0) return values;

	const scaled = clean.map((v) => (v / sum) * 100);
	const rounded = scaled.map((v) => Math.round(v * 100) / 100);
	const roundedSum = rounded.reduce((acc, v) => acc + v, 0);
	if (rounded.length > 0 && Number.isFinite(roundedSum)) {
		rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + (100 - roundedSum)) * 100) / 100;
	}
	return rounded;
}

function parseRowSizes(value: unknown, count: number): number[] | undefined {
	if (!Array.isArray(value)) return undefined;
	if (value.length !== count) return undefined;
	const nums = value.map((v) => (typeof v === 'number' ? v : Number.NaN));
	if (!nums.every((n) => Number.isFinite(n) && n > 0)) return undefined;
	return normalizeSizeList(nums);
}

function parseNumber(value: unknown): number | undefined {
	if (typeof value === 'number') return value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return undefined;
		const parsed = Number(trimmed);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

function parsePx(value: unknown, min: number, max: number): number | undefined {
	const n = parseNumber(value);
	if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
	const rounded = Math.round(n);
	if (rounded <= 0) return undefined;
	const clamped = Math.max(min, Math.min(max, rounded));
	return clamped;
}

function parsePct(value: unknown, min: number, max: number): number | undefined {
	const n = parseNumber(value);
	if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
	const clamped = Math.max(min, Math.min(max, n));
	const rounded = Math.round(clamped * 100) / 100;
	return rounded;
}

export const PAGE_BUILDER_CANONICAL_VERSION = 6;

const DEFAULT_CANVAS_WIDTHS: CanvasSettings['widths'] = {
	mobile: 390,
	tablet: 820,
	desktop: 1200,
};

export function defaultCanvasSettings(): CanvasSettings {
	return {
		snapPx: 1,
		widths: DEFAULT_CANVAS_WIDTHS,
		minHeightPx: 800,
	};
}

function defaultFrames(width: number, height: number): NodeFrames {
	return {
		mobile: { x: 0, y: 0, w: width, h: height },
		tablet: { x: 0, y: 0, w: width, h: height },
		desktop: { x: 0, y: 0, w: width, h: height },
	};
}

function parseFrame(value: unknown, fallback: NodeFrame): NodeFrame {
	if (!isRecord(value)) return fallback;
	const x = parseNumber(value['x']);
	const y = parseNumber(value['y']);
	const w = parseNumber(value['w']);
	const h = parseNumber(value['h']);
	const z = parseNumber(value['z']);
	return {
		x: Number.isFinite(x as number) ? Math.round(x as number) : fallback.x,
		y: Number.isFinite(y as number) ? Math.round(y as number) : fallback.y,
		w: Number.isFinite(w as number) && (w as number) > 0 ? Math.round(w as number) : fallback.w,
		h: Number.isFinite(h as number) && (h as number) > 0 ? Math.round(h as number) : fallback.h,
		z: Number.isFinite(z as number) ? Math.round(z as number) : fallback.z,
	};
}

function parseFrames(value: unknown, fallback: NodeFrames): NodeFrames {
	if (!isRecord(value)) return fallback;
	return {
		mobile: parseFrame(value['mobile'], fallback.mobile),
		tablet: parseFrame(value['tablet'], fallback.tablet),
		desktop: parseFrame(value['desktop'], fallback.desktop),
	};
}

function parseLegacyToEditorValue(blocks: unknown): EditorValue {
	if (!isRecord(blocks)) return emptyEditorValue();
	const rawBlocks = blocks['blocks'];
	if (!Array.isArray(rawBlocks)) return emptyEditorValue();

	let heroHeadline = '';
	let heroSubheadline = '';
	let paragraphText = '';

	for (const b of rawBlocks) {
		if (!isRecord(b)) continue;
		const type = b['type'];
		const data = b['data'];
		if (type === 'hero' && isRecord(data)) {
			heroHeadline =
				typeof data['headline'] === 'string' ? data['headline'].trim() : '';
			heroSubheadline =
				typeof data['subheadline'] === 'string'
					? data['subheadline'].trim()
					: '';
		}
		if (type === 'paragraph' && isRecord(data)) {
			paragraphText =
				typeof data['text'] === 'string' ? data['text'].trim() : '';
		}
	}

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

export function defaultPageBuilderState(): PageBuilderState {
	const canvas = defaultCanvasSettings();
	const padding = 24;
	const sectionHeight = 520;

	const section: PageNode = {
		id: stableId('node', 0),
		type: 'frame',
		data: { label: 'Section', paddingPx: padding },
		frames: {
			mobile: { x: 0, y: 0, w: canvas.widths.mobile, h: sectionHeight },
			tablet: { x: 0, y: 0, w: canvas.widths.tablet, h: sectionHeight },
			desktop: { x: 0, y: 0, w: canvas.widths.desktop, h: sectionHeight },
		},
		nodes: [
			{
				id: stableId('node', 0, 0),
				type: 'editor',
				data: emptyEditorValue(),
				frames: {
					mobile: { x: padding, y: padding, w: canvas.widths.mobile - padding * 2, h: 260 },
					tablet: { x: padding, y: padding, w: canvas.widths.tablet - padding * 2, h: 260 },
					desktop: { x: padding, y: padding, w: canvas.widths.desktop - padding * 2, h: 260 },
				},
			},
		],
	};

	return {
		template: { id: 'default', menu: 'main', footer: 'none' },
		canvas,
		nodes: [section],
	};
}

export function parsePageBuilderState(blocks: unknown): PageBuilderState {
	const fallback = defaultPageBuilderState();
	if (!isRecord(blocks)) return fallback;

	const rawVersion = blocks['version'];
	const version =
		typeof rawVersion === 'number'
			? rawVersion
			: typeof rawVersion === 'string' && /^\d+$/.test(rawVersion)
				? Number(rawVersion)
				: 1;

	const template = parsePageTemplateSettings(blocks['template']);

	const canvasFallback = defaultCanvasSettings();
	let canvas: CanvasSettings = canvasFallback;
	if (isRecord(blocks['canvas'])) {
		const c = blocks['canvas'] as Record<string, unknown>;
		const snapPx = parsePx(c['snapPx'], 1, 32) ?? canvasFallback.snapPx;
		const minHeightPx = parsePx(c['minHeightPx'], 200, 20000) ?? canvasFallback.minHeightPx;

		let widths = canvasFallback.widths;
		if (isRecord(c['widths'])) {
			const w = c['widths'] as Record<string, unknown>;
			const mobile = parsePx(w['mobile'], 240, 2000);
			const tablet = parsePx(w['tablet'], 320, 4000);
			const desktop = parsePx(w['desktop'], 480, 8000);
			if (mobile && tablet && desktop) widths = { mobile, tablet, desktop };
		}

		canvas = { snapPx, widths, minHeightPx };
	}

	function parseBlockNode(
		raw: unknown,
		fallbackId: string,
		path: Array<string | number>
	): PageBlock | null {
		if (!isRecord(raw)) return null;
		const type = raw['type'];
		if (typeof type !== 'string' || !type) return null;
		const id =
			typeof raw['id'] === 'string' && raw['id'].trim() ? raw['id'] : fallbackId;
		const data = raw['data'];
		const metaRaw = raw['meta'];
		let meta: NodeMeta | undefined;
		if (isRecord(metaRaw)) {
			const name =
				typeof metaRaw['name'] === 'string' && metaRaw['name'].trim()
					? metaRaw['name'].trim()
					: undefined;
			const locked = metaRaw['locked'] === true ? true : undefined;
			const hidden = metaRaw['hidden'] === true ? true : undefined;
			const collapsed = metaRaw['collapsed'] === true ? true : undefined;
			if (name || locked || hidden || collapsed) meta = { name, locked, hidden, collapsed };
		}

		if (type === 'editor' || type === 'tiptap') {
			return {
				id,
				meta,
				type: 'editor',
				data: parseEditorValue(data) ?? emptyEditorValue(),
			};
		}

		if (type === 'text') {
			const d = isRecord(data) ? data : {};
			const text = typeof d['text'] === 'string' ? d['text'] : '';
			const variantRaw = typeof d['variant'] === 'string' ? d['variant'].trim().toLowerCase() : '';
			const variant =
				variantRaw === 'h1' ||
				variantRaw === 'h2' ||
				variantRaw === 'h3' ||
				variantRaw === 'h4' ||
				variantRaw === 'lead' ||
				variantRaw === 'large' ||
				variantRaw === 'small' ||
				variantRaw === 'muted' ||
				variantRaw === 'code' ||
				variantRaw === 'p'
					? (variantRaw as TextVariant)
					: undefined;
			const className = typeof d['className'] === 'string' ? d['className'].trim() : undefined;

			return {
				id,
				meta,
				type: 'text',
				data: {
					text,
					variant,
					className: className || undefined,
				},
			};
		}

		if (type === 'slot') {
			const name =
				isRecord(data) && typeof data['name'] === 'string' ? data['name'] : undefined;
			return { id, meta, type: 'slot', data: { name } };
		}

		if (type === 'menu') {
			const menu = isRecord(data) && typeof data['menu'] === 'string' ? data['menu'] : 'main';
			const kindRaw =
				isRecord(data) && typeof data['kind'] === 'string'
					? data['kind'].trim().toLowerCase()
					: undefined;
			const kind =
				kindRaw === 'footer' || kindRaw === 'top' ? (kindRaw as 'top' | 'footer') : undefined;

			let items: MenuBlock['data']['items'] | undefined;
			const rawItems = isRecord(data) ? data['items'] : null;
			if (Array.isArray(rawItems)) {
				const parsed: NonNullable<MenuBlock['data']['items']> = [];
				for (const [idx, it] of rawItems.entries()) {
					if (!isRecord(it)) continue;
					const label = typeof it['label'] === 'string' ? it['label'].trim() : '';
					const href = typeof it['href'] === 'string' ? it['href'].trim() : '';
					if (!label || !href) continue;
					const itemId =
						typeof it['id'] === 'string' && it['id'].trim()
							? it['id']
							: stableId('mi', ...path, idx);
					parsed.push({ id: itemId, label, href });
				}
				items = parsed.length ? parsed : undefined;
			}

			return { id, meta, type: 'menu', data: items ? { menu, kind, items } : { menu, kind } };
		}

		if (type === 'frame') {
			const label =
				isRecord(data) && typeof data['label'] === 'string' ? data['label'] : undefined;
			const className =
				isRecord(data) && typeof data['className'] === 'string' ? data['className'] : undefined;
			const paddingPx = isRecord(data) ? parsePx(data['paddingPx'], 0, 500) : undefined;
			const clip = isRecord(data) && typeof data['clip'] === 'boolean' ? data['clip'] : undefined;
			const layoutRaw =
				isRecord(data) && typeof data['layout'] === 'string' ? data['layout'].trim().toLowerCase() : '';
			const layout =
				layoutRaw === 'box' ||
				layoutRaw === 'flex' ||
				layoutRaw === 'grid' ||
				layoutRaw === 'container' ||
				layoutRaw === 'section'
					? (layoutRaw as FrameBlock['data']['layout'])
					: undefined;

			let props: Record<string, unknown> | undefined;
			if (isRecord(data) && isRecord(data['props'])) {
				props = data['props'] as Record<string, unknown>;
			}
			return {
				id,
				meta,
				type: 'frame',
				data:
					layout || props || clip
						? { label, className, paddingPx, layout, props, clip: clip ? true : undefined }
						: { label, className, paddingPx },
			};
		}

		if (type === 'separator') {
			return { id, meta, type: 'separator', data: {} };
		}

		if (type === 'button') {
			const label = isRecord(data) && typeof data['label'] === 'string' ? data['label'] : 'Button';
			const href = isRecord(data) && typeof data['href'] === 'string' ? data['href'] : undefined;
			const variant = isRecord(data) && typeof data['variant'] === 'string' ? data['variant'] : undefined;
			return {
				id,
				meta,
				type: 'button',
				data: { label, href, variant: variant as ButtonBlock['data']['variant'] },
			};
		}

		if (type === 'card') {
			const title = isRecord(data) && typeof data['title'] === 'string' ? data['title'] : undefined;
			const body = isRecord(data) && typeof data['body'] === 'string' ? data['body'] : undefined;
			return { id, meta, type: 'card', data: { title, body } };
		}

		if (type === 'image') {
			const url = isRecord(data) && typeof data['url'] === 'string' ? data['url'] : '';
			const alt = isRecord(data) && typeof data['alt'] === 'string' ? data['alt'] : undefined;
			const mediaId = isRecord(data) && typeof data['media_id'] === 'number' ? data['media_id'] : undefined;
			return { id, meta, type: 'image', data: { url, alt, media_id: mediaId } };
		}

		if (type === 'collection-list') {
			const d = isRecord(data) ? data : {};
			const typeSlug = typeof d['type_slug'] === 'string' ? d['type_slug'].trim() : '';
			const limit = parsePx(d['limit'], 1, 100) ?? undefined;
			const columns = parsePx(d['columns'], 1, 12) ?? undefined;
			const sort = typeof d['sort'] === 'string' ? d['sort'].trim() : undefined;
			const dirRaw = typeof d['dir'] === 'string' ? d['dir'].trim().toLowerCase() : '';
			const dir = dirRaw === 'asc' || dirRaw === 'desc' ? (dirRaw as 'asc' | 'desc') : undefined;
			const imageField = typeof d['image_field'] === 'string' ? d['image_field'].trim() : undefined;
			const subtitleField = typeof d['subtitle_field'] === 'string' ? d['subtitle_field'].trim() : undefined;

			return {
				id,
				meta,
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

		if (type === 'shape') {
			const d = isRecord(data) ? data : {};
			const kindRaw = typeof d['kind'] === 'string' ? d['kind'].trim().toLowerCase() : 'rect';
			const kind =
				kindRaw === 'ellipse' ||
				kindRaw === 'line' ||
				kindRaw === 'arrow' ||
				kindRaw === 'polygon' ||
				kindRaw === 'star'
					? (kindRaw as ShapeKind)
					: ('rect' as ShapeKind);

			const fill = typeof d['fill'] === 'string' ? d['fill'].trim() : undefined;
			const stroke = typeof d['stroke'] === 'string' ? d['stroke'].trim() : undefined;
			const strokeWidth = parsePx(d['strokeWidth'], 0, 50) ?? undefined;
			const radiusPx = parsePx(d['radiusPx'], 0, 500) ?? undefined;
			const href = typeof d['href'] === 'string' ? d['href'].trim() : undefined;

			return {
				id,
				meta,
				type: 'shape',
				data: {
					kind,
					fill: fill || undefined,
					stroke: stroke || undefined,
					strokeWidth,
					radiusPx,
					href: href || undefined,
				},
			};
		}

		if (type === 'shadcn') {
			const component =
				isRecord(data) && typeof data['component'] === 'string' ? data['component'] : '';
			let props: Record<string, unknown> | undefined;
			if (isRecord(data) && isRecord(data['props'])) {
				props = data['props'] as Record<string, unknown>;
			} else if (isRecord(data)) {
				const rest: Record<string, unknown> = {};
				for (const [k, v] of Object.entries(data)) {
					if (k === 'component') continue;
					rest[k] = v;
				}
				if (Object.keys(rest).length > 0) props = rest;
			}

			let children: PageBlock[] | undefined;
			if (Array.isArray(raw['children'])) {
				const parsed: PageBlock[] = [];
				for (const [childIndex, childRaw] of raw['children'].entries()) {
					const child = parseBlockNode(
						childRaw,
						stableId('blk', ...path, childIndex),
						[...path, childIndex]
					);
					if (child) parsed.push(child);
				}
				children = parsed;
			}

			const out: ShadcnBlock = {
				id,
				meta,
				type: 'shadcn',
				data: props ? { component, props } : { component },
			};
			if (children) out.children = children;
			return out;
		}

		return {
			id,
			meta,
			type: 'unknown',
			data: { originalType: type, data },
		};
	}

	function parseNode(raw: unknown, fallbackId: string, path: Array<string | number>): PageNode | null {
		if (!isRecord(raw)) return null;

		const block = parseBlockNode(raw, fallbackId, path);
		if (!block) return null;

		const frames = parseFrames(raw['frames'], defaultFrames(320, 200));

		let nodes: PageNode[] | undefined;
		if (Array.isArray(raw['nodes'])) {
			const parsed: PageNode[] = [];
			for (const [childIndex, childRaw] of (raw['nodes'] as unknown[]).entries()) {
				const child = parseNode(
					childRaw,
					stableId('node', ...path, childIndex),
					[...path, childIndex]
				);
				if (child) parsed.push(child);
			}
			nodes = parsed;
		}

		// Containers must always have a `nodes` array, even when empty, so they can
		// accept drops in the editor (Figma-style frames/shapes).
		const shouldDefaultToContainer =
			block.type === 'frame' || block.type === 'shape';
		if (!nodes && shouldDefaultToContainer) nodes = [];

		return nodes ? { ...block, frames, nodes } : { ...block, frames };
	}

	function estimateNodeHeight(block: PageBlock): number {
		if (block.type === 'menu') return 80;
		if (block.type === 'separator') return 24;
		if (block.type === 'button') return 56;
		if (block.type === 'image') return 240;
		if (block.type === 'card') return 200;
		if (block.type === 'text') return 80;
		if (block.type === 'editor') return 260;
		if (block.type === 'slot') return 320;
		if (block.type === 'frame') return 360;
		if (block.type === 'collection-list') return 420;
		if (block.type === 'shadcn') return 220;
		return 200;
	}

	// v4: new canvas layout
	if (version === 4 || version === PAGE_BUILDER_CANONICAL_VERSION) {
		const layout = blocks['layout'];
		const nodesRaw = isRecord(layout) && Array.isArray(layout['nodes']) ? (layout['nodes'] as unknown[]) : [];
		const nodes: PageNode[] = [];

		for (const [idx, n] of nodesRaw.entries()) {
			const parsed = parseNode(n, stableId('node', idx), [idx]);
			if (parsed) nodes.push(parsed);
		}

		return {
			template,
			canvas,
			nodes: nodes.length ? nodes : fallback.nodes,
		};
	}

	// v3: legacy rows/columns -> v4 canvas (auto-upgrade)
	if (version === 3) {
		const desktopWidth = canvas.widths.desktop;
		const padding = 24;
		const rowGap = 80;
		const colGap = 24;
		const itemGap = 24;

		const layout = blocks['layout'];
		const rowsValue = isRecord(layout) ? layout['rows'] : null;
		const rowsRaw = Array.isArray(rowsValue) ? (rowsValue as unknown[]) : [];

		const nodes: PageNode[] = [];
		let cursorY = 0;

		for (const [rowIndex, r] of rowsRaw.entries()) {
			if (!isRecord(r)) continue;
			const rowId =
				typeof r['id'] === 'string' && r['id'].trim()
					? r['id']
					: stableId('node', 'row', rowIndex);

			const settings = isRecord(r['settings']) ? (r['settings'] as Record<string, unknown>) : null;
			const maxWidthPct = settings ? parsePct(settings['maxWidthPct'], 10, 100) : undefined;
			const rowWidth = Math.round(desktopWidth * ((maxWidthPct ?? 100) / 100));
			const rowX = Math.round((desktopWidth - rowWidth) / 2);
			const minRowHeight = settings ? parsePx(settings['minHeightPx'], 60, 8000) : undefined;

			const columnsRaw = Array.isArray(r['columns']) ? (r['columns'] as unknown[]) : [];
			const sizesSetting = settings ? parseRowSizes(settings['sizes'], columnsRaw.length) : undefined;
			const sizes =
				sizesSetting && sizesSetting.length === columnsRaw.length
					? sizesSetting
					: Array.from({ length: Math.max(1, columnsRaw.length) }).map(() => 100 / Math.max(1, columnsRaw.length));
			const sizesSum = sizes.reduce((a, b) => a + b, 0) || 1;

			const colFramesDesktop: Array<{ x: number; w: number }> = [];
			let colCursorX = 0;
			for (let i = 0; i < columnsRaw.length; i++) {
				const pct = sizes[i] / sizesSum;
				const w = Math.max(80, Math.round(rowWidth * pct) - (i < columnsRaw.length - 1 ? colGap : 0));
				colFramesDesktop.push({ x: colCursorX, w });
				colCursorX += w + colGap;
			}

			let rowHeight = minRowHeight ?? 0;
			const columnNodes: PageNode[] = [];

			for (const [colIndex, c] of columnsRaw.entries()) {
				if (!isRecord(c)) continue;
				const colId =
					typeof c['id'] === 'string' && c['id'].trim()
						? c['id']
						: stableId('node', 'col', rowIndex, colIndex);

				const colSettings = isRecord(c['settings']) ? (c['settings'] as Record<string, unknown>) : null;
				const minColHeight = colSettings ? parsePx(colSettings['minHeightPx'], 60, 8000) : undefined;

				const colFrameDesktop = colFramesDesktop[colIndex] ?? { x: 0, w: rowWidth };

				const blocksRaw = Array.isArray(c['blocks']) ? (c['blocks'] as unknown[]) : [];
				const childNodes: PageNode[] = [];
				let childY = padding;
				let colHeight = padding;

				for (const [blockIndex, b] of blocksRaw.entries()) {
					const parsed = parseBlockNode(
						b,
						stableId('node', rowIndex, colIndex, blockIndex),
						[rowIndex, colIndex, blockIndex]
					);
					if (!parsed) continue;

					const estH = estimateNodeHeight(parsed);
					const nodeW = Math.max(60, colFrameDesktop.w - padding * 2);

					childNodes.push({
						...parsed,
						frames: {
							mobile: { x: padding, y: childY, w: canvas.widths.mobile - padding * 2, h: estH },
							tablet: { x: padding, y: childY, w: canvas.widths.tablet - padding * 2, h: estH },
							desktop: { x: padding, y: childY, w: nodeW, h: estH },
						},
					});

					childY += estH + itemGap;
					colHeight = childY + padding;
				}

				colHeight = Math.max(colHeight, minColHeight ?? 0);
				rowHeight = Math.max(rowHeight, colHeight);

				columnNodes.push({
					id: colId,
					type: 'frame',
					data: { label: `Column ${colIndex + 1}`, paddingPx: padding },
					frames: {
						mobile: { x: padding, y: 0, w: canvas.widths.mobile - padding * 2, h: colHeight },
						tablet: { x: padding, y: 0, w: canvas.widths.tablet - padding * 2, h: colHeight },
						desktop: { x: colFrameDesktop.x, y: 0, w: colFrameDesktop.w, h: colHeight },
					},
					nodes: childNodes,
				});
			}

			rowHeight = Math.max(rowHeight, minRowHeight ?? 0);

			nodes.push({
				id: rowId,
				type: 'frame',
				data: { label: `Row ${rowIndex + 1}`, paddingPx: 0 },
				frames: {
					mobile: { x: 0, y: cursorY, w: canvas.widths.mobile, h: rowHeight },
					tablet: { x: 0, y: cursorY, w: canvas.widths.tablet, h: rowHeight },
					desktop: { x: rowX, y: cursorY, w: rowWidth, h: rowHeight },
				},
				nodes: columnNodes,
			});

			cursorY += rowHeight + rowGap;
		}

		return {
			template,
			canvas,
			nodes: nodes.length ? nodes : fallback.nodes,
		};
	}

	// v2: old multi-tiptap list
	if (version === 2) {
		const rawBlocks = Array.isArray(blocks['blocks']) ? blocks['blocks'] : [];
		const tiptap: EditorBlock[] = [];

		for (const [index, b] of rawBlocks.entries()) {
			if (!isRecord(b)) continue;
			if (b['type'] !== 'tiptap' && b['type'] !== 'editor') continue;
			const id =
				typeof b['id'] === 'string' && b['id'].trim()
					? b['id']
					: stableId('blk', 0, 0, index);
			const v = parseEditorValue(b['data']) ?? emptyEditorValue();
			tiptap.push({ id, type: 'editor', data: v });
		}

		const legacyBlock: EditorBlock = {
			id: stableId('blk', 'legacy'),
			type: 'editor',
			data: parseLegacyToEditorValue(blocks),
		};

		const blocksInColumn: PageBlock[] = tiptap.length > 0 ? tiptap : [legacyBlock];
		const padding = 24;
		const itemGap = 24;
		let y = padding;

		const childNodes: PageNode[] = blocksInColumn.map((b) => {
			const h = b.type === 'editor' ? 260 : 200;
			const node: PageNode = {
				...b,
				frames: {
					mobile: { x: padding, y, w: canvas.widths.mobile - padding * 2, h },
					tablet: { x: padding, y, w: canvas.widths.tablet - padding * 2, h },
					desktop: { x: padding, y, w: canvas.widths.desktop - padding * 2, h },
				},
			};
			y += h + itemGap;
			return node;
		});

		return {
			template: { id: 'default', menu: 'main', footer: 'none' },
			canvas,
			nodes: [
				{
					id: stableId('node', 'legacy_frame'),
					type: 'frame',
					data: { label: 'Content', paddingPx: padding },
					frames: {
						mobile: { x: 0, y: 0, w: canvas.widths.mobile, h: Math.max(canvas.minHeightPx, y + padding) },
						tablet: { x: 0, y: 0, w: canvas.widths.tablet, h: Math.max(canvas.minHeightPx, y + padding) },
						desktop: { x: 0, y: 0, w: canvas.widths.desktop, h: Math.max(canvas.minHeightPx, y + padding) },
					},
					nodes: childNodes,
				},
			],
		};
	}

	// v1 legacy
	{
		const padding = 24;
		const editor: PageNode = {
			id: stableId('node', 0, 0),
			type: 'editor',
			data: parseLegacyToEditorValue(blocks),
			frames: {
				mobile: { x: padding, y: padding, w: canvas.widths.mobile - padding * 2, h: 260 },
				tablet: { x: padding, y: padding, w: canvas.widths.tablet - padding * 2, h: 260 },
				desktop: { x: padding, y: padding, w: canvas.widths.desktop - padding * 2, h: 260 },
			},
		};

		return {
			template: { id: 'default', menu: 'main', footer: 'none' },
			canvas,
			nodes: [
				{
					id: stableId('node', 'legacy_frame'),
					type: 'frame',
					data: { label: 'Content', paddingPx: padding },
					frames: {
						mobile: { x: 0, y: 0, w: canvas.widths.mobile, h: canvas.minHeightPx },
						tablet: { x: 0, y: 0, w: canvas.widths.tablet, h: canvas.minHeightPx },
						desktop: { x: 0, y: 0, w: canvas.widths.desktop, h: canvas.minHeightPx },
					},
					nodes: [editor],
				},
			],
		};
	}
}

export function serializePageBuilderState(state: PageBuilderState) {
	function serializeBlock(b: PageBlock): Record<string, unknown> {
		const type = b.type === 'unknown' ? b.data.originalType : b.type;
		const data = b.type === 'unknown' ? b.data.data ?? null : b.data ?? null;
		const out: Record<string, unknown> = { id: b.id, type, data };

		if (b.meta) {
			const metaOut: Record<string, unknown> = {};
			if (b.meta.name) metaOut['name'] = b.meta.name;
			if (b.meta.locked) metaOut['locked'] = true;
			if (b.meta.hidden) metaOut['hidden'] = true;
			if (b.meta.collapsed) metaOut['collapsed'] = true;
			if (Object.keys(metaOut).length) out['meta'] = metaOut;
		}

		if (b.type === 'shadcn' && Array.isArray(b.children)) {
			out['children'] = b.children.map(serializeBlock);
		}

		return out;
	}

	function serializeNode(n: PageNode): Record<string, unknown> {
		const out = serializeBlock(n);
		out['frames'] = n.frames;
		if (Array.isArray(n.nodes)) {
			out['nodes'] = n.nodes.map(serializeNode);
		}
		return out;
	}

	return {
		version: PAGE_BUILDER_CANONICAL_VERSION,
		template: state.template,
		canvas: state.canvas,
		layout: {
			nodes: state.nodes.map(serializeNode),
		},
	};
}

export function stripIds(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stripIds);
	if (!isRecord(value)) return value;

	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) {
		if (k === 'id') continue;
		out[k] = stripIds(v);
	}
	return out;
}

export function comparableJsonFromBlocks(blocks: unknown): string {
	return JSON.stringify(stripIds(serializePageBuilderState(parsePageBuilderState(blocks))));
}

export function comparableJsonFromState(state: PageBuilderState): string {
	return JSON.stringify(stripIds(serializePageBuilderState(state)));
}

export function cloneNodesWithNewIds(nodes: PageNode[]): PageNode[] {
	function cloneBlockWithNewIds(block: PageBlock): PageBlock {
		if (block.type === 'unknown') {
			return {
				id: createId('blk'),
				type: 'unknown',
				data: {
					originalType: block.data.originalType,
					data: deepClone(block.data.data),
				},
			} satisfies UnknownBlock;
		}

		if (block.type === 'shadcn') {
			const cloned: ShadcnBlock = {
				id: createId('blk'),
				type: 'shadcn',
				data: deepClone(block.data),
			};
			if (Array.isArray(block.children)) {
				cloned.children = block.children.map(cloneBlockWithNewIds);
			}
			return cloned;
		}

		return {
			id: createId('blk'),
			type: block.type,
			data: deepClone(block.data),
		} as PageBlock;
	}

	function cloneNodeWithNewIds(node: PageNode): PageNode {
		const clonedBlock = cloneBlockWithNewIds(node);
		const cloned: PageNode = {
			...(clonedBlock as PageNode),
			frames: deepClone(node.frames),
		};
		if (Array.isArray(node.nodes)) {
			cloned.nodes = node.nodes.map(cloneNodeWithNewIds);
		}
		return cloned;
	}

	return nodes.map(cloneNodeWithNewIds);
}
