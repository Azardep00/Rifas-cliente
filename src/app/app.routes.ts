import { Routes } from '@angular/router';
import { panelMatch, soloSinSesionGuard } from './core/auth/guards';

/**
 * Mapa de rutas públicas del plan (sección 4). Cada pantalla se carga perezosa.
 * Panel (/admin/**): perezoso y protegido por rol desde el CP-16.
 */
export const routes: Routes = [
  { path: '', title: 'Alex Rifas', loadComponent: () => import('./pages/inicio').then((m) => m.Inicio) },
  { path: 'rifa/:codigo', title: 'Rifa', loadComponent: () => import('./pages/detalle').then((m) => m.Detalle) },
  { path: 'rifa/:codigo/reservar', title: 'Reservar números', loadComponent: () => import('./pages/reservar').then((m) => m.Reservar) },
  { path: 'reserva/:codigo', title: 'Tu reserva', loadComponent: () => import('./pages/reserva').then((m) => m.Reserva) },
  { path: 'mis-boletos', title: 'Mis boletos', loadComponent: () => import('./pages/mis-boletos').then((m) => m.MisBoletos) },
  { path: 'resultados/:codigo', title: 'Resultados', loadComponent: () => import('./pages/resultados').then((m) => m.Resultados) },
  { path: 'admin/login', title: 'Ingresar · Panel', canActivate: [soloSinSesionGuard], loadComponent: () => import('./admin/login').then((m) => m.AdminLogin) },
  {
    path: 'admin',
    canMatch: [panelMatch],
    loadComponent: () => import('./admin/layout').then((m) => m.AdminLayout),
    children: [{ path: '', title: 'Resumen · Panel', loadComponent: () => import('./admin/resumen').then((m) => m.AdminResumen) }],
  },
  { path: '**', title: 'No encontrada', loadComponent: () => import('./pages/no-encontrada').then((m) => m.NoEncontrada) },
];
