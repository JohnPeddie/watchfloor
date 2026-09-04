"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type MediaFrameProps = {
  src?: string | null;
  alt?: string;
  /** CSS aspect-ratio. Every instance of the same ratio stays the same size. */
  ratio?: `${number} / ${number}`;
  className?: string;
  iconSize?: number;
  emptyLabel?: string;
};

/**
 * Crops any source image into a fixed frame. Absolutely positioned so a
 * portrait photo or a 4K og:image cannot stretch the list row or reader.
 */
export function MediaFrame({
  src,
  alt = "",
  ratio = "16 / 9",
  className = "",
  iconSize = 18,
  emptyLabel,
}: MediaFrameProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const show = Boolean(src) && !failed;

  return (
    <div className={`md-media ${className}`.trim()} style={{ aspectRatio: ratio }}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src ?? ""} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="md-media-ph">
          <Icon name="article" size={iconSize} />
          {emptyLabel && <span className="md-label-sm">{emptyLabel}</span>}
        </span>
      )}
    </div>
  );
}
