import { mainIngredientFor } from './main-ingredients';

describe('mainIngredientFor', () => {
  it('hittar råvaran i början av ett sammansatt varunamn', () => {
    expect(mainIngredientFor('Kycklinglårfilé')).toBe('Kyckling');
    expect(mainIngredientFor('KYCKLINGDETALJER')).toBe('Kyckling');
    expect(mainIngredientFor('Laxloin')).toBe('Lax');
  });

  it('hittar råvaran i slutet av ett sammansatt varunamn', () => {
    expect(mainIngredientFor('Blandfärs')).toBe('Blandfärs');
    expect(mainIngredientFor('Nötfärs')).toBe('Nötfärs');
  });

  it('hittar råvaran mitt i en butiksrubrik', () => {
    expect(mainIngredientFor('STORA RÄKOR I LAKE')).toBe('Räkor');
    expect(mainIngredientFor('ENTRECÔTE I BIT')).toBe('Entrecôte');
  });

  it('bryr sig varken om versaler eller diakriter', () => {
    expect(mainIngredientFor('högrev')).toBe('Högrev');
    expect(mainIngredientFor('HOGREV')).toBe('Högrev');
    expect(mainIngredientFor('Entrecote')).toBe('Entrecôte');
  });

  it('låter den mer specifika råvaran vinna', () => {
    // Annars blir falukorv bara "Korv" och fläskkotlett bara "Kotlett".
    expect(mainIngredientFor('Falukorv')).toBe('Falukorv');
    expect(mainIngredientFor('Fläskkotlett')).toBe('Fläskkotlett');
    expect(mainIngredientFor('Nötfärs')).toBe('Nötfärs');
  });

  it('känner igen den allmänna varianten när den specifika inte passar', () => {
    expect(mainIngredientFor('Grillkorv')).toBe('Korv');
    expect(mainIngredientFor('Köttfärs')).toBe('Köttfärs');
  });

  it('svarar null på varor som inte bär en maträtt', () => {
    // Det här är hela poängen: smör och grädde ska inte styra receptvalet.
    expect(mainIngredientFor('Svenskt smör')).toBeNull();
    expect(mainIngredientFor('Gräddglass')).toBeNull();
    expect(mainIngredientFor('Bakpulver')).toBeNull();
    expect(mainIngredientFor('Chiliflakes')).toBeNull();
    expect(mainIngredientFor('SMAKSATT YOGHURT')).toBeNull();
  });

  it('svarar null på sådant som inte är mat alls', () => {
    expect(mainIngredientFor('Toalettpapper 12-pack')).toBeNull();
    expect(mainIngredientFor('TVÄTTMEDEL PULVER')).toBeNull();
    expect(mainIngredientFor('Blöjor megapack')).toBeNull();
    expect(mainIngredientFor('')).toBeNull();
  });

  it('låter sig inte luras av ord som bara börjar likadant', () => {
    // Alla tre har dykt upp i riktiga erbjudanden.
    expect(mainIngredientFor('Kaffebönor')).toBeNull();
    expect(mainIngredientFor('Hela kaffebönor')).toBeNull();
    expect(mainIngredientFor('Korvbröd 8-pack')).toBeNull();
    expect(mainIngredientFor('Färska örter')).toBeNull();
    expect(mainIngredientFor('Färskost')).toBeNull();
  });

  it('hittar ändå råvaran när undantagsordet står bredvid', () => {
    expect(mainIngredientFor('Färsk kyckling')).toBe('Kyckling');
  });

  it('väljer efter listans ordning när rubriken nämner flera råvaror', () => {
    // Erbjudandet gäller alla tre; listan avgör vilken som blir sökterm.
    expect(mainIngredientFor('Ekologiska Bönor, Kikärtor, Linser')).toBe('Linser');
  });

  it('tar med vegetariska huvudråvaror', () => {
    expect(mainIngredientFor('Halloumi')).toBe('Halloumi');
    expect(mainIngredientFor('Röda linser 500 g')).toBe('Linser');
  });
});
