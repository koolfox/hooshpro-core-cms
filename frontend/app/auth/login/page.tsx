import { Suspense } from 'react';

import LoginClient from './login-client';

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div className='min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground'>
					Loading…
				</div>
			}>
			<LoginClient />
		</Suspense>
	);
}

