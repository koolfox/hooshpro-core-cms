import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'hooshpro_session';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';

function redirectToLogin(req: NextRequest) {
	const url = req.nextUrl.clone();
	url.pathname = '/auth/login';
	url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
	return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	if (!pathname.startsWith('/admin')) return NextResponse.next();

	const token = req.cookies.get(COOKIE_NAME)?.value;
	if (!token) {
		return redirectToLogin(req);
	}

	const cookieHeader = req.headers.get('cookie') ?? '';

	try {
		const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
			method: 'GET',
			headers: {
				accept: 'application/json',
				cookie: cookieHeader,
			},
			cache: 'no-store',
		});

		if (res.ok) {
			return NextResponse.next();
		}

		const redirect = redirectToLogin(req);
		redirect.cookies.delete(COOKIE_NAME);
		return redirect;
	} catch {
		const redirect = redirectToLogin(req);
		redirect.cookies.delete(COOKIE_NAME);
		return redirect;
	}
}

export const config = {
	matcher: ['/admin/:path*'],
};
