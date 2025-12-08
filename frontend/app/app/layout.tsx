'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AppLayoutProps {
	children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
	const router = useRouter();
	const pathname = usePathname();

	const [checkedAuth, setCheckedAuth] = useState(false);

	useEffect(() => {
		const token = localStorage.getItem('hooshpro_token');

		if (!token) {
			router.replace('/login');
			return;
		}

		setCheckedAuth(true);
	}, [router]);

	if (!checkedAuth) {
		return (
			<div className='min-h-screen flex items-center justify-center text-gray-500'>
				{/*sidebar*/}
				<aside className='w-64 border-r border-slate-800 p-4 hidden md:flex flex-col'>
					<div className='mb-6'>
						<span className='text-xs uppercase tracking-wide text-slate-500'>
							Hooshpro
						</span>
						<div className='text-lg font-semibold'>
							Control Panel
						</div>
					</div>

					<nav className='space-y-1 text-sm'>
						<Link
							href='/app'
							className='{clsx(
                        "block rounded-md px-3 py-2 hover:bg-slate-900",
                        pathname==="/app"&&"bg-slate-900 text-slate-50"
                        )}'>
							Dashboard
						</Link>
						<Link
							href='/app/profile'
							className='{clsx(
                        "block rounded-md px-3 py-2 hover:bg-slate-900",
                        pathname==="/app/profile"&&"bg-slate-900 text-slate-50"
                        )}'>
							Profile
						</Link>
					</nav>
				</aside>
				{/*MAIN*/}
				<div className='flex-1 flex flex-col'>
					<header className='h-14 border-b border-slate-800 flex items-center justify-between px-4'>
						<div className='text-sm text-slate-400'>
							{pathname === '/app' ? 'dashboard' : 'Hooshpro'}
						</div>
						<button
							className='text-xs text-slate-400 hover:text-slate-100'
							onClick={() => {
								localStorage.removeItem('hooshpro_token');
								router.replace('/login');
							}}>
							Logout
						</button>
					</header>
					<main className='flex-1 p-4'>{children}</main>
				</div>
			</div>
		);
	}
}
