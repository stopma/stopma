import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:process.env.SITE_LAUNCH_READY==='true'?'/':undefined,disallow:process.env.SITE_LAUNCH_READY==='true'?['/admin','/api/']:'/'},sitemap:(process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000')+'/sitemap.xml'};}
