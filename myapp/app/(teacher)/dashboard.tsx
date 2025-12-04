import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Header } from '@/components/navigation/Header';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { clearAuth } from '@/services/api';

/**
 * TeacherDashboardScreen - Dashboard do Professor
 * Tela principal do professor com turmas e atividades
 */
export default function TeacherDashboardScreen() {
    const [activeNavId, setActiveNavId] = useState('dashboard');

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'classes', label: 'Turmas', iconName: 'groups' },
        { id: 'materials', label: 'Materiais', iconName: 'folder' },
        { id: 'reports', label: 'Relatórios', iconName: 'assessment' },
    ];

    // Mock class data
    const classes = [
        {
            id: '1',
            name: 'Cálculo I',
            students: 35,
            schedule: 'Seg/Qua 14h-16h',
        },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                // Already on dashboard
                break;
            case 'classes':
                router.push('/(teacher)/classes');
                break;
            case 'materials':
                router.push('/(teacher)/materials');
                break;
            case 'reports':
                router.push('/(teacher)/reports');
                break;
        }
    };

    const handleAttendancePress = () => {
        router.push('/(teacher)/attendance');
    };

    const handleLogout = async () => {
        await clearAuth();
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Header
                        userName="Professor"
                        avatarUri="https://i.pravatar.cc/150?img=33"
                        darkMode
                        onNotificationPress={() => console.log('Notifications')}
                    />

                    <View style={[styles.section, styles.lastSection]}>
                        <Text style={styles.sectionTitle}>Minhas Turmas</Text>
                        <View style={styles.classesContainer}>
                            {classes.map((classItem) => (
                                <TouchableOpacity
                                    key={classItem.id}
                                    style={styles.classCard}
                                    onPress={handleAttendancePress}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.classHeader}>
                                        <View style={styles.classIcon}>
                                            <MaterialIcons name="school" size={24} color={colors.white} />
                                        </View>
                                        <View style={styles.classInfo}>
                                            <Text style={styles.className}>{classItem.name}</Text>
                                            <Text style={styles.classSchedule}>{classItem.schedule}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.classFooter}>
                                        <View style={styles.studentsInfo}>
                                            <MaterialIcons name="people" size={16} color={colors.zinc400} />
                                            <Text style={styles.studentsCount}>{classItem.students} alunos</Text>
                                        </View>
                                        <View style={styles.attendanceButton}>
                                            <MaterialIcons name="fact-check" size={16} color={colors.primary} />
                                            <Text style={styles.attendanceText}>Fazer Chamada</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Logout Button */}
                    <View style={styles.logoutContainer}>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <MaterialIcons name="logout" size={20} color="#ef4444" />
                            <Text style={styles.logoutText}>Sair</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <BottomNav
                    items={navItems}
                    activeId={activeNavId}
                    onItemPress={handleNavPress}
                    darkMode
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundDark,
    },
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 96,
    },
    section: {
        marginTop: spacing.base,
    },
    lastSection: {
        marginBottom: spacing.base,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        letterSpacing: typography.letterSpacing.tight,
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.sm,
        paddingTop: spacing.base,
    },
    horizontalScroll: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        gap: spacing.md,
    },
    classesContainer: {
        paddingHorizontal: spacing.base,
        gap: spacing.md,
    },
    classCard: {
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.zinc800,
        padding: spacing.base,
        gap: spacing.md,
    },
    classHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    classIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    classInfo: {
        flex: 1,
    },
    className: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        marginBottom: 4,
    },
    classSchedule: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    classFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
    },
    studentsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    studentsCount: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
    },
    attendanceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primaryOpacity20,
        borderRadius: 8,
    },
    attendanceText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
    },
    logoutContainer: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.xl,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.base,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    logoutText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: '#ef4444',
    },
});
