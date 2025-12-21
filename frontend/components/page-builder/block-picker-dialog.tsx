'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/http';
import { isRecord } from '@/lib/page-builder';
import { shadcnComponentMeta } from '@/lib/shadcn-meta';
import type { ComponentDef, ComponentListOut } from '@/lib/types';

import { ComponentPreview } from '@/components/components/component-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type ComponentPickerItem = ComponentDef;

export function BlockPickerDialog({
	open,
	onOpenChange,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (component: ComponentPickerItem) => void;
}) {
	const [q, setQ] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [components, setComponents] = useState<ComponentPickerItem[]>([]);

	useEffect(() => {
		if (!open) return;

		let canceled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const res = await apiFetch<ComponentListOut>(
					`/api/admin/components?limit=200&offset=0`,
					{ cache: 'no-store', nextPath: window.location.pathname }
				);
				if (canceled) return;
				setComponents(res.items ?? []);
			} catch (e) {
				if (canceled) return;
				setError(e instanceof Error ? e.message : String(e));
				setComponents([]);
			} finally {
				if (!canceled) setLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [open]);

	const items = useMemo(() => {
		const query = q.trim().toLowerCase();
		if (!query) return components;
		return components.filter((c) => {
			const title = c.title.toLowerCase();
			const slug = c.slug.toLowerCase();
			const type = (c.type || '').toLowerCase();
			return title.includes(query) || slug.includes(query) || type.includes(query);
		});
	}, [q, components]);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-2xl'>
				<DialogHeader>
					<DialogTitle>Add a component</DialogTitle>
					<DialogDescription>
						Choose a component preset to insert into this column.
					</DialogDescription>
				</DialogHeader>

				<Input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder='Search components…'
				/>

				<div className='max-h-[60vh] overflow-auto pr-1'>
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
						{loading ? (
							<div className='text-sm text-muted-foreground'>
								Loading…
							</div>
						) : error ? (
							<div className='text-sm text-red-600'>{error}</div>
						) : items.length > 0 ? (
							items.map((c) => (
								(() => {
									const shadcnSlug =
										c.type === 'shadcn' &&
										isRecord(c.data) &&
										typeof c.data['component'] === 'string'
											? c.data['component'].trim().toLowerCase()
											: null;
									const shadcnMeta = shadcnComponentMeta(shadcnSlug);

									return (
								<div
									key={c.id}
									className='rounded-md border bg-card p-3 space-y-3'>
									<div className='flex items-start justify-between gap-3'>
										<div className='min-w-0 space-y-1'>
											<div className='font-medium truncate'>{c.title}</div>
											<div className='text-xs text-muted-foreground truncate'>
												/{c.slug} ·{' '}
												{c.type === 'shadcn' && shadcnSlug
													? `shadcn/${shadcnSlug}`
													: c.type}
											</div>
											{shadcnMeta ? (
												<div className='flex items-center gap-2 pt-1'>
													<Badge variant='outline'>{shadcnMeta.kind}</Badge>
													{shadcnMeta.canWrapChildren ? (
														<span className='text-xs text-muted-foreground'>
															structural wrapper
														</span>
													) : null}
												</div>
											) : null}
										</div>

										<Button
											type='button'
											variant='outline'
											size='sm'
											onClick={() => onPick(c)}>
											Add
										</Button>
									</div>

									<div className='p-3'>
										<ComponentPreview
											component={{
												title: c.title,
												type: c.type,
												data: c.data,
											}}
											className='max-w-none'
											/>
									</div>
								</div>
									);
								})()
							))
						) : (
							<div className='text-sm text-muted-foreground'>
								No components found.
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
