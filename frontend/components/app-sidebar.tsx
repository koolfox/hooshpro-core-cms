'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	Blocks,
	Database,
	FileText,
	ImageIcon,
	LayoutTemplate,
	LayoutDashboard,
	ListOrdered,
	LogOut,
	Palette,
	Puzzle,
	Settings,
	Tags,
} from 'lucide-react';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from '@/components/ui/sidebar';

import { apiFetch } from '@/lib/http';

const nav = [
	{ title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
	{ title: 'Pages', href: '/admin/pages', icon: FileText },
	{ title: 'Templates', href: '/admin/templates', icon: LayoutTemplate },
	{ title: 'Components', href: '/admin/components', icon: Puzzle },
	{ title: 'Blocks', href: '/admin/blocks', icon: Blocks },
	{ title: 'Collections', href: '/admin/collections', icon: Database },
	{ title: 'Entries', href: '/admin/entries', icon: ListOrdered },
	{ title: 'Taxonomies', href: '/admin/taxonomies', icon: Tags },
	{ title: 'Media', href: '/admin/media', icon: ImageIcon },
	{ title: 'Themes', href: '/admin/themes', icon: Palette },
	{ title: 'Settings', href: '/admin/settings', icon: Settings },
] as const;

function isActivePath(pathname: string, href: string) {
	return pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();

	async function logout() {
		try {
			await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST', nextPath: '/auth/login' });
		} finally {
			window.location.href = '/auth/login';
		}
	}

	return (
		<Sidebar
			collapsible='icon'
			className='top-(--header-height) h-[calc(100svh-var(--header-height))]!'
			{...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size='lg'
							tooltip='HooshPro'
							asChild>
							<Link href='/admin'>
								<div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
									<span className='text-xs font-bold'>
										HP
									</span>
								</div>
								<div className='grid flex-1 text-left text-sm leading-tight'>
									<span className='truncate font-medium'>
										HooshPro
									</span>
									<span className='truncate text-xs'>
										CMS
									</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarMenu>
					{nav.map((item) => (
						<SidebarMenuItem key={item.href}>
							<SidebarMenuButton
								asChild
								isActive={isActivePath(pathname, item.href)}
								tooltip={item.title}>
								<Link href={item.href}>
									<item.icon />
									<span>{item.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarContent>

			<SidebarFooter>
				<SidebarSeparator />
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							type='button'
							onClick={logout}
							tooltip='Logout'>
							<LogOut />
							<span>Logout</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}

