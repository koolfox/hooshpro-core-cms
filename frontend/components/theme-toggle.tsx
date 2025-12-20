'use client';

import { useTheme } from 'next-themes';
import { Laptop, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ThemeValue = 'light' | 'dark' | 'system';

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	const current: ThemeValue =
		theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';

	const icon =
		current === 'dark' ? (
			<Moon className='h-4 w-4' />
		) : current === 'light' ? (
			<Sun className='h-4 w-4' />
		) : (
			<Laptop className='h-4 w-4' />
		);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					aria-label='Theme'>
					{icon}
					<span className='ml-2 hidden sm:inline'>Theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align='end'
				className='min-w-[10rem]'>
				<DropdownMenuRadioGroup
					value={current}
					onValueChange={(v) => setTheme(v as ThemeValue)}>
					<DropdownMenuRadioItem value='system'>
						<Laptop className='h-4 w-4' />
						System
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value='light'>
						<Sun className='h-4 w-4' />
						Light
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value='dark'>
						<Moon className='h-4 w-4' />
						Dark
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
