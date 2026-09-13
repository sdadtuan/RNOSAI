import type { ImgRecipeStage } from '@/lib/crm/cp-image-sop-api';

const STAGE_LABELS: Record<string, { title: string; hint: string }> = {
  explore: { title: '1. Explore', hint: 'images_generate · 2–4 variants' },
  select: { title: '2. Select', hint: 'Art Director · winner_asset_id' },
  refine: { title: '3. Refine', hint: 'product lock · Weave · overlay' },
  upscale: { title: '4. Upscale', hint: 'Magnific images_upscale' },
  pack: { title: '5. Pack', hint: 'crop/resize 1:1 · 4:5 · 9:16' },
  qc: { title: '6. QC', hint: '7 chiều · G2/G3 · Hub' },
};

type CpImagePipeProps = {
  stages?: ImgRecipeStage[];
  activeStage?: string | null;
  compact?: boolean;
};

export function CpImagePipe({ stages, activeStage, compact = false }: CpImagePipeProps) {
  const order = ['explore', 'select', 'refine', 'upscale', 'pack', 'qc'] as const;
  const activeIndex = activeStage ? order.indexOf(activeStage as (typeof order)[number]) : 1;

  return (
    <div className={`cp-img-pipe${compact ? ' cp-img-pipe--compact' : ''}`}>
      {order.map((stage, index) => {
        const meta = STAGE_LABELS[stage];
        const recipe = stages?.find((item) => item.stage === stage);
        const cls =
          index < activeIndex
            ? 'cp-img-pipe__st cp-img-pipe__st--done'
            : index === activeIndex
              ? 'cp-img-pipe__st cp-img-pipe__st--on'
              : 'cp-img-pipe__st';
        return (
          <div key={stage} className={cls}>
            <b>{compact ? meta.title.replace(/^\d+\.\s/, '') : meta.title}</b>
            <span>
              {recipe
                ? `${recipe.capability}${recipe.provider ? ` · ${recipe.provider}` : ''}`
                : meta.hint}
            </span>
          </div>
        );
      })}
    </div>
  );
}
