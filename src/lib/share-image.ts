import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { shareCallToAction, stopShareTitle } from "./share-metadata";

const fontfile = join(process.cwd(), "public/fonts/NotoSansArabic.ttf");
// Explicit file read also lets Next.js trace the bundled font into server deployments.
let fontReady: Promise<Buffer> | undefined;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );

async function textLayer(
  markup: string,
  size: number,
  width = 1056,
  align: "left" | "right" = "right",
) {
  return sharp({
    text: {
      text: markup,
      font: `Noto Sans Arabic ${size}`,
      fontfile,
      width,
      dpi: 72,
      align,
      rgba: true,
      wrap: "word-char",
      spacing: 5,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
}

export async function renderStopShareImage(text: string) {
  await (fontReady ??= readFile(fontfile));
  const title = stopShareTitle(text);
  // Pango/HarfBuzz shapes Arabic and handles mixed Arabic/Latin direction correctly.
  const markup =
    '\u200f<span foreground="#df292f" weight="bold">STOP</span><span foreground="#202020" weight="bold">' +
    escape(title.slice(4)) +
    "</span>";
  let titleLayer = await textLayer(markup, 58);
  for (let size = 54; titleLayer.info.height > 276 && size >= 24; size -= 2)
    titleLayer = await textLayer(markup, size);
  if (titleLayer.info.height > 276) throw new Error("Share title does not fit");
  const logo = await textLayer(
    '<span foreground="#df292f" weight="bold">STOP</span><span foreground="#202020" weight="bold">.ma</span>',
    40,
    340,
    "left",
  );
  const footer = await textLayer(
    '\u200f<span foreground="#202020" weight="bold">' +
      escape(shareCallToAction) +
      "</span>",
    28,
  );
  const background = Buffer.from(
    '<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="white"/><rect width="1200" height="8" fill="#df292f"/><path d="M72 520H1128" stroke="#e5e5e5"/></svg>',
  );
  return sharp(background)
    .composite([
      { input: logo.data, left: 72, top: 48 },
      {
        input: titleLayer.data,
        left: 1200 - 72 - titleLayer.info.width,
        top: 145 + Math.floor((276 - titleLayer.info.height) / 2),
      },
      { input: footer.data, left: 1200 - 72 - footer.info.width, top: 549 },
    ])
    .png()
    .toBuffer();
}
