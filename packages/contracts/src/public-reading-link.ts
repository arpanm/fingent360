import { z } from 'zod';
import { DiscoveryIdSchema } from './discovery.js';

export const PublicReadingOriginSchema = z.string().transform((value, ctx) => {
  try {
    const url = new URL(value),
      host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['', '/'].includes(url.pathname) ||
      !host.includes('.') ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      host.includes(':') ||
      host === 'appassets.androidplatform.net' ||
      host === 'localhost' ||
      ['.localhost', '.local', '.internal', '.test', '.invalid'].some(
        (suffix) => host.endsWith(suffix),
      )
    )
      throw Error();
    return url.origin;
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'A public HTTPS deployment is needed to share this app link.',
    });
    return z.NEVER;
  }
});
export function publicReadingLink(origin: string, id: string) {
  return `${PublicReadingOriginSchema.parse(origin)}/#read/${DiscoveryIdSchema.parse(id)}`;
}
