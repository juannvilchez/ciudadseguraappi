import axios from "axios";

const API = process.env.EXPO_PUBLIC_URL;

// 🔄 Refresh token (vencimiento anual corregido)
export const refreshToken = async (refreshToken) => {
    try {
        const response = await axios.post(`${API}/api/auth/refresh`, { refreshToken });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// 🧾 Obtener datos del usuario autenticado
export const me = async (token) => {
    try {
        const response = await axios.post(`${API}/api/auth/me`, {}, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};
