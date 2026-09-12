import { readAiOpsFlags } from './cp-ai-ops.flags';
import {
  MAGNIFIC_PILOT_CAPABILITIES,
  assertMagnificAllowed,
  mapMagnificTool,
} from './cp-magnific-policy.util';

describe('MAGNIFIC_PILOT_CAPABILITIES', () => {
  it('lists the Wave B allowlist', () => {
    expect([...MAGNIFIC_PILOT_CAPABILITIES]).toEqual([
      'account_balance',
      'images_generate',
      'images_upscale',
      'images_remove_background',
      'images_crop',
      'images_resize',
      'video_generate',
      'creation_status',
      'creations_wait',
      'creations_get',
    ]);
  });
});

describe('mapMagnificTool', () => {
  it('maps a capability onto a discovered tool name', () => {
    expect(
      mapMagnificTool('images_generate', ['account_balance', 'images.generate', 'video_generate']),
    ).toBe('images.generate');
  });

  it('returns 409 mcp_tool_unavailable when discovery has no match', () => {
    expect(() => mapMagnificTool('video_generate', ['images_generate'])).toThrow(
      expect.objectContaining({
        status: 409,
        error: 'mcp_tool_unavailable',
      }),
    );
  });

  it('does not map tools outside the pilot allowlist', () => {
    expect(() => mapMagnificTool('audio_tts', ['audio_tts'])).toThrow(
      expect.objectContaining({
        status: 409,
        error: 'mcp_tool_unavailable',
      }),
    );
  });
});

describe('assertMagnificAllowed', () => {
  const mcpOn = readAiOpsFlags({ MAGNIFIC_MCP_ENABLED: '1' });
  const restOn = readAiOpsFlags({ MAGNIFIC_REST_API_ENABLED: 'true' });
  const allOff = readAiOpsFlags({});

  it('rejects a disabled transport with GT-A03', () => {
    expect(() =>
      assertMagnificAllowed({ provider: 'magnific_mcp', flags: allOff }),
    ).toThrow(
      expect.objectContaining({
        status: 409,
        error: 'magnific_disabled',
        gate: 'GT-A03',
      }),
    );
    expect(() =>
      assertMagnificAllowed({ provider: 'magnific_rest', flags: mcpOn }),
    ).toThrow(
      expect.objectContaining({
        status: 409,
        error: 'magnific_disabled',
        gate: 'GT-A03',
      }),
    );
  });

  it('rejects RESTRICTED classification with GT-M05', () => {
    expect(() =>
      assertMagnificAllowed({
        provider: 'magnific_mcp',
        flags: mcpOn,
        classification: 'RESTRICTED',
      }),
    ).toThrow(
      expect.objectContaining({
        status: 409,
        gate: 'GT-M05',
      }),
    );
  });

  it('rejects externalProhibited with GT-M05', () => {
    expect(() =>
      assertMagnificAllowed({
        provider: 'magnific_rest',
        flags: restOn,
        externalProhibited: true,
      }),
    ).toThrow(
      expect.objectContaining({
        status: 409,
        gate: 'GT-M05',
      }),
    );
  });

  it('allows an enabled transport that is not restricted', () => {
    expect(() =>
      assertMagnificAllowed({ provider: 'magnific_mcp', flags: mcpOn }),
    ).not.toThrow();
    expect(() =>
      assertMagnificAllowed({
        provider: 'magnific_rest',
        flags: restOn,
        classification: 'internal',
      }),
    ).not.toThrow();
  });
});
