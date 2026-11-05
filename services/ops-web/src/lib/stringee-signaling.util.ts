/** Stringee Call signalingstate.code → UX phase. */
export type StringeeUxPhase = 'connecting' | 'ringing' | 'in_call' | 'ended' | 'busy';

/** Docs: INIT=0 CALLING=1 RINGING=2 ANSWERED=3 CONNECTED=4 BUSY=5 ENDED=6 */
export function mapStringeeSignalingCode(code: number): StringeeUxPhase | null {
  if (code === 1) return 'connecting';
  if (code === 2) return 'ringing';
  if (code === 3 || code === 4) return 'in_call';
  if (code === 5) return 'busy';
  if (code === 6) return 'ended';
  return null;
}
