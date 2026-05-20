import React from "react";
import { CONTACT_ITEMS, MAROON_HAIRLINE } from "./contactData";
import { fadeUpStyle } from "./contact-animations";

interface ContactRowProps {
  inView: boolean;
}

/**
 * Three-column contact-info row (Email / Headquarters / Offices).
 * Bordered by thin maroon hairlines top & bottom.
 */
const ContactRow = React.memo(function ContactRow({ inView }: ContactRowProps) {
  return (
    <div
      style={{
        borderTop: MAROON_HAIRLINE,
        borderBottom: MAROON_HAIRLINE,
        ...fadeUpStyle(100, inView),
      }}
      className="flex items-start justify-between py-6 sm:py-8"
    >
      {CONTACT_ITEMS.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <span className="text-xs sm:text-sm font-medium tracking-wider uppercase text-title-red">
            {item.label}
          </span>
          {item.href ? (
            <a
              href={item.href}
              className="text-sm sm:text-base font-normal text-foreground hover:text-title-red transition-colors break-all sm:break-normal"
            >
              {item.value}
            </a>
          ) : (
            <span className="text-sm sm:text-base font-normal text-foreground-muted">
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

export default ContactRow;
