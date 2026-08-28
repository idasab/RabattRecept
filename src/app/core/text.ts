/**
 * Gemener och utan diakriter, så att "kott" hittar "kött". Delas av
 * erbjudandesökningen och receptmatchningen, som båda jämför butikstext med
 * det användaren eller källan skrivit.
 */
export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
