'use client';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

type TipTapValue = {
	doc: any;
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

	function setLink() {
		const prev = editor.getAttributes('link').href as string | undefined;
		const url = window.prompt('Enter URL', prev ?? 'https://');
		if (url === null) return;

		if (url.trim() === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		editor
			.chain()
			.focus()
			.extendMarkRange('link')
			.setLink({ href: url.trim() })
			.run();
	}

	function addImage() {
		const url = window.prompt('Image URL');
		if (!url) return;
		editor.chain().focus().setImage({ src: url.trim() }).run();
	}

	return (
		<div className='rounded-xl border overflow-hidden'>
			<div className='flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30'>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('bold'))}
					onClick={() => editor.chain().focus().toggleBold().run()}>
					B
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('italic'))}
					onClick={() => editor.chain().focus().toggleItalic().run()}>
					I
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('strike'))}
					onClick={() => editor.chain().focus().toggleStrike().run()}>
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
						editor.isActive('heading', { level: 2 })
					)}
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}>
					H2
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(
						editor.isActive('heading', { level: 3 })
					)}
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
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
					className={isActiveClass(editor.isActive('bulletList'))}
					onClick={() =>
						editor.chain().focus().toggleBulletList().run()
					}>
					• List
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('orderedList'))}
					onClick={() =>
						editor.chain().focus().toggleOrderedList().run()
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
					className={isActiveClass(editor.isActive('blockquote'))}
					onClick={() =>
						editor.chain().focus().toggleBlockquote().run()
					}>
					Quote
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('codeBlock'))}
					onClick={() =>
						editor.chain().focus().toggleCodeBlock().run()
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
					onClick={() => editor.chain().focus().undo().run()}
					disabled={!editor.can().chain().focus().undo().run()}>
					Undo
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					onClick={() => editor.chain().focus().redo().run()}
					disabled={!editor.can().chain().focus().redo().run()}>
					Redo
				</Button>
			</div>

			<div className='p-4'>
				<div className='prose prose-neutral dark:prose-invert max-w-none'>
					<EditorContent editor={editor} />
				</div>
			</div>
		</div>
	);
}
