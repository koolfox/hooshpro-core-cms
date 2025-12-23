'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import type { PageBlock, PageBuilderState } from '@/lib/page-builder';
import { sanitizeRichHtml } from '@/lib/sanitize';

import { PublicFooterNav } from '@/components/public/public-footer-nav';
import { PublicTopNav } from '@/components/public/public-top-nav';
import { ComponentPreview } from '@/components/components/component-preview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const MAX_COLUMNS = 12;

function clampColumnsCount(value: number): number {
	if (!Number.isFinite(value)) return 1;
	return Math.max(1, Math.min(MAX_COLUMNS, Math.round(value)));
}

function defaultColumnSizes(count: number): number[] {
	const safe = clampColumnsCount(count);
	const base = Math.floor((100 / safe) * 100) / 100;
	const sizes = Array.from({ length: safe }).map(() => base);
	const used = base * (safe - 1);
	sizes[safe - 1] = Math.round((100 - used) * 100) / 100;
	return sizes;
}

function normalizeColumnSizes(value: unknown, count: number): number[] | null {
	if (!Array.isArray(value)) return null;
	if (value.length !== count) return null;
	const nums = value.map((v) => (typeof v === 'number' ? v : Number.NaN));
	if (!nums.every((n) => Number.isFinite(n) && n > 0)) return null;
	const sum = nums.reduce((acc, v) => acc + v, 0);
	if (!Number.isFinite(sum) || sum <= 0) return null;
	const scaled = nums.map((v) => Math.round(((v / sum) * 100) * 100) / 100);
	const scaledSum = scaled.reduce((acc, v) => acc + v, 0);
	if (scaled.length > 0) {
		scaled[scaled.length - 1] =
			Math.round((scaled[scaled.length - 1] + (100 - scaledSum)) * 100) / 100;
	}
	return scaled;
}

export function renderBlockPreview(block: PageBlock, slot?: React.ReactNode) {
	if (block.type === 'editor') {
		const html = block.data.html;
		const safe = sanitizeRichHtml(html);
		return (
			<div
				className='prose prose-neutral dark:prose-invert max-w-none'
				dangerouslySetInnerHTML={{ __html: safe || '<p></p>' }}
			/>
		);
	}

	if (block.type === 'slot') {
		if (slot) return <>{slot}</>;
		return (
			<div className='rounded-md border border-dashed bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground'>
				Page content slot
			</div>
		);
	}

	if (block.type === 'menu') {
		const id = block.data.menu?.trim() || 'main';
		if (id === 'none') return null;
		const items =
			Array.isArray(block.data.items) && block.data.items.length ? block.data.items : undefined;
		return block.data.kind === 'footer' ? (
			<PublicFooterNav menuId={id} items={items} />
		) : (
			<PublicTopNav menuId={id} items={items} />
		);
	}

	if (block.type === 'separator') {
		return <Separator />;
	}

	if (block.type === 'button') {
		const href = block.data.href?.trim();
		return (
			<Button
				variant={block.data.variant ?? 'default'}
				asChild={!!href}>
				{href ? <Link href={href}>{block.data.label}</Link> : block.data.label}
			</Button>
		);
	}

	if (block.type === 'card') {
		return (
			<Card>
				{block.data.title ? (
					<CardHeader>
						<CardTitle>{block.data.title}</CardTitle>
					</CardHeader>
				) : null}
				<CardContent>
					{block.data.body ? (
						<p className='text-sm text-muted-foreground whitespace-pre-wrap'>
							{block.data.body}
						</p>
					) : (
						<p className='text-sm text-muted-foreground'>Card</p>
					)}
				</CardContent>
			</Card>
		);
	}

	if (block.type === 'image') {
		if (!block.data.url) {
			return (
				<div className='rounded-lg border p-4 text-sm text-muted-foreground'>
					Image (no URL)
				</div>
			);
		}
		return (
			<div className='relative aspect-video rounded-lg border overflow-hidden bg-muted/30'>
				<Image
					src={block.data.url}
					alt={block.data.alt ?? ''}
					fill
					unoptimized
					sizes='(min-width: 1024px) 50vw, 100vw'
					className='object-cover'
				/>
			</div>
		);
	}

	if (block.type === 'shadcn') {
		const componentId = (block.data.component || '').trim().toLowerCase();
		const children = Array.isArray(block.children) ? block.children : null;

		if (children && children.length > 0) {
			const rendered = children.map((child) => (
				<div key={child.id}>{renderBlockPreview(child, slot)}</div>
			));

			if (componentId === 'card') {
				return (
					<Card>
						<CardContent>
							<div className='space-y-4'>{rendered}</div>
						</CardContent>
					</Card>
				);
			}

			return <div className='space-y-4'>{rendered}</div>;
		}

		const data = { component: block.data.component, ...(block.data.props ?? {}) };
		return <ComponentPreview component={{ type: 'shadcn', data }} />;
	}

	return (
		<div className='rounded-lg border p-3 text-sm text-muted-foreground'>
			Unknown component: <code>{block.data.originalType}</code>
		</div>
	);
}

export function PageRenderer({ state }: { state: PageBuilderState }) {
	return <PageRendererWithSlot state={state} />;
}

export function PageRendererWithSlot({
	state,
	slot,
}: {
	state: PageBuilderState;
	slot?: React.ReactNode;
}) {
	return (
		<div className='space-y-10'>
			{state.rows.map((row) => {
				const columnsCount = clampColumnsCount(row.settings?.columns ?? row.columns.length);
				const sizes =
					normalizeColumnSizes(row.settings?.sizes ?? null, columnsCount) ??
					defaultColumnSizes(columnsCount);
				const template = sizes.map((n) => `${n}fr`).join(' ');
				const wrapper = row.settings?.wrapper ?? 'none';

				const grid = (
					<div
						className='grid grid-cols-1 gap-6 md:grid-cols-[var(--hp-cols)]'
						style={{ '--hp-cols': template } as CSSProperties}>
						{row.columns.map((col) => {
							const blocks = col.blocks.map((b) => (
								<div key={b.id}>{renderBlockPreview(b, slot)}</div>
							));

							if (col.settings?.wrapper === 'card') {
								return (
									<Card key={col.id}>
										<CardContent>
											<div className='space-y-4'>{blocks}</div>
										</CardContent>
									</Card>
								);
							}

							return (
								<div
									key={col.id}
									className='space-y-4'>
									{blocks}
								</div>
							);
						})}
					</div>
				);
				return (
					<section key={row.id}>
						{wrapper === 'card' ? (
							<Card>
								<CardContent>{grid}</CardContent>
							</Card>
						) : (
							grid
						)}
					</section>
				);
			})}
		</div>
	);
}
