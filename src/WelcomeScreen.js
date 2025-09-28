import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";

export default function WelcomeScreen({ navigation }) {
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userRole = await AsyncStorage.getItem("rol");

        if (token && userRole) {
          const decodedToken = jwtDecode(token);
          if (decodedToken.exp * 1000 > Date.now()) {
            // Token válido, redirigir y salir de esta pantalla
            navigation.replace(userRole === "admin" ? "AdminHome" : "UserHome");
            return;
          } else {
            // Token expirado, eliminarlo
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("rol");
          }
        }
      } catch (error) {
        console.error("Error verificando el token:", error);
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("rol");
      }
      setCheckingAuth(false); // Muestra la pantalla si no hay token válido
    };

    checkToken();
  }, [navigation]);

  // Si está verificando el token, no muestra la pantalla
  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00A6E8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={require("../assets/cds.png")} style={styles.logo} resizeMode="contain" />
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={[styles.button, styles.loginButton]} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.buttonText}>Iniciar Sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.registerButton]} onPress={() => navigation.navigate("Register")}>
          <Text style={styles.buttonText}>Registrarse</Text>
        </TouchableOpacity>
      </View>
      <Image source={require("../assets/cbs.png")} style={styles.footerLogo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EFEFEF",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EFEFEF",
    paddingVertical: 20,
  },
  logo: {
    width: 250,
    height: 90,
    marginBottom: 40,
  },
  buttonsContainer: {
    width: "80%",
    alignItems: "center",
    marginBottom: 20,
  },
  button: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 8,
  },
  loginButton: {
    backgroundColor: "#00A6E8",
  },
  registerButton: {
    backgroundColor: "#003F74",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  footerLogo: {
    width: 200,
    height: 70,
    marginTop: 30,
  },
});
