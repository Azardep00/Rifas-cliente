import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GrillaNumeros } from './grilla-numeros';

@Component({
  imports: [GrillaNumeros],
  template: `<app-grilla-numeros [estados]="estados()" [digitos]="digitos()" [seleccionados]="elegidos()"
                                 [soloLectura]="soloLectura()" (alternar)="pulsados.push($event)" />`,
})
class Anfitrion {
  estados = signal('L'.repeat(100));
  digitos = signal<number | undefined>(2);
  elegidos = signal<number[]>([]);
  soloLectura = signal(false);
  pulsados: number[] = [];
}

async function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const botones = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button[data-n]'));
  const boton = (n: number) => el.querySelector<HTMLButtonElement>(`button[data-n="${n}"]`)!;
  return { fixture, host: fixture.componentInstance, el, botones, boton };
}

describe('GrillaNumeros', () => {
  it('pinta 100 casillas con ceros a la izquierda y sin navegador de bloques', async () => {
    const { el, botones, boton } = await montar();
    expect(botones()).toHaveLength(100);
    expect(boton(7).textContent?.trim()).toBe('07');
    expect(el.querySelector('select')).toBeNull();
  });

  it('describe cada estado en su etiqueta accesible', async () => {
    const { host, fixture, boton } = await montar();
    host.estados.set('LRV' + 'L'.repeat(97));
    host.elegidos.set([3]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(boton(0).getAttribute('aria-label')).toBe('Número 00, libre');
    expect(boton(1).getAttribute('aria-label')).toBe('Número 01, reservado por otra persona');
    expect(boton(2).getAttribute('aria-label')).toBe('Número 02, vendido');
    expect(boton(3).getAttribute('aria-label')).toBe('Número 03, tu selección');
    expect(boton(3).getAttribute('aria-pressed')).toBe('true');
    expect(boton(0).getAttribute('aria-pressed')).toBe('false');
    expect(boton(1).getAttribute('aria-disabled')).toBe('true');
    expect(boton(2).getAttribute('aria-pressed')).toBeNull();
  });

  it('emite al tocar un número libre y no al tocar reservado o vendido', async () => {
    const { host, fixture, boton } = await montar();
    host.estados.set('LRV' + 'L'.repeat(97));
    fixture.detectChanges();
    await fixture.whenStable();
    boton(0).click();
    boton(1).click();
    boton(2).click();
    expect(host.pulsados).toEqual([0]);
  });

  it('en solo lectura no emite nada', async () => {
    const { host, fixture, boton } = await montar();
    host.soloLectura.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    boton(5).click();
    expect(host.pulsados).toEqual([]);
    expect(boton(5).getAttribute('aria-disabled')).toBe('true');
  });

  it('con 1000 números muestra un bloque de 100 y un selector con libres por bloque', async () => {
    const { host, fixture, el, botones } = await montar();
    host.estados.set('V'.repeat(100) + 'L'.repeat(900));
    host.digitos.set(3);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(botones()).toHaveLength(100);
    const opciones = Array.from(el.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(opciones).toHaveLength(10);
    expect(opciones[0]).toBe('000 a 099 · 0 libres');
    expect(opciones[1]).toBe('100 a 199 · 100 libres');
  });

  it('el selector y los botones cambian de bloque', async () => {
    const { host, fixture, el, botones } = await montar();
    host.estados.set('L'.repeat(1000));
    host.digitos.set(3);
    fixture.detectChanges();
    await fixture.whenStable();
    const select = el.querySelector('select')!;
    select.value = '4';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(botones()[0].textContent?.trim()).toBe('400');
    el.querySelector<HTMLButtonElement>('button[aria-label="Bloque siguiente"]')!.click();
    await fixture.whenStable();
    expect(botones()[0].textContent?.trim()).toBe('500');
    el.querySelector<HTMLButtonElement>('button[aria-label="Bloque anterior"]')!.click();
    await fixture.whenStable();
    expect(botones()[0].textContent?.trim()).toBe('400');
  });

  it('"Ir al número" salta al bloque y enfoca la casilla, aceptando ceros a la izquierda', async () => {
    const { host, fixture, el, boton } = await montar();
    host.estados.set('L'.repeat(1000));
    host.digitos.set(3);
    fixture.detectChanges();
    await fixture.whenStable();
    const campo = el.querySelector<HTMLInputElement>('#ir-a')!;
    campo.value = '0742';
    campo.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(boton(742)).toBeTruthy();
    expect(document.activeElement).toBe(boton(742));
  });

  it('"Ir al número" rechaza valores fuera de rango o no numéricos', async () => {
    const { host, fixture, el } = await montar();
    host.estados.set('L'.repeat(1000));
    host.digitos.set(3);
    fixture.detectChanges();
    await fixture.whenStable();
    const campo = el.querySelector<HTMLInputElement>('#ir-a')!;
    for (const malo of ['1000', 'abc', '-3', '']) {
      campo.value = malo;
      campo.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      expect(el.querySelector('#error-ir')?.textContent).toContain('entre 000 y 999');
    }
  });

  it('solo una casilla es tabulable y las flechas mueven el foco', async () => {
    const { fixture, boton, botones } = await montar();
    expect(botones().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(boton(0).tabIndex).toBe(0);

    boton(0).focus();
    boton(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton(1));
    expect(boton(1).tabIndex).toBe(0);
    expect(boton(0).tabIndex).toBe(-1);

    // Sin medidas de layout (jsdom) se usan 10 columnas: abajo = +10.
    boton(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton(11));
  });

  it('Inicio y Fin van a los extremos del bloque; los bordes no se salen', async () => {
    const { fixture, boton } = await montar();
    const tecla = (n: number, key: string) =>
      boton(n).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    boton(0).focus();
    tecla(0, 'ArrowLeft');
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton(0));
    tecla(0, 'End');
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton(99));
    tecla(99, 'Home');
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton(0));
  });

  it('AvPág y RePág cambian de bloque', async () => {
    const { host, fixture, boton } = await montar();
    host.estados.set('L'.repeat(1000));
    fixture.detectChanges();
    await fixture.whenStable();
    boton(5).focus();
    boton(5).dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton(105));
    boton(105).dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(boton(5));
  });

  it('si la grilla se achica no queda apuntando a un bloque inexistente', async () => {
    const { host, fixture, el, botones } = await montar();
    host.estados.set('L'.repeat(1000));
    fixture.detectChanges();
    await fixture.whenStable();
    const select = el.querySelector('select')!;
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    host.estados.set('L'.repeat(100));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(botones()).toHaveLength(100);
  });
});
