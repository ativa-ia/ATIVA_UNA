import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/constants/colors';
import { API_URL } from '@/services/api';

export default function StudentLayout() {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');

            if (!token) {
                router.replace('/(auth)/login');
                return;
            }

            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.user && data.user.role === 'student') {
                setIsAuthorized(true);
            } else {
                // Not student, redirect based on role
                if (data.user?.role === 'admin') {
                    router.replace('/(admin)/dashboard');
                } else if (data.user?.role === 'teacher') {
                    router.replace('/(teacher)/dashboard');
                } else {
                    router.replace('/(auth)/login');
                }
            }
        } catch (error) {
            router.replace('/(auth)/login');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!isAuthorized) {
        return null;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.backgroundDark },
            }}
        />
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.backgroundDark,
    },
});
