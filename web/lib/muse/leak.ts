// private-limit leak check. a limit ("i can't spend more than $20") shapes the plan,
// but nothing muse writes may restate it or hint at it. this is the server-side net
// under the prompt instruction: if any distinctive piece of a limit shows up in new
// output text, the output is rejected and regenerated.

const STOP = new Set(
  `about above after again against around because before being below between cannot could doing during every from have having here into just more most much myself need needs only other over really same should some such than that their them then there these they this those through under until very want wants were what when where which while will with would your yours maybe please thing things going come coming can't dont don't won't wont i'm im like kind kinda sorta people person anyone someone anything something plan plans time times`.split(/\s+/),
);

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [];
}

function numbers(text: string): string[] {
  return text.match(/\d+(?:[.:]\d+)?/g) ?? [];
}

/**
 * returns the leaked fragment, or null when clean.
 * `allowed` is text that was already public before this call (the old plan, the
 * counteroffer the same person typed in the open), so its words don't count.
 */
export function findLeak(output: string, limits: string[], allowed: string): string | null {
  const out = output.toLowerCase();
  const outWords = new Set(words(out));
  const outNumbers = new Set(numbers(out));
  const okWords = new Set(words(allowed));
  const okNumbers = new Set(numbers(allowed));

  for (const limit of limits) {
    const l = limit.toLowerCase().trim();
    if (l.length >= 12 && out.includes(l)) return l;
    for (const n of numbers(l)) {
      if (!okNumbers.has(n) && outNumbers.has(n)) return n;
    }
    for (const w of words(l)) {
      if (STOP.has(w) || okWords.has(w)) continue;
      // match the word and simple variants ("drink" vs "drinking", "drinks")
      const stem = w.replace(/(ing|ed|es|s)$/, "");
      for (const ow of outWords) {
        if (ow === w || (stem.length >= 4 && ow.startsWith(stem))) return w;
      }
    }
  }
  return null;
}
