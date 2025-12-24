'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Page, PageTemplate, PageTemplateListOut } from '@/lib/types';
import { apiFetch } from '@/lib/http';
import {
	comparableJsonFromBlocks,
	comparableJsonFromState,
	parsePageBuilderState,
	serializePageBuilderState,
	type PageBuilderState,
} from '@/lib/page-builder';

import { PageBuilder, PageRenderer, PageRendererWithSlot } from '@/components/page-builder/page-builder';
import { PageBuilderOutline } from '@/components/page-builder/page-outline';

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
import { Separator } from '@/components/ui/separator';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export function PublicPageClient({
	initialPage,
	initialTemplate,
	isAdmin,
	defaultEdit,
	menuOverride,
	footerOverride,
}: {
	initialPage: Page;
	initialTemplate?: PageTemplate | null;
	isAdmin: boolean;
	defaultEdit: boolean;
	menuOverride?: string | null;
	footerOverride?: string | null;
}) {
	const router = useRouter();

	const [page, setPage] = useState<Page>(initialPage);
	const [hydrated, setHydrated] = useState(false);

	// view/edit
	const [editMode, setEditMode] = useState<boolean>(isAdmin && defaultEdit);
	const [outlineOpen, setOutlineOpen] = useState(false);

	// settings modal
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [templates, setTemplates] = useState<PageTemplate[]>([]);
	const [templatesLoading, setTemplatesLoading] = useState(false);
	const [templatesError, setTemplatesError] = useState<string | null>(null);

	const [activeTemplate, setActiveTemplate] = useState<PageTemplate | null>(initialTemplate ?? null);
	const [activeTemplateLoading, setActiveTemplateLoading] = useState(false);
	const [activeTemplateError, setActiveTemplateError] = useState<string | null>(null);

	// editable fields
	const [title, setTitle] = useState(page.title);
	const [seoTitle, setSeoTitle] = useState(page.seo_title ?? '');
	const [seoDesc, setSeoDesc] = useState(page.seo_description ?? '');
	const [status, setStatus] = useState<'draft' | 'published'>(page.status);

	const [editingTitle, setEditingTitle] = useState(false);
	const titleRef = useRef<HTMLInputElement | null>(null);

	const [builder, setBuilder] = useState<PageBuilderState>(() =>
		parsePageBuilderState(initialPage.blocks)
	);
	const [baselineBlocks, setBaselineBlocks] = useState(() =>
		comparableJsonFromBlocks(initialPage.blocks)
	);

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const viewState = useMemo(() => parsePageBuilderState(page.blocks), [page.blocks]);

	const activeTemplateSlug = editMode ? builder.template.id : viewState.template.id;

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

	useEffect(() => {
		if (!editMode) {
			setEditingTitle(false);
			setOutlineOpen(false);
		}
	}, [editMode]);

	useEffect(() => {
		if (!editingTitle) return;
		const t = setTimeout(() => titleRef.current?.focus(), 0);
		return () => clearTimeout(t);
	}, [editingTitle]);

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

	const dirty = useMemo(() => {
		if (baselineBlocks !== comparableJsonFromState(builder)) return true;

		if (title !== page.title) return true;
		if ((seoTitle || null) !== (page.seo_title ?? null)) return true;
		if ((seoDesc || null) !== (page.seo_description ?? null)) return true;
		if (status !== page.status) return true;

		return false;
	}, [baselineBlocks, builder, page, title, seoTitle, seoDesc, status]);

	async function save(nextStatus?: 'draft' | 'published') {
		if (!isAdmin) return;

		setSaving(true);
		setError(null);

		const payload = {
			title: title.trim(),
			status: nextStatus ?? status,
			seo_title: seoTitle.trim() ? seoTitle.trim() : null,
			seo_description: seoDesc.trim() ? seoDesc.trim() : null,
			blocks: serializePageBuilderState(builder),
		};

		try {
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
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

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
		return state.rows.some((r) => r.columns.some((c) => c.blocks.some((b) => b.type === 'slot')));
	}

	const templateState = useMemo(() => {
		if (!activeTemplate) return null;
		const base = parsePageBuilderState(activeTemplate.definition);
		if (editMode) return base;

		const topOverride = menuOverride?.trim();
		const footerOverrideValue = footerOverride?.trim();
		if (!topOverride && !footerOverrideValue) return base;

		return {
			...base,
			rows: base.rows.map((r) => ({
				...r,
				columns: r.columns.map((c) => ({
					...c,
					blocks: c.blocks.map((b) => {
						if (b.type !== 'menu') return b;
						const kind = b.data.kind === 'footer' ? 'footer' : 'top';
						if (kind === 'top' && topOverride) {
							return { ...b, data: { ...b.data, menu: topOverride } };
						}
						if (kind === 'footer' && footerOverrideValue) {
							return { ...b, data: { ...b.data, menu: footerOverrideValue } };
						}
						return b;
					}),
				})),
			})),
		};
	}, [activeTemplate, editMode, menuOverride, footerOverride]);

	const fallbackTemplateState = useMemo(() => {
		const rows: Array<Record<string, unknown>> = [];

		if (legacyMenuId && legacyMenuId.trim() && legacyMenuId.trim().toLowerCase() !== 'none') {
			rows.push({
				id: 'row_header',
				settings: { columns: 1, sizes: [100] },
				columns: [
					{
						id: 'col_header',
						blocks: [
							{
								id: 'blk_menu_top',
								type: 'menu',
								data: { menu: legacyMenuId.trim(), kind: 'top' },
							},
						],
					},
				],
			});
		}

		rows.push({
			id: 'row_content',
			settings: { columns: 1, sizes: [100] },
			columns: [
				{
					id: 'col_content',
					blocks: [
						{
							id: 'blk_slot',
							type: 'slot',
							data: { name: 'Page content' },
						},
					],
				},
			],
		});

		if (
			legacyFooterId &&
			legacyFooterId.trim() &&
			legacyFooterId.trim().toLowerCase() !== 'none'
		) {
			rows.push({
				id: 'row_footer',
				settings: { columns: 1, sizes: [100] },
				columns: [
					{
						id: 'col_footer',
						blocks: [
							{
								id: 'blk_menu_footer',
								type: 'menu',
								data: { menu: legacyFooterId.trim(), kind: 'footer' },
							},
						],
					},
				],
			});
		}

		return parsePageBuilderState({ version: 3, layout: { rows } });
	}, [legacyMenuId, legacyFooterId]);

	const rendererState = templateState && hasSlot(templateState) ? templateState : fallbackTemplateState;

	const pageSlot = (
		<div className='max-w-5xl mx-auto p-6 space-y-6'>
			{isAdmin && editMode ? (
				<>
					<div className='fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80'>
						<Badge variant={status === 'published' ? 'default' : 'secondary'}>{status}</Badge>
						{dirty ? <Badge variant='outline'>Unsaved</Badge> : <Badge variant='secondary'>Saved</Badge>}
						<span className='hidden md:inline text-xs text-muted-foreground'>/{page.slug}</span>

						<Button
							variant='outline'
							size='sm'
							onClick={() => setOutlineOpen(true)}
							disabled={saving}>
							Outline
						</Button>

						<Button
							variant='outline'
							size='sm'
							onClick={() => setSettingsOpen(true)}
							disabled={saving}>
							Settings
						</Button>

						<Button
							variant='outline'
							size='sm'
							onClick={toggleStatus}
							disabled={saving}>
							{status === 'published' ? 'Unpublish' : 'Publish'}
						</Button>

						<Button
							size='sm'
							onClick={() => save()}
							disabled={saving || !dirty}>
							{saving ? 'Saving…' : 'Save'}
						</Button>

						<Button
							variant='outline'
							size='sm'
							onClick={exitEdit}
							disabled={saving}>
							Done
						</Button>
					</div>

					<Sheet
						open={outlineOpen}
						onOpenChange={setOutlineOpen}>
						<SheetContent side='right' className='w-[360px] sm:max-w-sm'>
							<SheetHeader>
								<SheetTitle>Outline</SheetTitle>
							</SheetHeader>
							<div className='p-4'>
								<PageBuilderOutline state={builder} />
							</div>
						</SheetContent>
					</Sheet>
				</>
			) : null}

			{isAdmin && !editMode ? (
				<div className='fixed bottom-4 right-4 z-50 flex items-center gap-2'>
					<Badge variant={status === 'published' ? 'default' : 'secondary'}>{status}</Badge>
					<Button onClick={enterEdit}>Edit</Button>
				</div>
			) : null}

			{isAdmin && (activeTemplateLoading || activeTemplateError) ? (
				<div className='rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground'>
					{activeTemplateLoading ? 'Loading template…' : null}
					{activeTemplateError ? (
						<span className='text-red-600'>{activeTemplateError}</span>
					) : null}
				</div>
			) : null}

			{/* Title */}
			{editMode ? (
				editingTitle ? (
					<Input
						ref={titleRef}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						onBlur={() => setEditingTitle(false)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === 'Escape') {
								setEditingTitle(false);
							}
						}}
						placeholder='Page title'
						disabled={saving}
						className='text-4xl font-bold tracking-tight h-auto py-3'
					/>
				) : (
					<button
						type='button'
						className='w-full text-left'
						onClick={() => setEditingTitle(true)}
						disabled={saving}>
						<h1 className='text-4xl font-bold tracking-tight'>
							{title.trim() ? title : 'Untitled page'}
						</h1>
						<p className='text-xs text-muted-foreground mt-1'>Click to edit title</p>
					</button>
				)
			) : (
				<h1 className='text-4xl font-bold tracking-tight'>{page.title}</h1>
			)}

			<Separator />

			{/* Body */}
			{editMode ? (
				hydrated ? (
					<PageBuilder
						value={builder}
						onChange={setBuilder}
						disabled={saving}
					/>
				) : (
					<PageRenderer state={viewState} />
				)
			) : (
				<PageRenderer state={viewState} />
			)}

			{error ? <p className='text-sm text-red-600'>{error}</p> : null}

			{/* Settings dialog */}
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
							disabled={saving}>
							Close
						</Button>
						<Button
							onClick={() => save()}
							disabled={saving || !dirty}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);

	const content = <PageRendererWithSlot state={rendererState} slot={pageSlot} />;

	return <main>{content}</main>;
}
