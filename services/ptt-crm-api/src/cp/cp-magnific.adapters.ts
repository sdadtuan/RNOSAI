import { Injectable } from '@nestjs/common';
import type { MagnificAdapterPort } from './cp-jobs.service';
import { CpMagnificMcpAdapter } from './cp-magnific-mcp.adapter';
import { CpMagnificRestAdapter } from './cp-magnific-rest.adapter';

@Injectable()
export class MagnificAdapters implements MagnificAdapterPort {
  constructor(
    private readonly mcp: CpMagnificMcpAdapter,
    private readonly rest: CpMagnificRestAdapter,
  ) {}

  getBalance(transport?: 'mcp' | 'rest'): Promise<{ credits: number | null }> {
    return this.pick(transport).getBalance();
  }

  generate(input: {
    transport: 'mcp' | 'rest';
    capability: string;
    inputs: Record<string, unknown>;
  }): Promise<{ externalRunId: string }> {
    return this.pick(input.transport).generate(input);
  }

  wait(
    externalRunId: string,
    transport?: 'mcp' | 'rest',
  ): Promise<{ outputUrls: string[]; actualCredits: number | null }> {
    return this.pick(transport).wait(externalRunId);
  }

  download(
    url: string,
    transport?: 'mcp' | 'rest',
  ): Promise<{ bytes: Buffer; mime: string }> {
    return this.pick(transport).download(url);
  }

  private pick(transport?: 'mcp' | 'rest'): MagnificAdapterPort {
    return transport === 'rest' ? this.rest : this.mcp;
  }
}
