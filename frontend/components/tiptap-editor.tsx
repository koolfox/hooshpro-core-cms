'use client';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { MediaPickerDialog } from '@/components/media/media-picker-dialog';

type TipTapValue = {
	doc: JSONContent;
	html: string;
};

type Props = {
	value: TipTapValue;
	onChange: (next: TipTapValue) => void;
	disabled?: boolean;
};

function isActiveClass(active: boolean) {
	return active ? 'bg-muted' : '';
}

export function TipTapEditor({ value, onChange, disabled }: Props) {
	const [blocksOpen, setBlocksOpen] = useState(false);
	const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

	const editor = useEditor({
		editable: !disabled,
		extensions: [
			StarterKit,
			Link.configure({
				openOnClick: false,
				autolink: true,
				linkOnPaste: true,
				HTMLAttributes: {
					rel: 'noopener noreferrer nofollow',
					target: '_blank',
				},
			}),
			Image,
			Placeholder.configure({
				placeholder: 'Start writing…',
			}),
		],
		content: value?.doc ?? {
			type: 'doc',
			content: [{ type: 'paragraph' }],
		},
		immediatelyRender: false,
		onUpdate({ editor }) {
			onChange({
				doc: editor.getJSON(),
				html: editor.getHTML(),
			});
		},
	});

	// when parent changes value (load page), sync editor
	useEffect(() => {
		if (!editor) return;
		const nextDoc = value?.doc;
		if (!nextDoc) return;

		const current = editor.getJSON();
		const curStr = JSON.stringify(current);
		const nextStr = JSON.stringify(nextDoc);
		if (curStr !== nextStr) {
			editor.commands.setContent(nextDoc);
		}
	}, [editor, value?.doc]);

	useEffect(() => {
		if (!editor) return;
		editor.setEditable(!disabled);
	}, [editor, disabled]);

	if (!editor) {
		return (
			<div className='rounded-xl border p-4 text-sm text-muted-foreground'>
				Loading editor…
			</div>
		);
	}

	const ed = editor;

	function setLink() {
		const prev = ed.getAttributes('link').href as string | undefined;
		const url = window.prompt('Enter URL', prev ?? 'https://');
		if (url === null) return;

		if (url.trim() === '') {
			ed.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		ed
			.chain()
			.focus()
			.extendMarkRange('link')
			.setLink({ href: url.trim() })
			.run();
	}

	function addImage() {
		const url = window.prompt('Image URL');
		if (!url) return;
		ed.chain().focus().setImage({ src: url.trim() }).run();
	}

	return (
		<div className='rounded-xl border overflow-hidden'>
			<div className='flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30'>
				<Sheet
					open={blocksOpen}
					onOpenChange={setBlocksOpen}>
					<SheetTrigger asChild>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							disabled={disabled}>
							Blocks
						</Button>
					</SheetTrigger>
					<SheetContent side='right'>
						<SheetHeader>
							<SheetTitle>Blocks</SheetTitle>
							<SheetDescription>
								Insert common blocks and templates.
							</SheetDescription>
						</SheetHeader>

						<div className='p-4 space-y-6'>
							<div className='space-y-2'>
								<p className='text-xs font-medium text-muted-foreground'>
									Text
								</p>
								<div className='grid grid-cols-2 gap-2'>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.setParagraph()
												.run();
											setBlocksOpen(false);
										}}>
										Paragraph
									</Button>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.toggleHeading({ level: 2 })
												.run();
											setBlocksOpen(false);
										}}>
										Heading 2
									</Button>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.toggleHeading({ level: 3 })
												.run();
											setBlocksOpen(false);
										}}>
										Heading 3
									</Button>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.toggleBlockquote()
												.run();
											setBlocksOpen(false);
										}}>
										Quote
									</Button>
								</div>
							</div>

							<div className='space-y-2'>
								<p className='text-xs font-medium text-muted-foreground'>
									Lists
								</p>
								<div className='grid grid-cols-2 gap-2'>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.toggleBulletList()
												.run();
											setBlocksOpen(false);
										}}>
										Bulleted
									</Button>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.toggleOrderedList()
												.run();
											setBlocksOpen(false);
										}}>
										Numbered
									</Button>
								</div>
							</div>

							<div className='space-y-2'>
								<p className='text-xs font-medium text-muted-foreground'>
									Media
								</p>
								<div className='grid grid-cols-1 gap-2'>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											setBlocksOpen(false);
											setMediaPickerOpen(true);
										}}>
										Insert image from library
									</Button>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											addImage();
											setBlocksOpen(false);
										}}>
										Insert image from URL
									</Button>
								</div>
							</div>

							<div className='space-y-2'>
								<p className='text-xs font-medium text-muted-foreground'>
									Other
								</p>
								<div className='grid grid-cols-2 gap-2'>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.setHorizontalRule()
												.run();
											setBlocksOpen(false);
										}}>
										Divider
									</Button>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.toggleCodeBlock()
												.run();
											setBlocksOpen(false);
										}}>
										Code block
									</Button>
								</div>
							</div>

							<div className='space-y-2'>
								<p className='text-xs font-medium text-muted-foreground'>
									Templates (MVP)
								</p>
								<div className='grid grid-cols-1 gap-2'>
									<Button
										type='button'
										variant='outline'
										disabled={disabled}
										onClick={() => {
											editor
												.chain()
												.focus()
												.insertContent([
													{
														type: 'heading',
														attrs: { level: 2 },
														content: [
															{
																type: 'text',
																text: 'Section headline',
															},
														],
													},
													{
														type: 'paragraph',
														content: [
															{
																type: 'text',
																text: 'Write something…',
															},
														],
													},
												])
												.run();
											setBlocksOpen(false);
										}}>
										Insert section
									</Button>
								</div>
							</div>
						</div>
					</SheetContent>
				</Sheet>

				<MediaPickerDialog
					open={mediaPickerOpen}
					onOpenChange={setMediaPickerOpen}
					onPick={(m) => {
						ed.chain().focus().setImage({ src: m.url }).run();
					}}
				/>

				<Separator
					orientation='vertical'
					className='mx-1 h-6'
				/>

				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(ed.isActive('bold'))}
					onClick={() => ed.chain().focus().toggleBold().run()}>
					B
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(ed.isActive('italic'))}
					onClick={() => ed.chain().focus().toggleItalic().run()}>
					I
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(ed.isActive('strike'))}
					onClick={() => ed.chain().focus().toggleStrike().run()}>
					S
				</Button>

				<Separator
					orientation='vertical'
					className='mx-1 h-6'
				/>

				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(
						ed.isActive('heading', { level: 2 })
					)}
					onClick={() =>
						ed.chain().focus().toggleHeading({ level: 2 }).run()
					}>
					H2
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(
						ed.isActive('heading', { level: 3 })
					)}
					onClick={() =>
						ed.chain().focus().toggleHeading({ level: 3 }).run()
					}>
					H3
				</Button>

				<Separator
					orientation='vertical'
					className='mx-1 h-6'
				/>

				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(ed.isActive('bulletList'))}
					onClick={() =>
						ed.chain().focus().toggleBulletList().run()
					}>
					• List
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(ed.isActive('orderedList'))}
					onClick={() =>
						ed.chain().focus().toggleOrderedList().run()
					}>
					1. List
				</Button>

				<Separator
					orientation='vertical'
					className='mx-1 h-6'
				/>

				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(ed.isActive('blockquote'))}
					onClick={() =>
						ed.chain().focus().toggleBlockquote().run()
					}>
					Quote
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(ed.isActive('codeBlock'))}
					onClick={() =>
						ed.chain().focus().toggleCodeBlock().run()
					}>
					Code
				</Button>

				<Separator
					orientation='vertical'
					className='mx-1 h-6'
				/>

				<Button
					type='button'
					variant='ghost'
					size='sm'
					onClick={setLink}>
					Link
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					onClick={addImage}>
					Image
				</Button>

				<Separator
					orientation='vertical'
					className='mx-1 h-6'
				/>

				<Button
					type='button'
					variant='ghost'
					size='sm'
					onClick={() => ed.chain().focus().undo().run()}
					disabled={!ed.can().chain().focus().undo().run()}>
					Undo
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					onClick={() => ed.chain().focus().redo().run()}
					disabled={!ed.can().chain().focus().redo().run()}>
					Redo
				</Button>
			</div>

			<div className='p-4'>
				<div className='prose prose-neutral dark:prose-invert max-w-none'>
					<EditorContent editor={ed} />
				</div>
			</div>
		</div>
	);
}
