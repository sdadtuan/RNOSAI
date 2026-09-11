import { NotEnabledError, type PublicationPackage, type PublishConnector } from './publish-connector';

export type FacebookPublishPackage = PublicationPackage & {
  page_id: string;
  message: string;
  access_token: string;
};

export function createFacebookPageConnector(opts: {
  enabled: boolean;
  statusOn: boolean;
  graphFetch?: typeof fetch;
  now?: () => Date;
}): PublishConnector {
  const graphFetch = opts.graphFetch ?? fetch;
  return {
    id: 'facebook',
    async publish(pkg: PublicationPackage): Promise<{ post_id: string }> {
      if (!opts.enabled || !opts.statusOn) {
        throw new NotEnabledError();
      }
      const { page_id, message, access_token } = pkg as FacebookPublishPackage;
      const url = `https://graph.facebook.com/v21.0/${page_id}/feed`;
      const body = new URLSearchParams({ message, access_token });
      const res = await graphFetch(url, { method: 'POST', body });
      if (res.ok) {
        const data = (await res.json()) as { id?: unknown };
        const postId = data.id == null ? '' : String(data.id).trim();
        if (!postId || postId === 'undefined') {
          throw new Error('graph_missing_post_id');
        }
        return { post_id: postId };
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error('TokenExpired');
      }
      if (res.status >= 400 && res.status < 500) {
        throw new Error('graph_rejected');
      }
      throw new Error('graph_unavailable');
    },
  };
}
