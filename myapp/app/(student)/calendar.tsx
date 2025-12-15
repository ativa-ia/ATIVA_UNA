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
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';

// Configurar idioma Português
LocaleConfig.locales['pt-br'] = {
    monthNames: [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro'
    ],
    monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
    dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    today: "Hoje"
};
LocaleConfig.defaultLocale = 'pt-br';

export default function CalendarScreen() {
    const [activeNavId, setActiveNavId] = useState('calendar');
    const [selectedDate, setSelectedDate] = useState('');

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
                        <Text style={styles.headerTitle}>Calendário Acadêmico</Text>
                        <View style={styles.placeholder} />
                    </View>
                </LinearGradient>

                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.calendarContainer}>
                        <Calendar
                            onDayPress={day => {
                                setSelectedDate(day.dateString);
                            }}
                            markedDates={{
                                [selectedDate]: { selected: true, disableTouchEvent: true }
                            }}
                            theme={{
                                backgroundColor: colors.white,
                                calendarBackground: colors.white,
                                textSectionTitleColor: colors.slate400,
                                selectedDayBackgroundColor: colors.primary,
                                selectedDayTextColor: colors.white,
                                todayTextColor: colors.primary,
                                dayTextColor: colors.textPrimary,
                                textDisabledColor: colors.slate300,
                                dotColor: colors.primary,
                                selectedDotColor: colors.white,
                                arrowColor: colors.primary,
                                disabledArrowColor: colors.slate200,
                                monthTextColor: colors.textPrimary,
                                indicatorColor: colors.primary,
                                textDayFontFamily: typography.fontFamily.body,
                                textMonthFontFamily: typography.fontFamily.display,
                                textDayHeaderFontFamily: typography.fontFamily.body,
                                textDayFontWeight: '400',
                                textMonthFontWeight: 'bold',
                                textDayHeaderFontWeight: '500',
                                textDayFontSize: 16,
                                textMonthFontSize: 18,
                                textDayHeaderFontSize: 14
                            }}
                        />
                    </View>

                    {selectedDate ? (
                        <View style={styles.eventsContainer}>
                            <Text style={styles.eventsTitle}>
                                Eventos em {selectedDate.split('-').reverse().join('/')}
                            </Text>
                            <View style={styles.emptyEvent}>
                                <Text style={styles.emptyEventText}>Nenhum evento agendado.</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.eventsContainer}>
                            <Text style={styles.hintText}>Selecione uma data para ver os eventos.</Text>
                        </View>
                    )}
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
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
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
    },
    scrollContent: {
        padding: spacing.base,
        paddingBottom: spacing.xl,
    },
    calendarContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: spacing.lg,
    },
    eventsContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.slate200,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    eventsTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    emptyEvent: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    emptyEventText: {
        color: colors.textSecondary,
    },
    hintText: {
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xl,
    }
});
