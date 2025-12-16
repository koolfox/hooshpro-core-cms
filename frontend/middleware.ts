import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'hooshpro_token';

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	if (!pathname.startsWith('/admin')) return NextResponse.next();

	const token = req.cookies.get(COOKIE_NAME)?.value;

	if (!token) {
		const url = req.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.set('next', pathname);
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/admin/:path*'],
};
