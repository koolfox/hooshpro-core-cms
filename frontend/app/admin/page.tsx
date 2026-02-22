'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
	DndContext,
	PointerSensor,
	closestCenter,
	type DragEndEvent,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	arrayMove,
	rectSortingStrategy,
	useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import { apiFetch } from '@/lib/http';
import type {
	BlockListOut,
	ComponentListOut,
	MediaListOut,
	PageListOut,
	PageTemplateListOut,
	ContentTypeListOut,
	ContentEntryListOut,
	TaxonomyListOut,
	ThemeListOut,
	FlowListOut,
} from '@/lib/types';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type DashboardWidget = {
	id: string;
	title: string;
	description: string;
	href: string;
	key: 'pages' | 'templates' | 'components' | 'blocks' | 'collections' | 'entries' | 'taxonomies' | 'media' | 'themes' | 'flows';
};

const WIDGETS: DashboardWidget[] = [
	{
		id: 'pages',
		key: 'pages',
		title: 'Pages',
		description: 'Create and manage pages (edit on the page).',
		href: '/admin/pages',
	},
	{
		id: 'templates',
		key: 'templates',
		title: 'Templates',
		description: 'Default layout/menu presets for pages.',
		href: '/admin/templates',
	},
	{
		id: 'components',
		key: 'components',
		title: 'Components',
		description: 'Reusable component presets used in the builder.',
		href: '/admin/components',
	},
	{
		id: 'blocks',
		key: 'blocks',
		title: 'Blocks',
		description: 'Reusable sections composed of components.',
		href: '/admin/blocks',
	},
	{
		id: 'collections',
		key: 'collections',
		title: 'Collections',
		description: 'Define content types (Products, Projects, etc.).',
		href: '/admin/collections',
	},
	{
		id: 'entries',
		key: 'entries',
		title: 'Entries',
		description: 'Dynamic content entries for collections.',
		href: '/admin/entries',
	},
	{
		id: 'taxonomies',
		key: 'taxonomies',
		title: 'Taxonomies',
		description: 'WordPress-like categories/tags/custom.',
		href: '/admin/taxonomies',
	},
	{
		id: 'media',
		key: 'media',
		title: 'Media',
		description: 'Upload and organize assets (folders + drag/drop).',
		href: '/admin/media',
	},
	{
		id: 'themes',
		key: 'themes',
		title: 'Themes',
		description: 'Theme definitions (CSS variables) for public rendering.',
		href: '/admin/themes',
	},
	{
		id: 'flows',
		key: 'flows',
		title: 'Flows',
		description: 'Automation workflows for forms and business processes.',
		href: '/admin/flows',
	},] as const;

function SortableWidgetCard({
	widget,
	count,
	loading,
}: {
	widget: DashboardWidget;
	count: number | null;
	loading: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: widget.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(isDragging && 'opacity-60')}>
			<Card className='h-full'>
				<CardHeader className='pb-2'>
					<div className='flex items-start justify-between gap-3'>
						<div className='space-y-1'>
							<CardTitle className='text-base'>{widget.title}</CardTitle>
							<CardDescription>{widget.description}</CardDescription>
						</div>

						<button
							type='button'
							aria-label='Drag to reorder'
							{...attributes}
							{...listeners}
							className='rounded-md border bg-background p-1 text-muted-foreground hover:text-foreground'>
							<GripVertical className='h-4 w-4' />
						</button>
					</div>
				</CardHeader>
				<CardContent className='pt-2 flex items-center justify-between gap-3'>
					<div className='text-sm text-muted-foreground'>
						{loading ? (
							'Loading…'
						) : (
							<>
								<span className='font-medium text-foreground'>{count ?? 0}</span>{' '}
								total
							</>
						)}
					</div>
					<Button
						asChild
						variant='outline'
						size='sm'>
						<Link href={widget.href}>Open</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function WidgetCard({
	widget,
	count,
	loading,
}: {
	widget: DashboardWidget;
	count: number | null;
	loading: boolean;
}) {
	return (
		<Card className='h-full'>
			<CardHeader className='pb-2'>
				<div className='flex items-start justify-between gap-3'>
					<div className='space-y-1'>
						<CardTitle className='text-base'>{widget.title}</CardTitle>
						<CardDescription>{widget.description}</CardDescription>
					</div>

					<button
						type='button'
						aria-label='Drag to reorder'
						disabled
						className='rounded-md border bg-background p-1 text-muted-foreground'>
						<GripVertical className='h-4 w-4' />
					</button>
				</div>
			</CardHeader>
			<CardContent className='pt-2 flex items-center justify-between gap-3'>
				<div className='text-sm text-muted-foreground'>
					{loading ? (
						'Loading…'
					) : (
						<>
							<span className='font-medium text-foreground'>{count ?? 0}</span>{' '}
							total
						</>
					)}
				</div>
				<Button
					asChild
					variant='outline'
					size='sm'>
					<Link href={widget.href}>Open</Link>
				</Button>
			</CardContent>
		</Card>
	);
}

export default function AdminHome() {
	const [me, setMe] = useState<{ id: number; email: string } | null>(null);
	const [counts, setCounts] = useState<Record<string, number | null>>({
		pages: null,
		templates: null,
		components: null,
		blocks: null,
		collections: null,
		entries: null,
		taxonomies: null,
		media: null,
		themes: null,
		flows: null,
	});
	const [loadingCounts, setLoadingCounts] = useState(true);
	const [countsError, setCountsError] = useState<string | null>(null);
	const [hydrated, setHydrated] = useState(false);

	const [widgetOrder, setWidgetOrder] = useState<string[]>(() => WIDGETS.map((w) => w.id));

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
	);

	useEffect(() => {
		let canceled = false;
		setHydrated(true);

		try {
			const saved = window.localStorage.getItem('hooshpro_dashboard_widget_order');
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
						const ids = WIDGETS.map((w) => w.id);
						const next = parsed.filter((id) => ids.includes(id));
						for (const id of ids) if (!next.includes(id)) next.push(id);
						if (!canceled) setWidgetOrder(next);
					}
				} catch {
					// ignore
				}
			}
		} catch {
			// ignore
		}

		async function load() {
			setLoadingCounts(true);
			setCountsError(null);

			try {
				const [meOut, pagesOut, templatesOut, componentsOut, blocksOut, collectionsOut, entriesOut, taxonomiesOut, mediaOut, themesOut, flowsOut] =
					await Promise.all([
						apiFetch<{ id: number; email: string }>('/api/auth/me', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<PageListOut>('/api/admin/pages?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<PageTemplateListOut>('/api/admin/templates?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<ComponentListOut>('/api/admin/components?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<BlockListOut>('/api/admin/blocks?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<ContentTypeListOut>('/api/admin/content-types?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<ContentEntryListOut>('/api/admin/entries?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<TaxonomyListOut>('/api/admin/taxonomies?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<MediaListOut>('/api/admin/media?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<ThemeListOut>('/api/admin/themes?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
						apiFetch<FlowListOut>('/api/admin/flows?limit=1&offset=0', {
							cache: 'no-store',
							nextPath: '/admin',
						}),
					]);

				if (canceled) return;

				setMe(meOut);
				setCounts({
					pages: pagesOut.total ?? 0,
					templates: templatesOut.total ?? 0,
					components: componentsOut.total ?? 0,
					blocks: blocksOut.total ?? 0,
					collections: collectionsOut.total ?? 0,
					entries: entriesOut.total ?? 0,
					taxonomies: taxonomiesOut.total ?? 0,
					media: mediaOut.total ?? 0,
					themes: themesOut.total ?? 0,
					flows: flowsOut.total ?? 0,
				});
			} catch (e) {
				if (canceled) return;
				setCountsError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!canceled) setLoadingCounts(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, []);

	const widgets = useMemo(() => {
		const byId = new Map(WIDGETS.map((w) => [w.id, w] as const));
		return widgetOrder.map((id) => byId.get(id)).filter(Boolean) as DashboardWidget[];
	}, [widgetOrder]);

	async function logout() {
		try {
			await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST', nextPath: '/auth/login' });
		} finally {
			window.location.href = '/auth/login';
		}
	}

	function onDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		setWidgetOrder((prev) => {
			const oldIndex = prev.indexOf(String(active.id));
			const newIndex = prev.indexOf(String(over.id));
			if (oldIndex === -1 || newIndex === -1) return prev;
			const next = arrayMove(prev, oldIndex, newIndex);
			window.localStorage.setItem('hooshpro_dashboard_widget_order', JSON.stringify(next));
			return next;
		});
	}

	return (
		<div className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold'>Dashboard</h1>
					<p className='text-sm text-muted-foreground'>
						Logged in as {me?.email ?? ''}
					</p>
				</div>

				<Button
					variant='outline'
					onClick={logout}>
					Logout
				</Button>
			</div>

			{countsError ? <p className='text-sm text-red-600'>{countsError}</p> : null}

			{hydrated ? (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={onDragEnd}>
					<SortableContext
						items={widgets.map((w) => w.id)}
						strategy={rectSortingStrategy}>
						<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
							{widgets.map((w) => (
								<SortableWidgetCard
									key={w.id}
									widget={w}
									count={counts[w.key] ?? 0}
									loading={loadingCounts}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			) : (
				<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
					{widgets.map((w) => (
						<WidgetCard
							key={w.id}
							widget={w}
							count={counts[w.key] ?? 0}
							loading={loadingCounts}
						/>
					))}
				</div>
			)}
		</div>
	);
}

