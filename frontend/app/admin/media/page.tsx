'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/http';

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
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Media = {
	id: number;
	url: string;
	original_name: string;
	content_type: string;
	size_bytes: number;
	created_at: string;
};

type MediaListOut = {
	items: Media[];
	total: number;
	limit: number;
	offset: number;
};

const LIMIT = 40;

function prettyBytes(n: number) {
	if (!Number.isFinite(n)) return '-';
	if (n < 1024) return `${n} B`;
	const kb = n / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	return `${mb.toFixed(1)} MB`;
}

export default function MediaScreen() {
	const [items, setItems] = useState<Media[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [offset, setOffset] = useState(0);
	const [qInput, setQInput] = useState('');
	const [q, setQ] = useState('');

	const [uploadOpen, setUploadOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<Media | null>(null);

	const canPrev = offset > 0;
	const canNext = offset + LIMIT < total;

	const listUrl = useMemo(() => {
		const params = new URLSearchParams();
		params.set('limit', String(LIMIT));
		params.set('offset', String(offset));
		if (q.trim()) params.set('q', q.trim());
		return `/api/admin/media?${params.toString()}`;
	}, [offset, q]);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const data = await apiFetch<MediaListOut>(listUrl, {
				cache: 'no-store',
				nextPath: '/admin/media',
			});
			setItems(data.items);
			setTotal(data.total);
		} catch (e: any) {
			setError(String(e?.message ?? e));
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [listUrl]);

	function applyFilters() {
		setOffset(0);
		setQ(qInput.trim());
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setQ('');
	}

	async function doUpload() {
		const f = fileRef.current?.files?.[0];
		if (!f) return;

		setUploading(true);
		setUploadError(null);

		try {
			const fd = new FormData();
			fd.append('file', f);

			await apiFetch<Media>('/api/admin/media/upload', {
				method: 'POST',
				body: fd,
				nextPath: '/admin/media',
			});

			setUploadOpen(false);
			if (fileRef.current) fileRef.current.value = '';
			await load();
		} catch (e: any) {
			setUploadError(String(e?.message ?? e));
		} finally {
			setUploading(false);
		}
	}

	async function doDelete(m: Media) {
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/media/${m.id}`, {
				method: 'DELETE',
				nextPath: '/admin/media',
			});
			setConfirmDelete(null);

			const nextTotal = Math.max(0, total - 1);
			const lastOffset = Math.max(
				0,
				Math.floor((nextTotal - 1) / LIMIT) * LIMIT
			);
			setOffset((cur) => Math.min(cur, lastOffset));
			if (offset === lastOffset) await load();
		} catch (e: any) {
			setError(String(e?.message ?? e));
		}
	}

	return (
		<main className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold'>Media</h1>
					<p className='text-sm text-muted-foreground'>
						Upload images, reuse them in pages later.
					</p>
				</div>

				<Button
					onClick={() => setUploadOpen(true)}
					disabled={loading}>
					Upload
				</Button>
			</div>

			<div className='rounded-xl border p-4'>
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-9 space-y-2'>
						<Label>Search</Label>
						<Input
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search by filename...'
							onKeyDown={(e) => {
								if (e.key === 'Enter') applyFilters();
								if (e.key === 'Escape') resetFilters();
							}}
						/>
					</div>
					<div className='md:col-span-3 flex gap-2 justify-end'>
						<Button
							variant='outline'
							onClick={resetFilters}
							disabled={loading}>
							Reset
						</Button>
						<Button
							onClick={applyFilters}
							disabled={loading}>
							Apply
						</Button>
					</div>
				</div>
			</div>

			<div className='flex items-center justify-between'>
				<p className='text-sm text-muted-foreground'>
					{total > 0 ? (
						<>
							Showing <b>{offset + 1}</b>–
							<b>{Math.min(offset + items.length, total)}</b> of{' '}
							<b>{total}</b>
						</>
					) : null}
				</p>

				<div className='flex items-center gap-2'>
					<Button
						variant='outline'
						disabled={!canPrev || loading}
						onClick={() =>
							setOffset((v) => Math.max(0, v - LIMIT))
						}>
						Prev
					</Button>
					<Button
						variant='outline'
						disabled={!canNext || loading}
						onClick={() => setOffset((v) => v + LIMIT)}>
						Next
					</Button>
				</div>
			</div>

			{loading ? (
				<p className='text-sm text-muted-foreground'>Loading…</p>
			) : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}

			{!loading && !error && items.length === 0 ? (
				<div className='rounded-xl border p-6'>
					<p className='text-sm text-muted-foreground'>
						No media yet.
					</p>
				</div>
			) : null}

			{!loading && !error && items.length > 0 ? (
				<div className='rounded-xl border p-4'>
					<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
						{items.map((m) => (
							<div
								key={m.id}
								className='rounded-lg border overflow-hidden'>
								<div className='aspect-video bg-muted/30'>
									<img
										src={m.url}
										alt={m.original_name}
										className='w-full h-full object-cover'
									/>
								</div>
								<div className='p-3 space-y-2'>
									<div className='text-xs text-muted-foreground line-clamp-2'>
										{m.original_name}
									</div>
									<div className='text-xs text-muted-foreground flex items-center justify-between'>
										<span>{prettyBytes(m.size_bytes)}</span>
										<Button
											size='sm'
											variant='destructive'
											onClick={() => setConfirmDelete(m)}>
											Delete
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			) : null}

			<Dialog
				open={uploadOpen}
				onOpenChange={setUploadOpen}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>Upload image</DialogTitle>
						<DialogDescription>
							Accepted: image/* — stored locally on the backend.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-2'>
						<Label>File</Label>
						<input
							ref={fileRef}
							type='file'
							accept='image/*'
							className='block w-full text-sm'
							disabled={uploading}
						/>
					</div>

					{uploadError ? (
						<p className='text-sm text-red-600'>{uploadError}</p>
					) : null}

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setUploadOpen(false)}
							disabled={uploading}>
							Cancel
						</Button>
						<Button
							onClick={doUpload}
							disabled={uploading}>
							{uploading ? 'Uploading…' : 'Upload'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!confirmDelete}
				onOpenChange={(v) => !v && setConfirmDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete media?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete{' '}
							<b>{confirmDelete?.original_name}</b>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={loading}
							onClick={() =>
								confirmDelete && doDelete(confirmDelete)
							}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}
