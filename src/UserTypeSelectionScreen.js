// UserTypeSelectionScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ImageBackground,
  ScrollView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login } from "./service/login.service";

export default function UserTypeSelectionScreen({ navigation, route }) {
  const { email, password } = route.params;
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  const userTypeOptions = [
    {
      label: "Género",
      value: "genero",
      description:
        "Este perfil está pensado para personas que atraviesan situaciones de violencia o riesgo por motivos de género. El Botón de Emergencia puede ser de ayuda en casos como violencia física, verbal o psicológica, situaciones de acoso, amenazas o intimidaciones. Al seleccionarlo, el Área de Género del Municipio se pondrá en contacto con vos para validar y autorizar su uso."
    },
    {
      label: "Adulto Mayor",
      value: "adulto_mayor",
      description:
        "Pensado para personas mayores que viven solas o pueden estar expuestas a situaciones de peligro. El Botón de Seguridad brinda asistencia rápida en casos como caídas en el hogar, emergencias médicas repentinas, intentos de robo o accidentes en la vía pública. Al seleccionarlo, el Centro de Operaciones y Monitoreo se pondrá en contacto para autorizar el perfil."
    },
    {
      label: "Ciudadano",
      value: "ciudadano",
      description:
        "Perfil general pensado para los vecinos de Junín. Te permite usar funciones como reportes, contacto con SAME, Bomberos, Defensa Civil, Atención Ciudadana, Ojos en Alerta y el mapa de tranqueras. Es la mejor opción para la mayoría de los ciudadanos y no requiere autorización. No incluye el uso del Botón de Emergencia."
    },
  ];

  const storeAndSetTokens = async (result) => {
    await AsyncStorage.setItem("token", result.accessToken);
    if (result.refreshToken) {
      await AsyncStorage.setItem("refreshToken", result.refreshToken);
    }
    await AsyncStorage.setItem("rol", result.rol);
    if (result.categoria) {
      await AsyncStorage.setItem("categoria", result.categoria);
    }
    await AsyncStorage.removeItem("pendingApproval");
  };

  const handleNavigation = async () => {
    const role = await AsyncStorage.getItem("rol");
    const categoria = await AsyncStorage.getItem("categoria");
    if (role === "admin") {
      navigation.replace("AdminHome");
    } else {
      navigation.replace(categoria === "ciudadano" ? "CitizenHome" : "UserHome");
    }
  };

  const handleLoginWithType = async (type) => {
    setLoading(true);
    setSelectedType(type);
    try {
      const data = {
        correo: email.trim().toLowerCase(),
        contrasena: password,
        tipo: type,
      };

      const result = await login(data);

      if (result.accessToken) {
        await storeAndSetTokens(result);
        handleNavigation();
      } else if (
        result.message &&
        (result.message.includes("pendiente de aprobación") ||
          result.message.includes("pendiente"))
      ) {
        setIsPending(true);
        await AsyncStorage.setItem("pendingApproval", "true");
      } else if (result.message && result.message.includes("rechazado")) {
        Alert.alert(
          "Registro rechazado",
          "Tu registro ha sido rechazado por el administrador."
        );
        navigation.replace("Login");
      } else {
        Alert.alert("Error", result.message || "Error en el login con tipo");
      }
    } catch (error) {
      console.error("Error al iniciar sesión con tipo:", error);
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Nueva función para confirmar selección
  const confirmSelection = (item) => {
    Alert.alert(
      "Confirmar selección",
      `¿Deseás continuar con el perfil "${item.label}"?\n\n${item.description}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceptar",
          onPress: () => handleLoginWithType(item.value),
        },
      ],
      { cancelable: true }
    );
  };

  useEffect(() => {
    let interval;
    if (isPending && selectedType) {
      interval = setInterval(async () => {
        try {
          const data = {
            correo: email.trim().toLowerCase(),
            contrasena: password,
            tipo: selectedType,
          };

          const result = await login(data);

          if (result.accessToken) {
            await storeAndSetTokens(result);
            clearInterval(interval);
            handleNavigation();
          } else if (result.message && result.message.includes("rechazado")) {
            clearInterval(interval);
            Alert.alert(
              "Registro rechazado",
              "Tu registro ha sido rechazado por el administrador."
            );
            navigation.replace("Login");
          }
        } catch (error) {
          console.error("Error al hacer polling del login:", error);
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPending, selectedType, email, password]);

  if (isPending) {
    return (
      <View style={styles.pendingContainer}>
        <ActivityIndicator size="large" color="#00A6E8" />
        <Text style={styles.pendingText}>
          En espera de aprobación del admin...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Bienvenido</Text>
          <Text style={styles.subheader}>Seleccione el tipo de usuario</Text>
        </View>
        <ScrollView contentContainerStyle={styles.buttonContainer}>
          <View style={styles.row}>
            {renderButton(userTypeOptions[0])}
            {renderButton(userTypeOptions[1])}
          </View>
          <View style={styles.row}>
            {renderButton(userTypeOptions[2])}
          </View>
        </ScrollView>
      </View>
    </View>
  );

  function renderButton(item) {
    return (
      <TouchableOpacity
        key={item.value}
        onPress={() => confirmSelection(item)}
        disabled={loading}
        style={styles.buttonContainerItem}
      >
        <ImageBackground
          source={require("../assets/1.png")}
          style={styles.buttonImage}
          resizeMode="cover"
        >
          <Text style={styles.imageText}>{item.label}</Text>
        </ImageBackground>
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#DEDAD9",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  content: {
    width: "100%",
    alignItems: "center",
  },
  headerContainer: {
    marginBottom: 20,
    textAlign: "center",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#003F74",
    textAlign: "center",
  },
  subheader: {
    fontSize: 18,
    color: "#007ACC",
    textAlign: "center",
    marginTop: 5,
  },
  buttonContainer: {
    width: "100%",
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 15,
  },
  buttonContainerItem: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  buttonImage: {
    width: 160,
    height: 130,
    borderRadius: 15,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  imageText: {
    fontSize: 18,
    color: "#003F74",
    fontWeight: "600",
    textAlign: "center",
  },
  pendingContainer: {
    flex: 1,
    backgroundColor: "#DEDAD9",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  pendingText: {
    marginTop: 20,
    fontSize: 18,
    color: "#003F74",
    textAlign: "center",
  },
});
