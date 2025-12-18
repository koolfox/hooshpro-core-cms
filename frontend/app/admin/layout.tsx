import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

const COOKIE_NAME = 'hooshpro_session';
const SIDEBAR_COOKIE_NAME = 'sidebar_state';

function buildNextParam(): string {
	return '/admin/pages';
}

async function requireAdminSession(token: string) {
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
	const cookieStore = await cookies();

	const token = cookieStore.get(COOKIE_NAME)?.value;
	if (!token) {
		redirect(`/auth/login?next=${encodeURIComponent(buildNextParam())}`);
	}

	const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
	const defaultOpen = sidebarCookie ? sidebarCookie === 'true' : true;

	await requireAdminSession(token);

	return (
		<div className='[--header-height:calc(--spacing(14))]'>
			<SidebarProvider
				defaultOpen={defaultOpen}
				className='flex flex-col'>
				<SiteHeader />

				<div className='flex flex-1'>
					<AppSidebar />
					<SidebarInset>{children}</SidebarInset>
				</div>
			</SidebarProvider>
		</div>
	);
}
