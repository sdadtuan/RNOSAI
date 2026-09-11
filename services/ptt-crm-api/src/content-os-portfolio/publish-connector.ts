export type PublicationPackage = {
  item_id: number;
  channel?: string;
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
