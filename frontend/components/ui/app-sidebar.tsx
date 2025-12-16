import { FileText, Home, Settings } from 'lucide-react';
import Link from 'next/link';

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';

const items = [
	{ title: 'Dashboard', href: '/admin', icon: Home },
	{ title: 'Pages', href: '/admin/pages', icon: FileText },
	{ title: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AppSidebar() {
	return (
		<Sidebar collapsible='icon'>
			<SidebarHeader className='px-2 py-2'>
				<div className='px-2 text-sm font-semibold'>HooshPro</div>
			</SidebarHeader>

			<SidebarContent>
				<SidebarMenu>
					{items.map((it) => (
						<SidebarMenuItem key={it.href}>
							<SidebarMenuButton asChild>
								<Link href={it.href}>
									<it.icon className='size-4' />
									<span>{it.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarContent>
			<SidebarFooter className='p-2'>
				<div className='text-xs text-muted-foreground px-2'>Admin</div>
			</SidebarFooter>
		</Sidebar>
	);
}
