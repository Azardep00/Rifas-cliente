import { PasoLoteria } from '../core/api/models';
import { claseResolucion, describirPaso, diaLoteria, etiquetaRegla } from './sorteo-texto';

const base: PasoLoteria = {
  posicionPremio: 1, resultadoId: 1, fechaSorteoLoteria: '2026-11-05', numeroMayor: '8377', numeroObjetivo: '77',
  resolucion: 'DIRECTO', causa: null, numeroBoleto: '77',
};

describe('sorteo-texto', () => {
  it('describe un paso directo', () => {
    expect(describirPaso(base)).toBe('Salió 8377 → terminación 77: gana el 77.');
    expect(claseResolucion(base)).toBe('ok');
  });

  it('describe cupo vacío adjudicado al siguiente vendido', () => {
    const p: PasoLoteria = { ...base, resolucion: 'ADJUDICADO_SIGUIENTE_VENDIDO', causa: 'NO_VENDIDO', numeroBoleto: '78' };
    expect(describirPaso(p)).toContain('no se vendió');
    expect(describirPaso(p)).toContain('el 78');
    expect(claseResolucion(p)).toBe('aviso');
  });

  it('describe un paso repetido por boleto que ya ganó', () => {
    const p: PasoLoteria = { ...base, resolucion: 'REPETIDO', causa: 'YA_GANO_OTRO_PREMIO', numeroBoleto: null };
    expect(describirPaso(p)).toContain('ya ganó otro premio');
    expect(describirPaso(p)).toContain('se repite');
    expect(claseResolucion(p)).toBe('repite');
  });

  it('etiqueta la regla de vacante', () => {
    expect(etiquetaRegla('REPETIR_SIGUIENTE_LOTERIA')).toContain('siguiente sorteo');
    expect(etiquetaRegla('ADJUDICAR_SIGUIENTE_VENDIDO')).toContain('siguiente número vendido');
  });

  it('no retrocede el día de la lotería por la zona horaria', () => {
    expect(diaLoteria('2026-11-05')).toContain('5');
  });
});
