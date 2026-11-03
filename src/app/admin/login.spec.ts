import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { errorInterceptor } from '../core/api/api-error';
import { respuesta } from '../core/auth/pruebas-auth';
import { AdminLogin, destinoSeguro } from './login';

describe('AdminLogin', () => {
  let http: HttpTestingController;
  const montar = () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AdminLogin],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(AdminLogin);
    f.detectChanges();
    return f;
  };
  const escribir = (f: ReturnType<typeof montar>, correo: string, clave: string) => {
    const el = f.nativeElement as HTMLElement;
    const c = el.querySelector<HTMLInputElement>('#correo')!;
    const p = el.querySelector<HTMLInputElement>('#contrasena')!;
    c.value = correo; c.dispatchEvent(new Event('input'));
    p.value = clave; p.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    f.detectChanges();
  };

  it('valida campos vacíos sin llamar a la API', () => {
    const f = montar();
    escribir(f, '', '');
    expect(f.nativeElement.textContent).toContain('Escribe tu correo y tu contraseña.');
    http.expectNone('/api/auth/login');
  });

  it('credenciales malas muestran mensaje claro y vacían la contraseña', () => {
    const f = montar();
    escribir(f, 'a@x.co', 'mala');
    http.expectOne('/api/auth/login').flush({ mensaje: 'x' }, { status: 401, statusText: 'U' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Correo o contraseña incorrectos.');
    expect(f.nativeElement.querySelector('#contrasena').value).toBe('');
  });

  it('un CLIENTE ve que no tiene acceso al panel', () => {
    const f = montar();
    escribir(f, 'c@x.co', 'buena-clave-1');
    http.expectOne('/api/auth/login').flush(respuesta('CLIENTE'));
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('no tiene acceso al panel');
  });

  it('ADMIN entra y navega al destino seguro; no se envía dos veces', async () => {
    const f = montar();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    escribir(f, 'a@x.co', 'buena-clave-1');
    escribir(f, 'a@x.co', 'buena-clave-1');
    http.expectOne('/api/auth/login').flush(respuesta('ADMIN'));
    expect(nav).toHaveBeenCalledWith('/admin');
  });

  it('destinoSeguro solo acepta rutas internas del panel', () => {
    expect(destinoSeguro('/admin/pagos')).toBe('/admin/pagos');
    expect(destinoSeguro('https://malo.com')).toBe('/admin');
    expect(destinoSeguro('//malo.com')).toBe('/admin');
    expect(destinoSeguro('/admin/login')).toBe('/admin');
    expect(destinoSeguro(null)).toBe('/admin');
  });
});
