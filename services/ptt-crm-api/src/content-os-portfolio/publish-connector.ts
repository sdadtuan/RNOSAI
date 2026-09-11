export type PublicationPackage = {
  item_id: number;
  channel?: string;
  page_id?: string;
  message?: string;
  access_token?: string;
};

export type PublishConnector = {
  id: string;
  publish(pkg: PublicationPackage): Promise<{ post_id: string }>;
};

export class NotEnabledError extends Error {
  constructor(message = 'direct_social_publish_not_enabled') {
    super(message);
    this.name = 'NotEnabledError';
  }
}

export function stubPublishConnector(_opts?: { direct_social_publish?: boolean }): PublishConnector {
  return {
    id: 'stub',
    async publish(_pkg: PublicationPackage): Promise<{ post_id: string }> {
      throw new NotEnabledError();
    },
  };
}

export function resolvePublishConnector(opts: {
  direct_social_publish: boolean;
  connectorStatus: string | null;
  hasToken: boolean;
  facebook?: PublishConnector;
}): PublishConnector {
  if (
    opts.direct_social_publish &&
    opts.connectorStatus === 'on' &&
    opts.hasToken &&
    opts.facebook
  ) {
    return opts.facebook;
  }
  return stubPublishConnector();
}
