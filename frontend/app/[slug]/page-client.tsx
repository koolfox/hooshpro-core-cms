'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Page } from '@/lib/types';
import { apiFetch } from '@/lib/http';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

import { TipTapEditor } from '@/components/tiptap-editor';

type TipTapValue = { doc: any; html: string };

function pickTipTapValue(blocks: any): TipTapValue {
	// expected:
	// { version: 2, blocks: [ { type: "tiptap", data: { doc, html } } ] }
	const b = blocks?.blocks?.find((x: any) => x?.type === 'tiptap');
	const data = b?.data ?? null;

	if (data?.doc && typeof data?.html === 'string') {
		return { doc: data.doc, html: data.html };
	}

	// fallback: create from old paragraph body
	return {
		doc: {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: '' }],
				},
			],
		},
		html: '',
	};
}

function blocksWithTipTap(value: TipTapValue) {
	return {
		version: 2,
		blocks: [
			{
				type: 'tiptap',
				data: {
					doc: value.doc,
					html: value.html,
				},
			},
		],
	};
}

function extractHtml(blocks: any): string {
	const b = blocks?.blocks?.find((x: any) => x?.type === 'tiptap');
	const html = b?.data?.html;
	if (typeof html === 'string') return html;

	// legacy paragraph fallback
	const p = blocks?.blocks?.find((x: any) => x?.type === 'paragraph');
	const text = p?.data?.text ?? '';
	return text ? `<p>${String(text)}</p>` : '';
}

export function PublicPageClient({
	initialPage,
	isAdmin,
	defaultEdit,
}: {
	initialPage: Page;
	isAdmin: boolean;
	defaultEdit: boolean;
}) {
	const router = useRouter();

	const [page, setPage] = useState<Page>(initialPage);

	// view/edit
	const [editMode, setEditMode] = useState<boolean>(isAdmin && defaultEdit);

	// settings modal
	const [settingsOpen, setSettingsOpen] = useState(false);

	// editable fields
	const [title, setTitle] = useState(page.title);
	const [seoTitle, setSeoTitle] = useState(page.seo_title ?? '');
	const [seoDesc, setSeoDesc] = useState(page.seo_description ?? '');
	const [status, setStatus] = useState<'draft' | 'published'>(page.status);

	const initialTipTap = useMemo(() => pickTipTapValue(page.blocks), []);
	const [rt, setRt] = useState<TipTapValue>(initialTipTap);

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const html = useMemo(() => extractHtml(page.blocks), [page.blocks]);

	const dirty = useMemo(() => {
		const blocksNow = JSON.stringify(page.blocks);
		const blocksNext = JSON.stringify(blocksWithTipTap(rt));
		if (blocksNow !== blocksNext) return true;

		if (title !== page.title) return true;
		if ((seoTitle || null) !== (page.seo_title ?? null)) return true;
		if ((seoDesc || null) !== (page.seo_description ?? null)) return true;
		if (status !== page.status) return true;

		return false;
	}, [page, rt, title, seoTitle, seoDesc, status]);

	async function save(nextStatus?: 'draft' | 'published') {
		if (!isAdmin) return;

		setSaving(true);
		setError(null);

		const payload: any = {
			title: title.trim(),
			status: nextStatus ?? status,
			seo_title: seoTitle.trim() ? seoTitle.trim() : null,
			seo_description: seoDesc.trim() ? seoDesc.trim() : null,
			blocks: blocksWithTipTap(rt),
		};

		try {
			const updated = await apiFetch<Page>(
				`/api/admin/pages/by-slug/${page.slug}`,
				{
					// first resolve id (backend endpoint returns full PageOut)
					cache: 'no-store',
					nextPath: `/${page.slug}?edit=1`,
				}
			);

			const out = await apiFetch<Page>(`/api/admin/pages/${updated.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
				nextPath: `/${page.slug}?edit=1`,
			});

			setPage(out);
			setStatus(out.status);
		} catch (e: any) {
			setError(String(e?.message ?? e));
		} finally {
			setSaving(false);
		}
	}

	async function toggleStatus() {
		if (status === 'draft') {
			await save('published');
			setStatus('published');
		} else {
			await save('draft');
			setStatus('draft');
		}
	}

	function enterEdit() {
		if (!isAdmin) return;
		setEditMode(true);
		router.replace(`/${page.slug}?edit=1`);
	}

	function exitEdit() {
		setEditMode(false);
		router.replace(`/${page.slug}`);
	}

	return (
		<main className='max-w-4xl mx-auto p-6 space-y-6'>
			{/* Admin top bar */}
			{isAdmin ? (
				<div className='rounded-xl border p-3 flex items-center justify-between gap-3'>
					<div className='flex items-center gap-2'>
						<Badge
							variant={
								status === 'published' ? 'default' : 'secondary'
							}>
							{status}
						</Badge>
						<span className='text-xs text-muted-foreground'>
							Slug: /{page.slug}
						</span>
					</div>

					<div className='flex items-center gap-2'>
						<Button
							variant='outline'
							onClick={() => setSettingsOpen(true)}
							disabled={saving}>
							Settings
						</Button>

						{editMode ? (
							<Button
								variant='outline'
								onClick={exitEdit}
								disabled={saving}>
								Preview
							</Button>
						) : (
							<Button
								variant='outline'
								onClick={enterEdit}>
								Edit
							</Button>
						)}

						<Button
							variant='outline'
							onClick={toggleStatus}
							disabled={saving}>
							{status === 'published' ? 'Unpublish' : 'Publish'}
						</Button>

						<Button
							onClick={() => save()}
							disabled={saving || !dirty}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</div>
				</div>
			) : null}

			{/* Title */}
			{editMode ? (
				<div className='space-y-2'>
					<Label>Title</Label>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder='Page title'
						disabled={saving}
					/>
				</div>
			) : (
				<h1 className='text-4xl font-bold tracking-tight'>
					{page.title}
				</h1>
			)}

			<Separator />

			{/* Body */}
			{editMode ? (
				<div className='space-y-2'>
					<Label>Content</Label>
					<TipTapEditor
						value={rt}
						onChange={setRt}
						disabled={saving}
					/>
					{error ? (
						<p className='text-sm text-red-600'>{error}</p>
					) : null}
				</div>
			) : (
				<div
					className='prose prose-neutral dark:prose-invert max-w-none'
					dangerouslySetInnerHTML={{ __html: html || '<p></p>' }}
				/>
			)}

			{/* Settings dialog */}
			<Dialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}>
				<DialogContent className='sm:max-w-xl'>
					<DialogHeader>
						<DialogTitle>Page settings</DialogTitle>
						<DialogDescription>
							SEO + status controls (MVP).
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label>SEO Title</Label>
							<Input
								value={seoTitle}
								onChange={(e) => setSeoTitle(e.target.value)}
								disabled={saving}
							/>
						</div>

						<div className='space-y-2'>
							<Label>SEO Description</Label>
							<Input
								value={seoDesc}
								onChange={(e) => setSeoDesc(e.target.value)}
								disabled={saving}
							/>
						</div>
					</div>

					{error ? (
						<p className='text-sm text-red-600'>{error}</p>
					) : null}

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setSettingsOpen(false)}
							disabled={saving}>
							Close
						</Button>
						<Button
							onClick={() => save()}
							disabled={saving || !dirty}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
