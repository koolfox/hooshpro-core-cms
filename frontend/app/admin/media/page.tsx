'use client';

import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/http';
import { useApiList } from '@/hooks/use-api-list';
import { AdminListPage } from '@/components/admin/admin-list-page';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MediaAsset, MediaListOut } from '@/lib/types';

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

const LIMIT = 40;
const SUPPORTED_TYPES_LABEL = 'JPG, PNG, WEBP, GIF, SVG';
const MAX_BYTES_LABEL = '10MB';

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function prettyBytes(n: number) {
	if (!Number.isFinite(n)) return '-';
	if (n < 1024) return `${n} B`;
	const kb = n / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	return `${mb.toFixed(1)} MB`;
}

export default function MediaScreen() {
	const [offset, setOffset] = useState(0);
	const [qInput, setQInput] = useState('');
	const [q, setQ] = useState('');

	const [uploadOpen, setUploadOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploadStatus, setUploadStatus] = useState<string | null>(null);
	const [dragActive, setDragActive] = useState(false);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const fileRef = useRef<HTMLInputElement | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<MediaAsset | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const listUrl = useMemo(() => {
		const params = new URLSearchParams();
		params.set('limit', String(LIMIT));
		params.set('offset', String(offset));
		if (q.trim()) params.set('q', q.trim());
		return `/api/admin/media?${params.toString()}`;
	}, [offset, q]);

	const { data, loading, error, reload } = useApiList<MediaListOut>(listUrl, {
		nextPath: '/admin/media',
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	function onPickFiles(list: FileList | null) {
		const files = Array.from(list ?? []);
		setPendingFiles(files);
		setUploadError(null);
	}

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
		if (pendingFiles.length === 0) return;

		setUploading(true);
		setUploadError(null);
		setUploadStatus(null);

		let okCount = 0;
		try {
			for (let i = 0; i < pendingFiles.length; i++) {
				const f = pendingFiles[i];
				setUploadStatus(
					`Uploading ${i + 1}/${pendingFiles.length}: ${f.name}`
				);

				const fd = new FormData();
				fd.append('file', f);

				await apiFetch<MediaAsset>('/api/admin/media/upload', {
					method: 'POST',
					body: fd,
					nextPath: '/admin/media',
				});
				okCount++;
			}

			setUploadOpen(false);
			setPendingFiles([]);
			if (fileRef.current) fileRef.current.value = '';
			setActionError(null);
		} catch (e) {
			setUploadError(toErrorMessage(e));
		} finally {
			setUploadStatus(null);
			setUploading(false);
			if (okCount > 0) await reload();
		}
	}

	async function doDelete(m: MediaAsset) {
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/media/${m.id}`, {
				method: 'DELETE',
				nextPath: '/admin/media',
			});
			setConfirmDelete(null);

			const nextTotal = Math.max(0, total - 1);
			const lastOffset = Math.max(
				0,
				Math.floor(Math.max(0, nextTotal - 1) / LIMIT) * LIMIT
			);
			const nextOffset = Math.min(offset, lastOffset);
			setOffset(nextOffset);
			setActionError(null);
			if (nextOffset === offset) await reload();
		} catch (e) {
			setActionError(toErrorMessage(e));
		}
	}

	return (
		<AdminListPage
			title='Media'
			description='Upload images, reuse them in pages later.'
			actions={
				<Button
					onClick={() => setUploadOpen(true)}
					disabled={loading}>
					Upload
				</Button>
			}
			filters={
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
			}
			total={total}
			offset={offset}
			limit={LIMIT}
			loading={loading}
			onPrev={() => setOffset((v) => Math.max(0, v - LIMIT))}
			onNext={() => setOffset((v) => v + LIMIT)}>

			{loading ? (
				<p className='text-sm text-muted-foreground'>Loading…</p>
			) : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}
			{actionError ? (
				<p className='text-sm text-red-600'>{actionError}</p>
			) : null}

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
				onOpenChange={(v) => {
					setUploadOpen(v);
					if (!v) {
						setPendingFiles([]);
						setUploadError(null);
						setUploadStatus(null);
						setDragActive(false);
						if (fileRef.current) fileRef.current.value = '';
					}
				}}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>Upload</DialogTitle>
						<DialogDescription>
							Drop files or browse. Supported: {SUPPORTED_TYPES_LABEL}. Max {MAX_BYTES_LABEL} each.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-2'>
						<Label>Files</Label>

						<input
							ref={fileRef}
							type='file'
							accept='image/*'
							multiple
							className='hidden'
							disabled={uploading}
							onChange={(e) => onPickFiles(e.target.files)}
						/>

						<div
							className={`rounded-lg border border-dashed p-6 text-center text-sm transition cursor-pointer ${dragActive ? 'bg-muted' : 'bg-muted/20'}`}
							onClick={() => fileRef.current?.click()}
							onDragOver={(e) => {
								e.preventDefault();
								setDragActive(true);
							}}
							onDragLeave={() => setDragActive(false)}
							onDrop={(e) => {
								e.preventDefault();
								setDragActive(false);
								onPickFiles(e.dataTransfer.files);
							}}>
							<div className='space-y-1'>
								<p className='font-medium'>
									Drop images here or click to browse
								</p>
								<p className='text-xs text-muted-foreground'>
									Supported: {SUPPORTED_TYPES_LABEL} • Max{' '}
									{MAX_BYTES_LABEL} each
								</p>
							</div>

							{pendingFiles.length > 0 ? (
								<div className='mt-3 text-xs text-muted-foreground space-y-1'>
									<p>
										Selected: <b>{pendingFiles.length}</b>
									</p>
									<div className='max-h-24 overflow-auto'>
										{pendingFiles.map((f) => (
											<div
												key={`${f.name}:${f.size}:${f.lastModified}`}>
												{f.name}
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
					</div>

					{uploadStatus ? (
						<p className='text-sm text-muted-foreground'>
							{uploadStatus}
						</p>
					) : null}
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
							disabled={uploading || pendingFiles.length === 0}>
							{uploading
								? 'Uploading…'
								: pendingFiles.length > 1
									? `Upload ${pendingFiles.length} files`
									: 'Upload'}
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
		</AdminListPage>
	);
}
