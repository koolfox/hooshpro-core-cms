'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

import type { MediaAsset, MediaFolderListOut, MediaListOut } from '@/lib/types';
import { useApiList } from '@/hooks/use-api-list';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

const LIMIT = 30;

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (media: MediaAsset) => void;
};

export function MediaPickerDialog({ open, onOpenChange, onPick }: Props) {
	const [offset, setOffset] = useState(0);
	const [qInput, setQInput] = useState('');
	const [q, setQ] = useState('');
	const [folderFilter, setFolderFilter] = useState<number | null>(0);

	const { data: foldersData, loading: foldersLoading, error: foldersError } =
		useApiList<MediaFolderListOut>('/api/admin/media/folders', {
			nextPath: '/admin/media',
			enabled: open,
		});

	const folders = foldersData?.items ?? [];

	const listUrl = useMemo(() => {
		const params = new URLSearchParams();
		params.set('limit', String(LIMIT));
		params.set('offset', String(offset));
		if (folderFilter !== null) params.set('folder_id', String(folderFilter));
		if (q.trim()) params.set('q', q.trim());
		return `/api/admin/media?${params.toString()}`;
	}, [offset, q, folderFilter]);

	const { data, loading, error } = useApiList<MediaListOut>(listUrl, {
		nextPath: '/admin/media',
		enabled: open,
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	const canPrev = offset > 0;
	const canNext = offset + LIMIT < total;

	function apply() {
		setOffset(0);
		setQ(qInput.trim());
	}

	function reset() {
		setOffset(0);
		setQInput('');
		setQ('');
		setFolderFilter(0);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				onOpenChange(v);
				if (!v) {
					setOffset(0);
					setQInput('');
					setQ('');
					setFolderFilter(0);
				}
			}}>
			<DialogContent className='sm:max-w-3xl'>
				<DialogHeader>
					<DialogTitle>Select media</DialogTitle>
					<DialogDescription>
						Choose an image to insert into the editor.
					</DialogDescription>
				</DialogHeader>

				<div className='space-y-3'>
					<div className='grid grid-cols-1 sm:grid-cols-12 gap-3 items-end'>
						<div className='sm:col-span-4 space-y-2'>
							<Label>Folder</Label>
							<Select
								value={folderFilter === null ? 'all' : String(folderFilter)}
								onValueChange={(v) => {
									setOffset(0);
									setFolderFilter(v === 'all' ? null : Number(v));
								}}
								disabled={loading || foldersLoading}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>All media</SelectItem>
									<SelectItem value='0'>Root</SelectItem>
									{folders.map((f) => (
										<SelectItem
											key={f.id}
											value={String(f.id)}>
											{f.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className='sm:col-span-5 space-y-2'>
							<Label>Search</Label>
							<Input
								value={qInput}
								onChange={(e) => setQInput(e.target.value)}
								placeholder='Search by filename...'
								onKeyDown={(e) => {
									if (e.key === 'Enter') apply();
									if (e.key === 'Escape') reset();
								}}
							/>
						</div>

						<div className='sm:col-span-3 flex gap-2 justify-end'>
							<Button
								variant='outline'
								onClick={reset}
								disabled={loading}>
								Reset
							</Button>
							<Button
								onClick={apply}
								disabled={loading}>
								Apply
							</Button>
						</div>
					</div>

					{loading ? (
						<p className='text-sm text-muted-foreground'>Loading…</p>
					) : null}
					{foldersError ? (
						<p className='text-sm text-red-600'>{foldersError}</p>
					) : null}
					{error ? (
						<p className='text-sm text-red-600'>{error}</p>
					) : null}

					<div className='rounded-xl border p-4'>
						{items.length === 0 && !loading && !error ? (
							<p className='text-sm text-muted-foreground'>
								No media found.
							</p>
						) : (
							<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
								{items.map((m) => (
									<button
										key={m.id}
										type='button'
										className='rounded-lg border overflow-hidden text-left hover:ring-2 hover:ring-ring'
										onClick={() => {
											onPick(m);
											onOpenChange(false);
										}}>
										<div className='relative aspect-video bg-muted/30'>
											<Image
												src={m.url}
												alt={m.original_name}
												fill
												unoptimized
												sizes='(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw'
												className='object-cover'
											/>
										</div>
										<div className='p-2'>
											<div className='text-xs text-muted-foreground line-clamp-2'>
												{m.original_name}
											</div>
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</div>

				<DialogFooter className='sm:justify-between'>
					<div className='flex items-center gap-2'>
						<Button
							variant='outline'
							disabled={!canPrev || loading}
							onClick={() => setOffset((v) => Math.max(0, v - LIMIT))}>
							Prev
						</Button>
						<Button
							variant='outline'
							disabled={!canNext || loading}
							onClick={() => setOffset((v) => v + LIMIT)}>
							Next
						</Button>
					</div>

					<Button
						variant='outline'
						onClick={() => onOpenChange(false)}
						disabled={loading}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
