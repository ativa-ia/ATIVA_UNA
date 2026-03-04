import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { BottomNav, NavItem } from '@/components/navigation/BottomNav';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, borderRadius } from '@/constants/spacing';
import { CalendarEventItem, getCalendarEvents } from '@/services/api';

// Configurar idioma Português
LocaleConfig.locales['pt-br'] = {
    monthNames: [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ],
    monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
    dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    today: "Hoje"
};
LocaleConfig.defaultLocale = 'pt-br';

export default function TeacherCalendarScreen() {
    const [activeNavId, setActiveNavId] = useState('calendar');
    const [selectedDate, setSelectedDate] = useState('');
    const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);

    const loadCalendarEvents = useCallback(async () => {
        const result = await getCalendarEvents();
        if (result.success) {
            setCalendarEvents(result.events || []);
        }
    }, []);

    useEffect(() => {
        loadCalendarEvents();
    }, [loadCalendarEvents]);

    useFocusEffect(
        useCallback(() => {
            setActiveNavId('calendar');
            loadCalendarEvents();
        }, [loadCalendarEvents])
    );

    const selectedDayEvents = useMemo(
        () => calendarEvents.filter((item) => item.event_date === selectedDate),
        [calendarEvents, selectedDate]
    );

    const markedDates = useMemo(() => {
        const marks: Record<string, any> = {};

        for (const item of calendarEvents) {
            marks[item.event_date] = {
                ...(marks[item.event_date] || {}),
                marked: true,
                dotColor: item.event_type === 'notice' ? colors.warning : colors.primary,
            };
        }

        if (selectedDate) {
            marks[selectedDate] = {
                ...(marks[selectedDate] || {}),
                selected: true,
                selectedColor: colors.primary,
            };
        }

        return marks;
    }, [calendarEvents, selectedDate]);

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
        { id: 'calendar', label: 'Calendário', iconName: 'calendar-today' },
        { id: 'recaps', label: 'Recapitulando', iconName: 'history-edu' },
    ];

    const handleNavPress = (id: string) => {
        setActiveNavId(id);

        switch (id) {
            case 'dashboard':
                router.push('./dashboard');
                break;
            case 'calendar':
                break;
            case 'recaps':
                router.push('/(teacher)/recaps');
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
                            onPress={() => router.canGoBack() ? router.back() : router.push('/(teacher)/dashboard')}
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
                            markedDates={markedDates}
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
                            {selectedDayEvents.length === 0 ? (
                                <View style={styles.emptyEvent}>
                                    <Text style={styles.emptyEventText}>Nenhum evento agendado.</Text>
                                </View>
                            ) : (
                                selectedDayEvents.map((event) => (
                                    <View key={event.id} style={styles.eventItem}>
                                        <View style={[styles.eventBadge, event.event_type === 'notice' ? styles.noticeBadge : styles.eventBadgePrimary]}>
                                            <Text style={styles.eventBadgeText}>{event.event_type === 'notice' ? 'Aviso' : 'Evento'}</Text>
                                        </View>
                                        <Text style={styles.eventItemTitle}>{event.title}</Text>
                                        {!!event.description && <Text style={styles.eventItemDescription}>{event.description}</Text>}
                                    </View>
                                ))
                            )}
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
        padding: spacing.base,
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
    },
    eventItem: {
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        marginBottom: spacing.sm,
        backgroundColor: colors.white,
    },
    eventBadge: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: spacing.xs,
    },
    eventBadgePrimary: {
        backgroundColor: colors.primaryOpacity20,
    },
    noticeBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    eventBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    eventItemTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    eventItemDescription: {
        marginTop: 4,
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
    }
});
