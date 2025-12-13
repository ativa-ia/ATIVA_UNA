import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

/**
 * CalendarScreen - Calendário (Aluno)
 * Tela placeholder para calendário acadêmico
 */
export default function CalendarScreen() {
    const [activeNavId, setActiveNavId] = useState('calendar');

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'calendar', label: 'Calendário', iconName: 'calendar-today' },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                router.push('./dashboard');
                break;
            case 'calendar':
                // Already on calendar, do nothing
                break;
            case 'grades':
                router.push('./grades');
                break;
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#4f46e5', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <MaterialIcons name="arrow-back-ios" size={20} color={colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Calendário</Text>
                        <View style={styles.placeholder} />
                    </View>
                </LinearGradient>

                {/* Content */}
                <View style={styles.content}>
                    <MaterialIcons name="calendar-today" size={80} color={colors.primary} />
                    <Text style={styles.title}>Em Desenvolvimento</Text>
                    <Text style={styles.description}>
                        O calendário acadêmico estará disponível em breve.
                    </Text>
                </View>

                {/* Bottom Navigation */}
                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={handleNavPress}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundLight,
    },
    container: {
        flex: 1,
    },
    headerGradient: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        paddingBottom: spacing.base,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -8,
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    placeholder: {
        width: 40,
        height: 40,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    title: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.textPrimary,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    description: {
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
