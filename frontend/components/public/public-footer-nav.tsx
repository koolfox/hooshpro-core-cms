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

	if (menuId === 'jeweler-footer') {
		const year = new Date().getFullYear();
		const hasLinks = effectiveItems.length > 0;

		return (
			<footer className='jeweler-footer' id='contact' aria-label='Footer'>
				<div className='jeweler-container jeweler-footer-top'>
					<svg className='jeweler-footer-mark' viewBox='0 0 120 82' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
						<path d='M60 6 106 32 60 76 14 32 60 6Z' stroke='rgb(200 183 154 / 0.85)' strokeWidth='4' />
					</svg>

					<p>
						Sed non mauris vitae erat consequat auctor eu in elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Mauris in erat justo.
					</p>

					{hasLinks ? (
						<nav className='mt-6 flex flex-wrap justify-center gap-2'>
							{effectiveItems.map((it) =>
								isHashHref(it.href) ? (
									<a
										key={it.id ?? `${it.href}:${it.label}`}
										href={it.href}
										className='text-sm px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground'>
										{it.label}
									</a>
								) : (
									<Link
										key={it.id ?? `${it.href}:${it.label}`}
										href={it.href}
										className='text-sm px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground'>
										{it.label}
									</Link>
								)
							)}
						</nav>
					) : null}
				</div>

				<div className='jeweler-footer-bottom'>
					<div className='jeweler-container'>
						© {year} HooshPro • <a href='#top'>Back to top</a>
					</div>
				</div>
			</footer>
		);
	}

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
