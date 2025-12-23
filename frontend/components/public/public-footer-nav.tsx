'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/http';
import type { PublicMenuOut } from '@/lib/types';

type MenuItem = { id?: string; label: string; href: string };

const FALLBACK_ITEMS: MenuItem[] = [{ label: 'Home', href: '/' }];

export function PublicFooterNav({ menuId, items }: { menuId: string; items?: MenuItem[] }) {
	const [fetchedItems, setFetchedItems] = useState<MenuItem[]>(FALLBACK_ITEMS);

	useEffect(() => {
		if (Array.isArray(items)) return;
		if (menuId === 'none') return;

		let canceled = false;

		async function load() {
			try {
				const out = await apiFetch<PublicMenuOut>(`/api/public/menus/${encodeURIComponent(menuId)}`, {
					cache: 'no-store',
				});
				if (canceled) return;
				setFetchedItems(out.items ?? []);
			} catch {
				if (canceled) return;
				setFetchedItems(FALLBACK_ITEMS);
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [menuId, items]);

	if (menuId === 'none') return null;

	const effectiveItems = Array.isArray(items) ? items : fetchedItems;

	return (
		<footer className='mt-10 border-t bg-muted/10'>
			<div className='max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6'>
				<div className='text-sm font-semibold'>
					<Link href='/'>HooshPro</Link>
				</div>

				<nav className='flex flex-wrap items-center gap-2'>
					{effectiveItems.map((it) => (
						<Link
							key={it.id ?? `${it.href}:${it.label}`}
							href={it.href}
							className='text-sm px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground'>
							{it.label}
						</Link>
					))}
				</nav>
			</div>
		</footer>
	);
}
