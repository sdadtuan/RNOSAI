import { describe, expect, it } from 'vitest';
import {
  vdAdminModelsPath,
  vdAdminProvidersPath,
  vdProjectCreatePath,
  vdProjectGetPath,
} from './video-sop-api';

describe('video-sop-api path helpers', () => {
  it('vdProjectCreatePath is POST collection', () => {
    expect(vdProjectCreatePath()).toBe('/api/v1/vd/projects');
  });

  it('vdProjectGetPath interpolates id', () => {
    expect(vdProjectGetPath(7)).toBe('/api/v1/vd/projects/7');
  });

  it('vdAdminProvidersPath is admin collection', () => {
    expect(vdAdminProvidersPath()).toBe('/api/v1/vd/admin/providers');
  });

  it('vdAdminModelsPath is admin collection', () => {
    expect(vdAdminModelsPath()).toBe('/api/v1/vd/admin/models');
  });
});
