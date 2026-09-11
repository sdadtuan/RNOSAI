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

      let consecutive5xx = 0;
      while (consecutive5xx < 3) {
        const res = await graphFetch(url, { method: 'POST', body });
        if (res.ok) {
          const data = (await res.json()) as { id?: string };
          return { post_id: String(data.id) };
        }
        if (res.status >= 400 && res.status < 500) {
          throw new Error('TokenExpired');
        }
        consecutive5xx += 1;
      }
      throw new Error('graph_unavailable');
    },
  };
}
