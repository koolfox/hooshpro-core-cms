export type Page = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;

	body?: string;

	blocks: unknown;

	published_at?: string | null;
	created_at: string;
	updated_at: string;
};

export type PageListOut = {
	items: Page[];
	total: number;
	limit: number;
	offset: number;
};

export type MediaAsset = {
	id: number;
	url: string;
	folder_id?: number | null;
	original_name: string;
	content_type: string;
	size_bytes: number;
	created_at: string;
};

export type MediaListOut = {
	items: MediaAsset[];
	total: number;
	limit: number;
	offset: number;
};

export type MediaFolder = {
	id: number;
	name: string;
	parent_id?: number | null;
	created_at: string;
	updated_at: string;
};

export type MediaFolderListOut = {
	items: MediaFolder[];
};

export type ComponentDef = {
	id: number;
	slug: string;
	title: string;
	type: string;
	description?: string | null;
	data: unknown;
	created_at: string;
	updated_at: string;
};

export type ComponentListOut = {
	items: ComponentDef[];
	total: number;
	limit: number;
	offset: number;
};

export type BlockTemplate = {
	id: number;
	slug: string;
	title: string;
	description?: string | null;
	definition: unknown;
	created_at: string;
	updated_at: string;
};

export type BlockListOut = {
	items: BlockTemplate[];
	total: number;
	limit: number;
	offset: number;
};

export type PageTemplate = {
	id: number;
	slug: string;
	title: string;
	description?: string | null;
	menu: string;
	created_at: string;
	updated_at: string;
};

export type PageTemplateListOut = {
	items: PageTemplate[];
	total: number;
	limit: number;
	offset: number;
};
