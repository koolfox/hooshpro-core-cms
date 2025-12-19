'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/http';
import type { BlockListOut, BlockTemplate } from '@/lib/types';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function BlockTemplatePickerDialog({
	open,
	onOpenChange,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (block: BlockTemplate) => void;
}) {
	const [q, setQ] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [blocks, setBlocks] = useState<BlockTemplate[]>([]);

	useEffect(() => {
		if (!open) return;

		let canceled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const res = await apiFetch<BlockListOut>(`/api/admin/blocks?limit=200&offset=0`, {
					cache: 'no-store',
					nextPath: window.location.pathname,
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
	}, [open]);

	const items = useMemo(() => {
		const query = q.trim().toLowerCase();
		if (!query) return blocks;
		return blocks.filter((b) => {
			const title = b.title.toLowerCase();
			const slug = b.slug.toLowerCase();
			const desc = (b.description ?? '').toLowerCase();
			return title.includes(query) || slug.includes(query) || desc.includes(query);
		});
	}, [q, blocks]);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-2xl'>
				<DialogHeader>
					<DialogTitle>Insert a block</DialogTitle>
					<DialogDescription>
						Blocks are reusable section templates (one or more rows).
					</DialogDescription>
				</DialogHeader>

				<Input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder='Search blocks…'
				/>

				<div className='max-h-[60vh] overflow-auto pr-1'>
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
						{loading ? (
							<div className='text-sm text-muted-foreground'>Loading…</div>
						) : error ? (
							<div className='text-sm text-red-600'>{error}</div>
						) : items.length > 0 ? (
							items.map((b) => (
								<Button
									key={b.id}
									type='button'
									variant='outline'
									className='h-auto items-start justify-start text-left whitespace-normal'
									onClick={() => onPick(b)}>
									<div className='space-y-1'>
										<div className='font-medium'>{b.title}</div>
										<div className='text-xs text-muted-foreground'>
											/{b.slug}
											{b.description ? ` · ${b.description}` : ''}
										</div>
									</div>
								</Button>
							))
						) : (
							<div className='text-sm text-muted-foreground'>
								No blocks found.
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

