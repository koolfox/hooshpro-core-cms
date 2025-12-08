'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

export default function AppLayout({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();

	const [authState, setAuthState] = useState<AuthState>('checking');

	useEffect(() => {
		const token = localStorage.getItem('hooshpro_token');
		console.log('[AppLayout] origin', window.location.origin);
		console.log(
			'[AppLayout] token:',
			localStorage.getItem('hooshpro_token')
		);
		if (!token) {
			setAuthState('unauthenticated');
			const t = setTimeout(() => {
				router.replace('/login');
			}, 400);
			return () => clearTimeout(t);
		}

		setAuthState('authenticated');
	}, [router]);

	if (authState === 'checking') {
		return (
			<div className='min-h-screen flex items-center justify-center text-slate-500'>
				CHECKING ...
			</div>
		);
	}

	if (authState == 'unauthenticated') {
		return (
			<div className='min-h-screen flex items-center justify-center text-slate-500'>
				REDIRECTING TO LOGIN PAGE ...
			</div>
		);
	}

	if (authState === 'authenticated') {
		return (
			<div className='min-h-screen flex bg-slate-950 text-slate-50'>
				{/*sidebar*/}
				<aside className='hidden md:flex ms:w-64 flex-col border-r border-slate-800 p-4'>
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
							className={clsx(
								'block rounded-md px-3 py-2 hover:bg-slate-900',
								pathname === '/app' &&
									'bg-slate-900 text-slate-50'
							)}>
							Dashboard
						</Link>
						<Link
							href='/app/profile'
							className={clsx(
								'block rounded-md px-3 py-2 hover:bg-slate-900',
								pathname === '/app/profile' &&
									'bg-slate-900 text-slate-50'
							)}>
							Profile
						</Link>
					</nav>
				</aside>
				{/*MAIN*/}
				<div className='flex-1 flex flex-col'>
					<header className='h-12 border-b border-slate-800 flex items-center justify-between px-4'>
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
