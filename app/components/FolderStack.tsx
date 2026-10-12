import type { CSSProperties, Ref } from "react";
import { SUBFOLDERS } from "./dockFolders";

/**
 * The three coloured folders, small and stacked, in the middle of the glass
 * folder (client, 9 Oct: "to help with the rendering of the folder glass,
 * add the three stacked color transparent folders inside the main glass
 * folder in a small size within its middle"). Something to see THROUGH the
 * glass is what makes it read as glass rather than a frosted shape.
 *
 * Drawn under the glass and over its frost, by the dock's folder and by the
 * folder's own dial's hub alike, so the stack is there on both sides of the
 * hand-over between them. Sized for the dock's 84px file canvas; the hub
 * scales it with `--fstack-scale`. Back to front, the same order and
 * colours as the subfolders the dial springs out.
 */
export default function FolderStack({
  className = "",
  ref,
}: {
  className?: string;
  ref?: Ref<HTMLSpanElement>;
}) {
  return (
    <span ref={ref} aria-hidden className={`cgd-fstack ${className}`}>
      {SUBFOLDERS.map((f, i) => (
        <span
          key={f.name}
          className="cgd-fstack-folder"
          style={
            {
              "--tint": f.tint,
              "--edge": f.edge,
              "--i": i - (SUBFOLDERS.length - 1) / 2,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
