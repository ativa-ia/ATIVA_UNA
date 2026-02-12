import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Platform,
    LayoutRectangle,
    useWindowDimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export interface TutorialStep {
    targetRef: React.RefObject<any>;
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TutorialOverlayProps {
    visible: boolean;
    steps: TutorialStep[];
    onClose: () => void;
    onFinish: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
    visible,
    steps,
    onClose,
    onFinish
}) => {
    const { width, height } = useWindowDimensions();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetLayout, setTargetLayout] = useState<LayoutRectangle | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setCurrentStepIndex(0);
            measureCurrentTarget(0);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            setTargetLayout(null);
            fadeAnim.setValue(0);
        }
    }, [visible]);

    const measureCurrentTarget = (index: number) => {
        const step = steps[index];
        if (step && step.targetRef && step.targetRef.current) {
            step.targetRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                setTargetLayout({
                    x: pageX,
                    y: pageY,
                    width,
                    height
                });
            });
        }
    };

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            const nextIndex = currentStepIndex + 1;
            setCurrentStepIndex(nextIndex);
            measureCurrentTarget(nextIndex);
        } else {
            finishTutorial();
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            const prevIndex = currentStepIndex - 1;
            setCurrentStepIndex(prevIndex);
            measureCurrentTarget(prevIndex);
        }
    };

    const finishTutorial = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            onFinish();
        });
    }

    // Calculate Card Position
    const getCardStyle = () => {
        // Fallback or centered default
        if (!targetLayout) return { top: height / 2 - 100, left: (width - 300) / 2, width: 300 };

        const spacing = 16;
        // Adjust widths for better mobile fit
        const maxCardWidth = 340;
        const minCardWidth = 260;

        let cardWidth = Math.min(width - 32, maxCardWidth);
        if (cardWidth < minCardWidth) cardWidth = width - 36;

        let top = 0;
        let left = 0;

        // Vertical Positioning
        const spaceBelow = height - (targetLayout.y + targetLayout.height + spacing);
        const spaceAbove = targetLayout.y - spacing;

        // Decide placement based on available space
        if (spaceBelow > 220 || spaceBelow > spaceAbove) {
            // Below
            top = targetLayout.y + targetLayout.height + spacing;
        } else {
            // Above
            // Estimate height approx 200 to be safe
            top = targetLayout.y - 200 - spacing;
            if (top < 60) top = 60; // Keep clear of top status bar area
        }

        // Horizontal Positioning
        // Attempt to center relative to target
        left = targetLayout.x + (targetLayout.width / 2) - (cardWidth / 2);

        // Boundary Check (Critical for "Fred" button on far right)
        // Ensure left margin
        if (left < 16) left = 16;

        // Ensure right margin
        if (left + cardWidth > width - 16) {
            left = width - cardWidth - 16;
        }

        return { top, left, width: cardWidth };
    };

    if (!visible) return null;

    const currentStep = steps[currentStepIndex];
    const cardStyle = getCardStyle();

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Background Mask - Semi-transparent dark overlay */}
                {targetLayout && (
                    <View style={styles.maskContainer}>
                        {/* Top */}
                        <View style={[styles.maskBlock, { top: 0, height: targetLayout.y, width: '100%', left: 0 }]} />
                        {/* Bottom */}
                        <View style={[styles.maskBlock, { top: targetLayout.y + targetLayout.height, height: height - (targetLayout.y + targetLayout.height), width: '100%', left: 0 }]} />
                        {/* Left */}
                        <View style={[styles.maskBlock, { top: targetLayout.y, height: targetLayout.height, width: targetLayout.x, left: 0 }]} />
                        {/* Right */}
                        <View style={[styles.maskBlock, { top: targetLayout.y, height: targetLayout.height, width: width - (targetLayout.x + targetLayout.width), left: targetLayout.x + targetLayout.width }]} />

                        {/* Highlight Spot (The "Hole") - Optional glow border */}
                        <View style={{
                            position: 'absolute',
                            top: targetLayout.y - 4,
                            left: targetLayout.x - 4,
                            width: targetLayout.width + 8,
                            height: targetLayout.height + 8,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: '#fbbf24', // Amber/Yellow highlight
                            backgroundColor: 'transparent',
                            shadowColor: "#fbbf24",
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.8,
                            shadowRadius: 10,
                            elevation: 10
                        }} />
                    </View>
                )}
                {!targetLayout && <View style={[styles.maskContainer, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />}

                {/* Card */}
                <Animated.View style={[styles.card, { top: cardStyle.top, left: cardStyle.left, width: cardStyle.width, opacity: fadeAnim }]}>
                    <LinearGradient
                        colors={['#ffffff', '#f8fafc']}
                        style={styles.cardGradient}
                    >
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>{currentStep?.title}</Text>
                            <TouchableOpacity onPress={onClose}>
                                <MaterialIcons name="close" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.cardDescription}>{currentStep?.description}</Text>

                        <View style={styles.cardFooter}>
                            <View style={styles.indicators}>
                                {steps.map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.indicatorDot,
                                            i === currentStepIndex && styles.indicatorDotActive
                                        ]}
                                    />
                                ))}
                            </View>

                            <View style={styles.buttons}>
                                {currentStepIndex > 0 && (
                                    <TouchableOpacity style={styles.backButton} onPress={handlePrevious}>
                                        <Text style={styles.backButtonText}>Voltar</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                                    <LinearGradient
                                        colors={['#4f46e5', '#4338ca']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.nextButtonGradient}
                                    >
                                        <Text style={styles.nextButtonText}>
                                            {currentStepIndex === steps.length - 1 ? 'Concluir' : 'Próximo'}
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>

                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    maskContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    maskBlock: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    card: {
        position: 'absolute',
        width: 300,
        borderRadius: 16,
        backgroundColor: 'white',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    cardGradient: {
        borderRadius: 16,
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    cardDescription: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        marginBottom: 20,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    indicators: {
        flexDirection: 'row',
        gap: 6,
    },
    indicatorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e2e8f0',
    },
    indicatorDotActive: {
        backgroundColor: '#4f46e5',
        width: 16,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    backButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    backButtonText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    nextButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    nextButtonGradient: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    nextButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
});
