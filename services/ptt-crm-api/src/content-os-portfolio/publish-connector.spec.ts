import { NotEnabledError, stubPublishConnector, type PublicationPackage, type PublishConnector } from './publish-connector';

const pkg: PublicationPackage = { item_id: 21, channel: 'facebook' };

describe('PublishConnector stub', () => {
  it('exposes the E3 interface and throws NotEnabledError from publish', async () => {
    const connector: PublishConnector = stubPublishConnector();
    expect(connector.id).toBe('stub');
    await expect(connector.publish(pkg)).rejects.toBeInstanceOf(NotEnabledError);
  });

  it('still throws NotEnabledError when direct_social_publish is on', async () => {
    const connector = stubPublishConnector({ direct_social_publish: true });
    await expect(connector.publish(pkg)).rejects.toMatchObject({
      name: 'NotEnabledError',
      message: 'direct_social_publish_not_enabled',
    });
  });
});
