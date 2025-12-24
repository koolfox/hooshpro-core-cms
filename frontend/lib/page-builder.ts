import type { JSONContent } from '@tiptap/core';

export type EditorValue = { doc: JSONContent; html: string };

export type PageTemplateSettings = {
	id: string;
	menu: string;
	footer: string;
};

export type PageBuilderState = {
	template: PageTemplateSettings;
	rows: PageRow[];
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
	| SlotBlock
	| MenuBlock
	| SeparatorBlock
	| ButtonBlock
	| CardBlock
	| ImageBlock
	| ShadcnBlock
	| UnknownBlock;

export type EditorBlock = {
	id: string;
	type: 'editor';
	data: EditorValue;
};

export type SlotBlock = {
	id: string;
	type: 'slot';
	data: {
		name?: string;
	};
};

export type MenuBlock = {
	id: string;
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

export type SeparatorBlock = {
	id: string;
	type: 'separator';
	data: Record<string, never>;
};

export type ButtonBlock = {
	id: string;
	type: 'button';
	data: {
		label: string;
		href?: string;
		variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
	};
};

export type CardBlock = {
	id: string;
	type: 'card';
	data: {
		title?: string;
		body?: string;
	};
};

export type ImageBlock = {
	id: string;
	type: 'image';
	data: {
		url: string;
		alt?: string;
		media_id?: number;
	};
};

export type ShadcnBlock = {
	id: string;
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
	return {
		template: { id: 'default', menu: 'main', footer: 'none' },
		rows: [
			{
				id: stableId('row', 0),
				settings: { columns: 1 },
				columns: [
					{
						id: stableId('col', 0, 0),
						blocks: [
							{
								id: stableId('blk', 0, 0, 0),
								type: 'editor',
								data: emptyEditorValue(),
							},
						],
					},
				],
			},
		],
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

	// v3: grid layout
	if (version === 3) {
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

			if (type === 'editor' || type === 'tiptap') {
				return {
					id,
					type: 'editor',
					data: parseEditorValue(data) ?? emptyEditorValue(),
				};
			}

			if (type === 'slot') {
				const name =
					isRecord(data) && typeof data['name'] === 'string' ? data['name'] : undefined;
				return { id, type: 'slot', data: { name } };
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

				return { id, type: 'menu', data: items ? { menu, kind, items } : { menu, kind } };
			}

			if (type === 'separator') {
				return { id, type: 'separator', data: {} };
			}

			if (type === 'button') {
				const label = isRecord(data) && typeof data['label'] === 'string' ? data['label'] : 'Button';
				const href = isRecord(data) && typeof data['href'] === 'string' ? data['href'] : undefined;
				const variant = isRecord(data) && typeof data['variant'] === 'string' ? data['variant'] : undefined;
				return {
					id,
					type: 'button',
					data: { label, href, variant: variant as ButtonBlock['data']['variant'] },
				};
			}

			if (type === 'card') {
				const title = isRecord(data) && typeof data['title'] === 'string' ? data['title'] : undefined;
				const body = isRecord(data) && typeof data['body'] === 'string' ? data['body'] : undefined;
				return { id, type: 'card', data: { title, body } };
			}

			if (type === 'image') {
				const url = isRecord(data) && typeof data['url'] === 'string' ? data['url'] : '';
				const alt = isRecord(data) && typeof data['alt'] === 'string' ? data['alt'] : undefined;
				const mediaId = isRecord(data) && typeof data['media_id'] === 'number' ? data['media_id'] : undefined;
				return { id, type: 'image', data: { url, alt, media_id: mediaId } };
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
					type: 'shadcn',
					data: props ? { component, props } : { component },
				};
				if (children) out.children = children;
				return out;
			}

			return {
				id,
				type: 'unknown',
				data: { originalType: type, data },
			};
		}

		const template = parsePageTemplateSettings(blocks['template']);
		const layout = blocks['layout'];
		const rowsValue = isRecord(layout) ? layout['rows'] : null;
		const rowsRaw = Array.isArray(rowsValue) ? rowsValue : [];

		const rows: PageRow[] = [];
		for (const [rowIndex, r] of rowsRaw.entries()) {
			if (!isRecord(r)) continue;
			const rowId =
				typeof r['id'] === 'string' && r['id'].trim()
					? r['id']
					: stableId('row', rowIndex);

			const columnsRaw = Array.isArray(r['columns']) ? r['columns'] : [];
			const columns: PageColumn[] = [];

			for (const [colIndex, c] of columnsRaw.entries()) {
				if (!isRecord(c)) continue;
				const colId =
					typeof c['id'] === 'string' && c['id'].trim()
						? c['id']
						: stableId('col', rowIndex, colIndex);

				const blocksRaw = Array.isArray(c['blocks']) ? c['blocks'] : [];
				const colBlocks: PageBlock[] = [];
				for (const [blockIndex, b] of blocksRaw.entries()) {
					const parsed = parseBlockNode(
						b,
						stableId('blk', rowIndex, colIndex, blockIndex),
						[rowIndex, colIndex, blockIndex]
					);
					if (parsed) colBlocks.push(parsed);
				}

				const colSettings = isRecord(c['settings']) ? c['settings'] : null;
				const colWrapperSetting =
					isRecord(colSettings) && typeof colSettings['wrapper'] === 'string'
						? colSettings['wrapper'].trim().toLowerCase()
						: undefined;
				const colWrapper =
					colWrapperSetting === 'card' || colWrapperSetting === 'none'
						? (colWrapperSetting as 'card' | 'none')
						: undefined;
				const colMinHeightPx = isRecord(colSettings)
					? parsePx(colSettings['minHeightPx'], 60, 5000)
					: undefined;

				columns.push({
					id: colId,
					blocks: colBlocks,
					settings:
						colWrapper || colMinHeightPx
							? { wrapper: colWrapper, minHeightPx: colMinHeightPx }
							: undefined,
				});
			}

			const settings = isRecord(r['settings']) ? r['settings'] : null;
			const columnsSetting =
				isRecord(settings) && typeof settings['columns'] === 'number'
					? settings['columns']
					: undefined;
			const sizesSetting = isRecord(settings)
				? parseRowSizes(settings['sizes'], columns.length)
				: undefined;
			const wrapperSetting =
				isRecord(settings) && typeof settings['wrapper'] === 'string'
					? settings['wrapper'].trim().toLowerCase()
					: undefined;
			const wrapper =
				wrapperSetting === 'card' || wrapperSetting === 'none'
					? (wrapperSetting as 'card' | 'none')
					: undefined;
			const minHeightPx = isRecord(settings) ? parsePx(settings['minHeightPx'], 60, 8000) : undefined;
			const maxWidthPct = isRecord(settings) ? parsePct(settings['maxWidthPct'], 10, 100) : undefined;

			rows.push({
				id: rowId,
				columns: columns.length > 0 ? columns : fallback.rows[0].columns,
				settings:
					columnsSetting || sizesSetting || wrapper || minHeightPx || maxWidthPct
						? { columns: columnsSetting, sizes: sizesSetting, wrapper, minHeightPx, maxWidthPct }
						: undefined,
			});
		}

		return {
			template,
			rows: rows.length > 0 ? rows : fallback.rows,
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

		return {
			template: { id: 'default', menu: 'main', footer: 'none' },
			rows: [
				{
					id: stableId('row', 0),
					settings: { columns: 1 },
					columns: [{ id: stableId('col', 0, 0), blocks: blocksInColumn }],
				},
			],
		};
	}

	// v1 legacy
	return {
		template: { id: 'default', menu: 'main', footer: 'none' },
		rows: [
			{
				id: stableId('row', 0),
				settings: { columns: 1 },
				columns: [
					{
						id: stableId('col', 0, 0),
						blocks: [
							{
								id: stableId('blk', 0, 0, 0),
								type: 'editor',
								data: parseLegacyToEditorValue(blocks),
							},
						],
					},
				],
			},
		],
	};
}

export function serializePageBuilderState(state: PageBuilderState) {
	function serializeBlock(b: PageBlock): Record<string, unknown> {
		const type = b.type === 'unknown' ? b.data.originalType : b.type;
		const data = b.type === 'unknown' ? b.data.data ?? null : b.data ?? null;
		const out: Record<string, unknown> = { id: b.id, type, data };

		if (b.type === 'shadcn' && Array.isArray(b.children)) {
			out['children'] = b.children.map(serializeBlock);
		}

		return out;
	}

	return {
		version: 3,
		template: state.template,
		layout: {
			rows: state.rows.map((r) => ({
				id: r.id,
				settings: r.settings,
				columns: r.columns.map((c) => ({
					id: c.id,
					settings: c.settings,
					blocks: c.blocks.map(serializeBlock),
				})),
			})),
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

export function cloneRowsWithNewIds(rows: PageRow[]): PageRow[] {
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

	return rows.map((row) => ({
		id: createId('row'),
		settings: row.settings ? deepClone(row.settings) : undefined,
		columns: row.columns.map((col) => ({
			id: createId('col'),
			settings: col.settings ? deepClone(col.settings) : undefined,
			blocks: col.blocks.map(cloneBlockWithNewIds),
		})),
	}));
}
