import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
	return (
		<div className='min-h-screen flex bg-slate-950 text-slate-50'>
			<aside className='w-64 border-r border-slate-800 bg-slate-900/60 px-4 py-6'>
				<div className='mb-8'>
					<h1 className='text-xl font-semibold tracking-light'>
						HooshPro Admin
					</h1>
					<p className='text-xs text-slate-400 mt-1'>
						Dynamic content engine v1
					</p>
				</div>
				<nav className='space-y-1 text-sm'>
					<Link
						href='/app/admin'
						className='block rounded-md px-3 py-2 hover:bg-slate-800/70 transition'>
						Dashboard
					</Link>
					<Link
						href='/app/admin/page'
						className='block rounded-md px-3 py-2 hover:bg-slate-800/70 transition'>
						Pages
					</Link>
				</nav>
			</aside>
			<main className='flex-1 px-6 py-8'>{children}</main>
		</div>
	);
}
