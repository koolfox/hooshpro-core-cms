'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/http';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { PublicMenuOut } from '@/lib/types';

type MenuItem = {
	id?: string;
	label: string;
	href: string;
};

const FALLBACK_ITEMS: MenuItem[] = [{ label: 'Home', href: '/' }];

export function PublicTopNav({ menuId, items }: { menuId: string; items?: MenuItem[] }) {
	const pathname = usePathname();
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
		<header className='bg-background/80 backdrop-blur border-b'>
			<div className='max-w-6xl mx-auto h-14 px-4 flex items-center justify-between gap-4'>
				<Link
					href='/'
					className='text-sm font-semibold'>
					HooshPro
				</Link>

				<nav className='flex items-center gap-2'>
					{effectiveItems.map((it) => (
						<Link
							key={it.id ?? `${it.href}:${it.label}`}
							href={it.href}
							className={cn(
								'text-sm px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground',
								pathname === it.href
									? 'bg-accent text-accent-foreground'
									: 'text-muted-foreground'
							)}>
							{it.label}
						</Link>
					))}

					<Button
						asChild
						variant='outline'
						size='sm'>
						<Link href='/admin'>Admin</Link>
					</Button>
				</nav>
			</div>
		</header>
	);
}
