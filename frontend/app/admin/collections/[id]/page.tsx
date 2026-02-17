'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import type { ContentField, ContentType } from '@/lib/types';
import { formatUiError } from '@/lib/error-message';
import {
	createAdminContentField,
	deleteAdminContentField,
	getAdminContentType,
	listAdminContentFields,
	updateAdminContentField,
} from '@/lib/api/content';

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
import { Checkbox } from '@/components/ui/checkbox';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'datetime', 'media', 'select'] as const;
type FieldType = (typeof FIELD_TYPES)[number];

function parseId(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
}

function slugify(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export default function AdminCollectionDetailPage() {
	const params = useParams();
	const typeId = parseId(params?.['id']);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [ct, setCt] = useState<ContentType | null>(null);
	const [fields, setFields] = useState<ContentField[]>([]);

	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<ContentField | null>(null);
	const [fieldSlug, setFieldSlug] = useState('');
	const [fieldLabel, setFieldLabel] = useState('');
	const [fieldType, setFieldType] = useState<FieldType>('string');
	const [fieldRequired, setFieldRequired] = useState(false);
	const [fieldOptionsRaw, setFieldOptionsRaw] = useState('{}');

	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<ContentField | null>(null);

	useEffect(() => {
		if (!typeId) {
			setLoading(false);
			setError('Invalid collection id.');
			return;
		}

		const currentTypeId = typeId;
		let canceled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const [typeOut, fieldsOut] = await Promise.all([
					getAdminContentType(currentTypeId, `/admin/collections/${currentTypeId}`),
					listAdminContentFields(currentTypeId, `/admin/collections/${currentTypeId}`),
				]);

				if (canceled) return;
				setCt(typeOut);
				setFields(fieldsOut.items ?? []);
			} catch (e) {
				if (canceled) return;
				setError(toErrorMessage(e));
			} finally {
				if (!canceled) setLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [typeId]);

	function openCreate() {
		setEditing(null);
		setFieldSlug('');
		setFieldLabel('');
		setFieldType('string');
		setFieldRequired(false);
		setFieldOptionsRaw('{}');
		setFormError(null);
		setEditorOpen(true);
	}

	function openEdit(f: ContentField) {
		setEditing(f);
		setFieldSlug(f.slug);
		setFieldLabel(f.label);
		setFieldType((FIELD_TYPES as readonly string[]).includes(f.field_type) ? (f.field_type as FieldType) : 'string');
		setFieldRequired(!!f.required);
		setFieldOptionsRaw(JSON.stringify(f.options ?? {}, null, 2));
		setFormError(null);
		setEditorOpen(true);
	}

	const entriesHref = useMemo(() => {
		if (!ct?.slug) return '/admin/entries';
		const params = new URLSearchParams();
		params.set('type', ct.slug);
		return `/admin/entries?${params.toString()}`;
	}, [ct?.slug]);

	async function save() {
		if (!typeId) return;
		setSaving(true);
		setFormError(null);

		let options: Record<string, unknown> = {};
		try {
			const raw = fieldOptionsRaw.trim();
			if (raw) options = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			setSaving(false);
			setFormError('Options must be valid JSON.');
			return;
		}

		const payload = {
			slug: (fieldSlug.trim() || slugify(fieldLabel)).trim(),
			label: fieldLabel.trim(),
			field_type: fieldType,
			required: fieldRequired,
			options,
		};

		try {
			if (editing) {
				const out = await updateAdminContentField(typeId, editing.id, payload, `/admin/collections/${typeId}`);
				setFields((prev) => prev.map((f) => (f.id === out.id ? out : f)));
			} else {
				const out = await createAdminContentField(typeId, payload, `/admin/collections/${typeId}`);
				setFields((prev) => [...prev, out]);
			}

			setEditorOpen(false);
			setEditing(null);
		} catch (e) {
			setFormError(toErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	async function doDelete(f: ContentField) {
		if (!typeId) return;
		setSaving(true);
		setFormError(null);
		try {
			await deleteAdminContentField(typeId, f.id, `/admin/collections/${typeId}`);
			setFields((prev) => prev.filter((x) => x.id !== f.id));
			setConfirmDelete(null);
		} catch (e) {
			setFormError(toErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className='p-6 space-y-6'>
			<div className='flex items-start justify-between gap-4'>
				<div className='space-y-1 min-w-0'>
					<div className='flex items-center gap-2'>
						<Button
							asChild
							variant='outline'
							size='sm'>
							<Link href='/admin/collections'>Back</Link>
						</Button>
						{ct ? <Badge variant='secondary'>/{ct.slug}</Badge> : null}
					</div>
					<h1 className='text-2xl font-semibold truncate'>Collection</h1>
					<p className='text-sm text-muted-foreground'>
						Define fields for validation and consistent rendering.
					</p>
				</div>

				<div className='flex items-center gap-2'>
					<Button
						asChild
						variant='outline'>
						<Link href={entriesHref}>Entries</Link>
					</Button>
					<Button onClick={openCreate} disabled={!ct || loading}>
						Add field
					</Button>
				</div>
			</div>

			{loading ? <p className='text-sm text-muted-foreground'>Loading…</p> : null}
			{error ? <p className='text-sm text-red-600'>{error}</p> : null}
			{formError ? <p className='text-sm text-red-600'>{formError}</p> : null}

			{ct ? (
				<div className='rounded-xl border p-4 space-y-2'>
					<div className='text-sm'>
						<div className='font-medium'>{ct.title}</div>
						{ct.description ? (
							<div className='text-sm text-muted-foreground'>{ct.description}</div>
						) : null}
					</div>
				</div>
			) : null}

			<div className='rounded-xl border overflow-hidden'>
				<div className='flex items-center justify-between gap-3 border-b p-4'>
					<div className='text-sm font-medium'>Fields</div>
					<div className='text-xs text-muted-foreground'>
						{fields.length} total
					</div>
				</div>
				<div className='divide-y'>
					{fields.length === 0 ? (
						<div className='p-6 text-sm text-muted-foreground'>
							No fields yet. Entries will accept any JSON <code>data</code> until you add fields.
						</div>
					) : (
						fields
							.slice()
							.sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id))
							.map((f) => (
								<div
									key={f.id}
									className='p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
									<div className='min-w-0'>
										<div className='flex items-center gap-2'>
											<div className='font-medium truncate'>{f.label}</div>
											{f.required ? <Badge variant='outline'>required</Badge> : null}
										</div>
										<div className='text-xs text-muted-foreground truncate'>
											<code>{f.slug}</code>
											<span className='mx-2'>·</span>
											{f.field_type}
											<span className='mx-2'>·</span>
											order {f.order_index}
										</div>
									</div>

									<div className='flex items-center gap-2 justify-end'>
										<Button
											variant='outline'
											size='sm'
											onClick={() => openEdit(f)}>
											Edit
										</Button>
										<Button
											variant='destructive'
											size='sm'
											onClick={() => setConfirmDelete(f)}>
											Delete
										</Button>
									</div>
								</div>
							))
					)}
				</div>
			</div>

			<Dialog
				open={editorOpen}
				onOpenChange={(open) => {
					setEditorOpen(open);
					if (!open) setEditing(null);
				}}>
				<DialogContent className='sm:max-w-2xl'>
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit field' : 'New field'}</DialogTitle>
						<DialogDescription>
							Fields validate entry <code>data</code> for this collection.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<Label>Label</Label>
								<Input
									value={fieldLabel}
									onChange={(e) => {
										const nextLabel = e.target.value;
										setFieldLabel(nextLabel);
										if (!editing && !fieldSlug.trim()) setFieldSlug(slugify(nextLabel));
									}}
									disabled={saving}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Slug</Label>
								<Input
									value={fieldSlug}
									onChange={(e) => setFieldSlug(e.target.value)}
									placeholder='e.g. price'
									disabled={saving}
								/>
							</div>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4 items-end'>
							<div className='space-y-2'>
								<Label>Type</Label>
								<Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{FIELD_TYPES.map((t) => (
											<SelectItem key={t} value={t}>
												{t}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className='flex items-center gap-2'>
								<Checkbox
									checked={fieldRequired}
									onCheckedChange={(v) => setFieldRequired(Boolean(v))}
									disabled={saving}
								/>
								<span className='text-sm'>Required</span>
							</div>
						</div>

						<Separator />

						<div className='space-y-2'>
							<Label>Options (JSON)</Label>
							<Textarea
								value={fieldOptionsRaw}
								onChange={(e) => setFieldOptionsRaw(e.target.value)}
								className='font-mono text-xs min-h-[160px]'
								disabled={saving}
							/>
							<p className='text-xs text-muted-foreground'>
								For <code>select</code>: use <code>{"{\"options\":[\"Gold\",\"Silver\"]}"}</code>.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setEditorOpen(false)}
							disabled={saving}>
							Cancel
						</Button>
						<Button
							onClick={() => void save()}
							disabled={saving || !fieldLabel.trim()}>
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
						<AlertDialogTitle>Delete field?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes <strong>{confirmDelete?.label}</strong> from the schema. Existing entry data is not modified.
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
		</div>
	);
}
