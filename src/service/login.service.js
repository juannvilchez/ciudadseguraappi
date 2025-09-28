import axios from 'axios';

const API = process.env.EXPO_PUBLIC_URL;

if (!API) {
  console.warn('⚠️ EXPO_PUBLIC_URL no está definida. Revisá tu .env y reiniciá con `expo start -c`.');
}

export const login = async (datos) => {
  try {
    const API_BASE = (API || '').replace(/\/+$/, ''); // quita barra final
    const url = `${API_BASE}/auth/login`; // 👈 ahora queda correcto

    const payload = {
      correo: datos.correo,
      contrasena: datos.contrasena,
    };
    if (datos.tipo) payload.tipo = datos.tipo;

    console.log('➡️ POST', url); // para verificar a dónde pega

    const response = await axios.post(url, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.warn('⚠️ Respuesta del backend con error (login):', error.response.status, error.response.data);
      return error.response.data;
    } else {
      console.error('❌ Error en el login:', error);
      return null;
    }
  }
};
