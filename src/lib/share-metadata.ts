export const shareDescription = "واش حتى نتا متافق؟ صوّت وشارك على STOP.ma";
export const shareCallToAction = "حتى نتا متافق؟ صوّت فـ STOP.ma";

export function stopShareTitle(text: string) {
  const body = text
    .trim()
    .replace(/^(?:STOP\b[\s:：\-–—]*)+/i, "")
    .replace(/\s+STOP\s*$/i, "")
    .trim();
  return body ? `STOP ${body}` : "STOP";
}
