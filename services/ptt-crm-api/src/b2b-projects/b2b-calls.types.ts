export type B2bCallState = 'queued' | 'ringing' | 'answered' | 'no_answer' | 'ended';
export type B2bCallKind = 'human' | 'ai';

export interface B2bCallSessionRow {
  id: string;
  leadId: number;
  staffId: number | null;
  provider: string;
  state: B2bCallState;
  kind: B2bCallKind;
  providerCallId: string | null;
}

export interface StartCallResult {
  sessionId: string;
  providerCallId: string;
}

export class B2bCpaasDownError extends Error {
  readonly code = 'cpaas_down';

  constructor(message = 'CPaaS unavailable') {
    super(message);
    this.name = 'B2bCpaasDownError';
  }
}
