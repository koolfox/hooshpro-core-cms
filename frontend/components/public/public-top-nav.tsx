'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/http';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import type { PublicMenuOut } from '@/lib/types';

type MenuItem = {
	id?: string;
	label: string;
	href: string;
};

const FALLBACK_ITEMS: MenuItem[] = [{ label: 'Home', href: '/' }];

function isHashHref(href: string): boolean {
	return href.trim().startsWith('#');
}

function splitMenu(items: MenuItem[]): [MenuItem[], MenuItem[]] {
	if (items.length <= 2) return [items, []];
	const split = Math.ceil(items.length / 2);
	return [items.slice(0, split), items.slice(split)];
}

export function PublicTopNav({ menuId, items }: { menuId: string; items?: MenuItem[] }) {
	const pathname = usePathname();
	const [fetchedItems, setFetchedItems] = useState<MenuItem[]>(FALLBACK_ITEMS);
	const [mobileOpen, setMobileOpen] = useState(false);

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

	if (menuId === 'jeweler-main') {
		const [left, right] = splitMenu(effectiveItems);
		const all = [...left, ...right];

		return (
			<header className='jeweler-site-header' role='banner'>
				<div className='jeweler-container jeweler-header-grid'>
					<nav className='jeweler-nav left' aria-label='Primary left'>
						{left.map((it) =>
							isHashHref(it.href) ? (
								<a key={it.id ?? `${it.href}:${it.label}`} href={it.href}>
									{it.label}
								</a>
							) : (
								<Link key={it.id ?? `${it.href}:${it.label}`} href={it.href}>
									{it.label}
								</Link>
							)
						)}
					</nav>

					<a className='jeweler-logo' href='#top' aria-label='Home'>
						<svg viewBox='0 0 120 82' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
							<path d='M60 6 106 32 60 76 14 32 60 6Z' stroke='rgb(200 183 154 / 0.95)' strokeWidth='4' />
							<path d='M38 33h44' stroke='rgb(200 183 154 / 0.65)' strokeWidth='3' />
							<path d='M52 26v14M68 26v14' stroke='rgb(200 183 154 / 0.65)' strokeWidth='3' strokeLinecap='round' />
						</svg>
					</a>

					<nav className='jeweler-nav right' aria-label='Primary right'>
						{right.map((it) =>
							isHashHref(it.href) ? (
								<a key={it.id ?? `${it.href}:${it.label}`} href={it.href}>
									{it.label}
								</a>
							) : (
								<Link key={it.id ?? `${it.href}:${it.label}`} href={it.href}>
									{it.label}
								</Link>
							)
						)}
					</nav>

					<button
						type='button'
						className='jeweler-menu-btn'
						aria-expanded={mobileOpen}
						aria-controls='jeweler-mobile-menu'
						aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
						onClick={() => setMobileOpen((v) => !v)}>
						<span className='bars' aria-hidden='true'>
							<i />
							<i />
							<i />
						</span>
					</button>
				</div>

				<div className='jeweler-mobile-menu' id='jeweler-mobile-menu' hidden={!mobileOpen}>
					<div className='jeweler-container'>
						<div className='inner'>
							{all.map((it) =>
								isHashHref(it.href) ? (
									<a
										key={it.id ?? `${it.href}:${it.label}`}
										href={it.href}
										onClick={() => setMobileOpen(false)}>
										{it.label}
									</a>
								) : (
									<Link
										key={it.id ?? `${it.href}:${it.label}`}
										href={it.href}
										onClick={() => setMobileOpen(false)}>
										{it.label}
									</Link>
								)
							)}
						</div>
					</div>
				</div>
			</header>
		);
	}

	return (
		<header className='bg-background/80 backdrop-blur border-b'>
			<div className='max-w-6xl mx-auto h-14 px-4 flex items-center justify-between gap-4'>
				<Link
					href='/'
					className='text-sm font-semibold'>
					HooshPro
				</Link>

				<div className='flex items-center gap-2'>
					<NavigationMenu>
						<NavigationMenuList className='flex-wrap justify-end'>
							{effectiveItems.map((it) => (
								<NavigationMenuItem key={it.id ?? `${it.href}:${it.label}`}>
									<NavigationMenuLink
										asChild
										active={pathname === it.href}
										className={cn(navigationMenuTriggerStyle(), 'text-muted-foreground')}>
										<Link href={it.href}>{it.label}</Link>
									</NavigationMenuLink>
								</NavigationMenuItem>
							))}
						</NavigationMenuList>
					</NavigationMenu>

					<Button
						asChild
						variant='outline'
						size='sm'>
						<Link href='/admin'>Admin</Link>
					</Button>
				</div>
			</div>
		</header>
	);
}
