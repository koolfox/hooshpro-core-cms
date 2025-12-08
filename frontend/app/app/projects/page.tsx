'use client';

import { apiCreateProject, apiListProjects, type Project } from '@/lib/api';
import { FormEvent, useEffect, useState } from 'react';

export default function ProjectsPage() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [name, setName] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');

	const [creating, setCreating] = useState(false);

	useEffect(() => {
		async function loadProjects() {
			try {
				setLoading(true);
				setError(null);

				const token = localStorage.getItem('hooshpro_token');
				if (!token) {
					setError('Token not found, please login again.');
					setLoading(false);
					return;
				}

				const data = await apiListProjects(token);
				setProjects(data);
			} catch (err) {
				setError('Project loading failed.');
			} finally {
				setLoading(false);
			}
		}
		loadProjects();
	}, []);

	async function handleCreate(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setCreating(true);

		try {
			const token = localStorage.getItem('hooshpro_token');
			if (!token) {
				setError('Token not found, please login again.');
				setCreating(false);
				return;
			}

			const project = await apiCreateProject(token, {
				name,
				slug,
				description: description || undefined,
			});

			setProjects((prev) => [project, ...prev]);

			setName('');
			setSlug('');
			setDescription('');
		} catch (err) {
			setError('Project creation failed.');
		} finally {
			setCreating(false);
		}
	}

	return (
		<div className='space-y-6'>
			<section>
				<h1 className='text-xl font-semibold mb-2'>Projects</h1>
				<p className='text-sm text-slate-400'>
					Create and manage projects with HooshPro
				</p>
			</section>

			<section className='bg-slate-900 border border-slate-800 rounded-xl p-4'>
				<h2 className='text-sm font-medium mb-3'>Add New Project</h2>

				<form
					onSubmit={handleCreate}
					className='space-y-3'>
					<div>
						<label
							className='block text-xs text-slate-400 mb-1'
							htmlFor='name'>
							Project Name
						</label>
						<input
							id='name'
							className='w-full rounded-md bg-slate-950 border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500'
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
						/>
					</div>

					<div>
						<label
							className='block text-xs text-slate-400 mb-1'
							htmlFor='slug'>
							Slug
						</label>
						<input
							id='slug'
							className='w-full rounded-md bg-slate-950 border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500'
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
							required
						/>
					</div>

					<div>
						<label
							className='block text-xs text-slate-400 mb-1'
							htmlFor='description'>
							Description
						</label>
						<input
							id='description'
							className='w-full rounded-md bg-slate-950 border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500'
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							required
						/>
					</div>

					{error && <p className='text-xs text-red-400'>{error}</p>}

					<button
						type='submit'
						disabled={creating}
						className='inline-flex items-center rounded-md bg-slate-100 text-slate-900 text-xs font-medium px-3 py-2 hover:bg-white disabled:opacity-50'>
						{creating ? 'Creating...' : 'Create'}
					</button>
				</form>
			</section>

			<section>
				<h2 className='text-sm font-medium mb-3'>Projects List</h2>
				{loading ? (
					<p className='text-sm text-slate-400'>Loading...</p>
				) : projects.length === 0 ? (
					<p className='text-sm text-slate-500'>No project yet</p>
				) : (
					<div className='space-y-2'>
						{projects.map((project) => (
							<article
								key={project.id}
								className='border border-slate-800 rounded-lg px-4 bg-slate-950'>
								<div className='flex items-center justify-between'>
									<div>
										<h3 className='text-sm font-medium'>
											{project.name}
										</h3>
										<p className='text-xs font-medium'>
											{project.slug}
										</p>
									</div>
									<span className='text-[10px] text-slate-500'>
										{new Date(
											project.created_at
										).toLocaleString('fa-IR')}
									</span>
								</div>
								{project.description && (
									<p className='mt-2 text-xs text-slate-300'>
										{project.description}
									</p>
								)}
							</article>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
