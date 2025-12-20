'use client';

import * as React from 'react';
import { GripVertical } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { cn } from '@/lib/utils';

type ResizablePanelGroupProps = Omit<
	React.ComponentPropsWithoutRef<typeof Group>,
	'orientation'
> & {
	direction?: 'horizontal' | 'vertical';
};

function ResizablePanelGroup({
	className,
	direction = 'horizontal',
	...props
}: ResizablePanelGroupProps) {
	return (
		<Group
			orientation={direction}
			className={cn('flex h-full w-full', className)}
			{...props}
		/>
	);
}

const ResizablePanel = Panel;

function ResizableHandle({
	withHandle,
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof Separator> & {
	withHandle?: boolean;
}) {
	return (
		<Separator
			className={cn(
				'relative flex w-3 items-center justify-center bg-transparent after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
				className
			)}
			{...props}>
			{withHandle ? (
				<div className='z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border'>
					<GripVertical className='h-2.5 w-2.5' />
				</div>
			) : null}
		</Separator>
	);
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
