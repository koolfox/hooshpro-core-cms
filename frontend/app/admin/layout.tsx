import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@/components/ui/sidebar';

const COOKIE_NAME = 'hooshpro_session';

function buildNextParam(): string {
	return '/admin/pages';
}

async function requireAdminSession() {
	const token = (await cookies()).get(COOKIE_NAME)?.value;
	if (!token) {
		redirect(`/auth/login?next=${encodeURIComponent(buildNextParam())}`);
	}

	const apiOrigin = process.env.API_ORIGIN || 'http://127.0.0.1:8000';

	const res = await fetch(`${apiOrigin}/api/auth/me`, {
		method: 'GET',
		cache: 'no-store',
		headers: {
			cookie: `${COOKIE_NAME}=${token}`,
		},
	});

	if (!res.ok) {
		redirect(`/auth/login?next=${encodeURIComponent(buildNextParam())}`);
	}
}

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	await requireAdminSession();

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

				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
