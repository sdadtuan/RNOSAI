export type SellLine = {
  name: string;
  qty: number;
  price_vnd: number;
  available?: number | null;
};

/** Variant price when it is set; otherwise the product price. Never a typed amount. */
export function catalogUnitPrice(
  productPrice: number | null | undefined,
  variantPrice: number | null | undefined,
): number {
  const variant = Math.round(Number(variantPrice) || 0);
  if (variant > 0) return variant;
  const product = Math.round(Number(productPrice) || 0);
  return product > 0 ? product : 0;
}

export function inStockVariants<T extends { active?: boolean; available?: number | null }>(variants: T[]): T[] {
  return variants.filter((row) => row.active !== false && Number(row.available ?? 0) > 0);
}

type VariantPick = { color?: string | null; size?: string | null; active?: boolean; available?: number | null };

type ProductImageSource = {
  image_url?: string | null;
  variants?: Array<{ color?: string | null; image_url?: string | null }>;
  spec?: { colors?: Array<{ name: string; image?: string }> };
};

const PLACEHOLDER_IMAGE = /placehold\.co|placeholder\.com|via\.placeholder|dummyimage\.com/i;

/** Empty, placehold.co, and similar stand-ins are not product photos. */
export function isPlaceholderImage(url: string | null | undefined): boolean {
  const value = String(url ?? '').trim();
  if (!value) return true;
  return PLACEHOLDER_IMAGE.test(value);
}

function usableImage(url: string | null | undefined): string {
  const value = String(url ?? '').trim();
  if (!value || PLACEHOLDER_IMAGE.test(value)) return '';
  return value;
}

/** Best display URL: variant (by color) → spec color → product → any variant/spec image. Skips placeholders. */
export function resolvePosProductImage(product: ProductImageSource, color?: string): string {
  const pick = String(color ?? '').trim();
  const variants = product.variants ?? [];
  if (pick) {
    const byColor = variants.find((row) => String(row.color ?? '').trim() === pick && usableImage(row.image_url));
    if (byColor?.image_url) return usableImage(byColor.image_url);
    const specImg = product.spec?.colors?.find((entry) => entry.name === pick)?.image;
    const fromSpec = usableImage(specImg);
    if (fromSpec) return fromSpec;
  }
  const productImg = usableImage(product.image_url);
  if (productImg) return productImg;
  for (const row of variants) {
    const url = usableImage(row.image_url);
    if (url) return url;
  }
  for (const entry of product.spec?.colors ?? []) {
    const url = usableImage(entry.image);
    if (url) return url;
  }
  return '';
}

export function namedColors<T extends { color?: string | null; active?: boolean }>(variants: T[]): string[] {
  return [...new Set(variants.filter((row) => row.active !== false).map((row) => String(row.color ?? '').trim()).filter(Boolean))];
}

/** True when the catalog has a color or a size to choose. A single blank variant is unclassified. */
export function hasVariantChoice<T extends { color?: string | null; size?: string | null; active?: boolean }>(variants: T[]): boolean {
  return variants.some((row) => row.active !== false && (String(row.color ?? '').trim() || String(row.size ?? '').trim()));
}

export function colorAvailable<T extends VariantPick>(variants: T[], pickColor: string): number {
  const color = pickColor.trim();
  return variants
    .filter((row) => row.active !== false && String(row.color ?? '').trim() === color)
    .reduce((sum, row) => sum + Math.max(0, Number(row.available ?? 0)), 0);
}

const COLOR_SWATCH: Record<string, string> = {
  den: '#111827',
  do: '#dc2626',
  vang: '#eab308',
  hong: '#ec4899',
  trang: '#f4f4f5',
  xanh: '#2563eb',
  tim: '#7c3aed',
  cam: '#ea580c',
  nau: '#92400e',
  xam: '#6b7280',
  be: '#d6d3d1',
};

function foldColorName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Dot color for a Vietnamese color name (Đen, Đỏ, Hồng, ĐEN, …). */
export function colorSwatch(name: string): string {
  const key = foldColorName(name);
  if (COLOR_SWATCH[key]) return COLOR_SWATCH[key];
  const palette = ['#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be123c', '#0369a1'];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

/** All distinct sizes for a color from active variants (includes out-of-stock). */
export function sizesForColor<T extends VariantPick>(variants: T[], pickColor: string): string[] {
  const active = variants.filter((row) => row.active !== false);
  const colors = [...new Set(active.map((row) => String(row.color ?? '').trim()).filter(Boolean))];
  const color = pickColor.trim();
  return [
    ...new Set(
      active
        .filter((row) => !colors.length || String(row.color ?? '').trim() === color)
        .map((row) => String(row.size ?? '').trim())
        .filter(Boolean),
    ),
  ];
}

export function variantAvailableFor<T extends VariantPick>(variants: T[], pickColor: string, pickSize: string): number {
  const color = pickColor.trim();
  const size = pickSize.trim();
  const row = variants.find(
    (v) =>
      v.active !== false &&
      String(v.color ?? '').trim() === color &&
      String(v.size ?? '').trim() === size,
  );
  return row ? Math.max(0, Number(row.available ?? 0)) : 0;
}

/** Distinct colors that still have stock. */
export function inStockColors<T extends VariantPick>(variants: T[]): string[] {
  return [...new Set(inStockVariants(variants).map((row) => String(row.color ?? '').trim()).filter(Boolean))];
}

/** Sizes in stock for the chosen color (or all sizes when the product has no color dimension). */
export function inStockSizesForColor<T extends VariantPick>(variants: T[], pickColor: string): string[] {
  const stocked = inStockVariants(variants);
  const colors = inStockColors(stocked);
  const color = pickColor.trim();
  return [
    ...new Set(
      stocked
        .filter((row) => !colors.length || String(row.color ?? '').trim() === color)
        .map((row) => String(row.size ?? '').trim())
        .filter(Boolean),
    ),
  ];
}

export function firstSizeForColor<T extends VariantPick>(variants: T[], pickColor: string): string {
  return inStockSizesForColor(variants, pickColor)[0] ?? '';
}

/** Match color and size when the product has those dimensions; never pick an ambiguous row. */
export function resolvePickedVariant<T extends VariantPick>(variants: T[], pickColor: string, pickSize: string): T | undefined {
  const stocked = inStockVariants(variants);
  if (!stocked.length) return undefined;
  const colors = [...new Set(stocked.map((row) => String(row.color ?? '').trim()).filter(Boolean))];
  const needColor = colors.length > 0;
  const needSize = stocked.some((row) => String(row.size ?? '').trim());
  if (!needColor && !needSize) return stocked.length === 1 ? stocked[0] : undefined;
  const color = pickColor.trim();
  const size = pickSize.trim();
  if (needColor && !color) return undefined;
  if (needSize && !size) return undefined;
  return stocked.find((row) => {
    const colorOk = !needColor || String(row.color ?? '').trim() === color;
    const sizeOk = !needSize || String(row.size ?? '').trim() === size;
    return colorOk && sizeOk;
  });
}

export function pendingAddReason(
  productName: string,
  hasVariant: boolean,
  priceVnd: number,
  qty: number,
  available: number,
): string {
  if (!productName) return 'Chọn sản phẩm trước.';
  if (!hasVariant) return 'Chọn đủ màu và size (hoặc biến thể còn hàng).';
  if (!(priceVnd > 0)) return `${productName} chưa có giá bán.`;
  if (qty < 1) return 'Số lượng tối thiểu là 1.';
  if (qty > available) return `Không đủ tồn kho — còn ${Math.max(0, available)}.`;
  return '';
}

export function productSellWarnings(product: {
  name?: string;
  price_vnd?: number | null;
  available?: number | null;
  active?: boolean;
  spec?: { sizes?: string[] };
  variants?: Array<{ price_vnd?: number | null; available?: number | null; active?: boolean; size?: string | null }>;
}): string[] {
  const warnings: string[] = [];
  if (product.active === false) warnings.push('Đang ẩn — chưa bán được.');
  const stocked = inStockVariants(product.variants ?? []);
  const specSizes = (product.spec?.sizes ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (specSizes.length && stocked.length && !stocked.some((row) => String(row.size ?? '').trim())) {
    warnings.push('Spec có size nhưng biến thể chưa gán size — đồng bộ lại sản phẩm.');
  }
  const variantPrices = (product.variants ?? []).map((row) => catalogUnitPrice(product.price_vnd, row.price_vnd));
  const sellPrice = Math.max(product.price_vnd ?? 0, ...variantPrices, 0);
  const avail = product.available ?? (product.variants ?? []).reduce((sum, row) => sum + Number(row.available ?? 0), 0);
  if (!(sellPrice > 0)) warnings.push('Chưa có giá bán (> 0).');
  if (avail <= 0) warnings.push('Tồn kho 0 — chưa chốt được.');
  return warnings;
}

export function normalizeVnPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

/** Empty string means the phone is valid for chốt đơn (10 digits, VN mobile). */
export function phoneBlockReason(phone: string): string {
  const d = normalizeVnPhoneDigits(phone.trim());
  if (!d) return 'Nhập số điện thoại.';
  if (d.length !== 10) return 'SĐT phải đủ 10 số.';
  if (!/^0[3-9]\d{8}$/.test(d)) return 'SĐT không hợp lệ.';
  return '';
}

/** Empty string means the order can be submitted. */
export function orderBlockReason(items: SellLine[], totalVnd: number): string {
  if (!items.length) return 'Chọn ít nhất một sản phẩm.';
  for (const item of items) {
    if (!(item.price_vnd > 0)) return `${item.name} chưa có giá bán.`;
    if (item.available != null && item.qty > item.available) {
      return `${item.name} chỉ còn ${Math.max(0, item.available)}.`;
    }
  }
  if (!(totalVnd > 0)) return 'Tổng đơn phải lớn hơn 0.';
  return '';
}
