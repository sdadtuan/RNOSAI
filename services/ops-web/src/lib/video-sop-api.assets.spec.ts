import { describe, expect, it } from 'vitest';
import { vdAssetsSearchPath } from './video-sop-api';

describe('vdAssetsSearchPath', () => {
  it('requires lifecycle_id and encodes filters', () => {
    expect(vdAssetsSearchPath({ lifecycleId: 4 })).toBe(
      '/api/v1/vd/assets/search?lifecycle_id=4',
    );
    expect(
      vdAssetsSearchPath({
        lifecycleId: 4,
        projectId: 3,
        kind: 'keyframe',
        q: 'dead',
        limit: 20,
      }),
    ).toBe(
      '/api/v1/vd/assets/search?lifecycle_id=4&project_id=3&kind=keyframe&q=dead&limit=20',
    );
  });
});
