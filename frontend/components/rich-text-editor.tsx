'use client';

import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

type Props = {
	value: string;
	onChange: (html: string) => void;
	disabled?: boolean;
	placeholder?: string;
};

function isActive(btn: boolean) {
	return btn ? 'bg-muted' : '';
}

export default function RichTextEditor({
	value,
	onChange,
	disabled,
	placeholder = 'Write…',
}: Props) {
	const editor = useEditor({
		extensions: [
			StarterKit,
			Link.configure({
				openOnClick: false,
				autolink: true,
				linkOnPaste: true,
			}),
			Placeholder.configure({ placeholder }),
		],
		content: value || '<p></p>',
		editable: !disabled,
		onUpdate({ editor }) {
			onChange(editor.getHTML());
		},
		editorProps: {
			attributes: {
				class: 'prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[220px] px-3 py-3',
			},
		},
	});

	useEffect(() => {
		if (!editor) return;
		const current = editor.getHTML();
		if ((value || '') !== current) {
			editor.commands.setContent(value || '<p></p>');
		}
	}, [value, editor]);

	function setLink() {
		if (!editor) return;
		const prev = editor.getAttributes('link')?.href as string | undefined;
		const url = window.prompt('Link URL', prev || '');
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
			<div className='rounded-xl border p-3 text-sm text-muted-foreground'>
				Loading editor…
			</div>
		);
	}

	return (
		<div className='rounded-xl border overflow-hidden'>
			<div className='flex flex-wrap items-center gap-2 p-2 border-b bg-muted/20'>
				<Button
					type='button'
					size='sm'
					variant='outline'
					disabled={disabled}
					className={isActive(editor.isActive('bold'))}
					onClick={() => editor.chain().focus().toggleBold().run()}>
					B
				</Button>

				<Button
					type='button'
					size='sm'
					variant='outline'
					disabled={disabled}
					className={isActive(editor.isActive('italic'))}
					onClick={() => editor.chain().focus().toggleItalic().run()}>
					I
				</Button>

				<Button
					type='button'
					size='sm'
					variant='outline'
					disabled={disabled}
					className={isActive(editor.isActive('strike'))}
					onClick={() => editor.chain().focus().toggleStrike().run()}>
					S
				</Button>

				<div className='w-px h-6 bg-border mx-1' />

				<Button
					type='button'
					size='sm'
					variant='outline'
					disabled={disabled}
					className={isActive(editor.isActive('bulletList'))}
					onClick={() =>
						editor.chain().focus().toggleBulletList().run()
					}>
					• List
				</Button>

				<Button
					type='button'
					size='sm'
					variant='outline'
					disabled={disabled}
					className={isActive(editor.isActive('orderedList'))}
					onClick={() =>
						editor.chain().focus().toggleOrderedList().run()
					}>
					1. List
				</Button>

				<div className='w-px h-6 bg-border mx-1' />

				<Button
					type='button'
					size='sm'
					variant='outline'
					disabled={disabled}
					className={isActive(editor.isActive('link'))}
					onClick={setLink}>
					Link
				</Button>

				<Button
					type='button'
					size='sm'
					variant='outline'
					disabled={disabled}
					onClick={() =>
						editor
							.chain()
							.focus()
							.unsetAllMarks()
							.clearNodes()
							.run()
					}>
					Clear
				</Button>
			</div>

			<EditorContent editor={editor} />
		</div>
	);
}
