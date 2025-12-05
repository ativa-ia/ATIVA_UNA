import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/services/api';
import { colors } from '@/constants/colors';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        // Sem token, vai para login
        router.replace('/(auth)/login');
        return;
      }

      // Verificar se o token é válido e obter o role do usuário
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success && data.user) {
        // Redirecionar baseado no role
        const role = data.user.role;
        if (role === 'admin') {
          router.replace('/(admin)/dashboard');
        } else if (role === 'student') {
          router.replace('/(student)/dashboard');
        } else if (role === 'teacher') {
          router.replace('/(teacher)/dashboard');
        } else {
          router.replace('/(auth)/login');
        }
      } else {
        // Token inválido, limpar e ir para login
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('userRole');
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      router.replace('/(auth)/login');
    } finally {
      setIsLoading(false);
    }
  };

  // Tela de loading enquanto verifica autenticação
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
  },
});
