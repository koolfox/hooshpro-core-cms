'use client';

import { useMemo, useRef, useState } from 'react';

import { apiFetch } from '@/lib/http';
import type { ComponentDef, ComponentListOut } from '@/lib/types';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
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

const LIMIT = 50;

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

function defaultDataJson() {
	return JSON.stringify({}, null, 2);
}

export default function AdminComponentsScreen() {
	const [offset, setOffset] = useState(0);
	const [qInput, setQInput] = useState('');
	const [typeInput, setTypeInput] = useState<'all' | string>('all');

	const [q, setQ] = useState('');
	const [type, setType] = useState<'all' | string>('all');

	const qRef = useRef<HTMLInputElement | null>(null);

	const listUrl = useMemo(() => {
		const params = new URLSearchParams();
		params.set('limit', String(LIMIT));
		params.set('offset', String(offset));
		if (q.trim()) params.set('q', q.trim());
		if (type !== 'all' && type.trim()) params.set('type', type.trim());
		return `/api/admin/components?${params.toString()}`;
	}, [offset, q, type]);

	const { data, loading, error, reload } = useApiList<ComponentListOut>(listUrl, {
		nextPath: '/admin/components',
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	function applyFilters() {
		setOffset(0);
		setQ(qInput.trim());
		setType(typeInput);
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setTypeInput('all');
		setQ('');
		setType('all');
		qRef.current?.focus();
	}

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<ComponentDef | null>(null);

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [compType, setCompType] = useState('editor');
	const [description, setDescription] = useState('');
	const [dataJson, setDataJson] = useState(defaultDataJson());

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<ComponentDef | null>(null);

	function openCreate() {
		setEditing(null);
		setTitle('');
		setSlug('');
		setCompType('editor');
		setDescription('');
		setDataJson(defaultDataJson());
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(c: ComponentDef) {
		setEditing(c);
		setTitle(c.title);
		setSlug(c.slug);
		setCompType(c.type);
		setDescription(c.description ?? '');
		setDataJson(JSON.stringify(c.data ?? {}, null, 2));
		setFormError(null);
		setEditorOpen(true);
	}

	async function save() {
		setSaving(true);
		setFormError(null);

		let dataObj: unknown = {};
		try {
			const raw = dataJson.trim();
			dataObj = raw ? JSON.parse(raw) : {};
			if (dataObj === null || typeof dataObj !== 'object' || Array.isArray(dataObj)) {
				throw new Error('Data JSON must be an object.');
			}
		} catch (e) {
			setFormError(toErrorMessage(e));
			setSaving(false);
			return;
		}

		const payload = {
			title: title.trim(),
			slug: slug.trim(),
			type: compType.trim(),
			description: description.trim() ? description.trim() : null,
			data: dataObj as Record<string, unknown>,
		};

		try {
			if (editing) {
				await apiFetch<ComponentDef>(`/api/admin/components/${editing.id}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/components',
				});
			} else {
				await apiFetch<ComponentDef>('/api/admin/components', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					nextPath: '/admin/components',
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

	async function doDelete(c: ComponentDef) {
		try {
			await apiFetch<{ ok: boolean }>(`/api/admin/components/${c.id}`, {
				method: 'DELETE',
				nextPath: '/admin/components',
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
			title='Components'
			description='Reusable component presets used by the page editor.'
			actions={
				<Button
					onClick={openCreate}
					disabled={loading}>
					New component
				</Button>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-7 space-y-2'>
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
					<div className='md:col-span-3 space-y-2'>
						<Label>Type</Label>
						<Select
							value={typeInput}
							onValueChange={(v) => setTypeInput(v)}
							disabled={loading}>
							<SelectTrigger>
								<SelectValue placeholder='All types' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All</SelectItem>
								<SelectItem value='editor'>editor</SelectItem>
								<SelectItem value='image'>image</SelectItem>
								<SelectItem value='button'>button</SelectItem>
								<SelectItem value='card'>card</SelectItem>
								<SelectItem value='separator'>separator</SelectItem>
								<SelectItem value='shadcn'>shadcn</SelectItem>
							</SelectContent>
						</Select>
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
				getRowKey={(c) => c.id}
				columns={[
					{
						header: 'Title',
						cell: (c) => (
							<div className='space-y-1'>
								<div className='font-medium'>{c.title}</div>
								<div className='text-xs text-muted-foreground'>/{c.slug}</div>
							</div>
						),
					},
					{
						header: 'Type',
						cell: (c) => (
							<Badge variant='secondary'>{c.type}</Badge>
						),
						headerClassName: 'w-[140px]',
					},
					{
						header: 'Updated',
						cell: (c) => (
							<span className='text-xs text-muted-foreground'>
								{formatIso(c.updated_at)}
							</span>
						),
						headerClassName: 'w-[220px]',
					},
					{
						header: '',
						cell: (c) => (
							<div className='flex items-center justify-end gap-2'>
								<Button
									size='sm'
									variant='outline'
									onClick={() => openEdit(c)}>
									Edit
								</Button>
								<Button
									size='sm'
									variant='destructive'
									onClick={() => setConfirmDelete(c)}>
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
						<DialogTitle>
							{editing ? 'Edit component' : 'New component'}
						</DialogTitle>
						<DialogDescription>
							Components are reusable presets that the page editor can insert.
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
									placeholder='e.g. hero-title'
									disabled={saving || !!editing}
								/>
								{editing ? (
									<p className='text-xs text-muted-foreground'>
										Slug changes are disabled for now (keeps references stable).
									</p>
								) : null}
							</div>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label>Type</Label>
								<Select
									value={compType}
									onValueChange={(v) => setCompType(v)}
									disabled={saving}>
									<SelectTrigger>
										<SelectValue placeholder='Type' />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='editor'>editor</SelectItem>
										<SelectItem value='image'>image</SelectItem>
										<SelectItem value='button'>button</SelectItem>
										<SelectItem value='card'>card</SelectItem>
										<SelectItem value='separator'>separator</SelectItem>
										<SelectItem value='shadcn'>shadcn</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className='space-y-2'>
								<Label>Description</Label>
								<Input
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									disabled={saving}
								/>
							</div>
						</div>

						<div className='space-y-2'>
							<Label>Data (JSON)</Label>
							<Textarea
								value={dataJson}
								onChange={(e) => setDataJson(e.target.value)}
								className='font-mono text-xs min-h-[220px]'
								disabled={saving}
							/>
							<p className='text-xs text-muted-foreground'>
								Stored as JSON and used as the default <code>data</code> when inserted.
							</p>
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
							disabled={saving || !title.trim() || !slug.trim() || !compType.trim()}>
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
						<AlertDialogTitle>Delete component?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes <strong>{confirmDelete?.title}</strong> from the component library.
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
		</AdminListPage>
	);
}

