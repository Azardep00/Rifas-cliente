import { Routes } from '@angular/router';

/**
 * Mapa de rutas públicas del plan (sección 4). Cada pantalla se carga perezosa.
 * Las rutas /admin/** llegan con el CP-16 (guards por rol).
 */
export const routes: Routes = [
  { path: '', title: 'Alex Rifas', loadComponent: () => import('./pages/inicio').then((m) => m.Inicio) },
  { path: 'rifa/:codigo', title: 'Rifa', loadComponent: () => import('./pages/detalle').then((m) => m.Detalle) },
  { path: 'rifa/:codigo/reservar', title: 'Reservar números', loadComponent: () => import('./pages/reservar').then((m) => m.Reservar) },
  { path: 'reserva/:codigo', title: 'Tu reserva', loadComponent: () => import('./pages/reserva').then((m) => m.Reserva) },
  { path: 'mis-boletos', title: 'Mis boletos', loadComponent: () => import('./pages/mis-boletos').then((m) => m.MisBoletos) },
  { path: 'resultados/:codigo', title: 'Resultados', loadComponent: () => import('./pages/resultados').then((m) => m.Resultados) },
  { path: '**', title: 'No encontrada', loadComponent: () => import('./pages/no-encontrada').then((m) => m.NoEncontrada) },
];
