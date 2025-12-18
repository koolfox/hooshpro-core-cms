'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

function titleFromPathname(pathname: string): string {
	if (pathname === '/admin') return 'Dashboard';
	if (pathname.startsWith('/admin/pages')) return 'Pages';
	if (pathname.startsWith('/admin/media')) return 'Media';
	return '';
}

export function SiteHeader({
	title,
	right,
}: {
	title?: string;
	right?: ReactNode;
}) {
	const pathname = usePathname();
	const resolvedTitle = title ?? titleFromPathname(pathname);

	return (
		<header className='bg-background sticky top-0 z-50 flex w-full items-center border-b'>
			<div className='flex h-(--header-height) w-full items-center gap-2 px-4'>
				<SidebarTrigger />
				<Separator
					orientation='vertical'
					className='mr-2 h-4'
				/>

				<Link
					href='/admin'
					className='text-sm font-semibold'>
					HooshPro
				</Link>

				{resolvedTitle ? (
					<span className='text-sm text-muted-foreground'>
						/ {resolvedTitle}
					</span>
				) : null}

				{right ? (
					<div className='ml-auto flex items-center gap-2'>
						{right}
					</div>
				) : null}
			</div>
		</header>
	);
}
