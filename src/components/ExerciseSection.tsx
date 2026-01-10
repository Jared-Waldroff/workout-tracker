import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useSets } from '../hooks/useSets';
import { useExercises } from '../hooks/useExercises';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation';
import { spacing, radii, typography, MIN_TOUCH_TARGET, colors } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;


interface ExerciseSectionProps {
    workoutExercise: {
        id: string;
        exercise?: {
            id: string;
            name: string;
            muscle_group?: string;
        };
        sets?: Array<{
            id: string;
            weight?: number;
            reps?: number;
            is_completed?: boolean;
        }>;
    };
    onSetToggle?: (setId: string, newComplete: boolean) => void;
    onSetAdd?: (newSet: any) => void;
    onSetDelete?: (setId: string) => void;
}

export default function ExerciseSection({ workoutExercise, onSetToggle, onSetAdd, onSetDelete }: ExerciseSectionProps) {
    const navigation = useNavigation<NavigationProp>();
    const { themeColors, colors: userColors } = useTheme();
    const { addSet, updateSet, deleteSet, toggleSetComplete, duplicateSet } = useSets();
    const { getExerciseHistory } = useExercises();

    const [sets, setSets] = useState(workoutExercise.sets || []);
    const [isExpanded, setIsExpanded] = useState(true);
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const exercise = workoutExercise.exercise;

    // Update sets from props when set count changes
    useEffect(() => {
        const propSets = workoutExercise.sets || [];
        if (propSets.length !== sets.length) {
            setSets(propSets);
        }
    }, [workoutExercise.sets?.length]);

    // Debounced update to prevent spam
    const debouncedUpdateSet = useCallback(
        (setId: string, field: string, value: string) => {
            const timerKey = `${setId}-${field}`;
            if (debounceTimers.current[timerKey]) {
                clearTimeout(debounceTimers.current[timerKey]);
            }

            debounceTimers.current[timerKey] = setTimeout(async () => {
                await updateSet(setId, { [field]: parseFloat(value) || 0 });
                delete debounceTimers.current[timerKey];
            }, 500);
        },
        [updateSet]
    );

    const handleSetChange = (setId: string, field: string, value: string) => {
        // Update locally immediately
        setSets((prev) =>
            prev.map((s) => (s.id === setId ? { ...s, [field]: value } : s))
        );
        debouncedUpdateSet(setId, field, value);
    };

    const handleToggleComplete = async (set: any) => {
        // Haptic feedback - different for complete vs incomplete
        if (!set.is_completed) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        const newCompleted = !set.is_completed;

        // Update local state immediately
        setSets((prev) =>
            prev.map((s) => (s.id === set.id ? { ...s, is_completed: newCompleted } : s))
        );

        // Notify parent immediately for count update (before DB call)
        if (onSetToggle) {
            onSetToggle(set.id, newCompleted);
        }

        // Update in database (async, doesn't block UI)
        toggleSetComplete(set.id, set.is_completed);
    };

    const handleAddSet = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const lastSet = sets[sets.length - 1];
        const { data } = await duplicateSet(workoutExercise.id, lastSet);
        if (data) {
            setSets((prev) => [...prev, data]);
            // Notify parent
            if (onSetAdd) {
                onSetAdd(data);
            }
        }
    };

    const handleDeleteSet = async (setId: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        await deleteSet(setId);
        setSets((prev) => prev.filter((s) => s.id !== setId));
        // Notify parent
        if (onSetDelete) {
            onSetDelete(setId);
        }
    };

    const handleExerciseClick = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (exercise?.id) {
            navigation.navigate('ExerciseDetail', { id: exercise.id });
        }
    };

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer));
        };
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}>
            {/* Header */}
            <Pressable
                style={styles.header}
                onPress={() => setIsExpanded(!isExpanded)}
            >
                <Pressable style={styles.exerciseInfo} onPress={handleExerciseClick}>
                    <Text style={[styles.exerciseName, { color: themeColors.textPrimary }]}>
                        {exercise?.name}
                    </Text>
                    <Text style={[styles.muscleGroup, { color: themeColors.textTertiary }]}>
                        {exercise?.muscle_group}
                    </Text>
                </Pressable>
                <Pressable style={styles.expandButton}>
                    <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={themeColors.textSecondary}
                    />
                </Pressable>
            </Pressable>

            {isExpanded && (
                <>
                    {/* Sets Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, styles.setNum, { color: themeColors.textTertiary }]}>
                            Set
                        </Text>
                        <Text style={[styles.headerCell, styles.weightCell, { color: themeColors.textTertiary }]}>
                            lbs
                        </Text>
                        <Text style={[styles.headerCell, styles.repsCell, { color: themeColors.textTertiary }]}>
                            Reps
                        </Text>
                        <View style={styles.checkCell} />
                        <View style={styles.deleteCell} />
                    </View>

                    {/* Sets */}
                    {sets.map((set, index) => (
                        <View
                            key={set.id}
                            style={[
                                styles.setRow,
                                set.is_completed && { backgroundColor: colors.success + '15' },
                            ]}
                        >
                            <Text style={[styles.setNum, { color: themeColors.textSecondary }]}>
                                {index + 1}
                            </Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    styles.weightCell,
                                    {
                                        backgroundColor: themeColors.inputBg,
                                        borderColor: themeColors.inputBorder,
                                        color: themeColors.textPrimary,
                                    },
                                ]}
                                value={String(set.weight ?? '')}
                                onChangeText={(value) => handleSetChange(set.id, 'weight', value)}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={themeColors.textMuted}
                            />
                            <TextInput
                                style={[
                                    styles.input,
                                    styles.repsCell,
                                    {
                                        backgroundColor: themeColors.inputBg,
                                        borderColor: themeColors.inputBorder,
                                        color: themeColors.textPrimary,
                                    },
                                ]}
                                value={String(set.reps ?? '')}
                                onChangeText={(value) => handleSetChange(set.id, 'reps', value)}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor={themeColors.textMuted}
                            />
                            <Pressable
                                style={[
                                    styles.checkButton,
                                    set.is_completed && { backgroundColor: colors.success },
                                    !set.is_completed && { backgroundColor: themeColors.inputBg, borderWidth: 2, borderColor: themeColors.inputBorder },
                                ]}
                                onPress={() => handleToggleComplete(set)}
                            >
                                {set.is_completed && (
                                    <Feather name="check" size={16} color="#fff" />
                                )}
                            </Pressable>
                            <Pressable
                                style={styles.deleteButton}
                                onPress={() => handleDeleteSet(set.id)}
                            >
                                <Feather name="x" size={16} color={themeColors.textMuted} />
                            </Pressable>
                        </View>
                    ))}

                    {/* Add Set Button */}
                    <Pressable
                        style={[styles.addSetButton]}
                        onPress={handleAddSet}
                    >
                        <Feather name="plus" size={16} color={themeColors.textSecondary} />
                        <Text style={[styles.addSetText, { color: themeColors.textSecondary }]}>
                            Add Set
                        </Text>
                    </Pressable>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: radii.lg,
        borderWidth: 1,
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    exerciseInfo: {
        flex: 1,
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
    },
    exerciseName: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
    },
    muscleGroup: {
        fontSize: typography.sizes.sm,
        marginTop: 2,
    },
    expandButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xs,
    },
    headerCell: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
        textTransform: 'uppercase',
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        minHeight: MIN_TOUCH_TARGET + 8,
    },
    setNum: {
        width: 36,
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
        textAlign: 'center',
    },
    weightCell: {
        flex: 1,
        marginHorizontal: spacing.xs,
    },
    repsCell: {
        flex: 1,
        marginHorizontal: spacing.xs,
    },
    input: {
        height: MIN_TOUCH_TARGET,
        borderRadius: radii.md,
        borderWidth: 1,
        textAlign: 'center',
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
    },
    checkCell: {
        width: MIN_TOUCH_TARGET,
    },
    deleteCell: {
        width: MIN_TOUCH_TARGET,
    },
    checkButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        borderRadius: radii.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: spacing.xs,
    },
    deleteButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addSetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        minHeight: MIN_TOUCH_TARGET,
    },
    addSetText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
});
