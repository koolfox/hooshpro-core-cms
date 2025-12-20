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

export type ComponentPreviewModel = {
	title?: string;
	type: string;
	data: unknown;
};

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
			return (
				<div className={className}>
					<Badge>Badge</Badge>
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
