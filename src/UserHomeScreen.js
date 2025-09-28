import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
  Text,
  BackHandler,
  Modal,
  ScrollView,
  Dimensions,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { jwtDecode } from "jwt-decode";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import { KalmanFilter, haversineDistance } from "./utils/utils";
import refresh from "./service/refreshToken.service";
import Icon from "react-native-vector-icons/FontAwesome";
import Constants from "expo-constants";

/* --------- ICONOS --------- */
const iconPaths = {
  ojosenalerta: require("../assets/ojosenalerta.png"),
  tranquerasconectadas: require("../assets/tranquerasconectadas.png"),
  bomberos: require("../assets/bomberos.png"),
  same: require("../assets/same.png"),
  botonpanico: require("../assets/botonpanico.png"),
  desactivar: require("../assets/desactivar.png"),
  top: require("../assets/cds.png"),
  bottom: require("../assets/cbs.png"),
  "103defensacivil": require("../assets/103defensacivil.png"),
  "147": require("../assets/147.png"),
};

/* --------- LAYOUT --------- */
const { width } = Dimensions.get("window");
const GRID_PADDING = 26;
const GRID_GAP = 8;
const TILE_W = Math.floor((width - GRID_PADDING * 2 - GRID_GAP) / 2);
const TILE_H = Math.round(TILE_W * 0.78);
const PANIC_W = TILE_W * 2 + GRID_GAP;
const PANIC_H = 130;

/* --------- ENV HELPERS --------- */
function normalizeBase(url) {
  const u = (url || "").trim().replace(/\/+$/, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) {
    console.warn("⚠️ La URL del API debe empezar con http/https. Valor:", u);
    return "";
  }
  return u;
}
function normalizeWs(url) {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (/^wss?:\/\//i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) {
    const https = raw.toLowerCase().startsWith("https://");
    return raw.replace(/^https?:\/\//i, https ? "wss://" : "ws://");
  }
  console.warn("⚠️ La URL del WS debe ser wss:// o http(s)://. Valor:", raw);
  return "";
}

const API_URL_BASE = normalizeBase(
  process.env.EXPO_PUBLIC_API ||
    process.env.EXPO_PUBLIC_URL ||
    (Constants.expoConfig?.extra && Constants.expoConfig.extra.API_URL)
);
const WS_URL_EXPLICIT = normalizeWs(
  process.env.EXPO_PUBLIC_WS ||
    (Constants.expoConfig?.extra && Constants.expoConfig.extra.WS_URL)
);
const WS_URL =
  WS_URL_EXPLICIT ||
  (process.env.EXPO_PUBLIC_URL
    ? normalizeWs(process.env.EXPO_PUBLIC_URL.replace(/\/+$/, "") + "/ws")
    : "");

/* ✅ no agrega "/api" extra */
function api(path) {
  if (!API_URL_BASE) throw new Error("API_URL no configurada");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL_BASE}${p}`;
}

export default function UserHomeScreen({ navigation }) {
  /* --------- STATE --------- */
  const [location, setLocation] = useState(null);
  const [alertActive, setAlertActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [helpVisible, setHelpVisible] = useState(false);

  // ⏱️ Temporizador en segundos + ref del intervalo
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef(null);

  const actionButtons = [
    "ojosenalerta",
    "tranquerasconectadas",
    "bomberos",
    "same",
    "103defensacivil",
    "147",
  ];

  /* --------- REFS --------- */
  const locationSubscriptionRef = useRef(null);
  const autoStopTimer = useRef(null);
  const isSendingRef = useRef(false);
  const kalmanFilterLatRef = useRef(new KalmanFilter({ R: 0.0001, Q: 0.00001 }));
  const kalmanFilterLngRef = useRef(new KalmanFilter({ R: 0.0001, Q: 0.00001 }));
  const wsRef = useRef(null);
  const wsReconnectInterval = useRef(null);

  /* --------- UTILS: TIMER --------- */
  const startTimer = useCallback(() => {
    setTimeLeft(20 * 60); // 20 minutos
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimeLeft(0);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  /* --------- BACK HANDLER --------- */
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [])
  );

  /* --------- WEBSOCKET --------- */
  const setupWebSocket = useCallback(() => {
    if (!WS_URL) {
      console.warn("❌ WebSocket no configurado (WS_URL vacío).");
      return;
    }
    try {
      wsRef.current = new WebSocket(WS_URL);
    } catch (e) {
      console.error("❌ WebSocket URL inválida:", WS_URL, e);
      return;
    }

    wsRef.current.onopen = () => {
      if (wsReconnectInterval.current) {
        clearInterval(wsReconnectInterval.current);
        wsReconnectInterval.current = null;
      }
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "stopLocation" && data.userId === currentUserId) {
          stopRealTimeLocation();
          setAlertActive(false);
          stopTimer(); // ⏹️ parar temporizador
          if (autoStopTimer.current) {
            clearTimeout(autoStopTimer.current);
            autoStopTimer.current = null;
          }
          Alert.alert("Alerta Completada", "El envío de coordenadas se ha detenido.");
        }
      } catch {}
    };

    wsRef.current.onerror = () => {};
    wsRef.current.onclose = () => {
      if (!wsReconnectInterval.current) {
        wsReconnectInterval.current = setInterval(() => setupWebSocket(), 5000);
      }
    };
  }, [currentUserId, stopTimer]);

  useEffect(() => {
    setupWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (wsReconnectInterval.current) clearInterval(wsReconnectInterval.current);
    };
  }, [setupWebSocket]);

  /* --------- LOCATION --------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") throw new Error("Permiso de ubicación denegado.");
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation.coords);
      } catch (error) {
        Alert.alert("Error", "No se pudo obtener la ubicación.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* --------- AUTH / REFRESH --------- */
  const refreshAccessToken = async (refreshToken) => {
    try {
      const result = await refresh(refreshToken);
      if (result && result.accessToken) {
        await AsyncStorage.setItem("token", result.accessToken);
        return result.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (token && refreshToken) {
          if (typeof token !== "string" || !token.trim()) throw new Error("Token inválido");
          let decodedToken = jwtDecode(token);
          if (decodedToken.exp * 1000 < Date.now()) {
            const newToken = await refreshAccessToken(refreshToken);
            if (!newToken) {
              await AsyncStorage.clear();
              navigation.replace("Login");
              return;
            }
            decodedToken = jwtDecode(newToken);
          }
          setCurrentUserId(decodedToken.id);
        } else {
          navigation.replace("Login");
        }
      } catch (error) {
        console.error("Error verificando token:", error);
        navigation.replace("Login");
      }
    })();
  }, [navigation]);

  /* --------- REALTIME LOCATION --------- */
  const startRealTimeLocation = async (userId, token) => {
    if (locationSubscriptionRef.current) return;
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 1,
        },
        async (newLocation) => {
          if (newLocation.coords.accuracy > 15) return;

          const newLat = parseFloat(newLocation.coords.latitude.toFixed(6));
          const newLng = parseFloat(newLocation.coords.longitude.toFixed(6));
          const filteredLat = parseFloat(
            kalmanFilterLatRef.current.filter(newLat, newLocation.coords.accuracy).toFixed(6)
          );
          const filteredLng = parseFloat(
            kalmanFilterLngRef.current.filter(newLng, newLocation.coords.accuracy).toFixed(6)
          );

          if (location) {
            const dist = haversineDistance(
              location.latitude,
              location.longitude,
              filteredLat,
              filteredLng
            );
            if (dist > 100) return;
          }

          setLocation({ latitude: filteredLat, longitude: filteredLng });

          if (isSendingRef.current) return;
          isSendingRef.current = true;
          try {
            await fetch(api("/alerts"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ userId, lat: filteredLat, lng: filteredLng }),
            });
          } catch {
          } finally {
            isSendingRef.current = false;
          }
        }
      );
      locationSubscriptionRef.current = subscription;
    } catch {}
  };

  const stopRealTimeLocation = () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
  };

  /* --------- ALERTA --------- */
  const handleToggleAlert = async () => {
    if (loading) return;
    if (!location) return Alert.alert("Error", "Ubicación no disponible.");
    if (!API_URL_BASE) return Alert.alert("Configuración", "La URL del API no está configurada.");

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return navigation.replace("Login");
      if (typeof token !== "string" || !token.trim()) throw new Error("Token inválido");

      const decodedToken = jwtDecode(token);

      if (alertActive) {
        // Desactivar alerta
        await fetch(api("/alerts/stop-location"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: decodedToken.id }),
        });
        stopRealTimeLocation();
        setAlertActive(false);
        stopTimer(); // ⏹️ parar temporizador
        if (autoStopTimer.current) {
          clearTimeout(autoStopTimer.current);
          autoStopTimer.current = null;
        }
        Alert.alert("Alerta Desactivada", "El envío de coordenadas se ha detenido.");
      } else {
        // Activar alerta
        await fetch(api("/stats"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "alerta",
            timestamp: new Date().toISOString(),
          }),
        });
        await startRealTimeLocation(decodedToken.id, token);
        setAlertActive(true);
        startTimer(); // ▶️ iniciar temporizador 20 min

        // Auto stop 20 min
        autoStopTimer.current = setTimeout(() => {
          stopRealTimeLocation();
          setAlertActive(false);
          stopTimer(); // ⏹️ forzar 00:00 al finalizar
          if (autoStopTimer.current) {
            clearTimeout(autoStopTimer.current);
            autoStopTimer.current = null;
          }
          Alert.alert("Alerta Completada", "El envío de coordenadas se ha detenido automáticamente.");
        }, 20 * 60 * 1000);

        Alert.alert("Alerta Activada", "El envío de coordenadas se ha iniciado.");
      }
    } catch {}
    setLoading(false);
  };

  /* --------- HELP --------- */
  const handleHelp = () => setHelpVisible(true);

  /* --------- LIMPIEZA EN DESMONTAJE --------- */
  useEffect(() => {
    return () => {
      // limpiar temporizadores al salir del screen
      stopTimer();
      if (autoStopTimer.current) {
        clearTimeout(autoStopTimer.current);
        autoStopTimer.current = null;
      }
    };
  }, [stopTimer]);

  /* --------- RENDER --------- */
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={iconPaths.top} style={styles.topImage} resizeMode="contain" />
        </View>

        {/* Grilla con botón pegado debajo */}
        <FlatList
          data={actionButtons}
          keyExtractor={(item, index) => `${item}-${index}`}
          numColumns={2}
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={{ justifyContent: "space-between", marginBottom: GRID_GAP }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleAction(item)}
              style={[styles.tile, { width: TILE_W, height: TILE_H }]}
            >
              <Image source={iconPaths[item]} style={styles.tileImg} resizeMode="cover" />
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <View style={styles.panicButtonWrapper}>
              <TouchableOpacity
                style={[styles.panicButton, { width: PANIC_W, height: PANIC_H }]}
                onPress={handleToggleAlert}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="large" />
                ) : (
                  <Image
                    source={alertActive ? iconPaths.desactivar : iconPaths.botonpanico}
                    style={styles.panicIcon}
                    resizeMode="cover"
                  />
                )}
              </TouchableOpacity>
              {/* ⛔️ el temporizador ya no está aquí, para no mover el layout */}
            </View>
          }
        />
      </View>

      {/* Footer fijo abajo (timer en overlay, no afecta layout) */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.helpButton} onPress={handleHelp}>
          <Icon name="question-circle" size={36} color="#000" />
        </TouchableOpacity>

        <Image source={iconPaths.bottom} style={styles.bottomImage} resizeMode="contain" />

        {(alertActive || timeLeft > 0) && (
          <Text
            style={[
              styles.timerText,
              styles.timerOverlay,
              timeLeft <= 60 ? styles.timerWarning : null,
            ]}
          >
            {formatTime(timeLeft)}
          </Text>
        )}
      </View>

      {/* Modal Ayuda */}
      <Modal
        visible={helpVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setHelpVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Ayuda</Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>Ojos en Alerta:</Text>Abre un chat de WhatsApp para
                reportar emergencias.
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>Tranqueras Conectadas:</Text> Abre el sitio web para ver
                información sobre tranqueras.
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>Bomberos:</Text> Llama directamente al servicio de
                bomberos.
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>SAME:</Text> Llama directamente al servicio del SAME.
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>Botón de emergencia:</Text> Activa o desactiva el envío
                de tu ubicación en tiempo real durante 20 minutos.
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setHelpVisible(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  /* --------- ACTIONS --------- */
  async function handleAction(action) {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return navigation.replace("Login");

      if (API_URL_BASE) {
        await fetch(api("/stats"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            timestamp: new Date().toISOString(),
          }),
        });
      }

      const actions = {
        ojosenalerta: "https://wa.me/2364660011?text=Hola,%20Ojos%20en%20Alerta!",
        tranquerasconectadas: "https://tranquerasconectadas.junin.gob.ar/",
        bomberos: "tel:02364444130",
        same: "tel:107",
        "103defensacivil": "tel:103",
        "147": `https://wa.me/2364414568?text=${encodeURIComponent("Hola, 147!")}`,
      };

      if (actions[action]) {
        Linking.openURL(actions[action]).catch(() =>
          Alert.alert("Error", "No se pudo completar la acción.")
        );
      }
    } catch {
      Alert.alert("Error", "Ocurrió un problema al procesar la acción.");
    }
  }
}

/* --------- STYLES --------- */
const FOOTER_HEIGHT = 120; // altura cómoda para imagen + timer + padding

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#DEDAD9" },

  mainContent: { flex: 1 },

  header: { alignItems: "center", paddingTop: 60 },
  topImage: { width: 260, height: 80 },

  // sin paddingBottom aquí para que el botón quede pegado a la grilla
  gridList: { paddingHorizontal: GRID_PADDING, paddingTop: 25 },

  tile: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  tileImg: { width: "100%", height: "100%" },

  // separa muy poquito la grilla del botón
  panicButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12, // espacio uniforme entre grilla y botón
    paddingHorizontal: GRID_PADDING,
  },

  panicButton: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    marginBottom: 40,
    elevation: 5,
    alignItems: "center",
    justifyContent: "center",
    width: PANIC_W,
    height: PANIC_H,
  },
  panicIcon: { width: "100%", height: "100%" },

  // ⏱️ estilo del temporizador
  timerText: {
    fontSize: 22,
    marginBottom: 10,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },
  // 🔴 cuando restan 60s o menos
  timerWarning: {
    color: "#C62828",
  },

  // Footer fijo con posiciones absolutas para no mover nada al aparecer el timer
  footer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minHeight: FOOTER_HEIGHT,
    paddingVertical: 10,
  },
  bottomImage: { width: 200, height: 70, marginBottom: 12 },

  // Botón de ayuda fijo a la izquierda, no depende del timer
  helpButton: {
    position: "absolute",
    left: 46,
    bottom: 46,
  },

  // El timer se dibuja por encima de la imagen, sin afectar el layout
  timerOverlay: {
    position: "absolute",
    // Lo ubicamos justo encima de la imagen de 70px de alto + 8px de separación
    bottom: 70 + 8, // si cambiás bottomImage.height, ajustá este valor
    left: 0,
    right: 0,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  modalText: { fontSize: 16, marginBottom: 10 },
  bold: { fontWeight: "bold" },
  modalCloseButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#DDD",
    borderRadius: 10,
    alignItems: "center",
  },
  modalCloseText: { fontSize: 16, color: "#000" },
});
