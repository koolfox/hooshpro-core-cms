'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/http';
import type { PublicMenuOut } from '@/lib/types';
import { Button } from '@/components/ui/button';

type MenuItem = {
	id?: string;
	label: string;
	href: string;
};

const FALLBACK_ITEMS: MenuItem[] = [{ label: 'Home', href: '/' }];

function isHashHref(href: string): boolean {
	return href.trim().startsWith('#');
}

export function PublicTopNav({ menuId, items }: { menuId: string; items?: MenuItem[] }) {
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
		<header className='border-b bg-base-100/90 backdrop-blur supports-[backdrop-filter]:bg-base-100/75'>
			<div className='mx-auto flex h-16 max-w-7xl items-center gap-4 px-4'>
				<Link href='/' className='text-sm font-semibold tracking-tight'>
					HooshPro
				</Link>

				<nav className='ml-auto flex flex-wrap items-center gap-1'>
					{effectiveItems.map((it) =>
						isHashHref(it.href) ? (
							<a
								key={it.id ?? `${it.href}:${it.label}`}
								href={it.href}
								className='btn btn-ghost btn-sm normal-case font-medium'>
								{it.label}
							</a>
						) : (
							<Link
								key={it.id ?? `${it.href}:${it.label}`}
								href={it.href}
								className='btn btn-ghost btn-sm normal-case font-medium'>
								{it.label}
							</Link>
						)
					)}
				</nav>

				<Button asChild variant='outline' size='sm'>
					<Link href='/admin'>Admin</Link>
				</Button>
			</div>
		</header>
	);
}

