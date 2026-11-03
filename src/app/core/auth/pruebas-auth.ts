import { AuthResponse, Rol } from '../api/models';

/** Soporte de pruebas de autenticación (no entra al bundle). */
export const respuesta = (rol: Rol = 'ADMIN', n = 1): AuthResponse => ({
  tipo: 'Bearer', accessToken: `acc${n}`, refreshToken: `ref${n}`, expiraEnSegundos: 900,
  usuario: { id: 1, nombre: 'Alex', apellido: 'R', correo: 'a@x.co', rol },
});
