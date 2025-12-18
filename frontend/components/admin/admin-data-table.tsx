'use client';

import type { ReactNode } from 'react';

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

export type AdminTableColumn<T> = {
	header: ReactNode;
	cell: (row: T) => ReactNode;
	headerClassName?: string;
	cellClassName?: string;
};

type Props<T> = {
	rows: T[];
	getRowKey: (row: T) => string | number;
	columns: AdminTableColumn<T>[];
	emptyText?: string;
};

export function AdminDataTable<T>({
	rows,
	getRowKey,
	columns,
	emptyText = 'No results.',
}: Props<T>) {
	return (
		<div className='rounded-xl border overflow-hidden'>
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((c, idx) => (
							<TableHead
								key={idx}
								className={c.headerClassName}>
								{c.header}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className='text-sm text-muted-foreground'>
								{emptyText}
							</TableCell>
						</TableRow>
					) : (
						rows.map((row) => (
							<TableRow key={getRowKey(row)}>
								{columns.map((c, idx) => (
									<TableCell
										key={idx}
										className={c.cellClassName}>
										{c.cell(row)}
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}

