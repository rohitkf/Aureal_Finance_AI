/**
 * The app's tint: the one colour every accent is drawn in.
 *
 * Seven, each defined in src/styles/index.css as `:root[data-tint=…]` and
 * each checked for contrast there (DESIGN.md has the figures): a bright fill
 * that black ink reads on, an ink dark enough for text on white, the paper a
 * light card is made of. `profiles.tint` refuses any other name, so a stored
 * value is always one the stylesheet can draw.
 */
export const TINTS = ['lime', 'sky', 'violet', 'coral', 'mint', 'rose', 'amber'] as const;

export type Tint = (typeof TINTS)[number];

export const DEFAULT_TINT: Tint = 'lime';

export const TINT_LABELS: Record<Tint, string> = {
  lime: 'Lime',
  sky: 'Sky',
  violet: 'Violet',
  coral: 'Coral',
  mint: 'Mint',
  rose: 'Rose',
  amber: 'Amber',
};

/**
 * Each tint's own fill, as a swatch. Written out whole and looked up, never
 * built from the name: Tailwind only emits a class it can find in the source.
 */
export const TINT_SWATCH: Record<Tint, string> = {
  lime: 'bg-[rgb(197_245_79)]',
  sky: 'bg-[rgb(140_200_255)]',
  violet: 'bg-[rgb(196_178_255)]',
  coral: 'bg-[rgb(255_166_133)]',
  mint: 'bg-[rgb(112_228_194)]',
  rose: 'bg-[rgb(255_164_202)]',
  amber: 'bg-[rgb(255_210_92)]',
};

export const isTint = (value: unknown): value is Tint =>
  typeof value === 'string' && (TINTS as readonly string[]).includes(value);
