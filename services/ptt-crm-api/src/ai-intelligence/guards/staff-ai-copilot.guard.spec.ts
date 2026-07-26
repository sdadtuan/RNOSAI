import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { StaffAiCopilotGuard } from './staff-ai-copilot.guard';

describe('StaffAiCopilotGuard', () => {
  const aiConfig = {
    copilotEnabled: true,
    isPilotUser: jest.fn(),
  };

  let guard: StaffAiCopilotGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new StaffAiCopilotGuard(aiConfig as never);
  });

  function ctx(req: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;
  }

  it('throws when copilot disabled', () => {
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = false;
    expect(() => guard.canActivate(ctx({}))).toThrow(ServiceUnavailableException);
  });

  it('allows internal key bypass', () => {
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = true;
    expect(guard.canActivate(ctx({ staffAuthVia: 'internal' }))).toBe(true);
  });

  it('requires staff jwt when not internal', () => {
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = true;
    expect(() => guard.canActivate(ctx({}))).toThrow(ForbiddenException);
  });

  it('blocks non-pilot staff', () => {
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = true;
    aiConfig.isPilotUser.mockReturnValue(false);
    expect(() =>
      guard.canActivate(ctx({ staffUser: { sub: 'staff-x' } })),
    ).toThrow(ForbiddenException);
  });

  it('allows pilot staff', () => {
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = true;
    aiConfig.isPilotUser.mockReturnValue(true);
    expect(guard.canActivate(ctx({ staffUser: { sub: 'staff-1' } }))).toBe(true);
  });
});
