import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { SettingsMenuComponent } from './settings-menu.component';

describe('SettingsMenuComponent', () => {
  let fixture: ComponentFixture<SettingsMenuComponent>;

  function setOpen(open: boolean): void {
    const previous = fixture.componentInstance.open;
    fixture.componentInstance.open = open;
    fixture.componentInstance.ngOnChanges({
      open: new SimpleChange(previous, open, false),
    });
    fixture.detectChanges();
  }

  function element<T extends HTMLElement>(selector: string): T | null {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  }

  function chips(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.chips li span')).map(
      (chip) => chip.textContent?.trim() ?? ''
    );
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SettingsMenuComponent] });
    fixture = TestBed.createComponent(SettingsMenuComponent);
    fixture.componentInstance.excluded = [];
    fixture.detectChanges();
  });

  it('visar ingenting när menyn är stängd', () => {
    expect(element('.panel')).toBeNull();
    expect(element('.scrim')).toBeNull();
  });

  it('är en dialog när den är öppen', () => {
    setOpen(true);

    const panel = element('.panel');
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
  });

  it('stänger med krysset', () => {
    setOpen(true);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    element<HTMLButtonElement>('.close')?.click();

    expect(closed).toBe(1);
  });

  it('stänger när man trycker utanför', () => {
    setOpen(true);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    element<HTMLButtonElement>('.scrim')?.click();

    expect(closed).toBe(1);
  });

  it('stänger med Esc', () => {
    setOpen(true);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    fixture.componentInstance.onEscape();

    expect(closed).toBe(1);
  });

  it('reagerar inte på Esc när den redan är stängd', () => {
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    fixture.componentInstance.onEscape();

    expect(closed).toBe(0);
  });

  it('flyttar fokus till panelen, inte till fältet', fakeAsync(() => {
    setOpen(true);
    tick();

    // Ett fokuserat textfält fäller upp tangentbordet och döljer halva menyn.
    expect(document.activeElement).toBe(element('.panel'));
  }));

  it('speglar om bara svenska varor är valt', () => {
    setOpen(true);
    expect(element<HTMLInputElement>('.toggle input')?.checked).toBeFalse();

    fixture.componentInstance.onlySwedish = true;
    fixture.detectChanges();

    expect(element<HTMLInputElement>('.toggle input')?.checked).toBeTrue();
  });

  it('skickar vidare när svenskfiltret slås på och av', () => {
    setOpen(true);
    const val: boolean[] = [];
    fixture.componentInstance.swedishOnly.subscribe((only) => val.push(only));

    element<HTMLInputElement>('.toggle input')?.click();
    fixture.componentInstance.onlySwedish = true;
    fixture.detectChanges();
    element<HTMLInputElement>('.toggle input')?.click();

    expect(val).toEqual([true, false]);
  });

  it('förklarar att okänt ursprung inte räknas som svenskt', () => {
    setOpen(true);

    expect(element('.note')?.textContent).toContain('okända');
  });

  it('säger till när inget är uteslutet', () => {
    setOpen(true);

    expect(element('.empty')?.textContent).toContain('Inget är uteslutet');
  });

  it('listar de uteslutna varorna', () => {
    fixture.componentInstance.excluded = ['fläsk', 'färsk kycklingfilé'];
    setOpen(true);

    expect(chips()).toEqual(['fläsk', 'färsk kycklingfilé']);
  });

  it('skickar vidare det man skrivit och tömmer fältet', () => {
    setOpen(true);
    const added: string[] = [];
    fixture.componentInstance.add.subscribe((entry) => added.push(entry));

    fixture.componentInstance.draft.set('  färsk kycklingfilé  ');
    element<HTMLFormElement>('.add')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(added).toEqual(['färsk kycklingfilé']);
    expect(fixture.componentInstance.draft()).toBe('');
  });

  it('skickar inget när fältet bara innehåller blanksteg', () => {
    setOpen(true);
    const added: string[] = [];
    fixture.componentInstance.add.subscribe((entry) => added.push(entry));

    fixture.componentInstance.draft.set('   ');
    element<HTMLFormElement>('.add')?.dispatchEvent(new Event('submit'));

    expect(added).toEqual([]);
  });

  it('låser knappen tills något är skrivet', () => {
    setOpen(true);
    expect(element<HTMLButtonElement>('.add button')?.disabled).toBeTrue();

    fixture.componentInstance.draft.set('lax');
    fixture.detectChanges();

    expect(element<HTMLButtonElement>('.add button')?.disabled).toBeFalse();
  });

  it('tömmer ett påbörjat fält när menyn öppnas på nytt', () => {
    setOpen(true);
    fixture.componentInstance.draft.set('halvskrivet');

    setOpen(false);
    setOpen(true);

    expect(fixture.componentInstance.draft()).toBe('');
  });

  it('skickar vidare vilken vara som ska tas bort', () => {
    fixture.componentInstance.excluded = ['fläsk', 'räkor'];
    setOpen(true);
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((entry) => removed.push(entry));

    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.chips button')[1]
      .click();

    expect(removed).toEqual(['räkor']);
  });

  it('erbjuder de kända råvarorna som förslag', () => {
    fixture.componentInstance.suggestions = ['Kyckling', 'Lax'];
    setOpen(true);

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('datalist option')
    ).map((option) => option.getAttribute('value'));

    expect(options).toEqual(['Kyckling', 'Lax']);
  });

  it('beskriver borttagningsknappen för skärmläsare', () => {
    fixture.componentInstance.excluded = ['fläsk'];
    setOpen(true);

    expect(element('.chips button')?.getAttribute('aria-label')).toBe('Sluta utesluta fläsk');
  });
});
