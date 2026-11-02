import { Routes } from '@angular/router';

/**
 * Mapa de rutas públicas del plan (sección 4). Cada pantalla se carga perezosa.
 * Las rutas /admin/** llegan con el CP-16 (guards por rol).
 */
export const routes: Routes = [
  { path: '', title: 'Alex Rifas', loadComponent: () => import('./pages/inicio').then((m) => m.Inicio) },
  {
    path: 'rifa/:codigo',
    title: 'Rifa',
    data: { cp: 12, pantalla: 'Detalle de la rifa' },
    loadComponent: () => import('./pages/pendiente').then((m) => m.Pendiente),
  },
  {
    path: 'rifa/:codigo/reservar',
    title: 'Reservar números',
    data: { cp: 14, pantalla: 'Reservar números' },
    loadComponent: () => import('./pages/pendiente').then((m) => m.Pendiente),
  },
  {
    path: 'reserva/:codigo',
    title: 'Tu reserva',
    data: { cp: 14, pantalla: 'Estado de tu reserva' },
    loadComponent: () => import('./pages/pendiente').then((m) => m.Pendiente),
  },
  {
    path: 'mis-boletos',
    title: 'Mis boletos',
    data: { cp: 15, pantalla: 'Mis boletos' },
    loadComponent: () => import('./pages/pendiente').then((m) => m.Pendiente),
  },
  {
    path: 'resultados/:codigo',
    title: 'Resultados',
    data: { cp: 15, pantalla: 'Resultados y ganadores' },
    loadComponent: () => import('./pages/pendiente').then((m) => m.Pendiente),
  },
  { path: '**', title: 'No encontrada', loadComponent: () => import('./pages/no-encontrada').then((m) => m.NoEncontrada) },
];
