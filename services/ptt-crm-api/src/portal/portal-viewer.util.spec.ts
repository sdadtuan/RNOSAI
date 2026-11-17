import { ForbiddenException } from '@nestjs/common';
import { assertNotViewer, viewerWriteBlocked, VIEWER_READ_ONLY_ERROR } from './portal-viewer.util';

describe('viewerWriteBlocked', () => {
  it('never blocks approver or staff', () => {
    expect(viewerWriteBlocked('approver', 'POST', '/api/portal/crm/cases/x/care')).toBe(false);
    expect(viewerWriteBlocked('staff', 'DELETE', '/api/portal/crm/staff/x')).toBe(false);
  });

  it('lets viewer read', () => {
    expect(viewerWriteBlocked('viewer', 'GET', '/api/portal/crm/desk')).toBe(false);
    expect(viewerWriteBlocked('viewer', 'HEAD', '/api/portal/crm/desk')).toBe(false);
    expect(viewerWriteBlocked('viewer', 'OPTIONS', '/api/portal/crm/desk')).toBe(false);
  });

  it.each([
    ['POST', '/api/portal/crm/cases/abc/receive'],
    ['POST', '/api/portal/crm/cases/abc/assign'],
    ['POST', '/api/portal/crm/cases/abc/notes'],
    ['POST', '/api/portal/crm/cases/abc/label'],
    ['POST', '/api/portal/crm/cases/abc/purchase'],
    ['POST', '/api/portal/crm/comments/1_2/reply'],
    ['POST', '/api/portal/crm/comments/1_2/hide'],
    ['POST', '/api/portal/crm/comments/1_2/create-lead'],
    ['PATCH', '/api/portal/crm/inbox-settings'],
    ['POST', '/api/portal/crm/quick-replies'],
    ['DELETE', '/api/portal/crm/pages/p/products/1'],
    ['POST', '/api/portal/crm/pages/p/sync'],
    ['POST', '/api/portal/pos/orders'],
    ['PATCH', '/api/v1/portal/settings'],
    ['POST', '/api/v1/creatives/abc/approve'],
    ['POST', '/api/portal/crm/cases/abc/read/../care'],
    ['POST', '/api/portal/crm/cases/abc/care?x=/read'],
  ])('blocks viewer %s %s', (method, path) => {
    expect(viewerWriteBlocked('viewer', method, path)).toBe(true);
  });

  it.each([
    ['POST', '/api/v1/portal/auth/change-password'],
    ['PATCH', '/api/v1/portal/notifications/read-all'],
    ['PATCH', '/api/v1/portal/notifications/abc/read'],
    ['POST', '/api/v1/portal/push/subscribe'],
    ['DELETE', '/api/v1/portal/push/subscribe'],
    ['POST', '/api/v1/mobile/device-token'],
    ['POST', '/api/portal/crm/cases/abc/read'],
    ['POST', '/api/portal/crm/cases/abc/read/'],
  ])('allows viewer self-service %s %s', (method, path) => {
    expect(viewerWriteBlocked('viewer', method, path)).toBe(false);
  });

  it('assertNotViewer throws 403 viewer_read_only', () => {
    try {
      assertNotViewer({ role: 'viewer' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({ error: VIEWER_READ_ONLY_ERROR });
    }
    expect(() => assertNotViewer({ role: 'staff' })).not.toThrow();
  });
});
