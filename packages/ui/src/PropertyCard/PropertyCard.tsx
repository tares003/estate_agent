import { forwardRef, type ReactElement } from 'react';
import './PropertyCard.css';

/**
 * The universal property card (EPIC-F), ported from
 * design/canvas/components/organisms/property-card.html. One component, nine
 * market-status variants. Trust markers per PRODUCT.md §8: the price qualifier
 * sits above the price, and a rent figure always carries its frequency.
 *
 * Accessibility (G9): rather than the canvas's button-nested-in-anchor (invalid
 * interactive nesting), this uses the stretched-link pattern — the card is an
 * <article>, the title holds the one navigational <a> whose ::after overlay makes
 * the whole card clickable, and the Save / Notify controls sit above that overlay
 * as separate buttons. The status badge always carries a verbatim aria-label
 * (colour is never the only signal).
 */
export type PropertyCardStatus =
  | 'for_sale'
  | 'to_rent'
  | 'under_offer'
  | 'new_home'
  | 'sold_stc'
  | 'sold'
  | 'let_agreed'
  | 'let'
  | 'withdrawn';

interface StatusMeta {
  label: string;
  toneClass: string;
  muted: boolean;
}

/** market_status → badge label, --colour-status-* tone class, and muted flag. */
const STATUS: Record<PropertyCardStatus, StatusMeta> = {
  for_sale: { label: 'For sale', toneClass: 'b-available', muted: false },
  to_rent: { label: 'To rent', toneClass: 'b-available', muted: false },
  under_offer: { label: 'Under offer', toneClass: 'b-under-offer', muted: false },
  new_home: { label: 'New home', toneClass: 'b-new', muted: false },
  sold_stc: { label: 'Sold STC', toneClass: 'b-sold-stc', muted: true },
  sold: { label: 'Sold', toneClass: 'b-sold', muted: true },
  let_agreed: { label: 'Let agreed', toneClass: 'b-let-agreed', muted: true },
  let: { label: 'Let', toneClass: 'b-let', muted: true },
  withdrawn: { label: 'Withdrawn', toneClass: 'b-withdrawn', muted: true },
};

export interface PropertyCardProps {
  /** Destination of the card's primary (stretched) link. */
  href: string;
  /** Market status — drives the badge, tone and muted treatment. */
  status: PropertyCardStatus;
  /** Trust-marker qualifier shown above the price (e.g. "Guide price", "Asking rent"). */
  priceQualifier: string;
  /** Pre-formatted price, e.g. "£525,000" or "£1,450". */
  price: string;
  /** Rent frequency shown beside the price (PRODUCT.md §8); omit for sales. */
  rentFrequency?: 'PCM' | 'PW' | 'PA';
  /** Headline, e.g. "Edwardian semi · 4 bed". */
  title: string;
  /** Address line, e.g. "Palatine Road, Didsbury, M20". */
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Number of photos; shows the photo-count pill when > 0. */
  photoCount?: number;
  addedLabel?: string;
  branchLabel?: string;
  /** Renders the Save control when provided. */
  onSave?: () => void;
  saved?: boolean;
  /** Renders the "Notify me of similar" control (used on muted sold/let cards). */
  notifyLabel?: string;
  onNotify?: () => void;
  className?: string;
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const HousePlaceholder = (): ReactElement => (
  <svg
    className="ph-house"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v9h14v-9" />
    <path d="M9 19v-5h6v5" />
  </svg>
);

export const PropertyCard = forwardRef<HTMLElement, PropertyCardProps>(function PropertyCard(
  {
    href,
    status,
    priceQualifier,
    price,
    rentFrequency,
    title,
    address,
    bedrooms,
    bathrooms,
    propertyType,
    imageUrl,
    imageAlt,
    photoCount,
    addedLabel,
    branchLabel,
    onSave,
    saved = false,
    notifyLabel,
    onNotify,
    className,
  }: PropertyCardProps,
  ref,
): ReactElement {
  const meta = STATUS[status];

  return (
    <article ref={ref} className={cx('pcard', meta.muted && 'muted', className)}>
      <div className="media">
        {imageUrl ? (
          <img className="photo" src={imageUrl} alt={imageAlt ?? title} />
        ) : (
          <div className="roof">
            <HousePlaceholder />
          </div>
        )}
        <span className={cx('badge', meta.toneClass)} aria-label={`Status: ${meta.label}`}>
          {meta.label}
        </span>
        {photoCount && photoCount > 0 ? (
          <span className="photos" aria-label={`${photoCount} photos`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="m6 19 5-4 4 3 3-2" />
            </svg>
            {photoCount}
          </span>
        ) : null}
        {onSave ? (
          <button
            type="button"
            className={cx('save', saved && 'is-saved')}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved properties' : 'Save property'}
            onClick={onSave}
          >
            <svg
              viewBox="0 0 24 24"
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="body">
        <p className="qual">{priceQualifier}</p>
        <p className="price">
          {price}
          {rentFrequency ? <span className="freq"> {rentFrequency}</span> : null}
        </p>
        <h3 className="addr">
          <a className="pcard-link" href={href}>
            {title}
          </a>
        </h3>
        <p className="street">{address}</p>
        <div className="meta">
          {typeof bedrooms === 'number' ? (
            <span>
              {bedrooms} {bedrooms === 1 ? 'bed' : 'beds'}
            </span>
          ) : null}
          {typeof bathrooms === 'number' ? (
            <span>
              {bathrooms} {bathrooms === 1 ? 'bath' : 'baths'}
            </span>
          ) : null}
          {propertyType ? <span>{propertyType}</span> : null}
        </div>
        {notifyLabel ? (
          <button type="button" className="notify" onClick={onNotify}>
            {notifyLabel}
          </button>
        ) : null}
        <div className="foot">
          {addedLabel ? <span className="added">{addedLabel}</span> : <span />}
          {branchLabel ? <span className="branch">{branchLabel}</span> : null}
        </div>
      </div>
    </article>
  );
});
