import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AdminHomeScreen({ navigation }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const API = process.env.EXPO_PUBLIC_URL;
  // Función para obtener la lista de usuarios pendientes de aprobación
  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      // Se asume que existe un endpoint para obtener todos los usuarios
      const response = await fetch(`${API}/auth/users`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Error al obtener usuarios");
      }
      const users = await response.json();
      // Filtra aquellos usuarios que son del tipo "user" y que aún no han sido aprobados
      const pending = users.filter(
        (user) => user.rol === "user" && user.aprobado === false
      );
      setPendingUsers(pending);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      Alert.alert("Error", "No se pudieron obtener los usuarios pendientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  // Función para aprobar un usuario
  const handleApprove = async (userId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      // Se asume que existe un endpoint para aprobar usuarios
      const response = await fetch(`${API}/auth/users/approve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        throw new Error("Error al aprobar el usuario");
      }
      Alert.alert("Éxito", "Usuario aprobado exitosamente");
      // Vuelve a cargar la lista de usuarios pendientes
      fetchPendingUsers();
    } catch (error) {
      console.error("Error approving user:", error);
      Alert.alert("Error", "No se pudo aprobar el usuario");
    }
  };

  // Función para cerrar sesión
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("userRole");
      navigation.replace("Login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hola Admin</Text>
      <Button title="Cerrar sesión" onPress={handleLogout} color="#FF5733" />
      <Text style={styles.subtitle}>Usuarios pendientes de aprobación:</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : pendingUsers.length === 0 ? (
        <Text style={styles.message}>No hay usuarios pendientes.</Text>
      ) : (
        <FlatList
          data={pendingUsers}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.userContainer}>
              <Text style={styles.userName}>
                {item.nombre} {item.apellido}
              </Text>
              <Text style={styles.userEmail}>{item.correo}</Text>
              <TouchableOpacity
                style={styles.approveButton}
                onPress={() => handleApprove(item._id)}
              >
                <Text style={styles.approveButtonText}>Aprobar</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EFEFEF",
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  userContainer: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  userEmail: {
    fontSize: 14,
    color: "#555",
    marginBottom: 10,
  },
  approveButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  approveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
