'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';

import { useShadcnVariants } from '@/hooks/use-shadcn-variants';
import { isRecord } from '@/lib/page-builder';
import { shadcnComponentMeta } from '@/lib/shadcn-meta';
import { getShadcnQuickPropsSpec, shadcnQuickPropKeys } from '@/lib/shadcn-specs';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function toKebabCase(input: string): string {
	return input
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[\s_]+/g, '-')
		.replace(/-+/g, '-')
		.toLowerCase();
}

function toPascalCase(input: string): string {
	const clean = toKebabCase(input);
	return clean
		.split('-')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

function stableJson(value: unknown): string {
	try {
		return JSON.stringify(value ?? {}, null, 2);
	} catch {
		return '{}';
	}
}

function normalizeShadcnData(data: unknown): { component: string; props: Record<string, unknown> } {
	const d = isRecord(data) ? (data as Record<string, unknown>) : {};
	const componentRaw = typeof d['component'] === 'string' ? String(d['component']) : '';
	const component = componentRaw.trim().toLowerCase();

	const explicitProps = isRecord(d['props']) ? (d['props'] as Record<string, unknown>) : null;
	if (explicitProps) return { component, props: { ...explicitProps } };

	// Back-compat: allow flat props on the data object.
	const props: Record<string, unknown> = { ...d };
	delete props['component'];
	delete props['props'];
	return { component, props };
}

function stringifyJsxPropValue(value: unknown): string {
	if (typeof value === 'string') return `"${value.replaceAll('"', '\\"')}"`;
	if (typeof value === 'number') return `{${Number.isFinite(value) ? value : 0}}`;
	if (typeof value === 'boolean') return value ? '{true}' : '{false}';
	if (value === null) return '{null}';
	if (value === undefined) return '{undefined}';
	try {
		return `{${JSON.stringify(value)}}`;
	} catch {
		return '{undefined}';
	}
}

function propsToJsxAttrs(props: Record<string, unknown>): string {
	const parts = Object.entries(props)
		.filter(([key, v]) => key !== 'children' && v !== undefined)
		.map(([key, v]) => ` ${key}=${stringifyJsxPropValue(v)}`);
	return parts.join('');
}

function shadcnJsxSnippet(args: { slug: string; componentName: string; props: Record<string, unknown> }): string {
	const importName = args.componentName || 'Component';
	const importPath = `@/components/ui/${args.slug}`;
	const attrs = propsToJsxAttrs(args.props);
	return `import { ${importName} } from "${importPath}"\n\n<${importName}${attrs} />\n`;
}

export function ComponentDataEditor({
	type,
	value,
	onChange,
	disabled,
	className,
}: {
	type: string;
	value: unknown;
	onChange: (next: unknown) => void;
	disabled?: boolean;
	className?: string;
}) {
	const normalizedType = (type || '').trim().toLowerCase();
	const base = useMemo(() => (isRecord(value) ? (value as Record<string, unknown>) : {}), [value]);

	const shadcnNormalized = useMemo(() => normalizeShadcnData(value), [value]);
	const shadcnSlug = normalizedType === 'shadcn' ? shadcnNormalized.component || null : null;
	const shadcnVariants = useShadcnVariants(shadcnSlug);
	const shadcnMeta = shadcnComponentMeta(shadcnSlug);
	const shadcnQuickSpec = useMemo(() => getShadcnQuickPropsSpec(shadcnSlug), [shadcnSlug]);
	const shadcnQuickKeys = useMemo(
		() => (shadcnQuickSpec ? shadcnQuickPropKeys(shadcnQuickSpec) : new Set<string>()),
		[shadcnQuickSpec]
	);

	const shadcnPrimaryExport = useMemo(() => {
		if (!shadcnSlug) return null;
		const expected = toPascalCase(shadcnSlug);
		if (shadcnVariants.exports.includes(expected)) return expected;
		const first = shadcnVariants.exports[0];
		return first || expected;
	}, [shadcnSlug, shadcnVariants.exports]);

	const [propsJson, setPropsJson] = useState(() => stableJson(shadcnNormalized.props));
	const [propsJsonError, setPropsJsonError] = useState<string | null>(null);
	const [framePropsJson, setFramePropsJson] = useState(() =>
		stableJson(isRecord(base['props']) ? (base['props'] as Record<string, unknown>) : {})
	);
	const [framePropsError, setFramePropsError] = useState<string | null>(null);
	const [rawJson, setRawJson] = useState(() => stableJson(base));
	const [rawError, setRawError] = useState<string | null>(null);

	useEffect(() => {
		if (normalizedType !== 'shadcn') return;
		setPropsJson(stableJson(shadcnNormalized.props));
		setPropsJsonError(null);
		// Only resync when the selected component slug changes; keep the user's in-progress JSON edits.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [normalizedType, shadcnSlug]);

	useEffect(() => {
		if (normalizedType !== 'frame') return;
		const props = isRecord(base['props']) ? (base['props'] as Record<string, unknown>) : {};
		setFramePropsJson(stableJson(props));
		setFramePropsError(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [normalizedType, base['layout']]);

	useEffect(() => {
		// Keep the raw editor in sync when switching component types.
		setRawJson(stableJson(base));
		setRawError(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [normalizedType]);

	const jsxSnippet = useMemo(() => {
		if (normalizedType === 'shadcn') {
			const slug = shadcnSlug || 'component';
			const componentName = shadcnPrimaryExport || 'Component';
			return shadcnJsxSnippet({ slug, componentName, props: shadcnNormalized.props });
		}

		if (normalizedType === 'button') {
			const label = typeof base['label'] === 'string' ? base['label'] : 'Button';
			const href = typeof base['href'] === 'string' ? base['href'] : '';
			const variant = typeof base['variant'] === 'string' ? base['variant'] : undefined;
			const attrs = propsToJsxAttrs({ variant, asChild: !!href.trim() });
			return `import { Button } from "@/components/ui/button"\n\n<Button${attrs}>${label}</Button>\n`;
		}

		if (normalizedType === 'image') {
			const url = typeof base['url'] === 'string' ? base['url'] : '';
			const alt = typeof base['alt'] === 'string' ? base['alt'] : '';
			return `import Image from "next/image"\n\n<Image src="${url}" alt="${alt}" width={1200} height={800} />\n`;
		}

		return '';
	}, [normalizedType, base, shadcnSlug, shadcnPrimaryExport, shadcnNormalized.props]);

	const onCopyJsx = async () => {
		if (!jsxSnippet.trim()) return;
		try {
			await navigator.clipboard.writeText(jsxSnippet);
		} catch {
			// ignore
		}
	};

	if (normalizedType === 'editor') {
		return (
			<div className={cn('space-y-2', className)}>
				<p className='text-sm text-muted-foreground'>
					Text content is edited directly on the canvas via TipTap.
				</p>
			</div>
		);
	}

	if (normalizedType === 'separator') {
		return (
			<div className={cn('space-y-2', className)}>
				<p className='text-sm text-muted-foreground'>No settings.</p>
			</div>
		);
	}

	if (normalizedType === 'button') {
		const label = typeof base['label'] === 'string' ? base['label'] : 'Button';
		const href = typeof base['href'] === 'string' ? base['href'] : '';
		const variant = typeof base['variant'] === 'string' ? base['variant'] : 'default';

		return (
			<div className={cn('space-y-4', className)}>
				<div className='grid grid-cols-2 gap-3'>
					<div className='space-y-2'>
						<Label>Label</Label>
						<Input
							value={label}
							onChange={(e) => onChange({ ...base, label: e.target.value })}
							disabled={disabled}
						/>
					</div>
					<div className='space-y-2'>
						<Label>Href</Label>
						<Input
							value={href}
							onChange={(e) => onChange({ ...base, href: e.target.value })}
							disabled={disabled}
						/>
					</div>
				</div>

				<div className='space-y-2'>
					<Label>Variant</Label>
					<Select
						value={variant}
						onValueChange={(v) => onChange({ ...base, variant: v })}
						disabled={disabled}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='default'>default</SelectItem>
							<SelectItem value='secondary'>secondary</SelectItem>
							<SelectItem value='outline'>outline</SelectItem>
							<SelectItem value='ghost'>ghost</SelectItem>
							<SelectItem value='destructive'>destructive</SelectItem>
							<SelectItem value='link'>link</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{jsxSnippet.trim() ? (
					<div className='space-y-2'>
						<div className='flex items-center justify-between gap-2'>
							<Label>JSX</Label>
							<Button type='button' size='sm' variant='outline' onClick={onCopyJsx} disabled={disabled}>
								<Copy className='h-4 w-4 mr-1' />
								Copy
							</Button>
						</div>
						<Textarea value={jsxSnippet} readOnly className='font-mono text-xs' rows={6} />
					</div>
				) : null}
			</div>
		);
	}

	if (normalizedType === 'card') {
		const title = typeof base['title'] === 'string' ? base['title'] : 'Card';
		const body = typeof base['body'] === 'string' ? base['body'] : '';

		return (
			<div className={cn('space-y-4', className)}>
				<div className='space-y-2'>
					<Label>Title</Label>
					<Input value={title} onChange={(e) => onChange({ ...base, title: e.target.value })} disabled={disabled} />
				</div>
				<div className='space-y-2'>
					<Label>Body</Label>
					<Textarea
						value={body}
						onChange={(e) => onChange({ ...base, body: e.target.value })}
						disabled={disabled}
						rows={5}
					/>
				</div>
			</div>
		);
	}

	if (normalizedType === 'image') {
		const url = typeof base['url'] === 'string' ? base['url'] : '';
		const alt = typeof base['alt'] === 'string' ? base['alt'] : '';

		return (
			<div className={cn('space-y-4', className)}>
				<div className='space-y-2'>
					<Label>Image URL</Label>
					<Input value={url} onChange={(e) => onChange({ ...base, url: e.target.value })} disabled={disabled} />
				</div>
				<div className='space-y-2'>
					<Label>Alt text</Label>
					<Input value={alt} onChange={(e) => onChange({ ...base, alt: e.target.value })} disabled={disabled} />
				</div>
			</div>
		);
	}

	if (normalizedType === 'menu') {
		const menu = typeof base['menu'] === 'string' ? base['menu'] : 'main';
		const kind = typeof base['kind'] === 'string' ? base['kind'] : 'top';

		return (
			<div className={cn('space-y-4', className)}>
				<div className='grid grid-cols-2 gap-3'>
					<div className='space-y-2'>
						<Label>Menu slug</Label>
						<Input value={menu} onChange={(e) => onChange({ ...base, menu: e.target.value })} disabled={disabled} />
					</div>
					<div className='space-y-2'>
						<Label>Kind</Label>
						<Select value={kind} onValueChange={(v) => onChange({ ...base, kind: v })} disabled={disabled}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='top'>top</SelectItem>
								<SelectItem value='footer'>footer</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		);
	}

	if (normalizedType === 'slot') {
		const name = typeof base['name'] === 'string' ? base['name'] : '';
		return (
			<div className={cn('space-y-4', className)}>
				<div className='space-y-2'>
					<Label>Slot name</Label>
					<Input value={name} onChange={(e) => onChange({ ...base, name: e.target.value })} disabled={disabled} />
				</div>
			</div>
		);
	}

	if (normalizedType === 'frame') {
		const label = typeof base['label'] === 'string' ? base['label'] : '';
		const classNameValue = typeof base['className'] === 'string' ? base['className'] : '';
		const paddingPx = typeof base['paddingPx'] === 'number' ? Math.max(0, Math.round(base['paddingPx'] as number)) : 24;
		const clip = base['clip'] === true;
		const layoutRaw = typeof base['layout'] === 'string' ? base['layout'] : 'section';
		const layout =
			layoutRaw === 'box' || layoutRaw === 'flex' || layoutRaw === 'grid' || layoutRaw === 'container' || layoutRaw === 'section'
				? layoutRaw
				: 'section';

		return (
			<div className={cn('space-y-4', className)}>
				<div className='grid grid-cols-2 gap-3'>
					<div className='space-y-2'>
						<Label>Label</Label>
						<Input value={label} onChange={(e) => onChange({ ...base, label: e.target.value })} disabled={disabled} />
					</div>
					<div className='space-y-2'>
						<Label>Layout</Label>
						<Select value={layout} onValueChange={(v) => onChange({ ...base, layout: v })} disabled={disabled}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='box'>box</SelectItem>
								<SelectItem value='flex'>flex</SelectItem>
								<SelectItem value='grid'>grid</SelectItem>
								<SelectItem value='container'>container</SelectItem>
								<SelectItem value='section'>section</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='space-y-2'>
						<Label>Padding (px)</Label>
						<Input
							type='number'
							value={paddingPx}
							onChange={(e) => onChange({ ...base, paddingPx: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
							disabled={disabled}
						/>
					</div>
					<div className='space-y-2'>
						<Label>ClassName</Label>
						<Input value={classNameValue} onChange={(e) => onChange({ ...base, className: e.target.value })} disabled={disabled} />
					</div>
				</div>

				<div className='flex items-center gap-2'>
					<Checkbox
						id='frame-clip'
						checked={clip}
						onCheckedChange={(checked) => onChange({ ...base, clip: checked === true ? true : undefined })}
						disabled={disabled}
					/>
					<Label htmlFor='frame-clip'>Clip contents</Label>
				</div>

				<div className='space-y-2'>
					<Label>Layout props (JSON)</Label>
					<Textarea
						value={framePropsJson}
						onChange={(e) => {
							const next = e.target.value;
							setFramePropsJson(next);
							try {
								const parsed = next.trim() ? JSON.parse(next) : {};
								if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
									throw new Error('Props JSON must be an object.');
								}
								setFramePropsError(null);
								onChange({ ...base, props: parsed });
							} catch (err) {
								setFramePropsError(toErrorMessage(err));
							}
						}}
						className='font-mono text-xs'
						rows={8}
						disabled={disabled}
					/>
					{framePropsError ? <p className='text-xs text-red-600'>{framePropsError}</p> : null}
				</div>
			</div>
		);
	}

	if (normalizedType === 'collection-list') {
		const typeSlug = typeof base['type_slug'] === 'string' ? base['type_slug'] : '';
		const limit = typeof base['limit'] === 'number' ? Math.max(1, Math.min(100, Math.round(base['limit'] as number))) : 6;
		const columns = typeof base['columns'] === 'number' ? Math.max(1, Math.min(12, Math.round(base['columns'] as number))) : 3;
		const sort = typeof base['sort'] === 'string' ? base['sort'] : 'published_at';
		const dir = typeof base['dir'] === 'string' ? base['dir'] : 'desc';
		const imageField = typeof base['image_field'] === 'string' ? base['image_field'] : '';
		const subtitleField = typeof base['subtitle_field'] === 'string' ? base['subtitle_field'] : '';

		return (
			<div className={cn('space-y-4', className)}>
				<div className='space-y-2'>
					<Label>Collection type slug</Label>
					<Input value={typeSlug} onChange={(e) => onChange({ ...base, type_slug: e.target.value })} disabled={disabled} />
				</div>
				<div className='grid grid-cols-2 gap-3'>
					<div className='space-y-2'>
						<Label>Columns</Label>
						<Input
							type='number'
							value={columns}
							onChange={(e) => onChange({ ...base, columns: Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))) })}
							disabled={disabled}
						/>
					</div>
					<div className='space-y-2'>
						<Label>Limit</Label>
						<Input
							type='number'
							value={limit}
							onChange={(e) => onChange({ ...base, limit: Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))) })}
							disabled={disabled}
						/>
					</div>
				</div>
				<div className='grid grid-cols-2 gap-3'>
					<div className='space-y-2'>
						<Label>Sort</Label>
						<Input value={sort} onChange={(e) => onChange({ ...base, sort: e.target.value })} disabled={disabled} />
					</div>
					<div className='space-y-2'>
						<Label>Dir</Label>
						<Select value={dir} onValueChange={(v) => onChange({ ...base, dir: v })} disabled={disabled}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='desc'>desc</SelectItem>
								<SelectItem value='asc'>asc</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className='grid grid-cols-2 gap-3'>
					<div className='space-y-2'>
						<Label>Image field</Label>
						<Input value={imageField} onChange={(e) => onChange({ ...base, image_field: e.target.value })} disabled={disabled} />
					</div>
					<div className='space-y-2'>
						<Label>Subtitle field</Label>
						<Input value={subtitleField} onChange={(e) => onChange({ ...base, subtitle_field: e.target.value })} disabled={disabled} />
					</div>
				</div>
			</div>
		);
	}

	if (normalizedType === 'shadcn') {
		const props = shadcnNormalized.props;
		const component = shadcnNormalized.component;

		function updateShadcn(next: { component?: string; props?: Record<string, unknown> }) {
			const nextComponent = (next.component ?? component).trim().toLowerCase();
			const nextProps = next.props ?? props;
			const cleanedProps = Object.fromEntries(Object.entries(nextProps ?? {}).filter(([, v]) => v !== undefined)) as Record<
				string,
				unknown
			>;
			const payload: Record<string, unknown> = { component: nextComponent };
			if (Object.keys(cleanedProps).length > 0) payload.props = cleanedProps;
			onChange(payload);
		}

		function updateProps(nextProps: Record<string, unknown>) {
			updateShadcn({ props: nextProps });
			setPropsJson(stableJson(nextProps));
			setPropsJsonError(null);
		}

		const variantGroups = shadcnVariants.groups.filter((g) => !shadcnQuickKeys.has(g.name));

		return (
			<div className={cn('space-y-4', className)}>
				<div className='space-y-2'>
					<div className='flex items-center justify-between gap-2'>
						<Label>shadcn slug</Label>
						{shadcnMeta ? (
							<div className='flex items-center gap-2'>
								<Badge variant='outline'>{shadcnMeta.kind}</Badge>
								{shadcnMeta.canWrapChildren ? <Badge variant='secondary'>wrapper</Badge> : null}
							</div>
						) : null}
					</div>
					<Input
						value={component}
						onChange={(e) => updateShadcn({ component: e.target.value })}
						placeholder='e.g. button'
						disabled={disabled}
					/>
				</div>

				{shadcnSlug && shadcnQuickSpec ? (
					<div className='rounded-lg border bg-muted/10 p-3 space-y-3'>
						<div className='text-sm font-medium'>Quick settings</div>
						{shadcnQuickSpec.description ? (
							<p className='text-xs text-muted-foreground'>{shadcnQuickSpec.description}</p>
						) : null}

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
							{shadcnQuickSpec.fields.map((field) => {
								const showWhen = field.kind === 'string-list' ? field.showWhen : undefined;
								if (showWhen) {
									const current = typeof props[showWhen.key] === 'string' ? String(props[showWhen.key]) : '';
									if (current !== showWhen.equals) return null;
								}

								if (field.kind === 'string') {
									const currentRaw = props[field.key];
									const current = typeof currentRaw === 'string' ? currentRaw : '';
									const onValue = (next: string) => {
										const trimmed = next.trim();
										updateProps({ ...props, [field.key]: trimmed ? trimmed : undefined });
									};

									return (
										<div
											key={field.key}
											className={cn('space-y-2', field.multiline ? 'sm:col-span-2' : null)}>
											<Label>{field.label}</Label>
											{field.multiline ? (
												<Textarea
													value={current}
													onChange={(e) => onValue(e.target.value)}
													disabled={disabled}
													rows={field.rows ?? 4}
													placeholder={field.placeholder}
												/>
											) : (
												<Input
													value={current}
													onChange={(e) => onValue(e.target.value)}
													disabled={disabled}
													placeholder={field.placeholder}
												/>
											)}
										</div>
									);
								}

								if (field.kind === 'select') {
									const currentRaw = typeof props[field.key] === 'string' ? String(props[field.key]) : '';
									const current = currentRaw || field.options[0] || '';

									return (
										<div key={field.key} className='space-y-2'>
											<Label>{field.label}</Label>
											<Select
												value={current}
												onValueChange={(v) => updateProps({ ...props, [field.key]: v })}
												disabled={disabled}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{field.options.map((opt) => (
														<SelectItem key={opt} value={opt}>
															{opt}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									);
								}

								if (field.kind === 'boolean') {
									const current = props[field.key] === true;
									return (
										<div key={field.key} className='flex items-center gap-2 pt-6'>
											<Checkbox
												id={`shadcn-${field.key}`}
												checked={current}
												onCheckedChange={(checked) =>
													updateProps({
														...props,
														[field.key]: checked === true ? true : undefined,
													})
												}
												disabled={disabled}
											/>
											<Label htmlFor={`shadcn-${field.key}`}>{field.label}</Label>
										</div>
									);
								}

								if (field.kind === 'string-list') {
									const raw = props[field.key];
									const items = Array.isArray(raw) && raw.every((x) => typeof x === 'string') ? (raw as string[]) : [];
									const value = items.join('\n');

									return (
										<div key={field.key} className='space-y-2 sm:col-span-2'>
											<Label>{field.label}</Label>
											<Textarea
												value={value}
												onChange={(e) => {
													const lines = e.target.value
														.split('\n')
														.map((l) => l.trim())
														.filter(Boolean);
													updateProps({
														...props,
														[field.key]: lines.length ? lines : undefined,
													});
												}}
												disabled={disabled}
												rows={field.rows ?? 5}
												placeholder={field.placeholder}
											/>
										</div>
									);
								}

								return null;
							})}
						</div>
					</div>
				) : null}

				{shadcnSlug ? (
					<div className='space-y-2'>
						<div className='flex items-center justify-between gap-2'>
							<Label>Variants</Label>
							<Button
								type='button'
								size='sm'
								variant='outline'
								onClick={() => {
									if (!shadcnVariants.groups.length) return;
									const next = { ...(props ?? {}) };
									for (const [k, v] of Object.entries(shadcnVariants.defaults ?? {})) next[k] = v;
									updateShadcn({ props: next });
									setPropsJson(stableJson(next));
									setPropsJsonError(null);
								}}
								disabled={disabled || shadcnVariants.loading}>
								Apply docs defaults
							</Button>
						</div>

						{shadcnVariants.loading ? (
							<p className='text-xs text-muted-foreground'>Loading variants…</p>
						) : shadcnVariants.error ? (
							<p className='text-xs text-red-600'>{shadcnVariants.error}</p>
						) : variantGroups.length ? (
							<div className='grid grid-cols-2 gap-3'>
								{variantGroups.map((g) => {
									const currentRaw = typeof props[g.name] === 'string' ? String(props[g.name]) : '';
									const current = currentRaw || shadcnVariants.defaults[g.name] || g.options[0] || '';
									return (
										<div key={g.name} className='space-y-2'>
											<Label>{g.name}</Label>
											<Select
												value={current}
												onValueChange={(v) => {
													const next = { ...props, [g.name]: v };
													updateShadcn({ props: next });
													setPropsJson(stableJson(next));
													setPropsJsonError(null);
												}}
												disabled={disabled}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{g.options.map((opt) => (
														<SelectItem key={opt} value={opt}>
															{opt}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									);
								})}
							</div>
						) : (
							<p className='text-xs text-muted-foreground'>
								{shadcnQuickSpec ? 'No additional variants detected.' : 'No variants detected for this component.'}
							</p>
						)}
					</div>
				) : null}

				<Separator />

				<div className='space-y-2'>
					<Label>Props (JSON)</Label>
					<Textarea
						value={propsJson}
						onChange={(e) => {
							const next = e.target.value;
							setPropsJson(next);
							try {
								const parsed = next.trim() ? JSON.parse(next) : {};
								if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
									throw new Error('Props JSON must be an object.');
								}
								setPropsJsonError(null);
								updateShadcn({ props: parsed as Record<string, unknown> });
							} catch (err) {
								setPropsJsonError(toErrorMessage(err));
							}
						}}
						className='font-mono text-xs'
						rows={10}
						disabled={disabled}
					/>
					{propsJsonError ? <p className='text-xs text-red-600'>{propsJsonError}</p> : null}
				</div>

				{jsxSnippet.trim() ? (
					<div className='space-y-2'>
						<div className='flex items-center justify-between gap-2'>
							<Label>JSX</Label>
							<Button type='button' size='sm' variant='outline' onClick={onCopyJsx} disabled={disabled}>
								<Copy className='h-4 w-4 mr-1' />
								Copy
							</Button>
						</div>
						<Textarea value={jsxSnippet} readOnly className='font-mono text-xs' rows={6} />
					</div>
				) : null}
			</div>
		);
	}

	// Fallback: raw JSON editor.
	return (
		<div className={cn('space-y-2', className)}>
			<Label>Data (JSON)</Label>
			<Textarea
				value={rawJson}
				onChange={(e) => {
					const next = e.target.value;
					setRawJson(next);
					try {
						const parsed = next.trim() ? JSON.parse(next) : {};
						if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
							throw new Error('Data JSON must be an object.');
						}
						setRawError(null);
						onChange(parsed);
					} catch (err) {
						setRawError(toErrorMessage(err));
					}
				}}
				className='font-mono text-xs'
				rows={10}
				disabled={disabled}
			/>
			{rawError ? <p className='text-xs text-red-600'>{rawError}</p> : null}
		</div>
	);
}
