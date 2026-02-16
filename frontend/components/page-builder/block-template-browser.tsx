'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	AppWindow,
	Blocks,
	Database,
	LayoutTemplate,
	Navigation,
	Sparkles,
} from 'lucide-react';

import { apiFetch } from '@/lib/http';
import { parsePageBuilderState } from '@/lib/page-builder';
import type { BlockListOut, BlockTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';

import { PageRenderer } from '@/components/page-builder/page-renderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type BlockTemplateCategory = 'pages' | 'navigation' | 'heroes' | 'features' | 'cms' | 'embeds';

const CATEGORIES: Array<{
	id: BlockTemplateCategory;
	label: string;
	icon: typeof AppWindow;
}> = [
	{ id: 'pages', label: 'Pages', icon: AppWindow },
	{ id: 'navigation', label: 'Navigation', icon: Navigation },
	{ id: 'heroes', label: 'Heroes', icon: Sparkles },
	{ id: 'features', label: 'Features', icon: LayoutTemplate },
	{ id: 'cms', label: 'CMS', icon: Database },
	{ id: 'embeds', label: 'Embeds', icon: Blocks },
];

function matchesQuery(b: BlockTemplate, query: string) {
	if (!query) return true;
	const q = query.trim().toLowerCase();
	if (!q) return true;
	const title = b.title.toLowerCase();
	const slug = b.slug.toLowerCase();
	const desc = (b.description ?? '').toLowerCase();
	return title.includes(q) || slug.includes(q) || desc.includes(q);
}

function inferCategoryMembership(block: BlockTemplate) {
	const slug = block.slug.toLowerCase();

	const isHero = slug.includes('hero') || slug.includes('banner') || slug.includes('header-hero');
	const isNavigation =
		slug.includes('nav') || slug.includes('menu') || slug.includes('navbar') || slug.includes('navigation');
	const isCms =
		slug.includes('collection') || slug.includes('cms') || slug.includes('list') || slug.includes('grid');
	const isEmbed = slug.includes('embed') || slug.includes('iframe') || slug.includes('html');
	const isFeature =
		slug.includes('feature') ||
		slug.includes('tile') ||
		slug.includes('tiles') ||
		slug.includes('split') ||
		slug.includes('promo') ||
		slug.includes('cta');

	return { isHero, isNavigation, isCms, isEmbed, isFeature };
}

export function BlockTemplateBrowser({
	active = true,
	resetOnInactive = false,
	initialCategory = 'pages',
	onPick,
	showInsertButton = true,
	insertLabel = 'Insert',
	nextPath,
	className,
	itemsClassName,
}: {
	active?: boolean;
	resetOnInactive?: boolean;
	initialCategory?: BlockTemplateCategory;
	onPick: (block: BlockTemplate) => void;
	showInsertButton?: boolean;
	insertLabel?: string;
	nextPath?: string;
	className?: string;
	itemsClassName?: string;
}) {
	const [q, setQ] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [blocks, setBlocks] = useState<BlockTemplate[]>([]);
	const [category, setCategory] = useState<BlockTemplateCategory>(initialCategory);

	useEffect(() => {
		if (!active) return;

		let canceled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const res = await apiFetch<BlockListOut>(`/api/admin/blocks?limit=200&offset=0`, {
					cache: 'no-store',
					nextPath: nextPath ?? window.location.pathname,
				});
				if (canceled) return;
				setBlocks(res.items ?? []);
			} catch (e) {
				if (canceled) return;
				setError(e instanceof Error ? e.message : String(e));
				setBlocks([]);
			} finally {
				if (!canceled) setLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [active, nextPath]);

	useEffect(() => {
		if (active) return;
		if (!resetOnInactive) return;
		setQ('');
		setCategory(initialCategory);
	}, [active, resetOnInactive, initialCategory]);

	const categorized = useMemo(() => {
		const byCategory: Record<BlockTemplateCategory, BlockTemplate[]> = {
			pages: [],
			navigation: [],
			heroes: [],
			features: [],
			cms: [],
			embeds: [],
		};

		for (const block of blocks) {
			const flags = inferCategoryMembership(block);
			byCategory.pages.push(block);
			if (flags.isNavigation) byCategory.navigation.push(block);
			if (flags.isHero) byCategory.heroes.push(block);
			if (flags.isFeature) byCategory.features.push(block);
			if (flags.isCms) byCategory.cms.push(block);
			if (flags.isEmbed) byCategory.embeds.push(block);
		}

		const items = blocks
			.filter((b) => matchesQuery(b, q))
			.filter((b) => {
				if (category === 'pages') return true;
				const flags = inferCategoryMembership(b);
				if (category === 'navigation') return flags.isNavigation;
				if (category === 'heroes') return flags.isHero;
				if (category === 'features') return flags.isFeature;
				if (category === 'cms') return flags.isCms;
				if (category === 'embeds') return flags.isEmbed;
				return true;
			});

		return { byCategory, items };
	}, [blocks, category, q]);

	return (
		<div className={cn('grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4', className)}>
			<div className='space-y-3'>
				<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search to insert…' />

				<div className='space-y-1'>
					{CATEGORIES.map(({ id, label, icon: Icon }) => {
						const count = categorized.byCategory[id].length;
						const activeCategory = category === id;
						return (
							<button
								key={id}
								type='button'
								onClick={() => setCategory(id)}
								className={cn(
									'w-full flex items-center gap-3 rounded-md border px-3 py-2 text-sm text-left',
									activeCategory
										? 'bg-muted/40 border-ring'
										: 'bg-background hover:bg-muted/20'
								)}>
								<span className='grid h-9 w-9 place-items-center rounded-md bg-muted/30'>
									<Icon className='h-5 w-5 text-muted-foreground' />
								</span>
								<span className='flex-1'>
									<span className='font-medium'>{label}</span>
									<span className='ml-2 text-xs text-muted-foreground tabular-nums'>{count}</span>
								</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className={cn('max-h-[65vh] overflow-auto pr-1', itemsClassName)}>
				<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
					{loading ? (
						<div className='text-sm text-muted-foreground'>Loading…</div>
					) : error ? (
						<div className='text-sm text-red-600'>{error}</div>
					) : categorized.items.length > 0 ? (
						categorized.items.map((b) => (
							<div
								key={b.id}
								className='rounded-md border bg-card p-3 space-y-3'>
								<div className='flex items-start justify-between gap-3'>
									<button
										type='button'
										className='min-w-0 space-y-1 text-left'
										onClick={() => onPick(b)}
										title='Insert'>
										<div className='font-medium truncate'>{b.title}</div>
										<div className='text-xs text-muted-foreground truncate'>
											/{b.slug}
											{b.description ? ` · ${b.description}` : ''}
										</div>
									</button>

									{showInsertButton ? (
										<Button type='button' variant='outline' size='sm' onClick={() => onPick(b)}>
											{insertLabel}
										</Button>
									) : null}
								</div>

								<button
									type='button'
									onClick={() => onPick(b)}
									className='w-full rounded-md border bg-muted/10 p-3 max-h-[220px] overflow-auto text-left'>
									<PageRenderer state={parsePageBuilderState(b.definition)} />
								</button>
							</div>
						))
					) : (
						<div className='text-sm text-muted-foreground'>No blocks found in this category.</div>
					)}
				</div>
			</div>
		</div>
	);
}

