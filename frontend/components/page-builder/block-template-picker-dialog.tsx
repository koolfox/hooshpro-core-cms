'use client';

import type { BlockTemplate } from '@/lib/types';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

import { BlockTemplateBrowser } from './block-template-browser';

export function BlockTemplatePickerDialog({
	open,
	onOpenChange,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (block: BlockTemplate) => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-5xl'>
				<DialogHeader>
					<DialogTitle>Insert a block</DialogTitle>
					<DialogDescription>
						Blocks are reusable section templates (one or more rows).
					</DialogDescription>
				</DialogHeader>

				<BlockTemplateBrowser active={open} resetOnInactive initialCategory='pages' onPick={onPick} />
			</DialogContent>
		</Dialog>
	);
}
