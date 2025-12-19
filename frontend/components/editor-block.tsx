'use client';

import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

import type { EditorValue } from '@/lib/page-builder';

import { Button } from '@/components/ui/button';

type Props = {
	value: EditorValue;
	onChange: (next: EditorValue) => void;
	disabled?: boolean;
};

function isActiveClass(active: boolean) {
	return active ? 'bg-muted' : '';
}

export function EditorBlock({ value, onChange, disabled }: Props) {
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
			Placeholder.configure({
				placeholder: 'Write…',
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

	function setLink() {
		if (!editor) return;
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

	if (!editor) {
		return (
			<div className='rounded-xl border p-4 text-sm text-muted-foreground'>
				Loading editor…
			</div>
		);
	}

	return (
		<div className='rounded-xl border bg-background overflow-hidden'>
			<BubbleMenu
				editor={editor}
				className='flex items-center gap-1 rounded-lg border bg-popover/95 shadow-sm p-1'>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('bold'))}
					disabled={disabled}
					onClick={() => editor.chain().focus().toggleBold().run()}>
					B
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('italic'))}
					disabled={disabled}
					onClick={() => editor.chain().focus().toggleItalic().run()}>
					I
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('strike'))}
					disabled={disabled}
					onClick={() => editor.chain().focus().toggleStrike().run()}>
					S
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('bulletList'))}
					disabled={disabled}
					onClick={() => editor.chain().focus().toggleBulletList().run()}>
					• List
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('orderedList'))}
					disabled={disabled}
					onClick={() => editor.chain().focus().toggleOrderedList().run()}>
					1. List
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className={isActiveClass(editor.isActive('link'))}
					disabled={disabled}
					onClick={setLink}>
					Link
				</Button>
			</BubbleMenu>

			<div className='p-4'>
				<div className='prose prose-neutral dark:prose-invert max-w-none'>
					<EditorContent editor={editor} />
				</div>
			</div>
		</div>
	);
}
