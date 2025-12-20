'use client';

import { useMemo } from 'react';

import type { PageBlock, PageBuilderState } from '@/lib/page-builder';
import { cn } from '@/lib/utils';

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';

function describeBlock(block: PageBlock): string {
	if (block.type === 'unknown') return block.data.originalType;
	if (block.type === 'shadcn') return `shadcn/${block.data.component || 'component'}`;
	return block.type;
}

export function PageBuilderOutline({
	state,
	className,
}: {
	state: PageBuilderState;
	className?: string;
}) {
	const totals = useMemo(() => {
		const rows = state.rows.length;
		const columns = state.rows.reduce((sum, row) => sum + row.columns.length, 0);
		const components = state.rows.reduce((sum, row) => {
			return (
				sum +
				row.columns.reduce((colSum, col) => colSum + col.blocks.length, 0)
			);
		}, 0);
		return { rows, columns, components };
	}, [state.rows]);

	return (
		<div className={cn('space-y-3', className)}>
			<div className='space-y-1'>
				<p className='text-sm font-medium'>Outline</p>
				<p className='text-xs text-muted-foreground'>
					{totals.rows} rows · {totals.columns} cols · {totals.components} components
				</p>
			</div>

			<div className='space-y-2'>
				{state.rows.map((row, rowIndex) => (
					<Collapsible
						key={row.id}
						defaultOpen>
						<div className='flex items-center justify-between gap-2'>
							<CollapsibleTrigger asChild>
								<button
									type='button'
									className='text-xs font-medium hover:underline underline-offset-4'>
									Row {rowIndex + 1}
								</button>
							</CollapsibleTrigger>
							<span className='text-xs text-muted-foreground'>
								{row.columns.length} col
							</span>
						</div>

						<CollapsibleContent className='mt-2 space-y-3 border-l pl-3'>
							{row.columns.map((col, colIndex) => (
								<div
									key={col.id}
									className='space-y-1'>
									<div className='flex items-center justify-between gap-2'>
										<span className='text-xs text-muted-foreground'>
											Col {colIndex + 1}
										</span>
										<span className='text-xs text-muted-foreground'>
											{col.blocks.length} items
										</span>
									</div>

									{col.blocks.length ? (
										<ul className='pl-3 space-y-1'>
											{col.blocks.map((b) => (
												<li
													key={b.id}
													className='text-xs text-muted-foreground truncate'>
													{describeBlock(b)}
												</li>
											))}
										</ul>
									) : (
										<p className='text-xs text-muted-foreground italic pl-3'>
											Empty
										</p>
									)}
								</div>
							))}
						</CollapsibleContent>
					</Collapsible>
				))}
			</div>
		</div>
	);
}

