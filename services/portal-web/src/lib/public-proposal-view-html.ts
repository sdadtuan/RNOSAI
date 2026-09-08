import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicProposalView } from '../components/PublicProposalView';
import type { PublicProposal } from './public-proposal';

const noop = () => undefined;

export function renderPublicProposalViewHtml(opts: {
  data: PublicProposal;
  name?: string;
  email?: string;
  title?: string;
  optionKey?: string;
  otp?: string;
  accepted?: boolean;
  acting?: boolean;
  message?: string;
}): string {
  return renderToStaticMarkup(
    createElement(PublicProposalView, {
      data: opts.data,
      name: opts.name ?? '',
      email: opts.email ?? '',
      title: opts.title ?? '',
      optionKey: opts.optionKey,
      otp: opts.otp ?? '',
      accepted: opts.accepted === true,
      acting: opts.acting === true,
      message: opts.message ?? '',
      onName: noop,
      onEmail: noop,
      onTitle: noop,
      onOptionKey: noop,
      onOtp: noop,
      onAccepted: noop,
      onRequestOtp: noop,
      onSubmit: noop,
    }),
  );
}
