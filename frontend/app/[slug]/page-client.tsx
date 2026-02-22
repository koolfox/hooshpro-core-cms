'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

import type { Page, PageTemplate, PageTemplateListOut, PublicContentEntryListOut } from '@/lib/types';
import { ApiError, apiFetch } from '@/lib/http';
import { cn } from '@/lib/utils';
import {
	comparableJsonFromBlocks,
	comparableJsonFromState,
	parsePageBuilderState,
	serializePageBuilderState,
	type PageBuilderState,
	type PageNode,
} from '@/lib/page-builder';

import { PageBuilder, PageRenderer, PageRendererWithSlot } from '@/components/page-builder/page-builder';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

function collectNodeIds(nodes: PageNode[]): string[] {
	const out: string[] = [];
	function walk(list: PageNode[]) {
		for (const n of list) {
			out.push(n.id);
			if (Array.isArray(n.nodes)) walk(n.nodes);
		}
	}
	walk(nodes);
	return out;
}

function findNodeById(nodes: PageNode[], nodeId: string): PageNode | null {
	for (const n of nodes) {
		if (n.id === nodeId) return n;
		if (Array.isArray(n.nodes)) {
			const found = findNodeById(n.nodes, nodeId);
			if (found) return found;
		}
	}
	return null;
}

function findFirstSlot(nodes: PageNode[]): PageNode | null {
	for (const n of nodes) {
		if (n.type === 'slot') return n;
		if (Array.isArray(n.nodes)) {
			const found = findFirstSlot(n.nodes);
			if (found) return found;
		}
	}
	return null;
}

function computeCanvasHeight(nodes: PageNode[], bp: 'mobile' | 'tablet' | 'desktop'): number {
	function walk(list: PageNode[]): number {
		let max = 0;
		for (const n of list) {
			const f = n.frames[bp];
			const childMax = Array.isArray(n.nodes) ? walk(n.nodes) : 0;
			const effectiveH = Math.max(f.h, childMax);
			max = Math.max(max, f.y + effectiveH);
		}
		return max;
	}
	return walk(nodes);
}

function computeStateHeight(state: PageBuilderState, bp: 'mobile' | 'tablet' | 'desktop'): number {
	return Math.max(state.canvas.minHeightPx, computeCanvasHeight(state.nodes, bp));
}

function slugify(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export function PublicPageClient({
	initialPage,
	initialTemplate,
	initialCollections,
	isAdmin,
	defaultEdit,
	siteTheme,
	siteThemeVars,
	menuOverride,
	footerOverride,
}: {
	initialPage: Page;
	initialTemplate?: PageTemplate | null;
	initialCollections?: Record<string, PublicContentEntryListOut>;
	isAdmin: boolean;
	defaultEdit: boolean;
	siteTheme?: string;
	siteThemeVars?: Record<string, string>;
	menuOverride?: string | null;
	footerOverride?: string | null;
}) {
	const router = useRouter();

	const [page, setPage] = useState<Page>(initialPage);
	const [hydrated, setHydrated] = useState(false);

	// view/edit
	const [editMode, setEditMode] = useState<boolean>(isAdmin && defaultEdit);
	const [showChrome, setShowChrome] = useState(true);
	// V5: everything is editable; don't lock template chrome.
	const [chromeUnlocked, setChromeUnlocked] = useState(true);

	// settings modal
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [templates, setTemplates] = useState<PageTemplate[]>([]);
	const [templatesLoading, setTemplatesLoading] = useState(false);
	const [templatesError, setTemplatesError] = useState<string | null>(null);

	const [activeTemplate, setActiveTemplate] = useState<PageTemplate | null>(initialTemplate ?? null);
	const [activeTemplateLoading, setActiveTemplateLoading] = useState(false);
	const [activeTemplateError, setActiveTemplateError] = useState<string | null>(null);
	const [cloningTemplate, setCloningTemplate] = useState(false);

	// editable fields
	const [title, setTitle] = useState(page.title);
	const [seoTitle, setSeoTitle] = useState(page.seo_title ?? '');
	const [seoDesc, setSeoDesc] = useState(page.seo_description ?? '');
	const [status, setStatus] = useState<'draft' | 'published'>(page.status);

	const [builder, setBuilder] = useState<PageBuilderState>(() =>
		parsePageBuilderState(initialPage.blocks)
	);
	const [baselineBlocks, setBaselineBlocks] = useState(() =>
		comparableJsonFromBlocks(initialPage.blocks)
	);
	const [templateDraft, setTemplateDraft] = useState<PageBuilderState | null>(null);
	const [baselineTemplate, setBaselineTemplate] = useState<string>('');

	const [saving, setSaving] = useState(false);
	const [autosaving, setAutosaving] = useState(false);
	const [autosaveEnabled, setAutosaveEnabled] = useState(true);
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
	const [autosaveError, setAutosaveError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const viewState = useMemo(() => parsePageBuilderState(page.blocks), [page.blocks]);

	const activeTemplateSlug = editMode ? builder.template.id : viewState.template.id;
	const themeSlug = (siteTheme ?? activeTemplateSlug).trim().toLowerCase();
	const themeClass = useMemo(() => {
		const normalized = themeSlug.replace(/[^a-z0-9-_]/g, '');
		return normalized ? `theme-${normalized}` : null;
	}, [themeSlug]);

	const themeStyle: CSSProperties | undefined = useMemo(() => {
		if (!siteThemeVars) return undefined;
		const entries = Object.entries(siteThemeVars).filter(
			([k, v]) => k.startsWith('--') && typeof v === 'string' && v.trim()
		);
		if (entries.length === 0) return undefined;
		return Object.fromEntries(entries) as CSSProperties;
	}, [siteThemeVars]);

	const legacyMenuId =
		!editMode && menuOverride && menuOverride.trim()
			? menuOverride.trim()
			: editMode
				? builder.template.menu
				: viewState.template.menu;

	const legacyFooterId =
		!editMode && footerOverride && footerOverride.trim()
			? footerOverride.trim()
			: editMode
				? builder.template.footer
				: viewState.template.footer;

	const templatesBySlug = useMemo(() => {
		const m = new Map<string, PageTemplate>();
		for (const t of templates) m.set(t.slug, t);
		return m;
	}, [templates]);

	useEffect(() => {
		setHydrated(true);
	}, []);

	async function cloneTemplateForPage() {
		if (!isAdmin) return;
		if (cloningTemplate || saving) return;
		setError(null);

		const baseSlug = slugify(activeTemplate?.slug ?? builder.template.id ?? 'template') || 'template';
		const baseTitle = (activeTemplate?.title ?? 'Template').trim() || 'Template';
		const baseMenu = (activeTemplate?.menu ?? builder.template.menu ?? 'main').trim() || 'main';
		const baseFooter = (activeTemplate?.footer ?? builder.template.footer ?? 'none').trim() || 'none';
		const baseDescription =
			activeTemplate?.description?.trim() || `Cloned from ${baseSlug} for page ${page.slug}.`;

		const stateToClone =
			showChrome && chromeUnlocked && templateDraft ? templateDraft : rendererState;
		const definition = serializePageBuilderState(stateToClone);

		const baseVariant = baseSlug.endsWith('-variant') ? baseSlug : `${baseSlug}-variant`;

		setCloningTemplate(true);
		try {
			let lastErr: unknown = null;
			for (let i = 0; i < 50; i++) {
				const candidate = i === 0 ? baseVariant : `${baseVariant}-${i + 1}`;
				try {
					const created = await apiFetch<PageTemplate>('/api/admin/templates', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							title: `${baseTitle} (variant)`,
							slug: candidate,
							description: baseDescription,
							menu: baseMenu,
							footer: baseFooter,
							definition,
						}),
						cache: 'no-store',
						nextPath: `/${page.slug}`,
					});

					setBuilder((prev) => ({
						...prev,
						template: { ...prev.template, id: created.slug, menu: created.menu, footer: created.footer },
					}));
					setTemplates((prev) =>
						prev.some((t) => t.slug === created.slug) ? prev : [created, ...prev]
					);
					setActiveTemplate(created);
					setSettingsOpen(false);
					return;
				} catch (e) {
					lastErr = e;
					if (e instanceof ApiError && e.status === 409) continue;
					throw e;
				}
			}
			throw lastErr ?? new Error('Failed to clone template');
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setCloningTemplate(false);
		}
	}

	useEffect(() => {
		if (!activeTemplateSlug) {
			setActiveTemplate(null);
			return;
		}

		if (activeTemplate?.slug === activeTemplateSlug) return;

		let canceled = false;
		async function load() {
			setActiveTemplateLoading(true);
			setActiveTemplateError(null);
			try {
				const t = await apiFetch<PageTemplate>(
					`/api/public/templates/${encodeURIComponent(activeTemplateSlug)}`,
					{
						cache: 'no-store',
						nextPath: `/${page.slug}`,
					}
				);
				if (canceled) return;
				setActiveTemplate(t);
			} catch (e) {
				if (canceled) return;
				setActiveTemplate(null);
				setActiveTemplateError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!canceled) setActiveTemplateLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [activeTemplateSlug, activeTemplate?.slug, page.slug]);

	useEffect(() => {
		if (!settingsOpen) return;
		if (!isAdmin) return;

		let canceled = false;
		async function load() {
			setTemplatesLoading(true);
			setTemplatesError(null);
			try {
				const res = await apiFetch<PageTemplateListOut>(`/api/admin/templates?limit=200&offset=0`, {
					cache: 'no-store',
					nextPath: `/${page.slug}?edit=1`,
				});
				if (canceled) return;
				setTemplates(res.items ?? []);
			} catch (e) {
				if (canceled) return;
				setTemplatesError(e instanceof Error ? e.message : String(e));
				setTemplates([]);
			} finally {
				if (!canceled) setTemplatesLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [settingsOpen, isAdmin, page.slug]);

	const templateDirty = useMemo(() => {
		if (!editMode) return false;
		if (!showChrome) return false;
		if (!chromeUnlocked) return false;
		if (!templateDraft) return false;
		if (!baselineTemplate) return false;
		return comparableJsonFromState(templateDraft) !== baselineTemplate;
	}, [editMode, showChrome, chromeUnlocked, templateDraft, baselineTemplate]);

	const dirty = useMemo(() => {
		if (baselineBlocks !== comparableJsonFromState(builder)) return true;

		if (title !== page.title) return true;
		if ((seoTitle || null) !== (page.seo_title ?? null)) return true;
		if ((seoDesc || null) !== (page.seo_description ?? null)) return true;
		if (status !== page.status) return true;
		if (templateDirty) return true;

		return false;
	}, [baselineBlocks, builder, page, title, seoTitle, seoDesc, status, templateDirty]);

	type SaveOptions = {
		autosave?: boolean;
	};

	const save = useCallback(
		async (nextStatus?: 'draft' | 'published', options?: SaveOptions) => {
			if (!isAdmin) return;

			const isAutosave = options?.autosave ?? false;
			if (saving || autosaving) return;

			if (isAutosave) {
				setAutosaving(true);
				setAutosaveError(null);
			} else {
				setSaving(true);
				setError(null);
				setAutosaveError(null);
			}

			const payload = {
				title: title.trim(),
				status: nextStatus ?? status,
				seo_title: seoTitle.trim() ? seoTitle.trim() : null,
				seo_description: seoDesc.trim() ? seoDesc.trim() : null,
				blocks: serializePageBuilderState(builder),
			};

			try {
				if (editMode && showChrome && chromeUnlocked && templateDraft && templateDirty && activeTemplate) {
					const t = await apiFetch<PageTemplate>(`/api/admin/templates/${activeTemplate.id}`, {
						method: 'PUT',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ definition: serializePageBuilderState(templateDraft) }),
						cache: 'no-store',
						nextPath: `/${page.slug}?edit=1`,
					});
					setActiveTemplate(t);
					const nextTemplate = parsePageBuilderState(t.definition);
					setTemplateDraft(nextTemplate);
					setBaselineTemplate(comparableJsonFromState(nextTemplate));
				}

				const updated = await apiFetch<Page>(`/api/admin/pages/by-slug/${page.slug}`, {
					cache: 'no-store',
					nextPath: `/${page.slug}?edit=1`,
				});

				const out = await apiFetch<Page>(`/api/admin/pages/${updated.id}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: `/${page.slug}?edit=1`,
				});

				const nextBuilder = parsePageBuilderState(out.blocks);

				setPage(out);
				setTitle(out.title);
				setSeoTitle(out.seo_title ?? '');
				setSeoDesc(out.seo_description ?? '');
				setStatus(out.status);
				setBuilder(nextBuilder);
				setBaselineBlocks(comparableJsonFromState(nextBuilder));
				setLastSavedAt(new Date());
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				if (isAutosave) {
					setAutosaveError(message);
				} else {
					setError(message);
				}
			} finally {
				if (isAutosave) {
					setAutosaving(false);
				} else {
					setSaving(false);
				}
			}
		},
		[
			isAdmin,
			saving,
			autosaving,
			title,
			status,
			seoTitle,
			seoDesc,
			builder,
			editMode,
			showChrome,
			chromeUnlocked,
			templateDraft,
			templateDirty,
			activeTemplate,
			page.slug,
		]
	);

	async function toggleStatus() {
		if (status === 'draft') {
			await save('published');
		} else {
			await save('draft');
		}
	}

	function enterEdit() {
		if (!isAdmin) return;
		setEditMode(true);
		router.replace(`/${page.slug}?edit=1`);
	}

	function exitEdit() {
		setEditMode(false);
		router.replace(`/${page.slug}`);
	}

	function hasSlot(state: PageBuilderState): boolean {
		function walk(nodes: PageNode[]): boolean {
			for (const n of nodes) {
				if (n.type === 'slot') return true;
				if (Array.isArray(n.nodes) && walk(n.nodes)) return true;
			}
			return false;
		}
		return walk(state.nodes);
	}

	const templateState = useMemo(() => {
		if (!activeTemplate) return null;
		const base = parsePageBuilderState(activeTemplate.definition);
		if (editMode) return base;

		const topOverride = menuOverride?.trim();
		const footerOverrideValue = footerOverride?.trim();
		if (!topOverride && !footerOverrideValue) return base;

		function mapNodes(nodes: PageNode[]): PageNode[] {
			return nodes.map((n) => {
				let next: PageNode = n;
				if (n.type === 'menu') {
					const kind = n.data.kind === 'footer' ? 'footer' : 'top';
					if (kind === 'top' && topOverride) {
						next = { ...n, data: { ...n.data, menu: topOverride } };
					}
					if (kind === 'footer' && footerOverrideValue) {
						next = { ...n, data: { ...n.data, menu: footerOverrideValue } };
					}
				}

				if (Array.isArray(next.nodes) && next.nodes.length) {
					const mapped = mapNodes(next.nodes);
					if (mapped !== next.nodes) next = { ...next, nodes: mapped };
				}
				return next;
			});
		}

		return {
			...base,
			nodes: mapNodes(base.nodes),
		};
	}, [activeTemplate, editMode, menuOverride, footerOverride]);

	const fallbackTemplateState = useMemo(() => {
		const canvas = {
			snapPx: 1,
			widths: { mobile: 390, tablet: 820, desktop: 1200 },
			minHeightPx: 800,
		};

		const nodes: PageNode[] = [];
		let cursorY = 0;

		if (legacyMenuId && legacyMenuId.trim() && legacyMenuId.trim().toLowerCase() !== 'none') {
			nodes.push({
				id: 'node_top_menu',
				type: 'menu',
				data: { menu: legacyMenuId.trim(), kind: 'top' },
				frames: {
					mobile: { x: 0, y: cursorY, w: canvas.widths.mobile, h: 96 },
					tablet: { x: 0, y: cursorY, w: canvas.widths.tablet, h: 96 },
					desktop: { x: 0, y: cursorY, w: canvas.widths.desktop, h: 96 },
				},
			});
			cursorY += 120;
		}

		nodes.push({
			id: 'node_slot',
			type: 'slot',
			data: { name: 'Page content' },
			frames: {
				mobile: { x: 0, y: cursorY, w: canvas.widths.mobile, h: 1200 },
				tablet: { x: 0, y: cursorY, w: canvas.widths.tablet, h: 1200 },
				desktop: { x: 0, y: cursorY, w: canvas.widths.desktop, h: 1200 },
			},
		});
		cursorY += 1240;

		if (legacyFooterId && legacyFooterId.trim() && legacyFooterId.trim().toLowerCase() !== 'none') {
			nodes.push({
				id: 'node_footer_menu',
				type: 'menu',
				data: { menu: legacyFooterId.trim(), kind: 'footer' },
				frames: {
					mobile: { x: 0, y: cursorY, w: canvas.widths.mobile, h: 96 },
					tablet: { x: 0, y: cursorY, w: canvas.widths.tablet, h: 96 },
					desktop: { x: 0, y: cursorY, w: canvas.widths.desktop, h: 96 },
				},
			});
		}

		return {
			template: {
				id: activeTemplateSlug || 'default',
				menu: legacyMenuId && legacyMenuId.trim() ? legacyMenuId.trim() : 'none',
				footer: legacyFooterId && legacyFooterId.trim() ? legacyFooterId.trim() : 'none',
			},
			canvas,
			nodes,
		};
	}, [activeTemplateSlug, legacyMenuId, legacyFooterId]);

	const rendererState = templateState && hasSlot(templateState) ? templateState : fallbackTemplateState;
	const effectiveRendererState = chromeUnlocked && templateDraft ? templateDraft : rendererState;
	const lastSavedLabel = useMemo(() => {
		if (!lastSavedAt) return 'Not saved yet';
		return `Last saved ${lastSavedAt.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		})}`;
	}, [lastSavedAt]);

	useEffect(() => {
		if (!editMode || !isAdmin || !autosaveEnabled) return;
		if (!dirty) return;
		if (saving || autosaving) return;

		const timerId = window.setTimeout(() => {
			void save(undefined, { autosave: true });
		}, 1400);

		return () => {
			window.clearTimeout(timerId);
		};
	}, [editMode, isAdmin, autosaveEnabled, dirty, saving, autosaving, save]);

	useEffect(() => {
		if (!editMode || !isAdmin) return;

		function onKeyDown(e: KeyboardEvent) {
			if (!(e.ctrlKey || e.metaKey)) return;
			if (e.key.toLowerCase() !== 's') return;
			e.preventDefault();
			if (dirty && !saving && !autosaving) {
				void save();
			}
		}

		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [editMode, isAdmin, dirty, saving, autosaving, save]);

	useEffect(() => {
		if (!editMode || !dirty) return;

		function onBeforeUnload(e: BeforeUnloadEvent) {
			e.preventDefault();
			e.returnValue = '';
		}

		window.addEventListener('beforeunload', onBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload);
		};
	}, [editMode, dirty]);

	useEffect(() => {
		if (!editMode) {
			setChromeUnlocked(false);
			setTemplateDraft(null);
			setBaselineTemplate('');
			return;
		}

		// When entering edit mode or switching templates, reset chrome-editing state.
		setChromeUnlocked(true);
		setTemplateDraft(rendererState);
		setBaselineTemplate(comparableJsonFromState(rendererState));
	}, [editMode, activeTemplate?.id, rendererState]);

	useEffect(() => {
		if (!chromeUnlocked) return;
		if (templateDraft) return;
		setTemplateDraft(rendererState);
	}, [chromeUnlocked, templateDraft, rendererState]);

	const editCanvas = useMemo(() => {
		if (!showChrome) {
			return {
				state: builder,
				slotId: null as string | null,
				slotName: null as string | null,
				lockedIds: null as string[] | null,
			};
		}
		const slot = findFirstSlot(effectiveRendererState.nodes);
		if (!slot) {
			return {
				state: builder,
				slotId: null as string | null,
				slotName: null as string | null,
				lockedIds: null as string[] | null,
			};
		}

		const desiredSlotH = {
			mobile: Math.max(1, Math.round(computeStateHeight(builder, 'mobile'))),
			tablet: Math.max(1, Math.round(computeStateHeight(builder, 'tablet'))),
			desktop: Math.max(1, Math.round(computeStateHeight(builder, 'desktop'))),
		} as const;

		const originalBottom = {
			mobile: slot.frames.mobile.y + slot.frames.mobile.h,
			tablet: slot.frames.tablet.y + slot.frames.tablet.h,
			desktop: slot.frames.desktop.y + slot.frames.desktop.h,
		} as const;

		const delta = {
			mobile: desiredSlotH.mobile - slot.frames.mobile.h,
			tablet: desiredSlotH.tablet - slot.frames.tablet.h,
			desktop: desiredSlotH.desktop - slot.frames.desktop.h,
		} as const;

		const slotFrame: PageNode = {
			id: slot.id,
			type: 'frame',
			data: { label: slot.type === 'slot' ? slot.data.name ?? 'Page content' : 'Page content', layout: 'box', paddingPx: 0, props: {} },
			frames: {
				mobile: { ...slot.frames.mobile, h: desiredSlotH.mobile },
				tablet: { ...slot.frames.tablet, h: desiredSlotH.tablet },
				desktop: { ...slot.frames.desktop, h: desiredSlotH.desktop },
			},
			nodes: builder.nodes,
		};

		const slotName = slot.type === 'slot' ? slot.data.name ?? 'Page content' : 'Page content';

		const composedNodes = effectiveRendererState.nodes.map((n) => {
			if (n.type === 'slot' && n.id === slot.id) return slotFrame;

			const frames = {
				mobile: { ...n.frames.mobile },
				tablet: { ...n.frames.tablet },
				desktop: { ...n.frames.desktop },
			};

			if (delta.mobile !== 0 && n.frames.mobile.y >= originalBottom.mobile) frames.mobile.y += delta.mobile;
			if (delta.tablet !== 0 && n.frames.tablet.y >= originalBottom.tablet) frames.tablet.y += delta.tablet;
			if (delta.desktop !== 0 && n.frames.desktop.y >= originalBottom.desktop) frames.desktop.y += delta.desktop;

			return { ...n, frames };
		});

		return {
			state: { template: builder.template, canvas: effectiveRendererState.canvas, nodes: composedNodes },
			slotId: slot.id,
			slotName,
			lockedIds: collectNodeIds(effectiveRendererState.nodes),
		};
	}, [builder, effectiveRendererState.canvas, effectiveRendererState.nodes, showChrome]);

	const onEditStateChange = useCallback(
		(next: PageBuilderState) => {
			if (!showChrome || !editCanvas.slotId) {
				setBuilder(next);
				return;
			}

				const slotNode = findNodeById(next.nodes, editCanvas.slotId);
				const children = slotNode && Array.isArray(slotNode.nodes) ? slotNode.nodes : [];
				setBuilder((prev) => ({ ...prev, template: next.template, canvas: next.canvas, nodes: children }));

				if (!chromeUnlocked) return;
				if (!editCanvas.slotName) return;
				if (!slotNode?.frames) return;

				const baseTemplate = templateDraft ?? rendererState;
				const baseSlot = findNodeById(baseTemplate.nodes, editCanvas.slotId);
				const baseSlotFrames = baseSlot?.frames ?? slotNode.frames;

				const slotBottom = {
					mobile: baseSlotFrames.mobile.y + baseSlotFrames.mobile.h,
					tablet: baseSlotFrames.tablet.y + baseSlotFrames.tablet.h,
					desktop: baseSlotFrames.desktop.y + baseSlotFrames.desktop.h,
				} as const;

				const delta = {
					mobile: slotNode.frames.mobile.h - baseSlotFrames.mobile.h,
					tablet: slotNode.frames.tablet.h - baseSlotFrames.tablet.h,
					desktop: slotNode.frames.desktop.h - baseSlotFrames.desktop.h,
				} as const;

				const baseTopById = new Map<string, PageNode>();
				for (const n of baseTemplate.nodes) baseTopById.set(n.id, n);

				function reverseShift(
					n: PageNode,
					bp: 'mobile' | 'tablet' | 'desktop'
				): PageNode['frames'][typeof bp] {
					const d = delta[bp];
					if (!d) return n.frames[bp];
					const baseNode = baseTopById.get(n.id);
					const shouldReverse = baseNode
						? baseNode.frames[bp].y >= slotBottom[bp]
						: n.frames[bp].y >= slotBottom[bp] + d;
					if (!shouldReverse) return n.frames[bp];
					return { ...n.frames[bp], y: n.frames[bp].y - d };
				}

				const slotPersistFrames = {
					mobile: {
						...baseSlotFrames.mobile,
						x: slotNode.frames.mobile.x,
						y: slotNode.frames.mobile.y,
						w: slotNode.frames.mobile.w,
						z: slotNode.frames.mobile.z,
					},
					tablet: {
						...baseSlotFrames.tablet,
						x: slotNode.frames.tablet.x,
						y: slotNode.frames.tablet.y,
						w: slotNode.frames.tablet.w,
						z: slotNode.frames.tablet.z,
					},
					desktop: {
						...baseSlotFrames.desktop,
						x: slotNode.frames.desktop.x,
						y: slotNode.frames.desktop.y,
						w: slotNode.frames.desktop.w,
						z: slotNode.frames.desktop.z,
					},
				} as const;

				const templateNodes = next.nodes.map((n) => {
					if (n.id === editCanvas.slotId) {
						return {
							id: n.id,
							type: 'slot',
							data: { name: editCanvas.slotName ?? 'Page content' },
							frames: slotPersistFrames,
						} satisfies PageNode;
					}

					const frames = {
						mobile: reverseShift(n, 'mobile'),
						tablet: reverseShift(n, 'tablet'),
						desktop: reverseShift(n, 'desktop'),
					};
					return { ...n, frames };
				});

				setTemplateDraft({ template: baseTemplate.template, canvas: next.canvas, nodes: templateNodes });
			},
			[showChrome, editCanvas.slotId, editCanvas.slotName, chromeUnlocked, templateDraft, rendererState]
		);

	const editToolbar = isAdmin && editMode ? (
		<div className='fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80'>
			<Badge variant={status === 'published' ? 'default' : 'secondary'}>{status}</Badge>
			{dirty ? <Badge variant='outline'>Unsaved</Badge> : <Badge variant='secondary'>Saved</Badge>}
			{autosaving ? <Badge variant='secondary'>Autosaving…</Badge> : null}
			<Badge variant={autosaveEnabled ? 'secondary' : 'outline'}>
				{autosaveEnabled ? 'Autosave on' : 'Autosave off'}
			</Badge>
			<span className='hidden lg:inline text-xs text-muted-foreground'>{lastSavedLabel}</span>
			<span className='hidden md:inline text-xs text-muted-foreground'>/{page.slug}</span>

			<Button
				variant='outline'
				size='sm'
				onClick={() => setSettingsOpen(true)}
				disabled={saving || autosaving}>
				Settings
			</Button>

			<Button
				variant='outline'
				size='sm'
				onClick={() => setShowChrome((prev) => !prev)}
				disabled={saving || autosaving}>
				{showChrome ? 'Hide chrome' : 'Show chrome'}
			</Button>

			<Badge variant='secondary'>All blocks editable</Badge>

			<Button
				variant='outline'
				size='sm'
				onClick={() => setAutosaveEnabled((prev) => !prev)}
				disabled={saving || autosaving}>
				{autosaveEnabled ? 'Disable autosave' : 'Enable autosave'}
			</Button>

			<Button
				variant='outline'
				size='sm'
				onClick={toggleStatus}
				disabled={saving || autosaving}>
				{status === 'published' ? 'Unpublish' : 'Publish'}
			</Button>

			<Button
				size='sm'
				onClick={() => save()}
				disabled={saving || autosaving || !dirty}>
				{saving ? 'Saving…' : 'Save'}
			</Button>

			<Button
				variant='outline'
				size='sm'
				onClick={exitEdit}
				disabled={saving || autosaving}>
				Done
			</Button>
		</div>
	) : null;

	const viewToolbar = isAdmin && !editMode ? (
		<div className='fixed bottom-4 right-4 z-50 flex items-center gap-2'>
			<Badge variant={status === 'published' ? 'default' : 'secondary'}>{status}</Badge>
			<Button onClick={enterEdit}>Edit</Button>
		</div>
	) : null;

	const settingsDialog = (
		<Dialog
			open={settingsOpen}
			onOpenChange={setSettingsOpen}>
			<DialogContent className='sm:max-w-xl'>
				<DialogHeader>
					<DialogTitle>Page settings</DialogTitle>
					<DialogDescription>Template + SEO controls.</DialogDescription>
				</DialogHeader>

				<div className='space-y-4'>
					<div className='space-y-2'>
						<Label>Title</Label>
						<Input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							disabled={saving}
						/>
					</div>

					<div className='space-y-2'>
						<Label>Template</Label>
						<Select
							value={builder.template.id}
							onValueChange={(v) =>
								setBuilder((prev) => ({
									...prev,
									template: { ...prev.template, id: v },
								}))
							}
							disabled={saving || templatesLoading}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{templates.length > 0 ? (
									<>
										{!templatesBySlug.has(builder.template.id) ? (
											<SelectItem value={builder.template.id}>
												{builder.template.id} (missing)
											</SelectItem>
										) : null}
										{templates.map((t) => (
											<SelectItem
												key={t.id}
												value={t.slug}>
												{t.slug}
											</SelectItem>
										))}
									</>
								) : (
									<>
										<SelectItem value='default'>default</SelectItem>
										<SelectItem value='blank'>blank</SelectItem>
									</>
								)}
							</SelectContent>
						</Select>
						{editMode && isAdmin && activeTemplate ? (
							<div className='flex items-center gap-2 pt-1'>
								<Button
									type='button'
									variant='secondary'
									size='sm'
									onClick={cloneTemplateForPage}
									disabled={saving || cloningTemplate}>
									{cloningTemplate ? 'Cloning…' : 'Clone as variant'}
								</Button>
								<p className='text-xs text-muted-foreground'>
									Detach this page from the shared template.
								</p>
							</div>
						) : null}
						{templatesLoading ? (
							<p className='text-xs text-muted-foreground'>Loading templates…</p>
						) : null}
						{templatesError ? <p className='text-xs text-red-600'>{templatesError}</p> : null}
					</div>

					<div className='space-y-2'>
						<Label>SEO Title</Label>
						<Input
							value={seoTitle}
							onChange={(e) => setSeoTitle(e.target.value)}
							disabled={saving}
						/>
					</div>

					<div className='space-y-2'>
						<Label>SEO Description</Label>
						<Input
							value={seoDesc}
							onChange={(e) => setSeoDesc(e.target.value)}
							disabled={saving}
						/>
					</div>
				</div>

				{error ? <p className='text-sm text-red-600'>{error}</p> : null}

				<DialogFooter>
					<Button
						variant='outline'
						onClick={() => setSettingsOpen(false)}
						disabled={saving || autosaving}>
						Close
					</Button>
					<Button
						onClick={() => save()}
						disabled={saving || autosaving || !dirty}>
						{saving ? 'Saving…' : 'Save'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);

	const templateStatus = isAdmin && (activeTemplateLoading || activeTemplateError) ? (
		<div className='rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground'>
			{activeTemplateLoading ? 'Loading template…' : null}
			{activeTemplateError ? <span className='text-red-600'>{activeTemplateError}</span> : null}
		</div>
	) : null;

	if (editMode) {
		return (
			<main className={cn('h-svh flex flex-col', themeClass)} style={themeStyle}>
				<div className='flex-1 min-h-0'>
					{templateStatus}
					{hydrated ? (
						<PageBuilder
							value={showChrome ? editCanvas.state : builder}
							onChange={showChrome ? onEditStateChange : setBuilder}
							disabled={saving}
							lockedNodeIds={undefined}
							editRootId={undefined}
							fullHeight={false}
							className='h-full min-h-0'
						/>
					) : (
						showChrome ? (
							<PageRendererWithSlot
								state={rendererState}
								slot={<PageRenderer state={viewState} collectionsByNodeId={initialCollections} />}
								slotState={viewState}
								collectionsByNodeId={initialCollections}
							/>
						) : (
							<PageRenderer state={viewState} collectionsByNodeId={initialCollections} />
						)
					)}
				</div>

				{editToolbar}
				{settingsDialog}
				{autosaveError ? (
					<p className='px-6 pb-2 text-sm text-amber-600'>Autosave failed: {autosaveError}</p>
				) : null}
				{error ? <p className='px-6 pb-6 text-sm text-red-600'>{error}</p> : null}
			</main>
		);
	}

	const pageSlot = (
		<div>
			{viewToolbar}
			{templateStatus ? <div className='p-4'>{templateStatus}</div> : null}
			<PageRenderer state={viewState} collectionsByNodeId={initialCollections} />

			{error ? <p className='p-4 text-sm text-red-600'>{error}</p> : null}
			{settingsDialog}
		</div>
	);

	return (
		<main className={cn(themeClass)} style={themeStyle}>
			<PageRendererWithSlot
				state={rendererState}
				slot={pageSlot}
				slotState={viewState}
				collectionsByNodeId={initialCollections}
			/>
		</main>
	);
}



