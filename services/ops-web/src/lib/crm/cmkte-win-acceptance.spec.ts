import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CmktEIntelligence } from '../../components/content-os/cmkte/CmktEIntelligence';
import { CmktESettings } from '../../components/content-os/cmkte/CmktESettings';
import { CmktEPublishPanel } from '../../components/content-os/cmkte/CmktEWorkspace';
import { DAM_PICK_LABEL } from './cmkte-dam';

const SRC = {
  settings: join(__dirname, '../../components/content-os/cmkte/CmktESettings.tsx'),
  workspace: join(__dirname, '../../components/content-os/cmkte/CmktEWorkspace.tsx'),
  intelligence: join(__dirname, '../../components/content-os/cmkte/CmktEIntelligence.tsx'),
  publish: join(__dirname, './cmkte-win-publish.ts'),
} as const;

function readSrc(...keys: Array<keyof typeof SRC>): string {
  return keys.map((key) => readFileSync(SRC[key], 'utf8')).join('\n');
}

describe('E4 UAT acceptance (ops-web)', () => {
  it('Settings/Workspace/Intelligence have no live IG handler', () => {
    const src = readSrc('settings', 'workspace', 'intelligence');
    expect(src).not.toMatch(/instagram/i);
    expect(src).not.toMatch(/Connect Instagram|graph\.facebook\.com/);
  });

  it('exposes Connect Page, Tạo Draft, Chọn từ DAM, Mark published', () => {
    const settings = renderToStaticMarkup(createElement(CmktESettings, { context: null }));
    expect(settings).toContain('Connect Page');

    const intelligence = renderToStaticMarkup(
      createElement(CmktEIntelligence, { summary: null, scoped: true }),
    );
    expect(intelligence).toContain('＋ Tạo Draft');

    const workspace = readFileSync(SRC.workspace, 'utf8');
    expect(workspace).toContain('Mark published');
    expect(workspace).toContain('DAM_PICK_LABEL');
    expect(DAM_PICK_LABEL).toBe('Chọn từ DAM');
  });

  it('12 CTA remains Đăng ký nhận tư vấn', () => {
    const copy = readSrc('workspace', 'settings', 'publish');
    expect(copy).toContain('Đăng ký nhận tư vấn');
    expect(copy).not.toContain('Gọi ngay');
  });
});
