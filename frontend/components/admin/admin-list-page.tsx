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
	children: ReactNode;
};

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
	children,
}: Props) {
	const canPrev = offset > 0;
	const canNext = offset + limit < total;

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

			<div className='flex items-center justify-between'>
				<p className='text-sm text-muted-foreground'>
					{total > 0 ? (
						<>
							Showing <b>{offset + 1}</b>–<b>{Math.min(offset + limit, total)}</b> of{' '}
							<b>{total}</b>
						</>
					) : null}
				</p>

				<div className='flex items-center gap-2'>
					<Button
						variant='outline'
						disabled={!canPrev || !!loading}
						onClick={onPrev}>
						Prev
					</Button>
					<Button
						variant='outline'
						disabled={!canNext || !!loading}
						onClick={onNext}>
						Next
					</Button>
				</div>
			</div>

			{children}
		</div>
	);
}
