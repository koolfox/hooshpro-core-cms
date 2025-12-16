import { AppSidebar } from '@/components/ui/app-sidebar';
import {
	SidebarInset,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
} from '@/components/ui/sidebar';

export default function AdminLayout({
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
					<SidebarSeparator
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
