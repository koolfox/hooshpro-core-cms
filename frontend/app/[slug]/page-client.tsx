'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Menu, MenuListOut, Page, PageTemplate, PageTemplateListOut } from '@/lib/types';
import { apiFetch } from '@/lib/http';
import {
	comparableJsonFromBlocks,
	comparableJsonFromState,
	parsePageBuilderState,
	serializePageBuilderState,
	type PageBuilderState,
} from '@/lib/page-builder';

import { PublicTopNav } from '@/components/public/public-top-nav';
import { PageBuilder, PageRenderer } from '@/components/page-builder/page-builder';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

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

export function PublicPageClient({
	initialPage,
	isAdmin,
	defaultEdit,
	menuOverride,
}: {
	initialPage: Page;
	isAdmin: boolean;
	defaultEdit: boolean;
	menuOverride?: string | null;
}) {
	const router = useRouter();

	const [page, setPage] = useState<Page>(initialPage);
	const [hydrated, setHydrated] = useState(false);

	// view/edit
	const [editMode, setEditMode] = useState<boolean>(isAdmin && defaultEdit);

	// settings modal
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [templates, setTemplates] = useState<PageTemplate[]>([]);
	const [templatesLoading, setTemplatesLoading] = useState(false);
	const [templatesError, setTemplatesError] = useState<string | null>(null);
	const [menus, setMenus] = useState<Menu[]>([]);
	const [menusLoading, setMenusLoading] = useState(false);
	const [menusError, setMenusError] = useState<string | null>(null);

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

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const viewState = useMemo(() => parsePageBuilderState(page.blocks), [page.blocks]);
	const activeMenuId =
		!editMode && menuOverride && menuOverride.trim()
			? menuOverride.trim()
			: editMode
				? builder.template.menu
				: viewState.template.menu;

	const templatesBySlug = useMemo(() => {
		const m = new Map<string, PageTemplate>();
		for (const t of templates) m.set(t.slug, t);
		return m;
	}, [templates]);

	const menuSlugs = useMemo(() => new Set(menus.map((m) => m.slug)), [menus]);

	useEffect(() => {
		setHydrated(true);
	}, []);

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

	useEffect(() => {
		if (!settingsOpen) return;
		if (!isAdmin) return;

		let canceled = false;
		async function load() {
			setMenusLoading(true);
			setMenusError(null);
			try {
				const res = await apiFetch<MenuListOut>(`/api/admin/menus?limit=200&offset=0`, {
					cache: 'no-store',
					nextPath: `/${page.slug}?edit=1`,
				});
				if (canceled) return;
				setMenus(res.items ?? []);
			} catch (e) {
				if (canceled) return;
				setMenusError(e instanceof Error ? e.message : String(e));
				setMenus([]);
			} finally {
				if (!canceled) setMenusLoading(false);
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

	const content = (
		<div className='max-w-5xl mx-auto p-6 space-y-6'>
			{activeMenuId !== 'none' ? (
				<div className='rounded-xl border overflow-hidden'>
					<PublicTopNav menuId={activeMenuId} />
				</div>
			) : null}

			{/* Admin top bar */}
			{isAdmin ? (
				<div className='rounded-xl border p-3 flex items-center justify-between gap-3'>
					<div className='flex items-center gap-2'>
						<Badge
							variant={status === 'published' ? 'default' : 'secondary'}>
							{status}
						</Badge>
						<span className='text-xs text-muted-foreground'>
							Slug: /{page.slug}
						</span>
					</div>

					<div className='flex items-center gap-2'>
						<Button
							variant='outline'
							onClick={() => setSettingsOpen(true)}
							disabled={saving}>
							Settings
						</Button>

						{editMode ? (
							<Button
								variant='outline'
								onClick={exitEdit}
								disabled={saving}>
								Preview
							</Button>
						) : (
							<Button
								variant='outline'
								onClick={enterEdit}>
								Edit
							</Button>
						)}

						<Button
							variant='outline'
							onClick={toggleStatus}
							disabled={saving}>
							{status === 'published' ? 'Unpublish' : 'Publish'}
						</Button>

						<Button
							onClick={() => save()}
							disabled={saving || !dirty}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</div>
				</div>
			) : null}

			{/* Title */}
			{editMode ? (
				<div className='space-y-2'>
					<Label>Title</Label>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder='Page title'
						disabled={saving}
					/>
				</div>
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
						<DialogDescription>
							Template/menu + SEO controls (MVP).
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div className='space-y-2'>
									<Label>Template</Label>
									<Select
										value={builder.template.id}
										onValueChange={(v) =>
											setBuilder((prev) => {
												const tmpl = templatesBySlug.get(v);
												return {
													...prev,
													template: {
														...prev.template,
														id: v,
														menu: tmpl ? tmpl.menu : prev.template.menu,
													},
												};
											})
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
													<SelectItem value='default'>
														default
													</SelectItem>
													<SelectItem value='blank'>
														blank
													</SelectItem>
												</>
											)}
										</SelectContent>
									</Select>
									{templatesLoading ? (
										<p className='text-xs text-muted-foreground'>Loading templates…</p>
									) : null}
									{templatesError ? (
										<p className='text-xs text-red-600'>{templatesError}</p>
									) : null}
								</div>

							<div className='space-y-2'>
								<Label>Menu</Label>
								<Select
									value={builder.template.menu}
									onValueChange={(v) =>
										setBuilder({
											...builder,
											template: {
												...builder.template,
												menu: v,
											},
										})
									}
									disabled={saving || menusLoading}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>
											none
										</SelectItem>
										{builder.template.menu !== 'none' && !menuSlugs.has(builder.template.menu) ? (
											<SelectItem value={builder.template.menu}>
												{builder.template.menu} (missing)
											</SelectItem>
										) : null}
										{menus.map((m) => (
											<SelectItem
												key={m.id}
												value={m.slug}>
												{m.slug}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{menusLoading ? (
									<p className='text-xs text-muted-foreground'>Loading menus…</p>
								) : null}
								{menusError ? (
									<p className='text-xs text-red-600'>{menusError}</p>
								) : null}
							</div>
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

	if (editMode && isAdmin) {
		return (
			<div className='[--header-height:calc(--spacing(14))]'>
				<SidebarProvider className='flex flex-col'>
					<SiteHeader title={`Editing /${page.slug}`} />
					<div className='flex flex-1'>
						<AppSidebar />
						<SidebarInset>{content}</SidebarInset>
					</div>
				</SidebarProvider>
			</div>
		);
	}

	return <main>{content}</main>;
}
