import {
  ArrowLeftRight,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Dumbbell,
  Fuel,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Lightbulb,
  PawPrint,
  Percent,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TrendingUp,
  Tv,
  UtensilsCrossed,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { nameKey, type Category, type Transaction } from '@gastos/shared';
import { ICON_SIZE } from './icons';

/**
 * How a category looks: an icon on a soft colour. Categories do not store an
 * icon; it is found from words in their name (the ones every user starts
 * with, and the usual ones people add), and a subcategory looks like the
 * category it hangs from. Anything else gets a neutral tag.
 */

export type Tone = 'green' | 'peach' | 'blue' | 'violet' | 'amber' | 'pink' | 'gray';

/** The background and icon colour of each tone, from the design tokens. */
export const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-tone-green-bg text-tone-green-fg',
  peach: 'bg-tone-peach-bg text-tone-peach-fg',
  blue: 'bg-tone-blue-bg text-tone-blue-fg',
  violet: 'bg-tone-violet-bg text-tone-violet-fg',
  amber: 'bg-tone-amber-bg text-tone-amber-fg',
  pink: 'bg-tone-pink-bg text-tone-pink-fg',
  gray: 'bg-tone-gray-bg text-tone-gray-fg',
};

export interface Look {
  icon: LucideIcon;
  tone: Tone;
}

/** Words looked for in a category's name (normalised), first match wins. */
const LOOKS: readonly [words: readonly string[], look: Look][] = [
  [['super', 'aliment', 'almacen', 'verduleria', 'carniceria'], { icon: ShoppingCart, tone: 'green' }],
  [['comida', 'delivery', 'restaurant', 'resto', 'cafe', 'bar'], { icon: UtensilsCrossed, tone: 'peach' }],
  [['vivienda', 'alquiler', 'casa', 'hogar', 'expensa'], { icon: House, tone: 'blue' }],
  [['luz', 'gas', 'agua', 'servicio'], { icon: Lightbulb, tone: 'amber' }],
  [['internet', 'telefono', 'celular'], { icon: Wifi, tone: 'blue' }],
  [['nafta', 'combustible'], { icon: Fuel, tone: 'peach' }],
  [['colectivo', 'subte', 'tren', 'sube'], { icon: Bus, tone: 'blue' }],
  [['transporte', 'auto', 'taxi', 'uber', 'estacionamiento'], { icon: Car, tone: 'blue' }],
  [['farmacia', 'remedio'], { icon: Pill, tone: 'pink' }],
  [['salud', 'medic', 'prepaga', 'obra social'], { icon: HeartPulse, tone: 'pink' }],
  [['gimnasio', 'deporte'], { icon: Dumbbell, tone: 'green' }],
  [['suscrip', 'streaming', 'netflix', 'spotify'], { icon: Tv, tone: 'violet' }],
  [['ropa', 'indumentaria'], { icon: Shirt, tone: 'violet' }],
  [['compra'], { icon: ShoppingBag, tone: 'violet' }],
  [['educacion', 'colegio', 'curso', 'facultad'], { icon: GraduationCap, tone: 'amber' }],
  [['libro'], { icon: BookOpen, tone: 'amber' }],
  [['ocio', 'viaje', 'vacacion', 'salida'], { icon: Plane, tone: 'blue' }],
  [['mascota', 'veterinaria'], { icon: PawPrint, tone: 'amber' }],
  [['cargo', 'interes', 'comision'], { icon: Percent, tone: 'peach' }],
  [['impuesto', 'afip', 'arba', 'monotributo'], { icon: Landmark, tone: 'gray' }],
  [['sueldo', 'salario', 'trabajo', 'honorario'], { icon: Briefcase, tone: 'green' }],
  [['rendimiento', 'inversion', 'plazo fijo'], { icon: TrendingUp, tone: 'green' }],
  [['venta'], { icon: Tag, tone: 'green' }],
  [['fijo', 'mensual'], { icon: Repeat, tone: 'violet' }],
];

const NEUTRAL: Look = { icon: Tag, tone: 'gray' };
const UNFILED: Look = { icon: Receipt, tone: 'gray' };
const TRANSFER: Look = { icon: ArrowLeftRight, tone: 'gray' };

/** The look of a category by its name; the root's when it is a subcategory. */
export function categoryLook(categoryId: string | null, categories: readonly Category[]): Look {
  let category = categories.find((candidate) => candidate.id === categoryId);
  if (!category) return UNFILED;
  // A subcategory looks like the branch it belongs to, unless its own name says more.
  const own = findLook(category.name);
  if (own) return own;
  while (category.parentId) {
    const parent = categories.find((candidate) => candidate.id === category!.parentId);
    if (!parent) break;
    category = parent;
  }
  return findLook(category.name) ?? NEUTRAL;
}

function findLook(name: string): Look | null {
  const key = nameKey(name);
  return LOOKS.find(([words]) => words.some((word) => key.includes(word)))?.[1] ?? null;
}

/** The look of a transaction: its category's, a transfer's, or the first part's when it is divided. */
export function transactionLook(
  transaction: Pick<Transaction, 'type' | 'categoryId' | 'splits'>,
  categories: readonly Category[],
): Look {
  if (transaction.type === 'transfer') return TRANSFER;
  return categoryLook(transaction.categoryId ?? transaction.splits[0]?.categoryId ?? null, categories);
}

/** An icon on its soft colour, round-cornered: how a category shows in a list. */
export function LookBadge({ look, size = 'md' }: { look: Look; size?: 'md' | 'lg' }) {
  const Icon = look.icon;
  const box = size === 'lg' ? 'size-12 rounded-2xl' : 'size-10 rounded-xl';
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${box} ${TONE_CLASSES[look.tone]}`}
      aria-hidden="true"
    >
      <Icon size={size === 'lg' ? ICON_SIZE.large : ICON_SIZE.regular} />
    </span>
  );
}
