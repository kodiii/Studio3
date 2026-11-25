# Reading a reference image

## 1. Size and scale

- Design tools export at 1× or 2×. A 2880-px-wide export of a desktop frame is a 1440-px layout at 2×: run
  `review match --scale 2`. Phone frames are usually 390 or 393 px wide at 3× (1170 or 1179 px).
- The capture uses the image size divided by the scale as the viewport. A frame taller than the screen compares the
  page from the top to that height; for one section, crop the reference to that section and use `--viewport` with the
  same height, scrolled with a route anchor if needed.

## 2. Measure before building

| What | How to read it from the image | Becomes |
|---|---|---|
| Grid | Left and right margins, column count, gutter (distance between aligned blocks) | Container max-width, padding, grid template |
| Rhythm | Vertical distances between sections and between items | Spacing tokens (snap to the scale; note real outliers) |
| Type | Cap height or x-height in pixels → font size; line spacing → line-height; characters per line → measure | Type-scale steps and weights |
| Colour | `review match` lists the reference palette with shares; sample flat areas, not anti-aliased edges | Colour roles (surface, ink, primary…) — not one variable per sample |
| Components | Buttons, inputs, cards: height, radius, border, shadow | Component tokens and states |

Snap measurements to the design system's scales. A 23-px gap in a mockup is almost always the 24-px step: matching
the intent beats matching the pixel.

## 3. What the image does not say

Hover, focus and pressed states; motion; how text wraps with real content; other breakpoints; empty, loading and error
states; behaviour at 200 % zoom. Decide them with the specialty studio's rules and list the decisions in the report.

## 4. What similarity means

Pixel similarity is the share of pixels that are perceptibly the same (pixelmatch, threshold 0.1). It is dominated by
large areas:

- 99–100 %: the same render (font rasterisation and compression are the remaining noise).
- 95–99 %: same layout and colours; differences in text wrapping, icons or images.
- 85–95 %: same structure; shifted blocks, different line breaks, different imagery or content.
- Below 85 %: a different layout, a different section height, or the wrong viewport/scale.

A page on a white background can score high while a key element is wrong — always look at `diff.png` and the region
table, not only the number. Use the regions: fix the one with the largest share first.

## 5. Common sources of difference

- Fonts not loaded (or a fallback with different metrics): everything below the first line moves. Load the real font.
- Different content length: a longer headline wraps and pushes the page down; use the reference's text while
  matching, then swap in real content and re-check the layout.
- Images and illustrations not supplied: use a same-size placeholder in the same position and say so.
- Scrollbars: the capture has no scrollbar; a screenshot from a desktop browser may.
- Sub-pixel rounding and anti-aliasing: noise at edges; ignore differences under about 1 %.
