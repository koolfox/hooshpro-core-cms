'use client';

import { useMemo, useRef, useState } from 'react';

import { apiFetch } from '@/lib/http';
import type { BlockListOut, BlockTemplate } from '@/lib/types';
import { useApiList } from '@/hooks/use-api-list';

import { AdminListPage } from '@/components/admin/admin-list-page';
import { AdminDataTable } from '@/components/admin/admin-data-table';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

const LIMIT = 30;

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function formatIso(iso: string) {
	try {
		const d = new Date(iso);
		return d.toLocaleString();
	} catch {
		return iso;
	}
}

function defaultDefinitionJson() {
	return JSON.stringify({ version: 3, layout: { rows: [] } }, null, 2);
}

export default function AdminBlocksScreen() {
	const [offset, setOffset] = useState(0);
	const [qInput, setQInput] = useState('');
	const [q, setQ] = useState('');

	const qRef = useRef<HTMLInputElement | null>(null);

	const listUrl = useMemo(() => {
		const params = new URLSearchParams();
		params.set('limit', String(LIMIT));
		params.set('offset', String(offset));
		if (q.trim()) params.set('q', q.trim());
		return `/api/admin/blocks?${params.toString()}`;
	}, [offset, q]);

	const { data, loading, error, reload } = useApiList<BlockListOut>(listUrl, {
		nextPath: '/admin/blocks',
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	function applyFilters() {
		setOffset(0);
		setQ(qInput.trim());
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setQ('');
		qRef.current?.focus();
	}

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<BlockTemplate | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [definitionJson, setDefinitionJson] = useState(defaultDefinitionJson());

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<BlockTemplate | null>(null);

	function openCreate() {
		setEditing(null);
		setTitle('');
		setSlug('');
		setDescription('');
		setDefinitionJson(defaultDefinitionJson());
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(b: BlockTemplate) {
		setEditing(b);
		setTitle(b.title);
		setSlug(b.slug);
		setDescription(b.description ?? '');
		setDefinitionJson(JSON.stringify(b.definition ?? { version: 3, layout: { rows: [] } }, null, 2));
		setFormError(null);
		setEditorOpen(true);
	}

	async function save() {
		setSaving(true);
		setFormError(null);

		let defObj: unknown;
		try {
			const raw = definitionJson.trim();
			defObj = raw ? JSON.parse(raw) : { version: 3, layout: { rows: [] } };
			if (defObj === null || typeof defObj !== 'object' || Array.isArray(defObj)) {
				throw new Error('Definition JSON must be an object.');
			}
		} catch (e) {
			setFormError(toErrorMessage(e));
			setSaving(false);
			return;
		}

		const payload = {
			title: title.trim(),
			slug: slug.trim(),
			description: description.trim() ? description.trim() : null,
			definition: defObj as Record<string, unknown>,
		};

		try {
			if (editing) {
				await apiFetch<BlockTemplate>(`/api/admin/blocks/${editing.id}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/blocks',
				});
			} else {
				await apiFetch<BlockTemplate>('/api/admin/blocks', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/blocks',
				});
			}
			setEditorOpen(false);
			setActionError(null);
			await reload();
		} catch (e) {
			setFormError(toErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(b: BlockTemplate) {
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/blocks/${b.id}`, {
				method: 'DELETE',
				nextPath: '/admin/blocks',
			});
			setConfirmDelete(null);
			setActionError(null);

			const nextTotal = Math.max(0, total - 1);
			const lastOffset = Math.max(
				0,
				Math.floor(Math.max(0, nextTotal - 1) / LIMIT) * LIMIT
			);
			const nextOffset = Math.min(offset, lastOffset);
			setOffset(nextOffset);
			if (nextOffset === offset) await reload();
		} catch (e) {
			setActionError(toErrorMessage(e));
		}
	}

	return (
		<AdminListPage
			title='Blocks'
			description='Reusable sections (blocks) composed of multiple components.'
			actions={
				<Button
					onClick={openCreate}
					disabled={loading}>
					New block
				</Button>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-10 space-y-2'>
						<Label>Search</Label>
						<Input
							ref={qRef}
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search by title or slug...'
							onKeyDown={(e) => {
								if (e.key === 'Enter') applyFilters();
								if (e.key === 'Escape') resetFilters();
							}}
						/>
					</div>
					<div className='md:col-span-2 flex gap-2 justify-end'>
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
			{loading ? <p className='text-sm text-muted-foreground'>Loading…</p> : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}
			{actionError ? <p className='text-sm text-red-600'>{actionError}</p> : null}

			<AdminDataTable
				rows={items}
				getRowKey={(b) => b.id}
				columns={[
					{
						header: 'Title',
						cell: (b) => (
							<div className='space-y-1'>
								<div className='font-medium'>{b.title}</div>
								<div className='text-xs text-muted-foreground'>/{b.slug}</div>
							</div>
						),
					},
					{
						header: 'Updated',
						cell: (b) => (
							<span className='text-xs text-muted-foreground'>
								{formatIso(b.updated_at)}
							</span>
						),
						headerClassName: 'w-[220px]',
					},
					{
						header: '',
						cell: (b) => (
							<div className='flex items-center justify-end gap-2'>
								<Button
									size='sm'
									variant='outline'
									onClick={() => openEdit(b)}>
									Edit
								</Button>
								<Button
									size='sm'
									variant='destructive'
									onClick={() => setConfirmDelete(b)}>
									Delete
								</Button>
							</div>
						),
						headerClassName: 'w-[190px]',
						cellClassName: 'text-right',
					},
				]}
			/>

			<Dialog
				open={editorOpen}
				onOpenChange={(open) => {
					setEditorOpen(open);
					if (!open) setEditing(null);
				}}>
				<DialogContent className='sm:max-w-2xl'>
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit block' : 'New block'}</DialogTitle>
						<DialogDescription>
							Blocks are reusable section templates (one or more rows).
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label>Title</Label>
								<Input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									disabled={saving}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Slug</Label>
								<Input
									value={slug}
									onChange={(e) => setSlug(e.target.value)}
									placeholder='e.g. hero-section'
									disabled={saving || !!editing}
								/>
								{editing ? (
									<p className='text-xs text-muted-foreground'>
										Slug changes are disabled for now (keeps references stable).
									</p>
								) : null}
							</div>
						</div>

						<div className='space-y-2'>
							<Label>Description</Label>
							<Input
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								disabled={saving}
							/>
						</div>

						<div className='space-y-2'>
							<Label>Definition (JSON)</Label>
							<Textarea
								value={definitionJson}
								onChange={(e) => setDefinitionJson(e.target.value)}
								className='font-mono text-xs min-h-[260px]'
								disabled={saving}
							/>
							<div className='text-xs text-muted-foreground space-y-1'>
								<p>
									Store a V3 snippet like <code>{`{ "version": 3, "layout": { "rows": [...] } }`}</code>.
								</p>
								<p>
									The page editor will later support inserting these blocks into a page.
								</p>
							</div>
						</div>

						{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}
					</div>

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setEditorOpen(false)}
							disabled={saving}>
							Cancel
						</Button>
						<Button
							onClick={save}
							disabled={saving || !title.trim() || !slug.trim()}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!confirmDelete}
				onOpenChange={(open) => {
					if (!open) setConfirmDelete(null);
				}}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete block?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes <strong>{confirmDelete?.title}</strong> from the blocks library.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={loading || !confirmDelete}
							onClick={() => {
								if (confirmDelete) void doDelete(confirmDelete);
							}}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{items.length === 0 && !loading && !error ? (
				<div className='rounded-xl border p-6'>
					<p className='text-sm text-muted-foreground'>No blocks yet.</p>
					<div className='mt-3'>
						<Badge variant='secondary'>Tip</Badge>
						<span className='ml-2 text-sm text-muted-foreground'>
							Blocks are “sections”: saved row/column/component layouts.
						</span>
					</div>
				</div>
			) : null}
		</AdminListPage>
	);
}

