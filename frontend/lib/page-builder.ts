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
	};
};

export type PageColumn = {
	id: string;
	blocks: PageBlock[];
};

export type PageBlock =
	| EditorBlock
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
		variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost';
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
	};
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
					if (!isRecord(b)) continue;
					const type = b['type'];
					if (typeof type !== 'string' || !type) continue;
					const id =
						typeof b['id'] === 'string' && b['id'].trim()
							? b['id']
							: stableId('blk', rowIndex, colIndex, blockIndex);
					const data = b['data'];

					if (type === 'editor' || type === 'tiptap') {
						colBlocks.push({
							id,
							type: 'editor',
							data: parseEditorValue(data) ?? emptyEditorValue(),
						});
						continue;
					}

					if (type === 'separator') {
						colBlocks.push({ id, type: 'separator', data: {} });
						continue;
					}

					if (type === 'button') {
						const label =
							isRecord(data) && typeof data['label'] === 'string'
								? data['label']
								: 'Button';
						const href =
							isRecord(data) && typeof data['href'] === 'string'
								? data['href']
								: undefined;
						const variant =
							isRecord(data) && typeof data['variant'] === 'string'
								? data['variant']
								: undefined;

						colBlocks.push({
							id,
							type: 'button',
							data: { label, href, variant: variant as ButtonBlock['data']['variant'] },
						});
						continue;
					}

					if (type === 'card') {
						const title =
							isRecord(data) && typeof data['title'] === 'string'
								? data['title']
								: undefined;
						const body =
							isRecord(data) && typeof data['body'] === 'string'
								? data['body']
								: undefined;
						colBlocks.push({ id, type: 'card', data: { title, body } });
						continue;
					}

					if (type === 'image') {
						const url =
							isRecord(data) && typeof data['url'] === 'string'
								? data['url']
								: '';
						const alt =
							isRecord(data) && typeof data['alt'] === 'string'
								? data['alt']
								: undefined;
						const mediaId =
							isRecord(data) && typeof data['media_id'] === 'number'
								? data['media_id']
								: undefined;
						colBlocks.push({
							id,
							type: 'image',
							data: { url, alt, media_id: mediaId },
						});
						continue;
					}

					if (type === 'shadcn') {
						const component =
							isRecord(data) && typeof data['component'] === 'string'
								? data['component']
								: '';
						colBlocks.push({
							id,
							type: 'shadcn',
							data: { component },
						});
						continue;
					}

					colBlocks.push({
						id,
						type: 'unknown',
						data: { originalType: type, data },
					});
				}

				columns.push({ id: colId, blocks: colBlocks });
			}

			const settings = isRecord(r['settings']) ? r['settings'] : null;
			const columnsSetting =
				isRecord(settings) && typeof settings['columns'] === 'number'
					? settings['columns']
					: undefined;

			rows.push({
				id: rowId,
				columns: columns.length > 0 ? columns : fallback.rows[0].columns,
				settings: columnsSetting ? { columns: columnsSetting } : undefined,
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
	return {
		version: 3,
		template: state.template,
		layout: {
			rows: state.rows.map((r) => ({
				id: r.id,
				settings: r.settings,
				columns: r.columns.map((c) => ({
					id: c.id,
					blocks: c.blocks.map((b) => ({
						id: b.id,
						type:
							b.type === 'unknown'
								? b.data.originalType
								: b.type,
						data:
							b.type === 'unknown'
								? b.data.data ?? null
								: b.data ?? null,
					})),
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
	return rows.map((row) => ({
		id: createId('row'),
		settings: row.settings ? deepClone(row.settings) : undefined,
		columns: row.columns.map((col) => ({
			id: createId('col'),
			blocks: col.blocks.map((b) => {
				if (b.type === 'unknown') {
					return {
						id: createId('blk'),
						type: 'unknown',
						data: {
							originalType: b.data.originalType,
							data: deepClone(b.data.data),
						},
					} satisfies UnknownBlock;
				}

				return {
					id: createId('blk'),
					type: b.type,
					data: deepClone(b.data),
				} as PageBlock;
			}),
		})),
	}));
}
