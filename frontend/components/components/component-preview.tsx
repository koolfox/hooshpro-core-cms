'use client';

import Image from 'next/image';

import { sanitizeRichHtml } from '@/lib/sanitize';
import { isRecord } from '@/lib/page-builder';

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';

export type ComponentPreviewModel = {
	title?: string;
	type: string;
	data: unknown;
};

type TypographyVariant =
	| 'h1'
	| 'h2'
	| 'h3'
	| 'h4'
	| 'p'
	| 'blockquote'
	| 'table'
	| 'list'
	| 'code'
	| 'lead'
	| 'large'
	| 'small'
	| 'muted';

function parseTypographyVariant(value: unknown): TypographyVariant {
	const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
	if (!raw) return 'p';
	if (raw === 'inline code' || raw === 'inline-code' || raw === 'inline_code') return 'code';
	if (
		raw === 'h1' ||
		raw === 'h2' ||
		raw === 'h3' ||
		raw === 'h4' ||
		raw === 'p' ||
		raw === 'blockquote' ||
		raw === 'table' ||
		raw === 'list' ||
		raw === 'code' ||
		raw === 'lead' ||
		raw === 'large' ||
		raw === 'small' ||
		raw === 'muted'
	) {
		return raw;
	}
	return 'p';
}

function typographyTextDefault(variant: TypographyVariant): string {
	switch (variant) {
		case 'h1':
			return 'Heading 1';
		case 'h2':
			return 'Heading 2';
		case 'h3':
			return 'Heading 3';
		case 'h4':
			return 'Heading 4';
		case 'blockquote':
			return '“A short quote that stands out.”';
		case 'code':
			return '@radix-ui/react-alert-dialog';
		case 'lead':
			return 'A lead paragraph that introduces a section.';
		case 'large':
			return 'Large text';
		case 'small':
			return 'Small text';
		case 'muted':
			return 'Muted helper text.';
		case 'p':
		default:
			return 'A paragraph of text.';
	}
}

function renderTypographyPreview(data: Record<string, unknown>) {
	const variant = parseTypographyVariant(data['variant']);
	const text =
		typeof data['text'] === 'string' && data['text'].trim()
			? data['text']
			: typographyTextDefault(variant);

	if (variant === 'h1') {
		return (
			<h1 className='scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance'>
				{text}
			</h1>
		);
	}

	if (variant === 'h2') {
		return (
			<h2 className='scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0'>
				{text}
			</h2>
		);
	}

	if (variant === 'h3') {
		return (
			<h3 className='scroll-m-20 text-2xl font-semibold tracking-tight'>
				{text}
			</h3>
		);
	}

	if (variant === 'h4') {
		return (
			<h4 className='scroll-m-20 text-xl font-semibold tracking-tight'>
				{text}
			</h4>
		);
	}

	if (variant === 'blockquote') {
		return <blockquote className='mt-6 border-l-2 pl-6 italic'>{text}</blockquote>;
	}

	if (variant === 'list') {
		const itemsRaw = data['items'];
		const items =
			Array.isArray(itemsRaw) && itemsRaw.every((x) => typeof x === 'string' && x.trim())
				? (itemsRaw as string[])
				: ['List item one', 'List item two', 'List item three'];
		return (
			<ul className='my-6 ml-6 list-disc [&>li]:mt-2'>
				{items.map((item, idx) => (
					<li key={idx}>{item}</li>
				))}
			</ul>
		);
	}

	if (variant === 'table') {
		return (
			<div className='my-6 w-full overflow-y-auto'>
				<table className='w-full'>
					<thead>
						<tr className='even:bg-muted m-0 border-t p-0'>
							<th className='border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right'>
								Key
							</th>
							<th className='border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right'>
								Value
							</th>
						</tr>
					</thead>
					<tbody>
						<tr className='even:bg-muted m-0 border-t p-0'>
							<td className='border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right'>
								name
							</td>
							<td className='border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right'>
								HooshPro
							</td>
						</tr>
						<tr className='even:bg-muted m-0 border-t p-0'>
							<td className='border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right'>
								type
							</td>
							<td className='border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right'>
								CMS
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		);
	}

	if (variant === 'code') {
		return (
			<code className='bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'>
				{text}
			</code>
		);
	}

	if (variant === 'lead') {
		return <p className='text-muted-foreground text-xl'>{text}</p>;
	}

	if (variant === 'large') {
		return <div className='text-lg font-semibold'>{text}</div>;
	}

	if (variant === 'small') {
		return <small className='text-sm leading-none font-medium'>{text}</small>;
	}

	if (variant === 'muted') {
		return <p className='text-muted-foreground text-sm'>{text}</p>;
	}

	return <p className='leading-7 [&:not(:first-child)]:mt-6'>{text}</p>;
}

export function ComponentPreview({
	component,
	className,
}: {
	component: ComponentPreviewModel;
	className?: string;
}) {
	const type = (component.type || '').trim();
	const data = component.data;

	if (type === 'editor') {
		const html =
			isRecord(data) && typeof data['html'] === 'string' ? data['html'] : '';
		if (html.trim()) {
			const safe = sanitizeRichHtml(html);
			return (
				<div className={className}>
					<div
						className='prose prose-sm prose-neutral dark:prose-invert max-w-none'
						dangerouslySetInnerHTML={{ __html: safe || '<p></p>' }}
					/>
				</div>
			);
		}

		return (
			<div className={className}>
				<div className='rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground'>
					Text
				</div>
			</div>
		);
	}

	if (type === 'separator') {
		return (
			<div className={className}>
				<Separator />
			</div>
		);
	}

	if (type === 'slot') {
		const d = isRecord(data) ? data : {};
		const name = typeof d['name'] === 'string' && d['name'].trim() ? d['name'].trim() : 'Page content';
		return (
			<div className={className}>
				<div className='rounded-md border border-dashed bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground'>
					{name} slot
				</div>
			</div>
		);
	}

	if (type === 'menu') {
		const d = isRecord(data) ? data : {};
		const menu = typeof d['menu'] === 'string' && d['menu'].trim() ? d['menu'].trim() : 'main';
		const kindRaw = typeof d['kind'] === 'string' ? d['kind'].trim().toLowerCase() : 'top';
		const kind = kindRaw === 'footer' ? 'footer' : 'top';

		return (
			<div className={className}>
				<div className='rounded-md border bg-background px-3 py-2'>
					<div className='flex items-center justify-between gap-3'>
						<div className='text-xs text-muted-foreground'>
							{kind === 'footer' ? 'Footer menu' : 'Top menu'} · <code>{menu}</code>
						</div>
						<div className='flex items-center gap-2'>
							<span className='text-xs text-muted-foreground'>Home</span>
							<span className='text-xs text-muted-foreground'>About</span>
							<span className='text-xs text-muted-foreground'>Contact</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (type === 'button') {
		const d = isRecord(data) ? data : {};
		const label = typeof d['label'] === 'string' ? d['label'] : 'Button';
		const href = typeof d['href'] === 'string' ? d['href'] : '';
		const variantRaw = typeof d['variant'] === 'string' ? d['variant'] : 'default';
		const variant =
			variantRaw &&
			['default', 'secondary', 'outline', 'destructive', 'ghost', 'link'].includes(variantRaw)
				? (variantRaw as 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link')
				: 'default';
		return (
			<div className={className}>
				<Button
					variant={variant}
					asChild={!!href.trim()}>
					{href.trim() ? (
						<a
							href={href}
							onClick={(e) => e.preventDefault()}>
							{label}
						</a>
					) : (
						label
					)}
				</Button>
			</div>
		);
	}

	if (type === 'card') {
		const d = isRecord(data) ? data : {};
		const title = typeof d['title'] === 'string' ? d['title'] : component.title ?? 'Card';
		const body = typeof d['body'] === 'string' ? d['body'] : '';
		return (
			<div className={className}>
				<Card>
					<CardHeader className='py-3'>
						<CardTitle className='text-sm'>{title}</CardTitle>
					</CardHeader>
					<CardContent className='pb-3'>
						<p className='text-sm text-muted-foreground line-clamp-3'>
							{body || 'Card body'}
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (type === 'image') {
		const d = isRecord(data) ? data : {};
		const url = typeof d['url'] === 'string' ? d['url'] : '';
		const alt = typeof d['alt'] === 'string' ? d['alt'] : '';
		if (!url.trim()) {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground'>
						Image
					</div>
				</div>
			);
		}

		return (
			<div className={className}>
				<div className='relative aspect-video rounded-lg border overflow-hidden bg-muted/20'>
					<Image
						src={url}
						alt={alt}
						fill
						unoptimized
						sizes='(min-width: 1024px) 25vw, 80vw'
						className='object-cover'
					/>
				</div>
			</div>
		);
	}

	if (type === 'shadcn') {
		const d = isRecord(data) ? data : {};
		const componentId =
			typeof d['component'] === 'string'
				? d['component'].trim().toLowerCase()
				: 'component';

		if (componentId === 'badge') {
			const variantRaw = typeof d['variant'] === 'string' ? d['variant'] : 'default';
			const variant =
				variantRaw &&
				['default', 'secondary', 'outline', 'destructive'].includes(variantRaw)
					? (variantRaw as 'default' | 'secondary' | 'outline' | 'destructive')
					: 'default';
			const text = typeof d['text'] === 'string' && d['text'].trim() ? d['text'] : 'Badge';
			return (
				<div className={className}>
					<Badge variant={variant}>{text}</Badge>
				</div>
			);
		}

		if (componentId === 'button') {
			const hasCustomProps =
				typeof d['label'] === 'string' ||
				typeof d['href'] === 'string' ||
				typeof d['variant'] === 'string' ||
				typeof d['size'] === 'string';

			if (!hasCustomProps) {
				return (
					<div className={className}>
						<div className='flex flex-wrap gap-2'>
							<Button>Default</Button>
							<Button variant='secondary'>Secondary</Button>
							<Button variant='outline'>Outline</Button>
							<Button variant='ghost'>Ghost</Button>
							<Button variant='destructive'>Destructive</Button>
							<Button variant='link'>Link</Button>
						</div>
					</div>
				);
			}

			const label = typeof d['label'] === 'string' && d['label'].trim() ? d['label'] : 'Button';
			const href = typeof d['href'] === 'string' ? d['href'] : '';

			const variantRaw = typeof d['variant'] === 'string' ? d['variant'] : 'default';
			const variant =
				variantRaw &&
				['default', 'secondary', 'outline', 'destructive', 'ghost', 'link'].includes(variantRaw)
					? (variantRaw as 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link')
					: 'default';

			const sizeRaw = typeof d['size'] === 'string' ? d['size'] : 'default';
			const size =
				sizeRaw &&
				['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'].includes(sizeRaw)
					? (sizeRaw as
							| 'default'
							| 'sm'
							| 'lg'
							| 'icon'
							| 'icon-sm'
							| 'icon-lg')
					: 'default';

			return (
				<div className={className}>
					<Button
						variant={variant}
						size={size}
						asChild={!!href.trim()}>
						{href.trim() ? (
							<a
								href={href}
								onClick={(e) => e.preventDefault()}>
								{label}
							</a>
						) : (
							label
						)}
					</Button>
				</div>
			);
		}

		if (componentId === 'alert') {
			const variantRaw = typeof d['variant'] === 'string' ? d['variant'] : 'default';
			const variant =
				variantRaw === 'destructive'
					? 'destructive'
					: ('default' as 'default' | 'destructive');
			const title =
				typeof d['title'] === 'string' && d['title'].trim()
					? d['title']
					: 'Heads up';
			const description =
				typeof d['description'] === 'string' && d['description'].trim()
					? d['description']
					: 'This is an alert component.';
			return (
				<div className={className}>
					<Alert variant={variant}>
						{variant === 'destructive' ? (
							<AlertCircle className='h-4 w-4' />
						) : (
							<CheckCircle2 className='h-4 w-4' />
						)}
						<AlertTitle>{title}</AlertTitle>
						<AlertDescription>{description}</AlertDescription>
					</Alert>
				</div>
			);
		}

		if (componentId === 'typography') {
			const payload = isRecord(d) ? d : {};
			return (
				<div className={className}>
					{renderTypographyPreview(payload)}
				</div>
			);
		}

		if (componentId === 'card') {
			return (
				<div className={className}>
					<Card>
						<CardHeader className='py-3'>
							<CardTitle className='text-sm'>Card</CardTitle>
						</CardHeader>
						<CardContent className='pb-3'>
							<p className='text-sm text-muted-foreground line-clamp-3'>
								A shadcn/ui card preview.
							</p>
						</CardContent>
					</Card>
				</div>
			);
		}

		if (componentId === 'input') {
			return (
				<div className={className}>
					<Input placeholder='Input' readOnly />
				</div>
			);
		}

		if (componentId === 'label') {
			return (
				<div className={className}>
					<div className='space-y-2'>
						<Label>Label</Label>
						<Input placeholder='Input' readOnly />
					</div>
				</div>
			);
		}

		if (componentId === 'textarea') {
			return (
				<div className={className}>
					<Textarea placeholder='Textarea' readOnly />
				</div>
			);
		}

		if (componentId === 'select') {
			const value = typeof d['value'] === 'string' && d['value'].trim() ? d['value'] : 'Select';
			return (
				<div className={className}>
					<div className='inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm'>
						<span className='text-muted-foreground'>{value}</span>
						<ChevronDown className='h-4 w-4 text-muted-foreground' />
					</div>
				</div>
			);
		}

		if (componentId === 'dropdown-menu') {
			return (
				<div className={className}>
					<Card>
						<CardHeader className='py-3'>
							<CardTitle className='text-sm'>Dropdown Menu</CardTitle>
						</CardHeader>
						<CardContent className='pb-3 space-y-2'>
							<Button variant='outline' size='sm'>
								Open menu
							</Button>
							<div className='space-y-1'>
								<div className='rounded-md border bg-muted/10 px-2 py-1 text-sm'>Item one</div>
								<div className='rounded-md border bg-muted/10 px-2 py-1 text-sm'>Item two</div>
								<div className='rounded-md border bg-muted/10 px-2 py-1 text-sm'>Item three</div>
							</div>
						</CardContent>
					</Card>
				</div>
			);
		}

		if (componentId === 'tooltip') {
			return (
				<div className={className}>
					<div className='inline-flex items-center gap-2 rounded-md border bg-muted/10 px-3 py-2 text-sm'>
						<span>Hover me</span>
						<span className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
							Tooltip
						</span>
					</div>
				</div>
			);
		}

		if (componentId === 'dialog') {
			return (
				<div className={className}>
					<Card>
						<CardHeader className='py-3'>
							<CardTitle className='text-sm'>Dialog</CardTitle>
						</CardHeader>
						<CardContent className='pb-3 space-y-2'>
							<p className='text-sm text-muted-foreground'>
								Dialogs open a modal for focused tasks.
							</p>
							<Button variant='outline' size='sm'>
								Open dialog
							</Button>
						</CardContent>
					</Card>
				</div>
			);
		}

		if (componentId === 'alert-dialog') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-muted/10 p-3 space-y-2'>
						<div className='text-sm font-medium'>Alert Dialog</div>
						<div className='text-xs text-muted-foreground'>
							Confirm a destructive action.
						</div>
						<div className='flex items-center gap-2'>
							<Button variant='outline' size='sm'>
								Cancel
							</Button>
							<Button variant='destructive' size='sm'>
								Delete
							</Button>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'accordion') {
			return (
				<div className={className}>
					<Accordion
						type='single'
						collapsible
						className='w-full rounded-lg border bg-background px-3'
						defaultValue='item-1'>
						<AccordionItem value='item-1'>
							<AccordionTrigger>Product Information</AccordionTrigger>
							<AccordionContent className='text-muted-foreground'>
								Accordion content…
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value='item-2'>
							<AccordionTrigger>Shipping Details</AccordionTrigger>
							<AccordionContent className='text-muted-foreground'>
								Accordion content…
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value='item-3'>
							<AccordionTrigger>Return Policy</AccordionTrigger>
							<AccordionContent className='text-muted-foreground'>
								Accordion content…
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			);
		}

		if (componentId === 'aspect-ratio') {
			return (
				<div className={className}>
					<div className='relative aspect-video rounded-lg border overflow-hidden bg-muted/10'>
						<div className='absolute inset-0 grid place-items-center text-xs text-muted-foreground'>
							Aspect ratio (16:9)
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'calendar' || componentId === 'date-picker') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='flex items-center justify-between'>
							<div className='text-sm font-medium'>July</div>
							<div className='flex items-center gap-1 text-muted-foreground'>
								<button type='button' className='px-2' aria-label='Previous month'>
									‹
								</button>
								<button type='button' className='px-2' aria-label='Next month'>
									›
								</button>
							</div>
						</div>
						<div className='grid grid-cols-7 gap-1 text-[11px] text-muted-foreground'>
							{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
								<div key={d} className='text-center'>
									{d}
								</div>
							))}
						</div>
						<div className='grid grid-cols-7 gap-1 text-xs'>
							{Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
								<div
									key={n}
									className={
										n === 12
											? 'rounded-md bg-primary text-primary-foreground text-center py-1'
											: 'rounded-md text-center py-1 hover:bg-muted/20'
									}>
									{n}
								</div>
							))}
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'carousel') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-muted/5 p-3 space-y-2'>
						<div className='flex items-center justify-between'>
							<div className='text-sm font-medium'>Carousel</div>
							<div className='text-xs text-muted-foreground'>‹ ›</div>
						</div>
						<div className='grid grid-cols-3 gap-2'>
							{['Slide 1', 'Slide 2', 'Slide 3'].map((t) => (
								<div key={t} className='rounded-md border bg-background p-2 text-xs text-muted-foreground'>
									{t}
								</div>
							))}
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'chart') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>Chart</div>
						<div className='flex items-end gap-2 h-24'>
							{[40, 65, 30, 80, 55].map((h, idx) => (
								<div
									key={idx}
									className='flex-1 rounded-sm bg-primary/20'
									style={{ height: `${h}%` }}
								/>
							))}
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'checkbox') {
			const itemsRaw = d['items'];
			const items =
				Array.isArray(itemsRaw) && itemsRaw.every((x) => typeof x === 'string' && x.trim())
					? (itemsRaw as string[])
					: ['Option A', 'Option B', 'Option C'];

			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-3'>
						<div className='text-sm font-medium'>Checkbox</div>
						<div className='space-y-2'>
							{items.map((labelText, idx) => {
								const id = `chk-${idx}`;
								return (
									<div key={labelText} className='flex items-center gap-2'>
										<Checkbox
											id={id}
											defaultChecked={idx === 0}
										/>
										<Label htmlFor={id} className='text-muted-foreground'>
											{labelText}
										</Label>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'combobox' || componentId === 'command') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>{componentId === 'command' ? 'Command' : 'Combobox'}</div>
						<div className='rounded-md border bg-muted/10 px-3 py-2 text-sm text-muted-foreground'>
							Search…
						</div>
						<div className='space-y-1'>
							{['Item one', 'Item two', 'Item three'].map((t, idx) => (
								<div
									key={t}
									className={
										idx === 0
											? 'rounded-md bg-accent px-2 py-1 text-sm'
											: 'rounded-md px-2 py-1 text-sm text-muted-foreground'
									}>
									{t}
								</div>
							))}
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'context-menu') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-muted/10 p-3 space-y-2'>
						<div className='text-sm font-medium'>Context Menu</div>
						<div className='rounded-md border bg-background p-2 text-xs text-muted-foreground'>
							Right click target
						</div>
						<div className='rounded-md border bg-background p-2 space-y-1'>
							{['Copy', 'Paste', 'Rename', 'Delete'].map((t) => (
								<div key={t} className='rounded-sm px-2 py-1 text-sm text-muted-foreground hover:bg-muted/20'>
									{t}
								</div>
							))}
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'data-table') {
			return (
				<div className={className}>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{[
								{ name: 'Home', status: 'published' },
								{ name: 'About', status: 'draft' },
							].map((row) => (
								<TableRow key={row.name}>
									<TableCell className='font-medium'>{row.name}</TableCell>
									<TableCell>
										<Badge variant={row.status === 'published' ? 'default' : 'secondary'}>
											{row.status}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			);
		}

		if (componentId === 'drawer') {
			return (
				<div className={className}>
					<div className='rounded-lg border overflow-hidden bg-background'>
						<div className='p-3 text-sm font-medium'>Drawer</div>
						<div className='border-t bg-muted/10 p-3 text-xs text-muted-foreground'>
							Slides up from the bottom.
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'form') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>Form</div>
						<div className='space-y-1'>
							<Label>Email</Label>
							<Input placeholder='name@example.com' readOnly />
						</div>
						<div className='space-y-1'>
							<Label>Message</Label>
							<Textarea placeholder='Write a message…' readOnly />
						</div>
						<Button size='sm'>Submit</Button>
					</div>
				</div>
			);
		}

		if (componentId === 'hover-card') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-muted/10 p-3 space-y-2'>
						<div className='text-sm font-medium'>Hover Card</div>
						<div className='rounded-md border bg-background p-2 text-xs text-muted-foreground'>
							Hover target
						</div>
						<div className='rounded-md border bg-background p-3'>
							<div className='text-sm font-medium'>HooshPro</div>
							<div className='text-xs text-muted-foreground'>A short hover-card description.</div>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'input-otp') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>Input OTP</div>
						<div className='flex items-center gap-2'>
							{Array.from({ length: 6 }, (_, i) => (
								<div key={i} className='h-9 w-9 rounded-md border bg-muted/10 grid place-items-center text-sm text-muted-foreground'>
									{i < 2 ? '•' : ''}
								</div>
							))}
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'kbd') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>Kbd</div>
						<div className='flex items-center gap-2 text-sm'>
							<kbd className='rounded border bg-muted px-2 py-1 font-mono text-xs'>⌘</kbd>
							<kbd className='rounded border bg-muted px-2 py-1 font-mono text-xs'>K</kbd>
							<span className='text-muted-foreground'>to search</span>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'menubar') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background overflow-hidden'>
						<div className='flex items-center gap-4 px-3 py-2 text-sm bg-muted/10'>
							<span className='font-medium'>File</span>
							<span className='text-muted-foreground'>Edit</span>
							<span className='text-muted-foreground'>View</span>
						</div>
						<div className='p-3 text-xs text-muted-foreground'>Menubar content…</div>
					</div>
				</div>
			);
		}

		if (componentId === 'navigation-menu') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3'>
						<div className='flex items-center gap-4 text-sm'>
							<span className='font-medium'>Home</span>
							<span className='text-muted-foreground'>Docs</span>
							<span className='text-muted-foreground'>Pricing</span>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'pagination') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3'>
						<div className='flex items-center justify-center gap-1'>
							<Button variant='outline' size='sm'>
								Prev
							</Button>
							{[1, 2, 3].map((n) => (
								<Button key={n} variant={n === 2 ? 'default' : 'outline'} size='sm'>
									{n}
								</Button>
							))}
							<Button variant='outline' size='sm'>
								Next
							</Button>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'popover') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-muted/10 p-3 space-y-2'>
						<div className='flex items-center gap-2'>
							<Button variant='outline' size='sm'>Open</Button>
							<span className='text-xs text-muted-foreground'>→</span>
							<span className='rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground'>
								Popover content
							</span>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'progress') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>Progress</div>
						<div className='h-2 rounded-full bg-muted overflow-hidden'>
							<div className='h-full bg-primary' style={{ width: '62%' }} />
						</div>
						<div className='text-xs text-muted-foreground'>62%</div>
					</div>
				</div>
			);
		}

		if (componentId === 'radio-group') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>Radio Group</div>
						{['Option A', 'Option B', 'Option C'].map((label, idx) => (
							<label key={label} className='flex items-center gap-2 text-sm'>
								<span
									className={
										idx === 1
											? 'h-4 w-4 rounded-full border bg-background grid place-items-center'
											: 'h-4 w-4 rounded-full border bg-background'
									}
									aria-hidden>
									{idx === 1 ? <span className='h-2 w-2 rounded-full bg-primary' /> : null}
								</span>
								<span className='text-muted-foreground'>{label}</span>
							</label>
						))}
					</div>
				</div>
			);
		}

		if (componentId === 'scroll-area') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3'>
						<div className='text-sm font-medium mb-2'>Scroll Area</div>
						<div className='relative h-24 rounded-md border bg-muted/10 overflow-hidden'>
							<div className='absolute inset-0 p-2 space-y-1'>
								{Array.from({ length: 8 }, (_, i) => (
									<div key={i} className='text-xs text-muted-foreground'>
										Item {i + 1}
									</div>
								))}
							</div>
							<div className='absolute top-2 right-1 h-20 w-1 rounded-full bg-muted' />
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'slider') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>Slider</div>
						<div className='relative h-2 rounded-full bg-muted'>
							<div className='absolute inset-y-0 left-0 rounded-full bg-primary' style={{ width: '55%' }} />
							<div
								className='absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border bg-background'
								style={{ left: '55%' }}
							/>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'sonner' || componentId === 'toast') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>{componentId === 'toast' ? 'Toast' : 'Sonner'}</div>
						<div className='rounded-md border bg-muted/10 px-3 py-2 text-sm'>
							<div className='font-medium'>Saved</div>
							<div className='text-xs text-muted-foreground'>Your changes have been saved.</div>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'spinner') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 flex items-center gap-3'>
						<div className='h-5 w-5 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin' />
						<div className='text-sm text-muted-foreground'>Loading…</div>
					</div>
				</div>
			);
		}

		if (componentId === 'switch') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>Switch</div>
						<div className='flex items-center gap-2'>
							<div className='h-5 w-9 rounded-full bg-primary relative'>
								<div className='absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-background' />
							</div>
							<span className='text-sm text-muted-foreground'>Enabled</span>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'tabs') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='flex items-center gap-2 text-sm'>
							<span className='rounded-md bg-accent px-2 py-1 font-medium'>Tab 1</span>
							<span className='rounded-md px-2 py-1 text-muted-foreground'>Tab 2</span>
							<span className='rounded-md px-2 py-1 text-muted-foreground'>Tab 3</span>
						</div>
						<div className='rounded-md border bg-muted/10 p-3 text-xs text-muted-foreground'>
							Tab content…
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'toggle' || componentId === 'toggle-group') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-background p-3 space-y-2'>
						<div className='text-sm font-medium'>{componentId === 'toggle' ? 'Toggle' : 'Toggle Group'}</div>
						<div className='flex items-center gap-2'>
							<Button variant='secondary' size='sm'>A</Button>
							<Button variant='outline' size='sm'>B</Button>
							<Button variant='outline' size='sm'>C</Button>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'sheet') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-muted/10 p-3 space-y-2'>
						<div className='text-sm font-medium'>Sheet</div>
						<div className='text-xs text-muted-foreground'>A panel that slides in from an edge.</div>
						<div className='flex items-center gap-2'>
							<Button variant='outline' size='sm'>
								Open
							</Button>
							<span className='text-xs text-muted-foreground'>→</span>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'collapsible') {
			return (
				<div className={className}>
					<div className='rounded-lg border bg-muted/10 p-3 space-y-2'>
						<div className='text-sm font-medium'>Collapsible</div>
						<div className='text-xs text-muted-foreground'>A section that can expand/collapse.</div>
						<div className='rounded-md border bg-background px-2 py-2 text-sm text-muted-foreground'>
							Collapsible content…
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'sidebar') {
			return (
				<div className={className}>
					<div className='rounded-lg border overflow-hidden grid grid-cols-[120px_1fr]'>
						<div className='bg-muted/20 p-2 space-y-1'>
							<div className='text-xs font-medium'>Sidebar</div>
							<div className='text-xs text-muted-foreground'>Item</div>
							<div className='text-xs text-muted-foreground'>Item</div>
							<div className='text-xs text-muted-foreground'>Item</div>
						</div>
						<div className='p-3'>
							<div className='text-sm font-medium'>Content</div>
							<div className='text-xs text-muted-foreground'>Main area</div>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'resizable') {
			return (
				<div className={className}>
					<div className='rounded-lg border overflow-hidden flex'>
						<div className='flex-1 p-3 bg-muted/10 text-xs text-muted-foreground'>Panel</div>
						<div className='w-2 bg-border' />
						<div className='flex-1 p-3 bg-muted/5 text-xs text-muted-foreground'>Panel</div>
					</div>
				</div>
			);
		}

		if (componentId === 'separator') {
			return (
				<div className={className}>
					<Separator />
				</div>
			);
		}

		if (componentId === 'avatar') {
			return (
				<div className={className}>
					<div className='flex items-center gap-3'>
						<Avatar>
							<AvatarFallback>HP</AvatarFallback>
						</Avatar>
						<div className='text-sm'>
							<div className='font-medium'>Avatar</div>
							<div className='text-xs text-muted-foreground'>Fallback</div>
						</div>
					</div>
				</div>
			);
		}

		if (componentId === 'breadcrumb') {
			return (
				<div className={className}>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href='#'>Home</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>Current</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			);
		}

		if (componentId === 'table') {
			return (
				<div className={className}>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Key</TableHead>
								<TableHead>Value</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<TableRow>
								<TableCell className='font-medium'>name</TableCell>
								<TableCell>HooshPro</TableCell>
							</TableRow>
							<TableRow>
								<TableCell className='font-medium'>type</TableCell>
								<TableCell>CMS</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				</div>
			);
		}

		if (componentId === 'skeleton') {
			return (
				<div className={className}>
					<div className='space-y-2'>
						<Skeleton className='h-4 w-3/4' />
						<Skeleton className='h-4 w-1/2' />
					</div>
				</div>
			);
		}

		return (
			<div className={className}>
				<div className='rounded-lg border bg-muted/20 p-3 text-sm'>
					<div className='font-medium'>shadcn/{componentId}</div>
					<div className='text-xs text-muted-foreground'>Preview not implemented (yet)</div>
				</div>
			</div>
		);
	}

	return (
		<div className={className}>
			<div className='rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground'>
				Unknown component: {type || 'unknown'}
			</div>
		</div>
	);
}
