'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/http';
import type { PublicMenuOut } from '@/lib/types';

type MenuItem = { id?: string; label: string; href: string };

const FALLBACK_ITEMS: MenuItem[] = [{ label: 'Home', href: '/' }];

function isHashHref(href: string): boolean {
	return href.trim().startsWith('#');
}

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
	const year = new Date().getFullYear();

	return (
		<footer className='mt-12 border-t bg-base-200/40'>
			<div className='mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between'>
				<div className='text-sm font-semibold'>
					<Link href='/'>HooshPro</Link>
				</div>

				<nav className='flex flex-wrap items-center gap-1'>
					{effectiveItems.map((it) =>
						isHashHref(it.href) ? (
							<a
								key={it.id ?? `${it.href}:${it.label}`}
								href={it.href}
								className='btn btn-ghost btn-sm normal-case text-base-content/70'>
								{it.label}
							</a>
						) : (
							<Link
								key={it.id ?? `${it.href}:${it.label}`}
								href={it.href}
								className='btn btn-ghost btn-sm normal-case text-base-content/70'>
								{it.label}
							</Link>
						)
					)}
				</nav>
			</div>
			<div className='border-t border-base-300/60 py-3 text-center text-xs text-base-content/60'>© {year} HooshPro</div>
		</footer>
	);
}
