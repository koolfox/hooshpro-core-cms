import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@/components/ui/sidebar';

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
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
