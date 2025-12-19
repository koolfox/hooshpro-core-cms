'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type MenuItem = {
	label: string;
	href: string;
};

const MENUS: Record<string, { items: MenuItem[] }> = {
	main: {
		items: [
			{ label: 'Home', href: '/' },
		],
	},
};

export function PublicTopNav({ menuId }: { menuId: string }) {
	const pathname = usePathname();
	if (menuId === 'none') return null;

	const menu = MENUS[menuId] ?? MENUS.main;

	return (
		<header className='bg-background/80 backdrop-blur border-b'>
			<div className='max-w-6xl mx-auto h-14 px-4 flex items-center justify-between gap-4'>
				<Link
					href='/'
					className='text-sm font-semibold'>
					HooshPro
				</Link>

				<nav className='flex items-center gap-2'>
					{menu.items.map((it) => (
						<Link
							key={it.href}
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

