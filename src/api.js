// api.js
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
const API = process.env.EXPO_PUBLIC_URL;

// Configura la instancia de Axios con la URL base de tu API.
const api = axios.create({
  baseURL: `${API}`,
});

// Interceptor de request para adjuntar el access token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Variables para manejar peticiones concurrentes durante el refresh.
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor de response para capturar errores 401 y renovar el token.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // Si ya se está renovando el token, encola la petición
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = "Bearer " + token;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Marca que se está reintentando la petición
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) {
          // No hay refresh token: redirige o notifica al usuario
          Alert.alert("Sesión expirada", "Por favor, inicie sesión de nuevo.");
          return Promise.reject(error);
        }

        // Solicita un nuevo access token usando el endpoint /refresh
        const response = await axios.post(`${API}/refresh`, { refreshToken });
        const newAccessToken = response.data.accessToken;

        // Almacena el nuevo access token
        await AsyncStorage.setItem("token", newAccessToken);
        // Actualiza el header en la instancia de Axios
        api.defaults.headers.common.Authorization = "Bearer " + newAccessToken;
        processQueue(null, newAccessToken);

        // Reintenta la petición original con el nuevo token
        originalRequest.headers.Authorization = "Bearer " + newAccessToken;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        // Elimina tokens y notifica al usuario para que vuelva a iniciar sesión
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("refreshToken");
        Alert.alert("Sesión expirada", "Por favor, inicie sesión de nuevo.");
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
