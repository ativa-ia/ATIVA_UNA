import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Modal,
    FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { register as registerUser, saveAuth, getPublicCourses, CourseOption } from '@/services/api';

/**
 * RegisterScreen - Tela de Cadastro Tradicional
 * Campos: Nome, Matrícula, Email, Senha, Curso (selecionável)
 * Role fixo em 'student'
 */

export default function RegisterScreen() {
    const [name, setName] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);
    const [courses, setCourses] = useState<CourseOption[]>([]);
    const [showCoursePicker, setShowCoursePicker] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        const result = await getPublicCourses();
        if (result.success) {
            setCourses(result.courses);
        }
    };

    const isValidEmail = (email: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const handleRegister = async () => {
        if (!name.trim()) { alert('Por favor, digite seu nome.'); return; }
        if (!registrationNumber.trim()) { alert('Por favor, digite sua matrícula.'); return; }
        if (!isValidEmail(email)) { alert('Email inválido!'); return; }
        if (password.length < 6) { alert('A senha deve ter no mínimo 6 caracteres.'); return; }
        if (password !== confirmPassword) { alert('As senhas não coincidem.'); return; }
        if (!selectedCourse) { alert('Por favor, selecione seu curso.'); return; }

        setIsLoading(true);
        setStatusMessage('Criando conta...');

        try {
            const response = await registerUser({
                name,
                email,
                password,
                role: 'student',
                registration_number: registrationNumber,
                course_id: selectedCourse.id,
            } as any);

            if (response.success && response.user && response.token) {
                await saveAuth(response.token, response.user.role);
                setStatusMessage('Conta criada! Redirecionando...');

                if (response.user.role === 'student') {
                    router.replace('/(student)/dashboard');
                } else if (response.user.role === 'teacher') {
                    router.replace('/(teacher)/dashboard');
                } else {
                    router.replace('/(admin)/dashboard');
                }
            } else {
                alert(response.message || 'Erro ao criar conta. Tente novamente.');
            }
        } catch (error) {
            console.error('Erro no cadastro:', error);
            alert('Erro ao conectar com o servidor');
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    };

    return (
        <View style={styles.mainContainer}>
            <LinearGradient
                colors={['#312e81', '#6366f1', '#a78bfa']}
                style={styles.backgroundGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <SafeAreaView style={styles.safeArea}>
                    <ScrollView
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Logo / Brand */}
                        <View style={styles.logoSection}>
                            <View style={styles.logoBackground}>
                                <MaterialIcons name="school" size={40} color={colors.white} />
                            </View>
                            <Text style={styles.appTitle}>ATIVA IA</Text>
                            <Text style={styles.appTagline}>Criar Conta</Text>
                        </View>

                        {/* Form Card */}
                        <View style={styles.glassCard}>
                            <View style={styles.form}>
                                <Input
                                    iconName="person"
                                    placeholder="Nome Completo"
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />

                                <Input
                                    iconName="badge"
                                    placeholder="Matrícula"
                                    value={registrationNumber}
                                    onChangeText={setRegistrationNumber}
                                    autoCapitalize="none"
                                />

                                <Input
                                    iconName="email"
                                    placeholder="Email"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />

                                <Input
                                    iconName="lock"
                                    placeholder="Senha"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />

                                <Input
                                    iconName="lock-outline"
                                    placeholder="Confirmar Senha"
                                    secureTextEntry
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />

                                {/* Course Picker */}
                                <TouchableOpacity
                                    style={styles.courseSelector}
                                    onPress={() => setShowCoursePicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcons
                                        name="menu-book"
                                        size={24}
                                        color={selectedCourse ? colors.primary : colors.slate400}
                                        style={styles.courseSelectorIcon}
                                    />
                                    <Text style={[
                                        styles.courseSelectorText,
                                        selectedCourse && styles.courseSelectorTextSelected
                                    ]}>
                                        {selectedCourse ? selectedCourse.name : 'Selecione seu Curso'}
                                    </Text>
                                    <MaterialIcons name="expand-more" size={24} color={colors.slate400} />
                                </TouchableOpacity>
                            </View>

                            {statusMessage ? (
                                <Text style={styles.statusText}>{statusMessage}</Text>
                            ) : null}

                            <View style={styles.actions}>
                                <Button
                                    title="Criar Conta"
                                    onPress={handleRegister}
                                    variant="primary"
                                    loading={isLoading}
                                    disabled={isLoading}
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.linkButton}
                                onPress={() => router.back()}
                            >
                                <Text style={styles.linkText}>
                                    Já tem uma conta? <Text style={styles.linkTextBold}>Fazer Login</Text>
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </LinearGradient>

            {/* Course Picker Modal */}
            <Modal
                visible={showCoursePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCoursePicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Selecione seu Curso</Text>
                            <TouchableOpacity onPress={() => setShowCoursePicker(false)}>
                                <MaterialIcons name="close" size={24} color={colors.slate600} />
                            </TouchableOpacity>
                        </View>

                        {courses.length === 0 ? (
                            <View style={styles.emptyState}>
                                <MaterialIcons name="info-outline" size={40} color={colors.slate400} />
                                <Text style={styles.emptyText}>Nenhum curso disponível</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={courses}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.courseItem,
                                            selectedCourse?.id === item.id && styles.courseItemSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedCourse(item);
                                            setShowCoursePicker(false);
                                        }}
                                    >
                                        <View style={styles.courseItemContent}>
                                            <Text style={[
                                                styles.courseItemName,
                                                selectedCourse?.id === item.id && styles.courseItemNameSelected
                                            ]}>
                                                {item.name}
                                            </Text>
                                            <Text style={styles.courseItemCode}>{item.code}</Text>
                                        </View>
                                        {selectedCourse?.id === item.id && (
                                            <MaterialIcons name="check-circle" size={22} color="#6366f1" />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    backgroundGradient: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    safeArea: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: spacing.lg,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    logoBackground: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    appTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.white,
        fontFamily: typography.fontFamily.display,
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    appTagline: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: typography.fontFamily.body,
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 28,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.2,
        shadowRadius: 30,
        elevation: 10,
    },
    form: {
        gap: spacing.md,
    },
    actions: {
        marginTop: spacing.lg,
    },
    statusText: {
        textAlign: 'center',
        marginTop: spacing.md,
        color: colors.primary,
        fontWeight: '500',
    },
    linkButton: {
        marginTop: spacing.lg,
        alignItems: 'center',
    },
    linkText: {
        fontSize: 14,
        color: colors.slate500,
    },
    linkTextBold: {
        fontWeight: '700',
        color: '#6366f1',
    },
    courseSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.slate200,
        paddingHorizontal: spacing.base,
    },
    courseSelectorIcon: {
        marginRight: 8,
    },
    courseSelectorText: {
        flex: 1,
        fontSize: typography.fontSize.base,
        fontFamily: typography.fontFamily.display,
        color: colors.slate500,
    },
    courseSelectorTextSelected: {
        color: colors.slate900,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '60%',
        paddingBottom: spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.slate200,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    emptyState: {
        padding: spacing['2xl'],
        alignItems: 'center',
        gap: spacing.sm,
    },
    emptyText: {
        fontSize: 14,
        color: colors.slate400,
    },
    courseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base,
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        borderRadius: borderRadius.md,
    },
    courseItemSelected: {
        backgroundColor: '#6366f110',
    },
    courseItemContent: {
        flex: 1,
    },
    courseItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    courseItemNameSelected: {
        color: '#6366f1',
    },
    courseItemCode: {
        fontSize: 12,
        color: colors.slate400,
        marginTop: 2,
    },
});
