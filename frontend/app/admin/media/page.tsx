'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	type DragEndEvent,
	type DragStartEvent,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FileImage, Folder, GripVertical, LayoutGrid, List } from 'lucide-react';
import {
	buildAdminMediaListUrl,
	ADMIN_MEDIA_FOLDERS_URL,
	createAdminMediaFolder,
	deleteAdminMedia,
	deleteAdminMediaFolder,
	updateAdminMedia,
	updateAdminMediaFolder,
	uploadAdminMedia,
} from '@/lib/api/media';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api-list';
import { AdminListPage } from '@/components/admin/admin-list-page';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatUiError } from '@/lib/error-message';
import type {
	MediaAsset,
	MediaFolder,
	MediaFolderListOut,
	MediaListOut,
} from '@/lib/types';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const LIMIT = 40;
const SUPPORTED_TYPES_LABEL = 'JPG, PNG, WEBP, GIF, SVG';
const MAX_BYTES_LABEL = '10MB';
const EMPTY_FOLDERS: MediaFolder[] = [];
const EMPTY_MEDIA: MediaAsset[] = [];

function parsePageParam(value: string | null): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function parseFolderParam(value: string | null): number | null {
	const v = (value ?? '').trim().toLowerCase();
	if (!v) return 0;
	if (v === 'all') return null;
	const n = Number.parseInt(v, 10);
	if (!Number.isFinite(n) || n < 0) return 0;
	return n;
}

type ViewMode = 'icons' | 'details';

function parseViewParam(value: string | null): ViewMode {
	const v = (value ?? '').trim().toLowerCase();
	if (v === 'details' || v === 'tree' || v === 'list') return 'details';
	return 'icons';
}

type SortDir = 'asc' | 'desc';

const SORT_FIELDS = ['created_at', 'name', 'size_bytes', 'content_type'] as const;
type MediaSort = (typeof SORT_FIELDS)[number];
const DEFAULT_SORT: MediaSort = 'created_at';
const DEFAULT_DIR: SortDir = 'desc';

function parseSortParam(value: string | null): MediaSort {
	const v = (value ?? '').trim().toLowerCase();
	if ((SORT_FIELDS as readonly string[]).includes(v)) return v as MediaSort;
	return DEFAULT_SORT;
}

function parseDirParam(value: string | null): SortDir {
	const v = (value ?? '').trim().toLowerCase();
	return v === 'asc' ? 'asc' : DEFAULT_DIR;
}

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
}

function prettyBytes(n: number) {
	if (!Number.isFinite(n)) return '-';
	if (n < 1024) return `${n} B`;
	const kb = n / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	return `${mb.toFixed(1)} MB`;
}

function formatIsoUtc(iso: string) {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
	} catch {
		return iso;
	}
}

type FolderNode = { folder: MediaFolder; depth: number };

function compareFolderName(a: string, b: string): number {
	const aa = a.trim().toLowerCase();
	const bb = b.trim().toLowerCase();

	if (aa < bb) return -1;
	if (aa > bb) return 1;
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

function buildFolderNodes(folders: MediaFolder[]): FolderNode[] {
	const byParent = new Map<number, MediaFolder[]>();

	for (const f of folders) {
		const key = f.parent_id ?? 0;
		const list = byParent.get(key) ?? [];
		list.push(f);
		byParent.set(key, list);
	}

	for (const list of byParent.values()) {
		list.sort((a, b) => compareFolderName(a.name, b.name));
	}

	const out: FolderNode[] = [];

	function walk(parentId: number, depth: number) {
		const children = byParent.get(parentId) ?? [];
		for (const f of children) {
			out.push({ folder: f, depth });
			walk(f.id, depth + 1);
		}
	}

	walk(0, 0);
	return out;
}

type DndMediaData = { kind: 'media'; mediaId: number };
type DndFolderData = { kind: 'folder'; folderId: number };
type DndData = DndMediaData | DndFolderData;

function mediaDndId(mediaId: number) {
	return `media:${mediaId}`;
}

function folderItemDndId(folderId: number) {
	return `folder:${folderId}`;
}

type FolderDropScope = 'tree' | 'browser';

function folderTargetDndId(scope: FolderDropScope, folderId: number) {
	return `folder-target:${scope}:${folderId}`;
}

function FolderDropTarget({
	scope = 'tree',
	folderId,
	onClick,
	className,
	style,
	children,
}: {
	scope?: FolderDropScope;
	folderId: number;
	onClick?: () => void;
	className?: string;
	style?: CSSProperties;
	children: ReactNode;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: folderTargetDndId(scope, folderId),
		data: { kind: 'folder', folderId } satisfies DndData,
	});

	return (
		<button
			ref={setNodeRef}
			type='button'
			onClick={onClick}
			style={style}
			className={cn(className, isOver && 'ring-2 ring-ring')}>
			{children}
		</button>
	);
}

function FolderDropTargetStatic({
	onClick,
	className,
	style,
	children,
}: {
	scope?: FolderDropScope;
	folderId: number;
	onClick?: () => void;
	className?: string;
	style?: CSSProperties;
	children: ReactNode;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			style={style}
			className={className}>
			{children}
		</button>
	);
}

function FolderTile({
	folder,
	onOpen,
	dragDisabled,
}: {
	folder: MediaFolder;
	onOpen: () => void;
	dragDisabled?: boolean;
}) {
	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: folderTargetDndId('browser', folder.id),
		data: { kind: 'folder', folderId: folder.id } satisfies DndData,
	});

	const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } =
		useDraggable({
			id: folderItemDndId(folder.id),
			data: { kind: 'folder', folderId: folder.id } satisfies DndData,
			disabled: !!dragDisabled,
		});

	const setNodeRef = (node: HTMLElement | null) => {
		setDropRef(node);
		setDragRef(node);
	};

	const style: CSSProperties | undefined = transform
		? { transform: CSS.Transform.toString(transform) }
		: undefined;

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				'rounded-lg border overflow-hidden bg-background cursor-pointer',
				isOver && 'ring-2 ring-ring',
				isDragging && 'opacity-60'
			)}
			role='button'
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') onOpen();
			}}>
			<div className='relative aspect-video bg-muted/20 flex items-center justify-center'>
				<Folder className='h-9 w-9 text-muted-foreground' />
				<button
					type='button'
					{...listeners}
					{...attributes}
					onClick={(e) => e.stopPropagation()}
					className='absolute top-2 right-2 rounded-md border bg-background/80 p-1 text-muted-foreground hover:text-foreground'>
					<GripVertical className='h-4 w-4' />
				</button>
			</div>
			<div className='p-2'>
				<div className='text-sm font-medium truncate'>{folder.name}</div>
				<div className='text-xs text-muted-foreground'>Folder</div>
			</div>
		</div>
	);
}

function FolderTileStatic({
	folder,
	onOpen,
}: {
	folder: MediaFolder;
	onOpen: () => void;
	dragDisabled?: boolean;
}) {
	return (
		<div
			className={cn('rounded-lg border overflow-hidden bg-background cursor-pointer')}
			role='button'
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') onOpen();
			}}>
			<div className='relative aspect-video bg-muted/20 flex items-center justify-center'>
				<Folder className='h-9 w-9 text-muted-foreground' />
				<button
					type='button'
					disabled
					onClick={(e) => e.stopPropagation()}
					className='absolute top-2 right-2 rounded-md border bg-background/80 p-1 text-muted-foreground'>
					<GripVertical className='h-4 w-4' />
				</button>
			</div>
			<div className='p-2'>
				<div className='text-sm font-medium truncate'>{folder.name}</div>
				<div className='text-xs text-muted-foreground'>Folder</div>
			</div>
		</div>
	);
}

function MediaTile({
	media,
	onDelete,
	dragDisabled,
}: {
	media: MediaAsset;
	onDelete: () => void;
	dragDisabled?: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: mediaDndId(media.id),
		data: { kind: 'media', mediaId: media.id } satisfies DndData,
		disabled: !!dragDisabled,
	});

	const style: CSSProperties | undefined = transform
		? { transform: CSS.Transform.toString(transform) }
		: undefined;

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				'rounded-lg border overflow-hidden bg-background',
				isDragging && 'opacity-60'
			)}>
			<div className='relative aspect-video bg-muted/30'>
				<Image
					src={media.url}
					alt={media.original_name}
					fill
					unoptimized
					sizes='(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw'
					className='object-cover'
				/>
				<button
					type='button'
					{...listeners}
					{...attributes}
					className='absolute top-2 right-2 rounded-md border bg-background/80 p-1 text-muted-foreground hover:text-foreground'>
					<GripVertical className='h-4 w-4' />
				</button>
			</div>
			<div className='p-3 space-y-2'>
				<div className='text-xs text-muted-foreground line-clamp-2'>
					{media.original_name}
				</div>
				<div className='text-xs text-muted-foreground flex items-center justify-between'>
					<span>{prettyBytes(media.size_bytes)}</span>
					<Button
						size='sm'
						variant='destructive'
						onClick={onDelete}>
						Delete
					</Button>
				</div>
			</div>
		</div>
	);
}

function MediaTileStatic({
	media,
	onDelete,
}: {
	media: MediaAsset;
	onDelete: () => void;
	dragDisabled?: boolean;
}) {
	return (
		<div className={cn('rounded-lg border overflow-hidden bg-background')}>
			<div className='relative aspect-video bg-muted/30'>
				<Image
					src={media.url}
					alt={media.original_name}
					fill
					unoptimized
					sizes='(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw'
					className='object-cover'
				/>
				<button
					type='button'
					disabled
					className='absolute top-2 right-2 rounded-md border bg-background/80 p-1 text-muted-foreground'>
					<GripVertical className='h-4 w-4' />
				</button>
			</div>
			<div className='p-3 space-y-2'>
				<div className='text-xs text-muted-foreground line-clamp-2'>
					{media.original_name}
				</div>
				<div className='text-xs text-muted-foreground flex items-center justify-between'>
					<span>{prettyBytes(media.size_bytes)}</span>
					<Button
						size='sm'
						variant='destructive'
						onClick={onDelete}>
						Delete
					</Button>
				</div>
			</div>
		</div>
	);
}

function FolderRow({
	folder,
	onOpen,
	dragDisabled,
}: {
	folder: MediaFolder;
	onOpen: () => void;
	dragDisabled?: boolean;
}) {
	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: folderTargetDndId('browser', folder.id),
		data: { kind: 'folder', folderId: folder.id } satisfies DndData,
	});

	const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } =
		useDraggable({
			id: folderItemDndId(folder.id),
			data: { kind: 'folder', folderId: folder.id } satisfies DndData,
			disabled: !!dragDisabled,
		});

	const setNodeRef = (node: HTMLElement | null) => {
		setDropRef(node);
		setDragRef(node);
	};

	const style: CSSProperties | undefined = transform
		? { transform: CSS.Transform.toString(transform) }
		: undefined;

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				'grid grid-cols-[auto_auto_1fr_auto] sm:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center p-3',
				isOver && 'bg-muted/40',
				isDragging && 'opacity-60'
			)}>
			<button
				type='button'
				{...listeners}
				{...attributes}
				disabled={!!dragDisabled}
				className='rounded-md border bg-background/80 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing'>
				<GripVertical className='h-4 w-4' />
			</button>

			<div className='rounded-md border bg-muted/20 h-10 w-10 flex items-center justify-center'>
				<Folder className='h-5 w-5 text-muted-foreground' />
			</div>

			<button
				type='button'
				onClick={onOpen}
				className='min-w-0 text-left'>
				<div className='font-medium truncate'>{folder.name}</div>
				<div className='text-xs text-muted-foreground'>Folder</div>
			</button>

			<div className='hidden sm:block text-xs text-muted-foreground'>—</div>
			<div className='hidden sm:block text-xs text-muted-foreground'>
				{formatIsoUtc(folder.updated_at)}
			</div>

			<Button
				size='sm'
				variant='outline'
				onClick={onOpen}>
				Open
			</Button>
		</div>
	);
}

function FolderRowStatic({
	folder,
	onOpen,
}: {
	folder: MediaFolder;
	onOpen: () => void;
	dragDisabled?: boolean;
}) {
	return (
		<div className='grid grid-cols-[auto_auto_1fr_auto] sm:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center p-3'>
			<button
				type='button'
				disabled
				className='rounded-md border bg-background/80 p-1 text-muted-foreground'>
				<GripVertical className='h-4 w-4' />
			</button>

			<div className='rounded-md border bg-muted/20 h-10 w-10 flex items-center justify-center'>
				<Folder className='h-5 w-5 text-muted-foreground' />
			</div>

			<button
				type='button'
				onClick={onOpen}
				className='min-w-0 text-left'>
				<div className='font-medium truncate'>{folder.name}</div>
				<div className='text-xs text-muted-foreground'>Folder</div>
			</button>

			<div className='hidden sm:block text-xs text-muted-foreground'>—</div>
			<div className='hidden sm:block text-xs text-muted-foreground'>
				{formatIsoUtc(folder.updated_at)}
			</div>

			<Button
				size='sm'
				variant='outline'
				onClick={onOpen}>
				Open
			</Button>
		</div>
	);
}

function MediaRow({
	media,
	onDelete,
	dragDisabled,
}: {
	media: MediaAsset;
	onDelete: () => void;
	dragDisabled?: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: mediaDndId(media.id),
		data: { kind: 'media', mediaId: media.id } satisfies DndData,
		disabled: !!dragDisabled,
	});

	const style: CSSProperties | undefined = transform
		? { transform: CSS.Transform.toString(transform) }
		: undefined;

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				'grid grid-cols-[auto_auto_1fr_auto] sm:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center p-3',
				isDragging && 'opacity-60'
			)}>
			<button
				type='button'
				{...listeners}
				{...attributes}
				disabled={!!dragDisabled}
				className='rounded-md border bg-background/80 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing'>
				<GripVertical className='h-4 w-4' />
			</button>

			<div className='rounded-md border bg-muted/20 h-10 w-10 overflow-hidden relative'>
				<Image
					src={media.url}
					alt={media.original_name}
					fill
					unoptimized
					sizes='40px'
					className='object-cover'
				/>
			</div>

			<div className='min-w-0'>
				<div className='font-medium truncate'>{media.original_name}</div>
				<div className='text-xs text-muted-foreground flex items-center gap-2'>
					<FileImage className='h-3.5 w-3.5' />
					<span className='truncate'>{media.content_type}</span>
				</div>
			</div>

			<div className='hidden sm:block text-xs text-muted-foreground'>
				{prettyBytes(media.size_bytes)}
			</div>
			<div className='hidden sm:block text-xs text-muted-foreground'>
				{formatIsoUtc(media.created_at)}
			</div>

			<Button
				size='sm'
				variant='destructive'
				onClick={onDelete}>
				Delete
			</Button>
		</div>
	);
}

function MediaRowStatic({
	media,
	onDelete,
}: {
	media: MediaAsset;
	onDelete: () => void;
	dragDisabled?: boolean;
}) {
	return (
		<div className='grid grid-cols-[auto_auto_1fr_auto] sm:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center p-3'>
			<button
				type='button'
				disabled
				className='rounded-md border bg-background/80 p-1 text-muted-foreground'>
				<GripVertical className='h-4 w-4' />
			</button>

			<div className='rounded-md border bg-muted/20 h-10 w-10 overflow-hidden relative'>
				<Image
					src={media.url}
					alt={media.original_name}
					fill
					unoptimized
					sizes='40px'
					className='object-cover'
				/>
			</div>

			<div className='min-w-0'>
				<div className='font-medium truncate'>{media.original_name}</div>
				<div className='text-xs text-muted-foreground flex items-center gap-2'>
					<FileImage className='h-3.5 w-3.5' />
					<span className='truncate'>{media.content_type}</span>
				</div>
			</div>

			<div className='hidden sm:block text-xs text-muted-foreground'>
				{prettyBytes(media.size_bytes)}
			</div>
			<div className='hidden sm:block text-xs text-muted-foreground'>
				{formatIsoUtc(media.created_at)}
			</div>

			<Button
				size='sm'
				variant='destructive'
				onClick={onDelete}>
				Delete
			</Button>
		</div>
	);
}

export default function MediaScreen() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);

	const urlQ = (searchParams.get('q') ?? '').trim();
	const urlPage = parsePageParam(searchParams.get('page'));
	const urlOffset = (urlPage - 1) * LIMIT;
	const urlFolderFilter = parseFolderParam(searchParams.get('folder_id'));
	const urlView = parseViewParam(searchParams.get('view'));
	const urlSort = parseSortParam(searchParams.get('sort'));
	const urlDir = parseDirParam(searchParams.get('dir'));

	const [offset, setOffset] = useState(urlOffset);
	const [qInput, setQInput] = useState(urlQ);
	const [q, setQ] = useState(urlQ);
	const [view, setView] = useState<ViewMode>(urlView);
	const [sortInput, setSortInput] = useState<MediaSort>(urlSort);
	const [dirInput, setDirInput] = useState<SortDir>(urlDir);
	const [sort, setSort] = useState<MediaSort>(urlSort);
	const [dir, setDir] = useState<SortDir>(urlDir);

	// folders: null = all media, 0 = root
	const [folderFilter, setFolderFilter] = useState<number | null>(urlFolderFilter);

	const [folderCreateOpen, setFolderCreateOpen] = useState(false);
	const [folderCreateName, setFolderCreateName] = useState('');
	const [folderCreateParentId, setFolderCreateParentId] = useState<number>(0);
	const [folderCreateSaving, setFolderCreateSaving] = useState(false);
	const [folderCreateError, setFolderCreateError] = useState<string | null>(null);

	const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<MediaFolder | null>(null);
	const [folderActionError, setFolderActionError] = useState<string | null>(null);

	const [uploadOpen, setUploadOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploadStatus, setUploadStatus] = useState<string | null>(null);
	const [dragActive, setDragActive] = useState(false);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const fileRef = useRef<HTMLInputElement | null>(null);
	const suppressNextFolderOpenRef = useRef(false);

	const [confirmDelete, setConfirmDelete] = useState<MediaAsset | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const { data: foldersData, loading: foldersLoading, error: foldersError, reload: reloadFolders } =
		useApiList<MediaFolderListOut>(ADMIN_MEDIA_FOLDERS_URL, {
			nextPath: '/admin/media',
		});

	const folders = foldersData?.items ?? EMPTY_FOLDERS;
	const foldersById = useMemo(() => {
		const m = new Map<number, MediaFolder>();
		for (const f of folders) m.set(f.id, f);
		return m;
	}, [folders]);

	const folderNodes = useMemo(() => buildFolderNodes(folders), [folders]);
	const selectedFolder = useMemo(() => {
		if (folderFilter === null || folderFilter === 0) return null;
		return folders.find((f) => f.id === folderFilter) ?? null;
	}, [folders, folderFilter]);

	const childFolders = useMemo(() => {
		const children =
			folderFilter === null || folderFilter === 0
				? folders.filter((f) => f.parent_id == null)
				: folders.filter((f) => f.parent_id === folderFilter);

		return [...children].sort((a, b) => compareFolderName(a.name, b.name));
	}, [folders, folderFilter]);

	useEffect(() => {
		setOffset(urlOffset);
		setQ(urlQ);
		setQInput(urlQ);
		setFolderFilter(urlFolderFilter);
		setView(urlView);
		setSort(urlSort);
		setDir(urlDir);
		setSortInput(urlSort);
		setDirInput(urlDir);
	}, [urlOffset, urlQ, urlFolderFilter, urlView, urlSort, urlDir]);

	function updateUrl(next: {
		page?: number;
		q?: string;
		folder?: number | null;
		view?: ViewMode;
		sort?: MediaSort;
		dir?: SortDir;
	}) {
		const params = new URLSearchParams(searchParams.toString());

		const page = next.page ?? parsePageParam(params.get('page'));
		if (page > 1) params.set('page', String(page));
		else params.delete('page');

		const nextQ = (next.q ?? params.get('q') ?? '').trim();
		if (nextQ) params.set('q', nextQ);
		else params.delete('q');

		const rawFolder = next.folder ?? parseFolderParam(params.get('folder_id'));
		if (rawFolder === null) {
			params.set('folder_id', 'all');
		} else if (rawFolder === 0) {
			params.delete('folder_id');
		} else {
			params.set('folder_id', String(rawFolder));
		}

		const nextView = next.view ?? parseViewParam(params.get('view'));
		if (nextView === 'details') params.set('view', 'details');
		else params.delete('view');

		const rawSort = (next.sort ?? parseSortParam(params.get('sort'))).trim().toLowerCase();
		const nextSort = parseSortParam(rawSort);

		const rawDir = (next.dir ?? parseDirParam(params.get('dir'))).trim().toLowerCase();
		const nextDir: SortDir = rawDir === 'asc' ? 'asc' : DEFAULT_DIR;

		if (nextSort === DEFAULT_SORT && nextDir === DEFAULT_DIR) {
			params.delete('sort');
			params.delete('dir');
		} else {
			params.set('sort', nextSort);
			params.set('dir', nextDir);
		}

		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname);
	}

	function goToOffset(nextOffset: number) {
		const safeOffset = Math.max(0, Math.floor(nextOffset / LIMIT) * LIMIT);
		setOffset(safeOffset);
		updateUrl({ page: safeOffset / LIMIT + 1 });
	}

	const listUrl = useMemo(
		() =>
			buildAdminMediaListUrl({
				limit: LIMIT,
				offset,
				folder_id: folderFilter,
				q,
				sort: sort !== DEFAULT_SORT || dir !== DEFAULT_DIR ? sort : undefined,
				dir: sort !== DEFAULT_SORT || dir !== DEFAULT_DIR ? dir : undefined,
			}),
		[offset, q, folderFilter, sort, dir]
	);

	const { data, loading, error, reload } = useApiList<MediaListOut>(listUrl, {
		nextPath: '/admin/media',
	});

	const items = data?.items ?? EMPTY_MEDIA;
	const total = data?.total ?? 0;

	type BrowserNode =
		| { kind: 'folder'; folder: MediaFolder }
		| { kind: 'media'; media: MediaAsset };

	const browserNodes = useMemo<BrowserNode[]>(() => {
		const out: BrowserNode[] = [];
		for (const f of childFolders) out.push({ kind: 'folder', folder: f });
		for (const m of items) out.push({ kind: 'media', media: m });
		return out;
	}, [childFolders, items]);

	const currentLocationLabel =
		folderFilter === null
			? 'All media'
			: folderFilter === 0
				? 'Root'
				: selectedFolder?.name ?? 'Folder';

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
	);

	const [dragMediaId, setDragMediaId] = useState<number | null>(null);
	const dragMedia = useMemo(() => {
		if (!dragMediaId) return null;
		return items.find((m) => m.id === dragMediaId) ?? null;
	}, [dragMediaId, items]);

	const [dragFolderId, setDragFolderId] = useState<number | null>(null);
	const dragFolder = useMemo(() => {
		if (!dragFolderId) return null;
		return foldersById.get(dragFolderId) ?? null;
	}, [dragFolderId, foldersById]);

	const [movingMediaId, setMovingMediaId] = useState<number | null>(null);
	const [movingFolderId, setMovingFolderId] = useState<number | null>(null);
	const dragDisabled = movingMediaId !== null || movingFolderId !== null;

	async function moveMediaToFolder(mediaId: number, folderId: number) {
		if (movingMediaId) return;

		const current = items.find((m) => m.id === mediaId);
		const currentFolderId = typeof current?.folder_id === 'number' ? current.folder_id : 0;
		if (currentFolderId === folderId) return;

		setMovingMediaId(mediaId);
		try {
			await updateAdminMedia(mediaId, { folder_id: folderId }, '/admin/media');
			setActionError(null);
			await reload();
		} catch (e) {
			setActionError(toErrorMessage(e));
		} finally {
			setMovingMediaId(null);
		}
	}

	function wouldCreateFolderCycle(folderId: number, parentId: number): boolean {
		if (parentId <= 0) return false;

		let cur = parentId;
		for (let i = 0; i < 2000; i++) {
			if (cur === folderId) return true;
			const next = foldersById.get(cur)?.parent_id ?? null;
			if (!next) return false;
			cur = next;
		}

		return true;
	}

	async function moveFolderToParent(folderId: number, parentId: number) {
		if (movingFolderId) return;

		const folder = foldersById.get(folderId);
		if (!folder) return;

		const currentParentId = folder.parent_id ?? 0;
		if (currentParentId === parentId) return;
		if (folderId === parentId) return;

		if (wouldCreateFolderCycle(folderId, parentId)) {
			setFolderActionError('Cannot move a folder into itself or a descendant folder.');
			return;
		}

		setMovingFolderId(folderId);
		try {
			await updateAdminMediaFolder(folderId, { parent_id: parentId }, '/admin/media');
			setFolderActionError(null);
			await reloadFolders();
		} catch (e) {
			setFolderActionError(toErrorMessage(e));
		} finally {
			setMovingFolderId(null);
		}
	}

	function suppressNextFolderOpen() {
		suppressNextFolderOpenRef.current = true;
		setTimeout(() => {
			suppressNextFolderOpenRef.current = false;
		}, 0);
	}

	function onDragStart(event: DragStartEvent) {
		const data = event.active.data.current as DndData | undefined;
		if (data?.kind === 'media') {
			setDragMediaId(data.mediaId);
			setDragFolderId(null);
		}
		if (data?.kind === 'folder') {
			setDragFolderId(data.folderId);
			setDragMediaId(null);
		}
	}

	function onDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		const activeData = active.data.current as DndData | undefined;
		const overData = over?.data.current as DndData | undefined;

		if (activeData?.kind === 'media' && overData?.kind === 'folder') {
			suppressNextFolderOpen();
			void moveMediaToFolder(activeData.mediaId, overData.folderId);
		}

		if (activeData?.kind === 'folder' && overData?.kind === 'folder') {
			suppressNextFolderOpen();
			void moveFolderToParent(activeData.folderId, overData.folderId);
		}

		setDragMediaId(null);
		setDragFolderId(null);
	}

	function onDragCancel() {
		setDragMediaId(null);
		setDragFolderId(null);
	}

	function onPickFiles(list: FileList | null) {
		const files = Array.from(list ?? []);
		setPendingFiles(files);
		setUploadError(null);
	}

	function applyFilters() {
		const nextQ = qInput.trim();
		const nextSort = sortInput;
		const nextDir = dirInput;
		setOffset(0);
		setQ(nextQ);
		setSort(nextSort);
		setDir(nextDir);
		updateUrl({ page: 1, q: nextQ, sort: nextSort, dir: nextDir });
	}

	function resetFilters() {
		setOffset(0);
		setQInput('');
		setSortInput(DEFAULT_SORT);
		setDirInput(DEFAULT_DIR);
		setQ('');
		setSort(DEFAULT_SORT);
		setDir(DEFAULT_DIR);
		updateUrl({ page: 1, q: '', sort: DEFAULT_SORT, dir: DEFAULT_DIR });
	}

	function setViewMode(next: ViewMode) {
		setView(next);
		updateUrl({ view: next });
	}

	function selectFolder(next: number | null) {
		setOffset(0);
		setFolderFilter(next);
		updateUrl({ page: 1, folder: next });
	}

	function onFolderClick(next: number | null) {
		if (suppressNextFolderOpenRef.current) {
			suppressNextFolderOpenRef.current = false;
			return;
		}
		selectFolder(next);
	}

	function openCreateFolder() {
		setFolderCreateName('');
		setFolderCreateParentId(
			folderFilter !== null && folderFilter > 0 ? folderFilter : 0
		);
		setFolderCreateError(null);
		setFolderCreateOpen(true);
	}

	async function doCreateFolder() {
		setFolderCreateSaving(true);
		setFolderCreateError(null);

		try {
			const payload = {
				name: folderCreateName.trim(),
				parent_id: folderCreateParentId === 0 ? null : folderCreateParentId,
			};

			const created = await createAdminMediaFolder(payload, '/admin/media');

			setFolderCreateOpen(false);
			setFolderCreateName('');
			setFolderCreateParentId(0);
			setFolderActionError(null);

			await reloadFolders();
			selectFolder(created.id);
		} catch (e) {
			setFolderCreateError(toErrorMessage(e));
		} finally {
			setFolderCreateSaving(false);
		}
	}

	async function doDeleteFolder(f: MediaFolder) {
		try {
			await deleteAdminMediaFolder(f.id, '/admin/media');
			setConfirmDeleteFolder(null);
			setFolderActionError(null);

			if (folderFilter === f.id) selectFolder(0);
			await reloadFolders();
		} catch (e) {
			setFolderActionError(toErrorMessage(e));
		}
	}

	async function doUpload() {
		if (pendingFiles.length === 0) return;

		setUploading(true);
		setUploadError(null);
		setUploadStatus(null);

		let okCount = 0;
		try {
			for (let i = 0; i < pendingFiles.length; i++) {
				const f = pendingFiles[i];
				setUploadStatus(
					`Uploading ${i + 1}/${pendingFiles.length}: ${f.name}`
				);

				const fd = new FormData();
				fd.append('file', f);
				fd.append('folder_id', String(folderFilter ?? 0));

				await uploadAdminMedia(f, folderFilter ?? 0, '/admin/media');
				okCount++;
			}

			setUploadOpen(false);
			setPendingFiles([]);
			if (fileRef.current) fileRef.current.value = '';
			setActionError(null);
		} catch (e) {
			setUploadError(toErrorMessage(e));
		} finally {
			setUploadStatus(null);
			setUploading(false);
			if (okCount > 0) await reload();
		}
	}

	async function doDelete(m: MediaAsset) {
		try {
			await deleteAdminMedia(m.id, '/admin/media');
			setConfirmDelete(null);

			const nextTotal = Math.max(0, total - 1);
				const lastOffset = Math.max(
					0,
					Math.floor(Math.max(0, nextTotal - 1) / LIMIT) * LIMIT
				);
				const nextOffset = Math.min(offset, lastOffset);
				goToOffset(nextOffset);
				setActionError(null);
				if (nextOffset === offset) await reload();
			} catch (e) {
				setActionError(toErrorMessage(e));
		}
	}

	return (
		<AdminListPage
			title='Media'
			description='Upload images, reuse them in pages later.'
			actions={
				<Button
					onClick={() => setUploadOpen(true)}
					disabled={loading}>
					Upload
				</Button>
			}
			filters={
				<div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
					<div className='md:col-span-7 space-y-2'>
						<Label>Search</Label>
						<Input
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							placeholder='Search by filename...'
							onKeyDown={(e) => {
								if (e.key === 'Enter') applyFilters();
								if (e.key === 'Escape') resetFilters();
							}}
						/>
					</div>
					<div className='md:col-span-3 space-y-2'>
						<Label>Sort</Label>
						<Select
							value={sortInput}
							onValueChange={(v) => setSortInput(v as MediaSort)}
							disabled={loading}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='created_at'>Created</SelectItem>
								<SelectItem value='name'>Name</SelectItem>
								<SelectItem value='size_bytes'>Size</SelectItem>
								<SelectItem value='content_type'>Type</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='md:col-span-2 space-y-2'>
						<Label>Order</Label>
						<Select
							value={dirInput}
							onValueChange={(v) => setDirInput(v as SortDir)}
							disabled={loading}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='desc'>desc</SelectItem>
								<SelectItem value='asc'>asc</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='md:col-span-12 flex gap-2 justify-end'>
						<Button
							variant='outline'
							onClick={resetFilters}
							disabled={loading}>
							Reset
						</Button>
						<Button
							onClick={applyFilters}
							disabled={loading}>
							Apply
						</Button>
					</div>
				</div>
			}
			total={total}
			offset={offset}
			limit={LIMIT}
			loading={loading}
			onPrev={() => goToOffset(offset - LIMIT)}
			onNext={() => goToOffset(offset + LIMIT)}
			onSetOffset={goToOffset}>

				{(() => {
					const DropTarget = hydrated ? FolderDropTarget : FolderDropTargetStatic;
					const BrowserFolderTile = hydrated ? FolderTile : FolderTileStatic;
					const BrowserMediaTile = hydrated ? MediaTile : MediaTileStatic;
					const BrowserFolderRow = hydrated ? FolderRow : FolderRowStatic;
					const BrowserMediaRow = hydrated ? MediaRow : MediaRowStatic;

					const content = (
						<div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
							<div className='lg:col-span-3'>
								<div className='rounded-xl border p-4 space-y-3'>
									<div className='flex items-start justify-between gap-3'>
										<div className='space-y-1'>
											<div className='text-sm font-medium'>Folders</div>
											<div className='text-xs text-muted-foreground'>
												{hydrated
													? 'Drag media or folders onto a folder to move.'
													: 'Loading drag & drop…'}
											</div>
										</div>
										<Button
											size='sm'
											variant='outline'
											onClick={openCreateFolder}
											disabled={foldersLoading}>
											New
										</Button>
									</div>

									{foldersLoading ? (
										<p className='text-sm text-muted-foreground'>Loading folders…</p>
									) : null}
									{foldersError ? <p className='text-sm text-red-600'>{foldersError}</p> : null}
									{folderActionError ? (
										<p className='text-sm text-red-600'>{folderActionError}</p>
									) : null}

									<div className='space-y-1'>
										<button
											type='button'
											className={cn(
												'w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted',
												folderFilter === null && 'bg-muted font-medium'
											)}
											onClick={() => onFolderClick(null)}>
											All media
										</button>

										<DropTarget
											folderId={0}
											onClick={() => onFolderClick(0)}
											className={cn(
												'w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted flex items-center gap-2',
												folderFilter === 0 && 'bg-muted font-medium'
											)}>
											<Folder className='h-4 w-4 text-muted-foreground' />
											<span>Root</span>
										</DropTarget>

										{folderNodes.map(({ folder, depth }) => (
											<DropTarget
												key={folder.id}
												folderId={folder.id}
												onClick={() => onFolderClick(folder.id)}
												style={{ paddingLeft: `${8 + depth * 12}px` }}
												className={cn(
													'w-full rounded-md py-1 pr-2 text-left text-sm hover:bg-muted flex items-center gap-2',
													folderFilter === folder.id && 'bg-muted font-medium'
												)}>
												<Folder className='h-4 w-4 text-muted-foreground shrink-0' />
												<span className='truncate'>{folder.name}</span>
											</DropTarget>
										))}
									</div>

									{selectedFolder ? (
										<Button
											size='sm'
											variant='destructive'
											onClick={() => setConfirmDeleteFolder(selectedFolder)}
											disabled={foldersLoading}>
											Delete “{selectedFolder.name}”
										</Button>
									) : null}
								</div>
							</div>

							<div className='lg:col-span-9 space-y-4'>
								{loading ? (
									<p className='text-sm text-muted-foreground'>Loading…</p>
								) : null}
								{error ? <p className='text-sm text-red-600'>{error}</p> : null}
								{actionError ? (
									<p className='text-sm text-red-600'>{actionError}</p>
								) : null}

								<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
									<div className='space-y-0.5'>
										<div className='text-sm font-medium'>{currentLocationLabel}</div>
										<div className='text-xs text-muted-foreground'>
											{hydrated
												? 'Drag items onto folders to organize them.'
												: 'Drag & drop is enabled after load.'}
										</div>
									</div>

									<div className='flex items-center gap-2'>
										<Button
											size='sm'
											variant={view === 'icons' ? 'secondary' : 'outline'}
											onClick={() => setViewMode('icons')}
											disabled={loading}>
											<LayoutGrid className='h-4 w-4 mr-2' />
											Icons
										</Button>
										<Button
											size='sm'
											variant={view === 'details' ? 'secondary' : 'outline'}
											onClick={() => setViewMode('details')}
											disabled={loading}>
											<List className='h-4 w-4 mr-2' />
											Details
										</Button>
									</div>
								</div>

								{!loading && !error && browserNodes.length === 0 ? (
									<div className='rounded-xl border p-6'>
										<p className='text-sm text-muted-foreground'>
											Nothing here yet. Upload media or create a folder.
										</p>
									</div>
								) : null}

								{!loading && !error && browserNodes.length > 0 ? (
									view === 'details' ? (
										<div className='rounded-xl border overflow-hidden divide-y'>
											<div className='hidden sm:grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center p-3 bg-muted/40 text-xs font-medium text-muted-foreground'>
												<div />
												<div />
												<div>Name</div>
												<div>Size</div>
												<div>Date</div>
												<div />
											</div>
											{browserNodes.map((n) =>
												n.kind === 'folder' ? (
													<BrowserFolderRow
														key={`folder:${n.folder.id}`}
														folder={n.folder}
														onOpen={() => onFolderClick(n.folder.id)}
														dragDisabled={dragDisabled}
													/>
												) : (
													<BrowserMediaRow
														key={`media:${n.media.id}`}
														media={n.media}
														onDelete={() => setConfirmDelete(n.media)}
														dragDisabled={dragDisabled}
													/>
												)
											)}
										</div>
									) : (
										<div className='rounded-xl border p-4'>
											<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
												{browserNodes.map((n) =>
													n.kind === 'folder' ? (
														<BrowserFolderTile
															key={`folder:${n.folder.id}`}
															folder={n.folder}
															onOpen={() => onFolderClick(n.folder.id)}
															dragDisabled={dragDisabled}
														/>
													) : (
														<BrowserMediaTile
															key={`media:${n.media.id}`}
															media={n.media}
															onDelete={() => setConfirmDelete(n.media)}
															dragDisabled={dragDisabled}
														/>
													)
												)}
											</div>
										</div>
									)
								) : null}
							</div>
						</div>
					);

					if (!hydrated) return content;

					return (
						<DndContext
							sensors={sensors}
							onDragStart={onDragStart}
							onDragEnd={onDragEnd}
							onDragCancel={onDragCancel}>
							{content}
							<DragOverlay>
								{dragMedia ? (
									<div className='rounded-lg border bg-background overflow-hidden w-[240px]'>
										<div className='relative aspect-video bg-muted/30'>
											<Image
												src={dragMedia.url}
												alt={dragMedia.original_name}
												fill
												unoptimized
												sizes='240px'
												className='object-cover'
											/>
										</div>
										<div className='p-2 text-xs text-muted-foreground line-clamp-2'>
											{dragMedia.original_name}
										</div>
									</div>
								) : dragFolder ? (
									<div className='rounded-lg border bg-background overflow-hidden w-[240px]'>
										<div className='flex items-center justify-center aspect-video bg-muted/20'>
											<Folder className='h-10 w-10 text-muted-foreground' />
										</div>
										<div className='p-2 text-xs text-muted-foreground line-clamp-2'>
											{dragFolder.name}
										</div>
									</div>
								) : null}
							</DragOverlay>
						</DndContext>
					);
				})()}

			<Dialog
				open={folderCreateOpen}
				onOpenChange={(v) => {
					setFolderCreateOpen(v);
					if (!v) {
						setFolderCreateName('');
						setFolderCreateParentId(0);
						setFolderCreateError(null);
						setFolderCreateSaving(false);
					}
				}}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>New folder</DialogTitle>
						<DialogDescription>
							Create folders and subfolders to organize uploads.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<Label>Name</Label>
							<Input
								value={folderCreateName}
								onChange={(e) => setFolderCreateName(e.target.value)}
								placeholder='e.g. Homepage'
								disabled={folderCreateSaving}
							/>
						</div>

						<div className='space-y-2'>
							<Label>Parent</Label>
							<Select
								value={String(folderCreateParentId)}
								onValueChange={(v) => setFolderCreateParentId(Number(v))}
								disabled={folderCreateSaving}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='0'>Root</SelectItem>
									{folderNodes.map(({ folder, depth }) => (
										<SelectItem
											key={folder.id}
											value={String(folder.id)}>
											{depth > 0 ? `${'—'.repeat(depth)} ` : ''}
											{folder.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{folderCreateError ? (
							<p className='text-sm text-red-600'>{folderCreateError}</p>
						) : null}
					</div>

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setFolderCreateOpen(false)}
							disabled={folderCreateSaving}>
							Cancel
						</Button>
						<Button
							onClick={doCreateFolder}
							disabled={folderCreateSaving || !folderCreateName.trim()}>
							{folderCreateSaving ? 'Creating…' : 'Create'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!confirmDeleteFolder}
				onOpenChange={(v) => !v && setConfirmDeleteFolder(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete folder?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete{' '}
							<b>{confirmDeleteFolder?.name}</b>. Folder must be empty (no subfolders or media).
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={foldersLoading}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={foldersLoading}
							onClick={() =>
								confirmDeleteFolder && doDeleteFolder(confirmDeleteFolder)
							}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={uploadOpen}
				onOpenChange={(v) => {
					setUploadOpen(v);
					if (!v) {
						setPendingFiles([]);
						setUploadError(null);
						setUploadStatus(null);
						setDragActive(false);
						if (fileRef.current) fileRef.current.value = '';
					}
				}}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>Upload</DialogTitle>
						<DialogDescription>
							Drop files or browse. Supported: {SUPPORTED_TYPES_LABEL}. Max {MAX_BYTES_LABEL} each.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-2'>
						<Label>Files</Label>

						<input
							ref={fileRef}
							type='file'
							accept='image/*'
							multiple
							className='hidden'
							disabled={uploading}
							onChange={(e) => onPickFiles(e.target.files)}
						/>

						<div
							className={`rounded-lg border border-dashed p-6 text-center text-sm transition cursor-pointer ${dragActive ? 'bg-muted' : 'bg-muted/20'}`}
							onClick={() => fileRef.current?.click()}
							onDragOver={(e) => {
								e.preventDefault();
								setDragActive(true);
							}}
							onDragLeave={() => setDragActive(false)}
							onDrop={(e) => {
								e.preventDefault();
								setDragActive(false);
								onPickFiles(e.dataTransfer.files);
							}}>
							<div className='space-y-1'>
								<p className='font-medium'>
									Drop images here or click to browse
								</p>
								<p className='text-xs text-muted-foreground'>
									Supported: {SUPPORTED_TYPES_LABEL} • Max{' '}
									{MAX_BYTES_LABEL} each
								</p>
							</div>

							{pendingFiles.length > 0 ? (
								<div className='mt-3 text-xs text-muted-foreground space-y-1'>
									<p>
										Selected: <b>{pendingFiles.length}</b>
									</p>
									<div className='max-h-24 overflow-auto'>
										{pendingFiles.map((f) => (
											<div
												key={`${f.name}:${f.size}:${f.lastModified}`}>
												{f.name}
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
					</div>

					{uploadStatus ? (
						<p className='text-sm text-muted-foreground'>
							{uploadStatus}
						</p>
					) : null}
					{uploadError ? (
						<p className='text-sm text-red-600'>{uploadError}</p>
					) : null}

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setUploadOpen(false)}
							disabled={uploading}>
							Cancel
						</Button>
						<Button
							onClick={doUpload}
							disabled={uploading || pendingFiles.length === 0}>
							{uploading
								? 'Uploading…'
								: pendingFiles.length > 1
									? `Upload ${pendingFiles.length} files`
									: 'Upload'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!confirmDelete}
				onOpenChange={(v) => !v && setConfirmDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete media?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete{' '}
							<b>{confirmDelete?.original_name}</b>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={loading}
							onClick={() =>
								confirmDelete && doDelete(confirmDelete)
							}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AdminListPage>
	);
}
