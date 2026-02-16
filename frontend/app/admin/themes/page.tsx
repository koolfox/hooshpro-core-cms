'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import type { Theme, ThemeListOut } from '@/lib/types';
import { buildAdminThemesListUrl, createAdminTheme, deleteAdminTheme, updateAdminTheme } from '@/lib/api/themes';
import { useApiList } from '@/hooks/use-api-list';

import { AdminListPage } from '@/components/admin/admin-list-page';
import { AdminDataTable } from '@/components/admin/admin-data-table';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

type SortDir = 'asc' | 'desc';
const SORT_FIELDS = ['updated_at', 'created_at', 'title', 'slug', 'id'] as const;
type ThemeSort = (typeof SORT_FIELDS)[number];
const DEFAULT_SORT: ThemeSort = 'updated_at';
const DEFAULT_DIR: SortDir = 'desc';

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseSortParam(value: string | null): ThemeSort {
	const v = (value ?? '').trim().toLowerCase();
	if ((SORT_FIELDS as readonly string[]).includes(v)) return v as ThemeSort;
	return DEFAULT_SORT;
}

function parseDirParam(value: string | null): SortDir {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'asc' ? 'asc' : DEFAULT_DIR;
}

function formatIso(iso: string) {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
	} catch {
		return iso;
	}
}

function defaultVarsJson() {
	return JSON.stringify({}, null, 2);
}

function parseVarsJson(text: string): { vars: Record<string, string>; error: string | null } {
	const rawText = text.trim() || '{}';
	try {
		const raw = JSON.parse(rawText) as unknown;
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			return { vars: {}, error: 'Vars must be a JSON object like {"--primary":"#000"}.' };
		}

		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
			if (!k.startsWith('--')) return { vars: {}, error: `Invalid CSS variable key '${k}' (must start with --).` };
			if (typeof v !== 'string' || !v.trim()) return { vars: {}, error: `CSS variable '${k}' must be a non-empty string.` };
			out[k] = v.trim();
		}

		return { vars: out, error: null };
	} catch (e) {
		return { vars: {}, error: e instanceof Error ? e.message : String(e) };
	}
}

export default function AdminThemesPage() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;
	const urlSort = parseSortParam(searchParams.get('sort'));
	const urlDir = parseDirParam(searchParams.get('dir'));

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [sortInput, setSortInput] = useState<ThemeSort>(urlSort);
	const [dirInput, setDirInput] = useState<SortDir>(urlDir);

	const [q, setQ] = useState(urlQ);
	const [sort, setSort] = useState<ThemeSort>(urlSort);
	const [dir, setDir] = useState<SortDir>(urlDir);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setQInput(urlQ);
		setSort(urlSort);
		setDir(urlDir);
		setSortInput(urlSort);
		setDirInput(urlDir);
	}, [urlOffset, urlQ, urlSort, urlDir]);

	function updateUrl(next: { page?: number; q?: string; sort?: ThemeSort; dir?: SortDir }) {
		const sp = new URLSearchParams(searchParams.toString());
		const nextPage = next.page ?? Math.floor(offset / LIMIT) + 1;
		const nextQ = next.q ?? q;
		const nextSort = next.sort ?? sort;
		const nextDir = next.dir ?? dir;

		if (nextPage > 1) sp.set('page', String(nextPage));
		else sp.delete('page');
		if (nextQ) sp.set('q', nextQ);
		else sp.delete('q');
		if (nextSort !== DEFAULT_SORT) sp.set('sort', nextSort);
		else sp.delete('sort');
		if (nextDir !== DEFAULT_DIR) sp.set('dir', nextDir);
		else sp.delete('dir');

		const qs = sp.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname);
	}

	const listUrl = useMemo(() => {
		return buildAdminThemesListUrl({
			limit: LIMIT,
			offset,
			q,
			sort,
			dir,
		});
	}, [offset, q, sort, dir]);

	const { data, loading, error, reload, setData } = useApiList<ThemeListOut>(listUrl, {
		nextPath: '/admin/themes',
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<Theme | null>(null);
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [slug, setSlug] = useState('');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [varsText, setVarsText] = useState(defaultVarsJson());

	const [confirmDelete, setConfirmDelete] = useState<Theme | null>(null);

	function openCreate() {
		setEditing(null);
		setSlug('');
		setTitle('');
		setDescription('');
		setVarsText(defaultVarsJson());
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(t: Theme) {
		setEditing(t);
		setSlug(t.slug);
		setTitle(t.title);
		setDescription(t.description ?? '');
		setVarsText(JSON.stringify(t.vars ?? {}, null, 2));
		setFormError(null);
		setEditorOpen(true);
	}

	async function save() {
		setSaving(true);
		setFormError(null);
		try {
			const { vars, error } = parseVarsJson(varsText);
			if (error) throw new Error(error);

			const payload = {
				slug: slug.trim().toLowerCase(),
				title: title.trim(),
				description: description.trim() ? description.trim() : null,
				vars,
			};
			if (!payload.slug) throw new Error('Slug is required.');
			if (!payload.title) throw new Error('Title is required.');

			const out = editing
			? await updateAdminTheme(editing.id, payload, '/admin/themes')
			: await createAdminTheme(payload, '/admin/themes');

			setEditorOpen(false);
			setEditing(null);

			setData((prev) => {
				if (!prev) return prev;
				const nextItems = editing
					? prev.items.map((it) => (it.id === out.id ? out : it))
					: [out, ...prev.items];
				return { ...prev, items: nextItems };
			});
			void reload();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(t: Theme) {
		setSaving(true);
		setFormError(null);
		try {
			await deleteAdminTheme(t.id, '/admin/themes');
			setConfirmDelete(null);
			void reload();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}
	return (
		<AdminListPage
			title='Themes'
			description='Theme definitions (CSS variables) for public rendering.'
			total={total}
			offset={offset}
			limit={LIMIT}
			loading={loading}
			onPrev={() => {
				const next = Math.max(0, offset - LIMIT);
				setOffset(next);
				updateUrl({ page: Math.floor(next / LIMIT) + 1 });
			}}
			onNext={() => {
				const next = offset + LIMIT;
				setOffset(next);
				updateUrl({ page: Math.floor(next / LIMIT) + 1 });
			}}
			onSetOffset={(nextOffset) => {
				setOffset(nextOffset);
				updateUrl({ page: Math.floor(nextOffset / LIMIT) + 1 });
			}}
			actions={
				<Button onClick={openCreate}>
					<Plus className='h-4 w-4 mr-1' />
					New theme
				</Button>
			}
			filters={
				<div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
					<div className='space-y-2 md:col-span-2'>
						<Label>Search</Label>
						<Input
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search themes…'
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									setQ(qInput.trim());
									setOffset(0);
									updateUrl({ q: qInput.trim(), page: 1 });
								}
							}}
						/>
					</div>

					<div className='space-y-2'>
						<Label>Sort</Label>
						<Select
							value={sortInput}
							onValueChange={(v) => setSortInput(v as ThemeSort)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SORT_FIELDS.map((f) => (
									<SelectItem key={f} value={f}>
										{f}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className='space-y-2'>
						<Label>Dir</Label>
						<Select
							value={dirInput}
							onValueChange={(v) => setDirInput(v as SortDir)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='desc'>desc</SelectItem>
								<SelectItem value='asc'>asc</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className='md:col-span-4 flex flex-wrap gap-2'>
						<Button
							variant='outline'
							onClick={() => {
								setQ(qInput.trim());
								setSort(sortInput);
								setDir(dirInput);
								setOffset(0);
								updateUrl({ q: qInput.trim(), sort: sortInput, dir: dirInput, page: 1 });
							}}>
							Apply
						</Button>
						<Button
							variant='ghost'
							onClick={() => {
								setQInput('');
								setSortInput(DEFAULT_SORT);
								setDirInput(DEFAULT_DIR);
								setQ('');
								setSort(DEFAULT_SORT);
								setDir(DEFAULT_DIR);
								setOffset(0);
								updateUrl({ q: '', sort: DEFAULT_SORT, dir: DEFAULT_DIR, page: 1 });
							}}>
							Reset
						</Button>
					</div>
				</div>
			}>
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}

			<AdminDataTable
				rows={items}
				getRowKey={(t) => t.id}
				columns={[
					{
						header: 'Slug',
						cell: (t) => <code className='text-xs'>{t.slug}</code>,
					},
					{
						header: 'Title',
						cell: (t) => (
							<div className='space-y-1'>
								<div className='font-medium'>{t.title}</div>
								{t.description ? <div className='text-xs text-muted-foreground'>{t.description}</div> : null}
							</div>
						),
					},
					{
						header: 'Updated',
						cell: (t) => <span className='text-xs text-muted-foreground'>{formatIso(t.updated_at)}</span>,
						headerClassName: 'w-[220px]',
					},
					{
						header: '',
						cell: (t) => (
							<div className='flex items-center justify-end gap-2'>
								<Button variant='outline' size='sm' onClick={() => openEdit(t)}>
									Edit
								</Button>
								<Button variant='outline' size='icon' onClick={() => setConfirmDelete(t)}>
									<Trash2 className='h-4 w-4' />
									<span className='sr-only'>Delete</span>
								</Button>
							</div>
						),
						headerClassName: 'w-[140px]',
						cellClassName: 'text-right',
					},
				]}
			/>

			<Dialog open={editorOpen} onOpenChange={setEditorOpen}>
				<DialogContent className='sm:max-w-2xl'>
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit theme' : 'New theme'}</DialogTitle>
						<DialogDescription>Define CSS variables to inject into public pages.</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
							<div className='space-y-2'>
								<Label>Slug</Label>
								<Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={saving} placeholder='jeweler' />
							</div>
							<div className='space-y-2'>
								<Label>Title</Label>
								<Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} placeholder='Jeweler' />
							</div>
						</div>

						<div className='space-y-2'>
							<Label>Description</Label>
							<Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} placeholder='Optional…' />
						</div>

						<div className='space-y-2'>
							<Label>Vars (JSON)</Label>
							<Textarea value={varsText} onChange={(e) => setVarsText(e.target.value)} disabled={saving} rows={10} className='font-mono text-xs' />
							<p className='text-xs text-muted-foreground'>Example: <code>{'{\"--jeweler-gold\":\"#c8b79a\"}'}</code></p>
						</div>

						{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={() => setEditorOpen(false)} disabled={saving}>
							Cancel
						</Button>
						<Button onClick={save} disabled={saving || !slug.trim() || !title.trim()}>
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
						<AlertDialogTitle>Delete theme?</AlertDialogTitle>
						<AlertDialogDescription>
							This deletes <strong>{confirmDelete?.title}</strong>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={saving || !confirmDelete}
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









