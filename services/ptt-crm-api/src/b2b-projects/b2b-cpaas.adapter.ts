import { B2bCpaasDownError } from './b2b-calls.types';

export interface CpaasStartCallInput {
  phone: string;
  sessionId: string;
  staffId: number;
  leadId: number;
}

export interface CpaasStartCallResult {
  providerCallId: string;
}

export interface B2bCpaasAdapter {
  startCall(input: CpaasStartCallInput): Promise<CpaasStartCallResult>;
}

export class MockB2bCpaasAdapter implements B2bCpaasAdapter {
  async startCall(input: CpaasStartCallInput): Promise<CpaasStartCallResult> {
    return { providerCallId: `mock-${input.sessionId}` };
  }
}

export class DownB2bCpaasAdapter implements B2bCpaasAdapter {
  async startCall(): Promise<CpaasStartCallResult> {
    throw new B2bCpaasDownError();
  }
}

export function createB2bCpaasAdapter(mode: string): B2bCpaasAdapter {
  const m = (mode || 'mock').trim().toLowerCase();
  if (m === 'down' || m === 'off') return new DownB2bCpaasAdapter();
  return new MockB2bCpaasAdapter();
}
