import { Offer } from './offers.models';
import { normalizeText } from './text';

interface Category {
  name: string;
  /** Ord i varunamnet som pekar ut kategorin. */
  stems: string[];
  /** Ordbörjan som gör att ordet inte räknas, trots att en stam matchar. */
  except?: string[];
}

/**
 * Varor som inte gick att placera. Står alltid sist.
 *
 * Det som blir kvar är nästan alltid rubriker som bara är ett varumärke —
 * "TUPLA MAXI" är en chokladbit, men det står ingenstans. "Ospecificerat"
 * säger vad som faktiskt hänt: varan har ingen angiven grupp, inte att den
 * skulle vara en udda restpost.
 */
export const OTHER = 'Ospecificerat';

/**
 * Varugrupperna rabattlistan delas in i.
 *
 * Tjek lämnar ingen kategori: erbjudandet har inget sådant fält, och kedjans
 * category_ids är tom. Indelningen måste därför läsas ur varunamnet, precis
 * som huvudråvarorna i main-ingredients.ts.
 *
 * Ordningen avgör, för den första posten som matchar vinner. Färdigmat och
 * fika står först eftersom de är sammansatta av råvaror som annars skulle ta
 * dem: en kycklingpizza hör hemma bland färdigmaten, inte bland fågeln, och
 * ostbågar är snacks och inte mejeri.
 */
const CATEGORIES: Category[] = [
  {
    name: 'Färdigmat',
    stems: [
      'pizza',
      'lasagne',
      'sushi',
      'paj',
      'piroger',
      'gratäng',
      'pytt',
      'färdigrätt',
      'wok',
      'nuggets',
      'pannkak',
      'plättar',
      'kroppkakor',
      'pirog',
    ],
  },
  {
    name: 'Fika & godis',
    stems: [
      'kaffe',
      'glass',
      'choklad',
      'godis',
      'lördagsgodis',
      'kex',
      'chips',
      'snacks',
      'bågar',
      'nachos',
      'popcorn',
      'kaka',
      'kakor',
      'tårta',
      'bulle',
      'bullar',
      'wienerbröd',
      'lakrits',
      'karamell',
      'praliner',
      'marsipan',
      'våffl',
      'skorpor',
      'sockerkaka',
    ],
    // Kokosmjölk är matlagning och kakaopulver är skafferi. Köttbullar,
    // fiskbullar och potatisbullar slutar på "bullar" utan att vara fika.
    except: ['kakao', 'kokos', 'kött', 'fisk', 'potatis', 'grönsak', 'falafel'],
  },
  {
    name: 'Dryck',
    stems: [
      'läsk',
      'saft',
      'juice',
      'cider',
      'lemonad',
      'energidryck',
      'sportdryck',
      'smoothie',
      'mineralvatten',
      'kolsyrat',
      'bryggd',
      'öl',
      'folköl',
      'tonic',
      'nektar',
      'vatten',
    ],
    // "öl" är kort och sitter i många ord: kål, mjöl, tröjöl finns inte men
    // kålrot och mjölk gör det.
    except: ['kål', 'mjöl', 'ölandspotatis', 'vattenmelon'],
  },
  {
    name: 'Bröd & bageri',
    stems: [
      'bröd',
      'baguette',
      'knäcke',
      'tortilla',
      'pitabröd',
      'croissant',
      'fralla',
      'ciabatta',
      'bagel',
      'kavring',
      'rostbröd',
      'tunnbröd',
      'korvbröd',
      'hamburgerbröd',
      'scones',
      'limpa',
      'levain',
    ],
  },
  {
    name: 'Kyckling & fågel',
    stems: ['kyckling', 'kalkon', 'anka', 'fågel'],
    except: ['kycklingbuljong', 'kycklingfond'],
  },
  {
    name: 'Fisk & skaldjur',
    stems: [
      'lax',
      'torsk',
      'sej',
      'kolja',
      'fisk',
      'räk',
      'räkor',
      'skaldjur',
      'sill',
      'strömming',
      'makrill',
      'tonfisk',
      'musslor',
      'kräft',
      'hummer',
      'abborre',
      'gös',
      'rödspätta',
      'kaviar',
      'surimi',
    ],
    except: ['fiskeby'],
  },
  {
    name: 'Kött & chark',
    stems: [
      'kött',
      'färs',
      'nöt',
      'fläsk',
      'gris',
      'lamm',
      'kotlett',
      'karré',
      'kassler',
      'revben',
      'bacon',
      'skinka',
      'korv',
      'salami',
      'chark',
      'biff',
      'entrecôte',
      'entrecote',
      'oxfilé',
      'oxfile',
      'ryggbiff',
      'högrev',
      'rostbiff',
      'pastrami',
      'leverpastej',
      'blodpudding',
      'kebab',
      'schnitzel',
      'stek',
    ],
    // "färsk" börjar på "färs", "korvbröd" är bröd, och nötterna är skafferi.
    except: ['färsk', 'korvbröd', 'nötter', 'jordnöt', 'cashewnöt', 'valnöt', 'hasselnöt'],
  },
  {
    name: 'Mejeri & ägg',
    stems: [
      'mjölk',
      'grädde',
      'filmjölk',
      'yoghurt',
      'kvarg',
      'kefir',
      'smör',
      'margarin',
      'bregott',
      'ägg',
      'keso',
      'kesella',
      'ost',
      'gouda',
      'cheddar',
      'mozzarella',
      'fetaost',
      'prästost',
      'herrgård',
      'brie',
      'creme',
      'crème',
    ],
    // Smörgås är bröd, smörgåsgurka är grönt, och kokosmjölk är skafferi.
    except: ['smörgås', 'kokosmjölk', 'havremjölk', 'sojamjölk', 'kompost'],
  },
  {
    name: 'Frukt & grönt',
    stems: [
      'frukt',
      'grönsak',
      'sallad',
      'tomat',
      'gurka',
      'paprika',
      'lök',
      'potatis',
      'morot',
      'morötter',
      'äpple',
      'banan',
      'apelsin',
      'päron',
      'druv',
      'melon',
      'jordgubb',
      'blåbär',
      'hallon',
      'vinbär',
      'avokado',
      'broccoli',
      'blomkål',
      'champinjon',
      'svamp',
      'citron',
      'lime',
      'spenat',
      'fikon',
      'persilja',
      'basilika',
      'mango',
      'kiwi',
      'ananas',
      'nektarin',
      'plommon',
      'kål',
      'purjo',
      'squash',
      'aubergine',
      'zucchini',
      'sockerärt',
      'rotfrukt',
      'ingefära',
      'klementin',
      'clementin',
      'rucola',
    ],
    // Krossade tomater och tomatpuré är skafferi, chipsen är fika.
    except: ['tomatpuré', 'tomatkross', 'krossade', 'potatischips', 'lökringar'],
  },
  {
    name: 'Skafferi',
    stems: [
      'pasta',
      'spaghetti',
      'makaroner',
      'ris',
      'mjöl',
      'socker',
      'buljong',
      'fond',
      'konserv',
      'olja',
      'vinäger',
      'ketchup',
      'majonnäs',
      'senap',
      'sås',
      'soppa',
      'bönor',
      'linser',
      'kikärt',
      'couscous',
      'bulgur',
      'gryn',
      'müsli',
      'flingor',
      'havregryn',
      'sylt',
      'marmelad',
      'honung',
      'nötter',
      'krydd',
      'salt',
      'peppar',
      'jäst',
      'bakpulver',
      'tomatpuré',
      'kokosmjölk',
      'kakao',
      'sirap',
      'dressing',
      'pesto',
      'hummus',
      'oliver',
      'gröt',
      'russin',
      'nudlar',
      'nudel',
      'ramen',
      'soba',
      'udon',
      'nori',
    ],
    except: ['gris', 'lågpris', 'jämförpris', 'styckpris', 'prispressat', 'saltgurka'],
  },
  {
    name: 'Hem & hushåll',
    stems: [
      'papper',
      'tvätt',
      'disk',
      'blöj',
      'rengöring',
      'schampo',
      'tandkräm',
      'tvål',
      'folie',
      'soppås',
      'batteri',
      'kattmat',
      'hundmat',
      'kattsand',
      'servetter',
      'plastpåsar',
      'dusch',
      'deodorant',
      'hushållsrullar',
      'bindor',
      'tamponger',
      'rakhyvel',
      'blommor',
      'bukett',
      'rosor',
      'plantjord',
      'naturgödsel',
      'hårfärg',
      'ljus',
    ],
  },
];

/** Stammarna avdiakritiserade en gång, så att jämförelsen slipper göra om det. */
const PREPARED = CATEGORIES.map((entry) => ({
  name: entry.name,
  stems: entry.stems.map(normalizeText),
  except: (entry.except ?? []).map(normalizeText),
}));

/** Ordningen kategorierna visas i. Det ospecificerade sist, där det hör hemma. */
export const CATEGORY_ORDER: readonly string[] = [
  ...CATEGORIES.map((entry) => entry.name),
  OTHER,
];

/**
 * Kategorin ett erbjudande hör till.
 *
 * Rubriken avgör i första hand, för det är där varunamnet står. Går den inte
 * att placera prövas beskrivningen, som ofta bär varunamnet igen i en längre
 * form — men bara som andrahandskälla, eftersom den också innehåller mängder
 * och jämförpriser som lätt ger en felaktig träff.
 */
export function categoryFor(heading: string, description = ''): string {
  return match(heading) ?? match(description) ?? OTHER;
}

/** Erbjudandena grupperade per kategori, i kategoriordningen. Tomma utelämnas. */
export function byCategory(offers: readonly Offer[]): { name: string; offers: Offer[] }[] {
  const held = new Map<string, Offer[]>();

  for (const offer of offers) {
    const name = categoryFor(offer.heading, offer.description);
    const list = held.get(name);
    if (list) {
      list.push(offer);
    } else {
      held.set(name, [offer]);
    }
  }

  return CATEGORY_ORDER.filter((name) => held.has(name)).map((name) => ({
    name,
    offers: held.get(name) as Offer[],
  }));
}

/**
 * Matchningen görs per ord och godtar både början och slutet av ordet, för
 * svenska varunamn sätter ihop varan åt båda hållen: "kycklinglårfilé" börjar
 * med varan, "lövbiff" slutar med den.
 */
function match(text: string): string | null {
  const words = normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (!words.length) {
    return null;
  }

  for (const entry of PREPARED) {
    const usable = words.filter(
      (word) => !entry.except.some((excluded) => word.startsWith(excluded))
    );

    for (const stem of entry.stems) {
      if (usable.some((word) => word.startsWith(stem) || word.endsWith(stem))) {
        return entry.name;
      }
    }
  }

  return null;
}
