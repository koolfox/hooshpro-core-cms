'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/http';
import { isRecord } from '@/lib/page-builder';
import { shadcnComponentMeta } from '@/lib/shadcn-meta';
import type { ComponentDef, ComponentListOut } from '@/lib/types';

import { ComponentDataEditor } from '@/components/components/component-data-editor';
import { ComponentPreview } from '@/components/components/component-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export type ComponentPickerItem = ComponentDef;

function deepClone<T>(value: T): T {
	const sc = (globalThis as unknown as { structuredClone?: (v: unknown) => unknown }).structuredClone;
	if (typeof sc === 'function') {
		try {
			return sc(value) as T;
		} catch {
			// fall through
		}
	}
	return JSON.parse(JSON.stringify(value)) as T;
}

function nextVariantSlug(base: string, existingSlugs: Set<string>): string {
	const normalized = base.trim().toLowerCase();
	const baseSlug = normalized.endsWith('-variant') ? normalized : `${normalized}-variant`;

	if (!existingSlugs.has(baseSlug)) return baseSlug;

	for (let i = 2; i < 1000; i++) {
		const candidate = `${baseSlug}-${i}`;
		if (!existingSlugs.has(candidate)) return candidate;
	}

	return `${baseSlug}-${Math.floor(Math.random() * 100000)}`;
}

export function BlockPickerDialog({
	open,
	onOpenChange,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (component: ComponentPickerItem) => void;
}) {
	const [q, setQ] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [components, setComponents] = useState<ComponentPickerItem[]>([]);
	const [step, setStep] = useState<'list' | 'configure'>('list');
	const [selected, setSelected] = useState<ComponentPickerItem | null>(null);
	const [draftData, setDraftData] = useState<unknown>({});

	const [presetTitle, setPresetTitle] = useState('');
	const [presetSlug, setPresetSlug] = useState('');
	const [presetSaving, setPresetSaving] = useState(false);
	const [presetError, setPresetError] = useState<string | null>(null);
	const [presetSavedId, setPresetSavedId] = useState<number | null>(null);

	useEffect(() => {
		if (!open) return;

		let canceled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const res = await apiFetch<ComponentListOut>(
					`/api/admin/components?limit=200&offset=0`,
					{ cache: 'no-store', nextPath: window.location.pathname }
				);
				if (canceled) return;
				setComponents(res.items ?? []);
			} catch (e) {
				if (canceled) return;
				setError(e instanceof Error ? e.message : String(e));
				setComponents([]);
			} finally {
				if (!canceled) setLoading(false);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [open]);

	useEffect(() => {
		if (open) return;
		setQ('');
		setStep('list');
		setSelected(null);
		setDraftData({});
		setPresetTitle('');
		setPresetSlug('');
		setPresetSaving(false);
		setPresetError(null);
		setPresetSavedId(null);
	}, [open]);

	const existingSlugs = useMemo(() => {
		const out = new Set<string>();
		for (const c of components) out.add((c.slug || '').trim().toLowerCase());
		return out;
	}, [components]);

	const items = useMemo(() => {
		const query = q.trim().toLowerCase();
		if (!query) return components;
		return components.filter((c) => {
			const title = c.title.toLowerCase();
			const slug = c.slug.toLowerCase();
			const type = (c.type || '').toLowerCase();
			return title.includes(query) || slug.includes(query) || type.includes(query);
		});
	}, [q, components]);

	function beginConfigure(c: ComponentPickerItem) {
		setSelected(c);
		setDraftData(deepClone(c.data ?? {}));
		setPresetTitle(`${c.title} (variant)`);
		setPresetSlug(nextVariantSlug(c.slug, existingSlugs));
		setPresetError(null);
		setPresetSavedId(null);
		setStep('configure');
	}

	async function savePreset() {
		if (!selected) return;
		const title = presetTitle.trim();
		const slug = presetSlug.trim().toLowerCase();
		if (!title || !slug) {
			setPresetError('Title and slug are required.');
			return;
		}

		setPresetSaving(true);
		setPresetError(null);

		try {
			const out = await apiFetch<ComponentDef>(`/api/admin/components`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					title,
					slug,
					type: selected.type,
					data: draftData ?? {},
				}),
				cache: 'no-store',
				nextPath: window.location.pathname,
			});

			setComponents((prev) => [out, ...prev]);
			setPresetSavedId(out.id);
			setPresetError(null);
		} catch (e) {
			setPresetSavedId(null);
			setPresetError(e instanceof Error ? e.message : String(e));
		} finally {
			setPresetSaving(false);
		}
	}

	function insertConfigured() {
		if (!selected) return;
		onPick({ ...selected, data: draftData });
		onOpenChange(false);
		setStep('list');
		setSelected(null);
		setDraftData({});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className={step === 'configure' ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}>
				<DialogHeader>
					{step === 'configure' && selected ? (
						<>
							<DialogTitle>Configure component</DialogTitle>
							<DialogDescription>
								Customize <strong>{selected.title}</strong> before inserting.
							</DialogDescription>
						</>
					) : (
						<>
							<DialogTitle>Add a component</DialogTitle>
							<DialogDescription>
								Choose a component preset to insert into this column.
							</DialogDescription>
						</>
					)}
				</DialogHeader>

				{step === 'list' ? (
					<Input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder='Search components…'
					/>
				) : null}

				{step === 'configure' && selected ? (
					<div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
						<div className='space-y-3'>
							<ComponentDataEditor
								type={selected.type}
								value={draftData}
								onChange={setDraftData}
							/>

							<details className='rounded-lg border bg-muted/10 p-3'>
								<summary className='text-sm font-medium cursor-pointer select-none'>
									Save as preset (variant)
								</summary>
								<div className='mt-3 space-y-3'>
									<p className='text-xs text-muted-foreground'>
										Save this configured instance into the component library for reuse.
									</p>

									<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
										<div className='space-y-2'>
											<Label>Title</Label>
											<Input
												value={presetTitle}
												onChange={(e) => setPresetTitle(e.target.value)}
												disabled={presetSaving}
											/>
										</div>
										<div className='space-y-2'>
											<Label>Slug</Label>
											<Input
												value={presetSlug}
												onChange={(e) => setPresetSlug(e.target.value)}
												disabled={presetSaving}
											/>
										</div>
									</div>

									{presetError ? <p className='text-xs text-red-600'>{presetError}</p> : null}
									{presetSavedId ? (
										<p className='text-xs text-emerald-600'>
											Saved. You can find it in the Components library.
										</p>
									) : null}

									<div className='flex items-center justify-end gap-2'>
										<Button
											type='button'
											variant='outline'
											size='sm'
											onClick={savePreset}
											disabled={presetSaving || !presetTitle.trim() || !presetSlug.trim()}>
											{presetSaving ? 'Saving…' : 'Save preset'}
										</Button>
									</div>
								</div>
							</details>
						</div>
						<div className='space-y-2'>
							<div className='text-sm font-medium'>Preview</div>
							<div className='rounded-xl border bg-muted/10 p-3'>
								<ComponentPreview
									component={{
										title: selected.title,
										type: selected.type,
										data: draftData,
									}}
									className='max-w-none'
								/>
							</div>
							<p className='text-xs text-muted-foreground'>
								Preview updates as you change props.
							</p>

							<Separator />

							<div className='text-xs text-muted-foreground'>
								Tip: use <strong>Save as preset</strong> to create reusable variants (Figma-like).
							</div>
						</div>
					</div>
				) : (
					<div className='max-h-[60vh] overflow-auto pr-1'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
							{loading ? (
								<div className='text-sm text-muted-foreground'>
									Loading…
								</div>
							) : error ? (
								<div className='text-sm text-red-600'>{error}</div>
							) : items.length > 0 ? (
								items.map((c) => (
									(() => {
										const shadcnSlug =
											c.type === 'shadcn' &&
											isRecord(c.data) &&
											typeof c.data['component'] === 'string'
												? c.data['component'].trim().toLowerCase()
												: null;
										const shadcnMeta = shadcnComponentMeta(shadcnSlug);

										return (
									<div
										key={c.id}
										className='rounded-md border bg-card p-3 space-y-3'>
										<div className='flex items-start justify-between gap-3'>
											<div className='min-w-0 space-y-1'>
												<div className='font-medium truncate'>{c.title}</div>
												<div className='text-xs text-muted-foreground truncate'>
													/{c.slug} ·{' '}
													{c.type === 'shadcn' && shadcnSlug
														? `shadcn/${shadcnSlug}`
														: c.type}
												</div>
												{shadcnMeta ? (
													<div className='flex items-center gap-2 pt-1'>
														<Badge variant='outline'>{shadcnMeta.kind}</Badge>
														{shadcnMeta.canWrapChildren ? (
															<span className='text-xs text-muted-foreground'>
																structural wrapper
															</span>
														) : null}
													</div>
												) : null}
											</div>

											<Button
												type='button'
												variant='outline'
												size='sm'
												onClick={() => beginConfigure(c)}>
												Configure
											</Button>
										</div>

										<div className='p-3'>
											<ComponentPreview
												component={{
													title: c.title,
													type: c.type,
													data: c.data,
												}}
												className='max-w-none'
												/>
										</div>
									</div>
										);
									})()
								))
							) : (
								<div className='text-sm text-muted-foreground'>
									No components found.
								</div>
							)}
						</div>
					</div>
				)}

				<div className='flex items-center justify-end gap-2 pt-2'>
					{step === 'configure' ? (
						<>
							<Button type='button' variant='outline' onClick={() => setStep('list')}>
								Back
							</Button>
							<Button type='button' onClick={insertConfigured}>
								Insert
							</Button>
						</>
					) : (
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
							Close
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
