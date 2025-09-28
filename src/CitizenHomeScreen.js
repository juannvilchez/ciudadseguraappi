import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
  BackHandler,
  Platform,
  Modal,
  ScrollView,
  Text,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { refreshToken } from "./service/refreshToken.service";
import Icon from "react-native-vector-icons/FontAwesome";

export default function CitizenHomeScreen({ navigation }) {
  // 👇 ahora usamos la variable que realmente existe en tu .env
  const API_URL = process.env.EXPO_PUBLIC_URL;
  const [helpVisible, setHelpVisible] = useState(false);

  // manejar botón de retroceso
  useEffect(() => {
    const backAction = () => {
      if (Platform.OS === "android") {
        BackHandler.exitApp();
      } else {
        Linking.openURL("app://");
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );
    return () => backHandler.remove();
  }, []);

  // refrescar token
  const refreshAccessToken = async (token) => {
    try {
      const result = await refreshToken(token);
      if (result && result.accessToken) {
        await AsyncStorage.setItem("token", result.accessToken);
        return result.accessToken;
      }
      return null;
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  };

  // verificación de token al cargar
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const refreshTokenStored = await AsyncStorage.getItem("refreshToken");
        if (token && refreshTokenStored) {
          if (typeof token !== "string" || !token.trim())
            throw new Error("Token inválido");
          let decodedToken = jwtDecode(token);
          if (decodedToken.exp * 1000 < Date.now()) {
            const newToken = await refreshAccessToken(refreshTokenStored);
            if (!newToken) {
              await AsyncStorage.clear();
              navigation.replace("Login");
              return;
            }
          }
        } else {
          navigation.replace("Login");
        }
      } catch (error) {
        console.error("Error verificando token:", error);
        navigation.replace("Login");
      }
    })();
  }, [navigation]);

  // acciones
  const handleAction = async (action) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return navigation.replace("Login");

      const response = await fetch(`${API_URL}/stats`, {
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const actions = {
        ojosenalerta:
          "https://wa.me/2364660011?text=Hola,%20Ojos%20en%20Alerta!",
        tranquerasconectadas: "https://tranquerasconectadas.junin.gob.ar/",
        bomberos: "tel:02364444130",
        same: "tel:107",
        "103defensacivil": "tel:103",
        whatsapp147: `https://wa.me/2364414568?text=${encodeURIComponent(
          "Hola, 147!"
        )}`,
      };

      if (actions[action]) {
        Linking.openURL(actions[action]).catch(() =>
          Alert.alert("Error", "No se pudo completar la acción.")
        );
      }
    } catch (error) {
      console.error("Error en handleAction:", error);
      Alert.alert("Error", "Ocurrió un problema al procesar la acción.");
    }
  };

  // iconos
  const iconPaths = {
    ojosenalerta: require("../assets/ojosenalerta.png"),
    tranquerasconectadas: require("../assets/tranquerasconectadas.png"),
    bomberos: require("../assets/bomberos.png"),
    same: require("../assets/same.png"),
    "103defensacivil": require("../assets/103defensacivil.png"),
    whatsapp147: require("../assets/147.png"),
    top: require("../assets/cds.png"),
    bottom: require("../assets/cbs.png"),
  };

  const gridButtons = [
    { key: "ojosenalerta" },
    { key: "tranquerasconectadas" },
    { key: "bomberos" },
    { key: "same" },
    { key: "103defensacivil" },
    { key: "whatsapp147" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Image source={iconPaths.top} style={styles.topImage} resizeMode="contain" />

      {/* grilla de accesos */}
      <View style={styles.grid}>
        {gridButtons.map((btn) => (
          <TouchableOpacity
            key={btn.key}
            style={styles.button}
            onPress={() => handleAction(btn.key)}
          >
            <Image source={iconPaths[btn.key]} style={styles.icon} />
          </TouchableOpacity>
        ))}
      </View>

      {/* footer con ayuda */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.helpButton} onPress={() => setHelpVisible(true)}>
          <Icon name="question-circle" size={36} color="#000" />
        </TouchableOpacity>
        <Image source={iconPaths.bottom} style={styles.bottomImage} resizeMode="contain" />
      </View>

      {/* modal de ayuda */}
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
                • <Text style={styles.bold}>Ojos en Alerta:</Text> Abre un chat de WhatsApp para reportar emergencias.
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>Tranqueras Conectadas:</Text> Abre el sitio web con información sobre tranqueras.
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>Bomberos:</Text> Llama directamente al servicio de bomberos (0236-4444130).
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>SAME:</Text> Llama al 107 para emergencias médicas.
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>Defensa Civil 103:</Text> Llama directamente al 103.
              </Text>
              <Text style={styles.modalText}>
                • <Text style={styles.bold}>WhatsApp 147:</Text> Abre un chat de WhatsApp con el 147.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setHelpVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* --------- STYLES --------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#DEDAD9",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  button: {
    width: "48%",
    alignItems: "center",
    marginVertical: 12,
    marginHorizontal: 1,
  },
  icon: {
    width: 155,
    height: 125,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  topImage: { width: 220, height: 90, marginBottom: 30, marginTop: 90 },
  bottomImage: { width: 220, height: 80, marginTop: -10, marginBottom: 40 },
  footer: {
    alignItems: "center",
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  helpButton: { marginRight: 18, marginBottom: 50 },
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
