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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { AlertCircle, CheckCircle2 } from 'lucide-react';

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

	if (type === 'button') {
		const d = isRecord(data) ? data : {};
		const label = typeof d['label'] === 'string' ? d['label'] : 'Button';
		const variantRaw = typeof d['variant'] === 'string' ? d['variant'] : 'default';
		const variant =
			variantRaw &&
			['default', 'secondary', 'outline', 'destructive', 'ghost'].includes(variantRaw)
				? (variantRaw as 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost')
				: 'default';
		return (
			<div className={className}>
				<Button variant={variant}>{label}</Button>
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
			typeof d['component'] === 'string' ? d['component'] : 'component';

		if (componentId === 'badge') {
			const variantRaw = typeof d['variant'] === 'string' ? d['variant'] : 'default';
			const variant =
				variantRaw &&
				['default', 'secondary', 'outline', 'destructive'].includes(variantRaw)
					? (variantRaw as 'default' | 'secondary' | 'outline' | 'destructive')
					: 'default';
			return (
				<div className={className}>
					<Badge variant={variant}>Badge</Badge>
				</div>
			);
		}

		if (componentId === 'button') {
			return (
				<div className={className}>
					<div className='flex flex-wrap gap-2'>
						<Button>Button</Button>
						<Button variant='secondary'>Secondary</Button>
						<Button variant='outline'>Outline</Button>
					</div>
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

		if (componentId === 'textarea') {
			return (
				<div className={className}>
					<Textarea placeholder='Textarea' readOnly />
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
