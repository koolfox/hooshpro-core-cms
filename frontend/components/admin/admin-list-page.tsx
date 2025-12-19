'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type Props = {
	title: string;
	description?: string;
	actions?: ReactNode;
	filters?: ReactNode;
	total: number;
	offset: number;
	limit: number;
	loading?: boolean;
	onPrev: () => void;
	onNext: () => void;
	onSetOffset?: (offset: number) => void;
	children: ReactNode;
};

type PageItem = number | 'ellipsis';

function pageItems(currentPage: number, totalPages: number): PageItem[] {
	if (totalPages <= 1) return [1];
	if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

	let start = Math.max(2, currentPage - 2);
	let end = Math.min(totalPages - 1, currentPage + 2);

	const window = end - start + 1;
	if (window < 5) {
		const missing = 5 - window;
		if (start === 2) {
			end = Math.min(totalPages - 1, end + missing);
		} else if (end === totalPages - 1) {
			start = Math.max(2, start - missing);
		}
	}

	const items: PageItem[] = [1];
	if (start > 2) items.push('ellipsis');
	for (let p = start; p <= end; p++) items.push(p);
	if (end < totalPages - 1) items.push('ellipsis');
	items.push(totalPages);
	return items;
}

export function AdminListPage({
	title,
	description,
	actions,
	filters,
	total,
	offset,
	limit,
	loading,
	onPrev,
	onNext,
	onSetOffset,
	children,
}: Props) {
	const canPrev = offset > 0;
	const canNext = offset + limit < total;

	const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
	const currentPage = Math.min(
		totalPages,
		Math.max(1, Math.floor(Math.max(0, offset) / Math.max(1, limit)) + 1)
	);

	const canShowNumbers = total > 0 && totalPages > 1 && typeof onSetOffset === 'function';
	const numbers = canShowNumbers ? pageItems(currentPage, totalPages) : [];

	function renderPaginationBar() {
		return (
			<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
				<p className='text-sm text-muted-foreground'>
					{total > 0 ? (
						<>
							Showing <b>{offset + 1}</b>–<b>{Math.min(offset + limit, total)}</b> of{' '}
							<b>{total}</b>
							<span className='mx-2'>·</span>
							Page <b>{currentPage}</b> of <b>{totalPages}</b>
						</>
					) : null}
				</p>

				<div className='flex flex-wrap items-center gap-2 justify-end'>
					<Button
						variant='outline'
						size='sm'
						disabled={!canPrev || !!loading}
						onClick={onPrev}>
						Prev
					</Button>

					{canShowNumbers ? (
						<div className='flex flex-wrap items-center gap-1'>
							{numbers.map((p, idx) =>
								p === 'ellipsis' ? (
									<span
										key={`e-${idx}`}
										className='px-2 text-sm text-muted-foreground'>
										…
									</span>
								) : (
									<Button
										key={p}
										type='button'
										variant={p === currentPage ? 'secondary' : 'outline'}
										size='sm'
										aria-current={p === currentPage ? 'page' : undefined}
										disabled={!!loading}
										onClick={() => onSetOffset?.((p - 1) * limit)}>
										{p}
									</Button>
								)
							)}
						</div>
					) : null}

					<Button
						variant='outline'
						size='sm'
						disabled={!canNext || !!loading}
						onClick={onNext}>
						Next
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold'>{title}</h1>
					{description ? (
						<p className='text-sm text-muted-foreground'>
							{description}
						</p>
					) : null}
				</div>

				{actions ? <div className='shrink-0'>{actions}</div> : null}
			</div>

			{filters ? <div className='rounded-xl border p-4'>{filters}</div> : null}

			{renderPaginationBar()}

			{children}

			{renderPaginationBar()}
		</div>
	);
}
