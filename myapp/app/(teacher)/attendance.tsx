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
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { Student } from '@/types';

/**
 * AttendanceCheckScreen - Chamada Otimizada do Professor
 * Tela para o professor fazer chamada dos alunos
 */
export default function AttendanceCheckScreen() {
    const [students, setStudents] = useState<Student[]>([
        { id: '1', name: 'Ana Silva', present: undefined },
        { id: '2', name: 'Bruno Costa', present: undefined },
        { id: '3', name: 'Carlos Mendes', present: undefined },
        { id: '4', name: 'Diana Oliveira', present: undefined },
        { id: '5', name: 'Eduardo Santos', present: undefined },
    ]);

    const toggleAttendance = (id: string) => {
        setStudents(students.map(student =>
            student.id === id
                ? { ...student, present: student.present === true ? false : true }
                : student
        ));
    };

    const markAllPresent = () => {
        setStudents(students.map(student => ({ ...student, present: true })));
    };

    const presentCount = students.filter(s => s.present === true).length;
    const absentCount = students.filter(s => s.present === false).length;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Chamada - Cálculo I</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Stats */}
                <View style={styles.stats}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{students.length}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, styles.statValuePresent]}>
                            {presentCount}
                        </Text>
                        <Text style={styles.statLabel}>Presentes</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, styles.statValueAbsent]}>
                            {absentCount}
                        </Text>
                        <Text style={styles.statLabel}>Ausentes</Text>
                    </View>
                </View>

                {/* Quick Action */}
                <TouchableOpacity style={styles.quickAction} onPress={markAllPresent}>
                    <MaterialIcons name="done-all" size={20} color={colors.primary} />
                    <Text style={styles.quickActionText}>Marcar todos como presentes</Text>
                </TouchableOpacity>

                {/* Students List */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {students.map((student) => (
                        <TouchableOpacity
                            key={student.id}
                            style={[
                                styles.studentCard,
                                student.present === true && styles.studentCardPresent,
                                student.present === false && styles.studentCardAbsent,
                            ]}
                            onPress={() => toggleAttendance(student.id)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.studentInfo}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {student.name.charAt(0)}
                                    </Text>
                                </View>
                                <Text style={styles.studentName}>{student.name}</Text>
                            </View>

                            <View style={styles.attendanceIndicator}>
                                {student.present === true && (
                                    <MaterialIcons name="check-circle" size={28} color="#10b981" />
                                )}
                                {student.present === false && (
                                    <MaterialIcons name="cancel" size={28} color="#ef4444" />
                                )}
                                {student.present === undefined && (
                                    <MaterialIcons name="radio-button-unchecked" size={28} color={colors.zinc600} />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Save Button */}
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.saveButton}>
                        <Text style={styles.saveButtonText}>Salvar Chamada</Text>
                    </TouchableOpacity>
                </View>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc800,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    stats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc800,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    statValuePresent: {
        color: '#10b981',
    },
    statValueAbsent: {
        color: '#ef4444',
    },
    statLabel: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.display,
        color: colors.zinc400,
        marginTop: 4,
    },
    quickAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        marginHorizontal: spacing.base,
        marginTop: spacing.base,
        backgroundColor: colors.primaryOpacity20,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
    },
    quickActionText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily.display,
        color: colors.primary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.base,
        gap: spacing.md,
    },
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.base,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    studentCardPresent: {
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    studentCardAbsent: {
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    studentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    studentName: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
    attendanceIndicator: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        padding: spacing.base,
        borderTopWidth: 1,
        borderTopColor: colors.zinc800,
    },
    saveButton: {
        height: 56,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        fontFamily: typography.fontFamily.display,
        color: colors.white,
    },
});
