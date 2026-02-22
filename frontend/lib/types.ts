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
	definition: Record<string, unknown>;
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
	footer: string;
	definition: Record<string, unknown>;
	created_at: string;
	updated_at: string;
};

export type PageTemplateListOut = {
	items: PageTemplate[];
	total: number;
	limit: number;
	offset: number;
};

export type Menu = {
	id: number;
	slug: string;
	title: string;
	description?: string | null;
	created_at: string;
	updated_at: string;
};

export type MenuListOut = {
	items: Menu[];
	total: number;
	limit: number;
	offset: number;
};

export type MenuItem = {
	id: number;
	menu_id: number;
	type: 'page' | 'link' | string;
	label: string;
	page_id?: number | null;
	href?: string | null;
	order_index: number;
	page_slug?: string | null;
	page_title?: string | null;
	created_at: string;
	updated_at: string;
};

export type MenuItemListOut = {
	items: MenuItem[];
};

export type PublicMenuItem = {
	label: string;
	href: string;
};

export type PublicMenuOut = {
	slug: string;
	title: string;
	items: PublicMenuItem[];
};

export type ContentType = {
	id: number;
	slug: string;
	title: string;
	description?: string | null;
	created_at: string;
	updated_at: string;
};

export type ContentTypeListOut = {
	items: ContentType[];
	total: number;
	limit: number;
	offset: number;
};

export type ContentField = {
	id: number;
	content_type_id: number;
	slug: string;
	label: string;
	field_type: string;
	required: boolean;
	options: Record<string, unknown>;
	order_index: number;
	created_at: string;
	updated_at: string;
};

export type ContentFieldListOut = {
	items: ContentField[];
};

export type ContentEntry = {
	id: number;
	content_type_id: number;
	content_type_slug: string;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	order_index: number;
	data: Record<string, unknown>;
	published_at?: string | null;
	created_at: string;
	updated_at: string;
};

export type ContentEntryListOut = {
	items: ContentEntry[];
	total: number;
	limit: number;
	offset: number;
};

export type PublicContentEntry = {
	id: number;
	content_type_slug: string;
	title: string;
	slug: string;
	data: Record<string, unknown>;
	published_at?: string | null;
};

export type PublicContentEntryListOut = {
	items: PublicContentEntry[];
	total: number;
	limit: number;
	offset: number;
};

export type OptionOut = {
	id: number;
	key: string;
	value: unknown;
	created_at: string;
	updated_at: string;
};

export type OptionListOut = {
	items: OptionOut[];
	total: number;
	limit: number;
	offset: number;
};

export type Theme = {
	id: number;
	slug: string;
	title: string;
	description?: string | null;
	vars: Record<string, string>;
	created_at: string;
	updated_at: string;
};

export type ThemeListOut = {
	items: Theme[];
	total: number;
	limit: number;
	offset: number;
};

export type PublicThemeOut = {
	slug: string;
	title: string;
	vars: Record<string, string>;
};

export type Taxonomy = {
	id: number;
	slug: string;
	title: string;
	description?: string | null;
	hierarchical: boolean;
	created_at: string;
	updated_at: string;
};

export type TaxonomyListOut = {
	items: Taxonomy[];
	total: number;
	limit: number;
	offset: number;
};

export type Term = {
	id: number;
	taxonomy_id: number;
	parent_id?: number | null;
	slug: string;
	title: string;
	description?: string | null;
	created_at: string;
	updated_at: string;
};

export type TermListOut = {
	items: Term[];
	total: number;
	limit: number;
	offset: number;
};

export type EntryTerm = {
	id: number;
	taxonomy_id: number;
	taxonomy_slug: string;
	taxonomy_title: string;
	slug: string;
	title: string;
};

export type EntryTermListOut = {
	items: EntryTerm[];
};


export type FlowNode = {
	id: string;
	kind: 'trigger' | 'action';
	label: string;
	config: Record<string, unknown>;
};

export type FlowEdge = {
	source: string;
	target: string;
};

export type FlowDefinition = {
	version: 1;
	nodes: FlowNode[];
	edges: FlowEdge[];
};

export type Flow = {
	id: number;
	slug: string;
	title: string;
	description?: string | null;
	status: 'draft' | 'active' | 'disabled';
	trigger_event: string;
	definition: FlowDefinition;
	created_at: string;
	updated_at: string;
};

export type FlowListOut = {
	items: Flow[];
	total: number;
	limit: number;
	offset: number;
};

export type FlowRun = {
	id: number;
	flow_id: number;
	status: string;
	input: Record<string, unknown>;
	output: Record<string, unknown>;
	error?: string | null;
	created_at: string;
};

export type FlowRunListOut = {
	items: FlowRun[];
	total: number;
	limit: number;
	offset: number;
};

export type FlowTriggerResult = {
	ok: boolean;
	flow_id: number;
	flow_slug: string;
	status: string;
	event: string;
	output: Record<string, unknown>;
	steps: Array<Record<string, unknown>>;
	run_id?: number | null;
};
