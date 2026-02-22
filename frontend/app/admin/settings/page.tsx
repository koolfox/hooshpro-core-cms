'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Page, Theme } from '@/lib/types';
import { listAdminOptions, setAdminOption } from '@/lib/api/options';
import { listAdminPages } from '@/lib/api/pages';
import { listAdminThemes } from '@/lib/api/themes';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const OPTION_KEYS = [
	'general.site_title',
	'general.tagline',
	'reading.front_page_slug',
	'reading.posts_page_slug',
	'appearance.active_theme',
	'appearance.theme_vars',
] as const;

function stringOrEmpty(v: unknown) {
	return typeof v === 'string' ? v : '';
}

function themeVarsToText(v: unknown): string {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return '{}';
	try {
		return JSON.stringify(v, null, 2);
	} catch {
		return '{}';
	}
}

export default function AdminSettingsPage() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [pages, setPages] = useState<Page[]>([]);
	const [themes, setThemes] = useState<Theme[]>([]);

	const [siteTitle, setSiteTitle] = useState('');
	const [tagline, setTagline] = useState('');
	const [frontPageSlug, setFrontPageSlug] = useState('home');
	const [postsPageSlug, setPostsPageSlug] = useState('blog');
	const [activeTheme, setActiveTheme] = useState('default');
	const [themeVarsText, setThemeVarsText] = useState('{}');

	const baseline = useMemo(() => {
		return JSON.stringify({
			siteTitle,
			tagline,
			frontPageSlug,
			postsPageSlug,
			activeTheme,
			themeVarsText,
		});
	}, [siteTitle, tagline, frontPageSlug, postsPageSlug, activeTheme, themeVarsText]);
	const [savedBaseline, setSavedBaseline] = useState<string>(baseline);

	const dirty = baseline !== savedBaseline;

	useEffect(() => {
		let canceled = false;

		async function load() {
			setLoading(true);
			setError(null);

			try {
				const [optOut, pagesOut, themesOut] = await Promise.all([
					listAdminOptions(
						{
							limit: 200,
							offset: 0,
							keys: [...OPTION_KEYS],
							sort: 'key',
							dir: 'asc',
						},
						'/admin/settings'
					),
					listAdminPages({ limit: 200, offset: 0, sort: 'title', dir: 'asc' }, '/admin/settings'),
					listAdminThemes({ limit: 200, offset: 0, sort: 'title', dir: 'asc' }, '/admin/settings'),
				]);

				if (canceled) return;

				const map = new Map(optOut.items.map((o) => [o.key, o.value] as const));
				setSiteTitle(stringOrEmpty(map.get('general.site_title')) || 'HooshPro');
				setTagline(stringOrEmpty(map.get('general.tagline')) || 'HooshPro CMS');
				setFrontPageSlug(stringOrEmpty(map.get('reading.front_page_slug')) || 'home');
				setPostsPageSlug(stringOrEmpty(map.get('reading.posts_page_slug')) || 'blog');
				setActiveTheme(stringOrEmpty(map.get('appearance.active_theme')) || 'default');
				setThemeVarsText(themeVarsToText(map.get('appearance.theme_vars')));

				setPages(pagesOut.items ?? []);
				setThemes(themesOut.items ?? []);

				const nextBaseline = JSON.stringify({
					siteTitle: stringOrEmpty(map.get('general.site_title')) || 'HooshPro',
					tagline: stringOrEmpty(map.get('general.tagline')) || 'HooshPro CMS',
					frontPageSlug: stringOrEmpty(map.get('reading.front_page_slug')) || 'home',
					postsPageSlug: stringOrEmpty(map.get('reading.posts_page_slug')) || 'blog',
					activeTheme: stringOrEmpty(map.get('appearance.active_theme')) || 'default',
					themeVarsText: themeVarsToText(map.get('appearance.theme_vars')),
				});
				setSavedBaseline(nextBaseline);
			} catch (e) {
				if (canceled) return;
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!canceled) setLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, []);

	async function save() {
		setSaving(true);
		setError(null);
		try {
			let themeVars: unknown = {};
			try {
				themeVars = JSON.parse(themeVarsText || '{}');
			} catch {
				throw new Error('Theme vars must be valid JSON.');
			}
			if (!themeVars || typeof themeVars !== 'object' || Array.isArray(themeVars)) {
				throw new Error('Theme vars must be a JSON object (e.g. {\"--brand-color\\":\\"#2563eb\"}).');
			}

			const updates: Array<[string, unknown]> = [
				['general.site_title', siteTitle.trim()],
				['general.tagline', tagline.trim()],
				['reading.front_page_slug', frontPageSlug.trim().toLowerCase()],
				['reading.posts_page_slug', postsPageSlug.trim().toLowerCase()],
				['appearance.active_theme', activeTheme.trim().toLowerCase()],
				['appearance.theme_vars', themeVars],
			];

			await Promise.all(updates.map(([key, value]) => setAdminOption(key, value, '/admin/settings')));

			setSavedBaseline(baseline);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	const pageOptions = useMemo(() => {
		const out: Array<{ value: string; label: string }> = [];
		for (const p of pages) {
			out.push({ value: p.slug, label: `${p.title} (${p.slug})` });
		}
		return out;
	}, [pages]);

	const themesBySlug = useMemo(() => {
		const m = new Map<string, Theme>();
		for (const t of themes) m.set(t.slug, t);
		return m;
	}, [themes]);

	return (
		<div className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold'>Settings</h1>
					<p className='text-sm text-muted-foreground'>WordPress-style site options (stored in DB).</p>
				</div>

				<Button onClick={save} disabled={loading || saving || !dirty}>
					{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
				</Button>
			</div>

			{error ? <p className='text-sm text-red-600'>{error}</p> : null}

			<div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>General</CardTitle>
						<CardDescription>Site title and tagline.</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='space-y-2'>
							<Label>Site title</Label>
							<Input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} disabled={loading || saving} />
						</div>
						<div className='space-y-2'>
							<Label>Tagline</Label>
							<Input value={tagline} onChange={(e) => setTagline(e.target.value)} disabled={loading || saving} />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Reading</CardTitle>
						<CardDescription>Configure the front page and posts index page.</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='space-y-2'>
							<Label>Front page</Label>
							<Select value={frontPageSlug} onValueChange={setFrontPageSlug} disabled={loading || saving}>
								<SelectTrigger>
									<SelectValue placeholder='Select a page' />
								</SelectTrigger>
								<SelectContent>
									{pageOptions.length > 0 ? (
										pageOptions.map((p) => (
											<SelectItem key={p.value} value={p.value}>
												{p.label}
											</SelectItem>
										))
									) : (
										<SelectItem value='home'>home</SelectItem>
									)}
								</SelectContent>
							</Select>
						</div>

						<div className='space-y-2'>
							<Label>Posts page (slug)</Label>
							<Input value={postsPageSlug} onChange={(e) => setPostsPageSlug(e.target.value)} disabled={loading || saving} />
							<p className='text-xs text-muted-foreground'>
								Reserved for V5 blog routing (default <code>blog</code>).
							</p>
						</div>
					</CardContent>
				</Card>

				<Card className='xl:col-span-2'>
					<CardHeader>
						<CardTitle>Appearance</CardTitle>
						<CardDescription>Theme selection (V5 customizer will replace this).</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='space-y-2'>
							<Label>Active theme</Label>
							<Select value={activeTheme} onValueChange={setActiveTheme} disabled={loading || saving}>
								<SelectTrigger>
									<SelectValue placeholder='Select a theme' />
								</SelectTrigger>
								<SelectContent>
									{themes.length > 0 ? (
										<>
											{!themesBySlug.has(activeTheme) ? (
												<SelectItem value={activeTheme}>
													{activeTheme} (missing)
												</SelectItem>
											) : null}
											{themes.map((t) => (
												<SelectItem key={t.id} value={t.slug}>
													{t.title} ({t.slug})
												</SelectItem>
											))}
										</>
									) : (
										<>
											<SelectItem value='default'>Default (default)</SelectItem>
										</>
									)}
								</SelectContent>
							</Select>
						</div>

					<div className='space-y-2'>
						<Label>Theme vars (CSS variables)</Label>
						<Textarea
							value={themeVarsText}
							onChange={(e) => setThemeVarsText(e.target.value)}
							disabled={loading || saving}
							rows={10}
							className='font-mono text-xs'
						/>
						<p className='text-xs text-muted-foreground'>
							Example: <code>{'{\"--brand-color\\":\\"#2563eb\"}'}</code>
						</p>
					</div>

					<Separator />

					<p className='text-xs text-muted-foreground'>
						Theme tokens are DB-driven. Add any CSS variables here and they are injected at render time.
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}





