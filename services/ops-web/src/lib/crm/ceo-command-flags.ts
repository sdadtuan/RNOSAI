export function ceoCommandEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PTT_CEO_COMMAND ?? '1') !== '0';
}
