import { redirect } from 'next/navigation';

export default function NewPageRedirect() {
	redirect('/admin/pages');
}
