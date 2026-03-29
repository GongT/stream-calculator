import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(() => {
	const isProd = process.env.NODE_ENV === 'production';
	return {
		plugins: [],
		define: {
			'import.meta.env?.PROD': isProd.toString(),
			'import.meta.env.PROD': isProd.toString(),
		},
	};
});
