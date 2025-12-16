import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/ui/app-sidebar';
import {
	SidebarProvider,
	SidebarTrigger,
	SidebarInset,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

const COOKIE_NAME = 'hooshpro_token';

async function requireAuth() {
	const cookieStore = await cookies();
	const token = cookieStore.get(COOKIE_NAME)?.value;

	if (!token) redirect('/login');

	const res = await fetch(
		`${process.env.API_ORIGIN ?? 'http://127.0.0.1:8000'}/api/auth/me`,
		{
			headers: { Authorization: `Bearer ${token}` },
			cache: 'no-store',
		}
	);

	if (!res.ok) redirect('/login');
}

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	await requireAuth();

	return (
		<SidebarProvider defaultOpen>
			<AppSidebar />
			<SidebarInset>
				<header className='flex h-14 items-center gap-2 border-b px-4'>
					<SidebarTrigger />
					<Separator
						orientation='vertical'
						className='h-6'
					/>
					<div className='text-sm font-medium'>HooshPro Admin</div>
				</header>
				<main className='p-6'>{children}</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
