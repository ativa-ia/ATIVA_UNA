import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Animated,
    Platform,
    TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export interface TutorialStep {
    title: string;
    description: string;
    targetRef?: any; // Just for identification in parent
    key?: string; // identifier
}

export interface TargetLayout {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TutorialOverlayProps {
    visible: boolean;
    steps: TutorialStep[];
    currentStepIndex: number;
    targetLayout: TargetLayout | null;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    isLastStep: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TutorialOverlay({
    visible,
    steps,
    currentStepIndex,
    targetLayout,
    onNext,
    onPrev,
    onSkip,
    isLastStep
}: TutorialOverlayProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Animation trigger
    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible, currentStepIndex, targetLayout]); // Re-animate on step change

    if (!visible) return null;

    const currentStep = steps[currentStepIndex];

    // Determine Popover Position
    // Default to center if no target
    let popoverStyle: any = {
        top: SCREEN_HEIGHT / 2 - 100,
        left: 20,
        right: 20,
    };
    let arrowStyle: any = { opacity: 0 };
    let arrowDirection: 'up' | 'down' = 'up';

    // Spotlight dimensions (default full screen dim if no target)
    let spotTop = 0;
    let spotLeft = 0;
    let spotWidth = 0;
    let spotHeight = 0;
    let hasTarget = false;

    if (targetLayout) {
        hasTarget = true;
        const { x, y, width, height } = targetLayout;
        spotTop = y;
        spotLeft = x;
        spotWidth = width;
        spotHeight = height;

        const spaceAbove = y;
        const spaceBelow = SCREEN_HEIGHT - (y + height);
        const popoverHeight = 200; // estimated

        // Decide whether to put bubble above or below
        if (spaceBelow > popoverHeight || spaceBelow > spaceAbove) {
            // Place Below
            popoverStyle = {
                top: y + height + 16,
                left: 20, // Keep mostly full width but with padding
                right: 20,
            };
            arrowDirection = 'up';
            // Arrow position relative to the card. 
            // The card is (SCREEN_WIDTH - 40) wide.
            // visual target center relative to screen X is x + width/2.
            // visual target center relative to card left (20) is (x + width/2) - 20.
            const arrowX = (x + width / 2) - 20;
            // Clamp arrowX to be within card radius (approx 16px to width-16px)
            const clampedArrowX = Math.max(16, Math.min(SCREEN_WIDTH - 40 - 16, arrowX));

            arrowStyle = {
                top: -10, // Stick out top
                left: clampedArrowX - 10, // Center the 20px arrow
                borderBottomWidth: 10,
                borderBottomColor: '#FFF',
                borderLeftWidth: 10,
                borderLeftColor: 'transparent',
                borderRightWidth: 10,
                borderRightColor: 'transparent',
                borderTopWidth: 0,
            };
        } else {
            // Place Above
            popoverStyle = {
                bottom: SCREEN_HEIGHT - y + 16,
                left: 20,
                right: 20,
            };
            arrowDirection = 'down';
            const arrowX = (x + width / 2) - 20;
            const clampedArrowX = Math.max(16, Math.min(SCREEN_WIDTH - 40 - 16, arrowX));

            arrowStyle = {
                bottom: -10, // Stick out bottom
                left: clampedArrowX - 10,
                borderTopWidth: 10,
                borderTopColor: '#FFF',
                borderLeftWidth: 10,
                borderLeftColor: 'transparent',
                borderRightWidth: 10,
                borderRightColor: 'transparent',
                borderBottomWidth: 0,
            };
        }
    }

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onSkip}
            statusBarTranslucent
        >
            {/* Spotlight Overlay Calculation */}
            {hasTarget ? (
                // 4-part overlay to create a "hole"
                <View style={StyleSheet.absoluteFill}>
                    {/* Top Dim */}
                    <View style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: spotTop,
                        backgroundColor: 'rgba(0,0,0,0.7)'
                    }} />
                    {/* Bottom Dim */}
                    <View style={{
                        position: 'absolute', top: spotTop + spotHeight, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)'
                    }} />
                    {/* Left Dim */}
                    <View style={{
                        position: 'absolute', top: spotTop, left: 0, width: spotLeft, height: spotHeight,
                        backgroundColor: 'rgba(0,0,0,0.7)'
                    }} />
                    {/* Right Dim */}
                    <View style={{
                        position: 'absolute', top: spotTop, left: spotLeft + spotWidth, right: 0, height: spotHeight,
                        backgroundColor: 'rgba(0,0,0,0.7)'
                    }} />

                    {/* Target Highlighting Border (Optional) */}
                    <View style={{
                        position: 'absolute',
                        top: spotTop - 4, left: spotLeft - 4,
                        width: spotWidth + 8, height: spotHeight + 8,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: '#fff',
                        backgroundColor: 'transparent',
                        shadowColor: "#FFF",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 10,
                        elevation: 10,
                    }} />
                </View>
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
            )}

            {/* Click to Skip/Next area (maybe disabled to force interaction with buttons) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none" />

            {/* Popover Card */}
            <Animated.View style={[styles.popoverCard, popoverStyle, { opacity: fadeAnim }]}>
                {/* Arrow */}
                {hasTarget && <View style={[styles.arrow, arrowStyle]} />}

                <View style={styles.cardContent}>
                    <Text style={styles.stepTitle}>{currentStep.title}</Text>
                    <Text style={styles.stepDesc}>{currentStep.description}</Text>

                    {/* Footer Controls */}
                    <View style={styles.footer}>
                        <View style={styles.dots}>
                            {steps.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        i === currentStepIndex ? styles.activeDot : styles.inactiveDot
                                    ]}
                                />
                            ))}
                        </View>

                        <View style={styles.buttons}>
                            <TouchableOpacity onPress={onSkip}>
                                <Text style={styles.skipText}>Pular</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onNext} style={styles.nextBtn}>
                                <LinearGradient
                                    colors={['#6366f1', '#4f46e5']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.gradientBtn}
                                >
                                    <Text style={styles.nextText}>
                                        {isLastStep ? 'Concluir' : 'Próximo'}
                                    </Text>
                                    <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    popoverCard: {
        position: 'absolute',
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 20,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        maxWidth: 500,
        alignSelf: 'center', // Center horizontally if left/right not strict, but we set left/right to 20
    },
    arrow: {
        position: 'absolute',
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
    },
    cardContent: {
        gap: 12,
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    stepDesc: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    dots: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    activeDot: {
        width: 24,
        backgroundColor: '#6366f1',
    },
    inactiveDot: {
        width: 6,
        backgroundColor: '#cbd5e1',
    },
    buttons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    skipText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
    },
    nextBtn: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    gradientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 6,
    },
    nextText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
