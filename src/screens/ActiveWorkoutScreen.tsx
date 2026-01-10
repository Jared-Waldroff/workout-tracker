import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useExercises } from '../hooks/useExercises';
import { checkWorkoutForBadges, BADGE_DEFINITIONS } from '../data/badges';
import { RootStackParamList } from '../navigation';
import ExerciseSection from '../components/ExerciseSection';
import ConfirmDialog from '../components/ConfirmDialog';
import ScreenLayout from '../components/ScreenLayout';
import { colors, spacing, radii, typography, MIN_TOUCH_TARGET } from '../theme';

type ActiveWorkoutRouteProp = RouteProp<RootStackParamList, 'ActiveWorkout'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ActiveWorkoutScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<ActiveWorkoutRouteProp>();
    const { id } = route.params;
    const { themeColors, colors: userColors } = useTheme();
    const { addBadge, hasBadge } = useAthleteProfile();
    const { exercises, createExercise, fetchExercises } = useExercises();

    const [workout, setWorkout] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
    const [newBadge, setNewBadge] = useState<any>(null);

    // Add Exercise Modal state
    const [showAddExercise, setShowAddExercise] = useState(false);
    const [exerciseSearch, setExerciseSearch] = useState('');
    const [showCreateExercise, setShowCreateExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [newExerciseMuscle, setNewExerciseMuscle] = useState('');
    const [newExerciseDescription, setNewExerciseDescription] = useState('');
    const [addingExercise, setAddingExercise] = useState(false);

    // KEEP SCREEN AWAKE during workout
    useEffect(() => {
        activateKeepAwakeAsync();
        return () => {
            deactivateKeepAwake();
        };
    }, []);

    // Load workout
    useEffect(() => {
        loadWorkout();
    }, [id]);

    const loadWorkout = async () => {
        if (!id) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('workouts')
                .select(`
            *,
            workout_exercises (
              id,
              order_index,
              exercise:exercises (
                id,
                name,
                muscle_group
              ),
              sets (
                id,
                weight,
                reps,
                is_completed,
                completed_at,
                created_at
              )
            )
          `)
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error loading workout:', error);
                setWorkout(null);
            } else if (data) {
                // Sort exercises and sets
                data.workout_exercises?.sort((a: any, b: any) => a.order_index - b.order_index);
                data.workout_exercises?.forEach((we: any) => {
                    we.sets?.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                });
                setWorkout(data);
            }
        } catch (err) {
            console.error('Exception loading workout:', err);
            setWorkout(null);
        }

        setLoading(false);
    };

    // Filter exercises by search
    const filteredExercises = exercises.filter(ex =>
        ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        ex.muscle_group?.toLowerCase().includes(exerciseSearch.toLowerCase())
    );

    // Handle set toggle - update local state immediately for instant count update
    const handleSetToggle = useCallback((setId: string, newComplete: boolean) => {
        setWorkout((prev: any) => {
            if (!prev?.workout_exercises) return prev;

            return {
                ...prev,
                workout_exercises: prev.workout_exercises.map((we: any) => ({
                    ...we,
                    sets: we.sets?.map((s: any) =>
                        s.id === setId ? { ...s, is_completed: newComplete } : s
                    )
                }))
            };
        });
    }, []);

    // Handle new set added - updates total sets count
    const handleSetAdd = useCallback((newSet: any) => {
        setWorkout((prev: any) => {
            if (!prev?.workout_exercises) return prev;

            return {
                ...prev,
                workout_exercises: prev.workout_exercises.map((we: any) => {
                    if (we.id === newSet.workout_exercise_id) {
                        return {
                            ...we,
                            sets: [...(we.sets || []), newSet]
                        };
                    }
                    return we;
                })
            };
        });
    }, []);

    // Handle set deleted - updates total sets count
    const handleSetDelete = useCallback((setId: string) => {
        setWorkout((prev: any) => {
            if (!prev?.workout_exercises) return prev;

            return {
                ...prev,
                workout_exercises: prev.workout_exercises.map((we: any) => ({
                    ...we,
                    sets: we.sets?.filter((s: any) => s.id !== setId)
                }))
            };
        });
    }, []);

    const handleAddExercise = async (exerciseId: string) => {
        setAddingExercise(true);
        try {
            const maxOrder = Math.max(0, ...(workout.workout_exercises?.map((we: any) => we.order_index) || []));

            // Add workout_exercise
            const { data: weData, error: weError } = await supabase
                .from('workout_exercises')
                .insert({
                    workout_id: id,
                    exercise_id: exerciseId,
                    order_index: maxOrder + 1,
                })
                .select(`
                    id,
                    order_index,
                    exercise:exercises (id, name, muscle_group),
                    sets (id, weight, reps, is_completed, completed_at, created_at)
                `)
                .single();

            if (weError) throw weError;

            // Add one default set
            if (weData) {
                const { data: setData, error: setError } = await supabase
                    .from('sets')
                    .insert({
                        workout_exercise_id: weData.id,
                        weight: 0,
                        reps: 0,
                        is_completed: false,
                    })
                    .select()
                    .single();

                if (!setError && setData) {
                    weData.sets = [setData];
                }
            }

            // Update local workout state
            setWorkout((prev: any) => ({
                ...prev,
                workout_exercises: [...(prev.workout_exercises || []), weData],
            }));

            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowAddExercise(false);
            setExerciseSearch('');
        } catch (err) {
            console.error('Error adding exercise:', err);
            Alert.alert('Error', 'Failed to add exercise');
        }
        setAddingExercise(false);
    };

    // Create new exercise and add to workout
    const handleCreateNewExercise = async () => {
        if (!newExerciseName.trim() || !newExerciseMuscle.trim()) {
            Alert.alert('Error', 'Please fill in both exercise name and muscle group');
            return;
        }

        setAddingExercise(true);
        try {
            const { data, error } = await createExercise({
                name: newExerciseName.trim(),
                muscle_group: newExerciseMuscle.trim(),
                description: newExerciseDescription.trim() || undefined,
            });

            if (error) throw new Error(error);

            if (data) {
                await fetchExercises(true);
                await handleAddExercise(data.id);

                setNewExerciseName('');
                setNewExerciseMuscle('');
                setNewExerciseDescription('');
                setShowCreateExercise(false);
            }
        } catch (err) {
            console.error('Error creating exercise:', err);
            Alert.alert('Error', 'Failed to create exercise');
        }
        setAddingExercise(false);
    };

    // Calculate set completion stats
    const getAllSets = useCallback(() => {
        if (!workout?.workout_exercises) return [];
        return workout.workout_exercises.flatMap((we: any) => we.sets || []);
    }, [workout]);

    const allSets = getAllSets();
    const completedSets = allSets.filter((s: any) => s.is_completed);
    const totalSets = allSets.length;
    const allSetsComplete = totalSets > 0 && completedSets.length === totalSets;

    const handleCompleteWorkout = async () => {
        const newStatus = !workout.is_completed;

        // Haptic feedback
        if (newStatus) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        // Update locally immediately
        setWorkout((prev: any) => ({ ...prev, is_completed: newStatus }));
        setShowCompleteConfirm(false);

        // Update in database
        await supabase
            .from('workouts')
            .update({ is_completed: newStatus })
            .eq('id', workout.id);

        // Check for race badges if completing workout
        if (newStatus) {
            const earnedBadges = checkWorkoutForBadges({ ...workout, is_completed: true });
            for (const badgeId of earnedBadges) {
                if (!hasBadge(badgeId)) {
                    await addBadge(badgeId);
                    setNewBadge((BADGE_DEFINITIONS as any)[badgeId]);
                    break; // Show one badge at a time
                }
            }

            // Navigate to Home after completing workout (if no badge shown)
            if (earnedBadges.length === 0 || earnedBadges.every((b: any) => hasBadge(b))) {
                navigation.navigate('Main' as any, { screen: 'Home' });
            }
        }
    };

    const handleCompleteClick = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // If explicitly clicking the button to complete, or uncomplete, we should just follow user intent
        // The user asked "when i click complete woprkout it shjould take me back to the home page"

        if (workout.is_completed) {
            // Already completed -> Toggle off or ask?
            // "click complete woprkout... take me back" implies the button when it's NOT done or when it IS done?
            // Assuming the main "Complete" action.
            // If it's already completed, the button says "Mark as Incomplete".
            setShowCompleteConfirm(true);
        } else if (!allSetsComplete) {
            // Show warning if not all sets complete
            setShowIncompleteWarning(true);
        } else {
            // Complete safely
            handleCompleteWorkout();
        }
    };

    const handleDeleteWorkout = async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        await supabase.from('workouts').delete().eq('id', workout.id);
        navigation.goBack();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <ScreenLayout hideHeader>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={userColors.accent_color} />
                    <Text style={[styles.loadingText, { color: themeColors.textTertiary }]}>
                        Loading workout...
                    </Text>
                </View>
            </ScreenLayout>
        );
    }

    if (!workout) {
        return (
            <ScreenLayout hideHeader>
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: themeColors.textTertiary }]}>
                        Workout not found
                    </Text>
                    <Pressable
                        style={[styles.button, { backgroundColor: userColors.accent_color }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.buttonText}>Go Back</Text>
                    </Pressable>
                </View>
            </ScreenLayout>
        );
    }

    return (
        <ScreenLayout hideHeader>
            {/* Header Removed as per user request */}

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Color Bar */}
                <View style={[styles.colorBar, { backgroundColor: workout.color }]} />

                {/* Completed Banner */}
                {workout.is_completed && (
                    <View style={[styles.completedBanner, { backgroundColor: colors.success }]}>
                        <Feather name="check-circle" size={20} color="#fff" />
                        <Text style={styles.completedBannerText}>Workout Completed!</Text>
                    </View>
                )}

                {/* Exercises */}
                <View style={styles.exercisesList}>
                    {workout.workout_exercises?.map((we: any) => (
                        <ExerciseSection
                            key={we.id}
                            workoutExercise={we}
                            onSetToggle={handleSetToggle}
                            onSetAdd={handleSetAdd}
                            onSetDelete={handleSetDelete}
                        />
                    ))}
                </View>

                {/* Add Exercise Button */}
                <Pressable
                    style={[styles.addExerciseButton, { borderColor: themeColors.glassBorder }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowAddExercise(true);
                    }}
                >
                    <Feather name="plus-circle" size={20} color={userColors.accent_color} />
                    <Text style={[styles.addExerciseText, { color: userColors.accent_color }]}>Add Exercise</Text>
                </Pressable>

                {workout.workout_exercises?.length === 0 && (
                    <View style={[styles.emptyExercises, { backgroundColor: themeColors.inputBg }]}>
                        <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
                            No exercises in this workout
                        </Text>
                    </View>
                )}

                {/* Complete Button */}
                <Pressable
                    style={[
                        styles.completeButton,
                        workout.is_completed
                            ? { backgroundColor: themeColors.inputBg, borderWidth: 1, borderColor: themeColors.inputBorder }
                            : { backgroundColor: allSetsComplete ? colors.success : themeColors.inputBg },
                    ]}
                    onPress={handleCompleteClick}
                >
                    <Feather
                        name={workout.is_completed ? 'rotate-ccw' : 'check'}
                        size={20}
                        color={workout.is_completed ? themeColors.textSecondary : '#fff'}
                    />
                    <Text
                        style={[
                            styles.completeButtonText,
                            { color: workout.is_completed ? themeColors.textSecondary : '#fff' },
                        ]}
                    >
                        {workout.is_completed
                            ? 'Mark as Incomplete'
                            : allSetsComplete
                                ? 'Complete Workout'
                                : `Complete Sets (${completedSets.length}/${totalSets})`}
                    </Text>
                </Pressable>
            </ScrollView>

            {/* Add Exercise Modal */}
            <Modal visible={showAddExercise} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: themeColors.bgSecondary }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Add Exercise</Text>
                            <Pressable onPress={() => { setShowAddExercise(false); setShowCreateExercise(false); }}>
                                <Feather name="x" size={24} color={themeColors.textSecondary} />
                            </Pressable>
                        </View>

                        {/* Search */}
                        <View style={[styles.searchContainer, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder }]}>
                            <Feather name="search" size={20} color={themeColors.textMuted} />
                            <TextInput
                                style={[styles.searchInput, { color: themeColors.textPrimary }]}
                                placeholder="Search exercises..."
                                placeholderTextColor={themeColors.textMuted}
                                value={exerciseSearch}
                                onChangeText={setExerciseSearch}
                                autoCapitalize="none"
                            />
                            {exerciseSearch.length > 0 && (
                                <Pressable onPress={() => setExerciseSearch('')}>
                                    <Feather name="x-circle" size={18} color={themeColors.textMuted} />
                                </Pressable>
                            )}
                        </View>

                        {/* Create New Exercise - Sticky at top */}
                        {showCreateExercise ? (
                            <View style={[styles.createExerciseForm, { backgroundColor: themeColors.bgPrimary }]}>
                                <Text style={[styles.createExerciseTitle, { color: themeColors.textPrimary }]}>Create New Exercise</Text>
                                <TextInput
                                    style={[styles.createExerciseInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.textPrimary }]}
                                    placeholder="Exercise name"
                                    placeholderTextColor={themeColors.textMuted}
                                    value={newExerciseName}
                                    onChangeText={setNewExerciseName}
                                    autoCapitalize="words"
                                />
                                <TextInput
                                    style={[styles.createExerciseInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.textPrimary }]}
                                    placeholder="Muscle group (e.g., Chest, Back, Legs)"
                                    placeholderTextColor={themeColors.textMuted}
                                    value={newExerciseMuscle}
                                    onChangeText={setNewExerciseMuscle}
                                    autoCapitalize="words"
                                />
                                <TextInput
                                    style={[styles.createExerciseInput, styles.createExerciseTextArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.textPrimary }]}
                                    placeholder="Description (optional) - How to perform"
                                    placeholderTextColor={themeColors.textMuted}
                                    value={newExerciseDescription}
                                    onChangeText={setNewExerciseDescription}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                                <View style={styles.createExerciseButtons}>
                                    <Pressable
                                        style={[styles.createExerciseCancelBtn, { borderColor: themeColors.inputBorder }]}
                                        onPress={() => { setShowCreateExercise(false); setNewExerciseName(''); setNewExerciseMuscle(''); setNewExerciseDescription(''); }}
                                    >
                                        <Text style={[styles.createExerciseCancelText, { color: themeColors.textSecondary }]}>Cancel</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.createExerciseSaveBtn, { backgroundColor: userColors.accent_color }]}
                                        onPress={handleCreateNewExercise}
                                        disabled={addingExercise}
                                    >
                                        <Feather name="plus" size={16} color="#fff" />
                                        <Text style={styles.createExerciseSaveText}>{addingExercise ? 'Creating...' : 'Create & Add'}</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <Pressable
                                style={[styles.createExerciseBtn, { borderColor: userColors.accent_color }]}
                                onPress={() => { setShowCreateExercise(true); setNewExerciseName(exerciseSearch); }}
                            >
                                <Feather name="plus-circle" size={20} color={userColors.accent_color} />
                                <Text style={[styles.createExerciseBtnText, { color: userColors.accent_color }]}>
                                    {exerciseSearch.trim() ? `Create "${exerciseSearch}"` : 'Create New Exercise'}
                                </Text>
                            </Pressable>
                        )}

                        {/* Scrollable Exercise List */}
                        <ScrollView style={styles.exerciseList} showsVerticalScrollIndicator={true}>
                            {filteredExercises.map(ex => (
                                <Pressable
                                    key={ex.id}
                                    style={[styles.exerciseRow, { borderBottomColor: themeColors.glassBorder }]}
                                    onPress={() => handleAddExercise(ex.id)}
                                    disabled={addingExercise}
                                >
                                    <View style={styles.exerciseRowInfo}>
                                        <Text style={[styles.exerciseRowName, { color: themeColors.textPrimary }]}>{ex.name}</Text>
                                        <Text style={[styles.exerciseRowMuscle, { color: themeColors.textSecondary }]}>{ex.muscle_group}</Text>
                                    </View>
                                    <Feather name="plus" size={20} color={userColors.accent_color} />
                                </Pressable>
                            ))}

                            {filteredExercises.length === 0 && !showCreateExercise && (
                                <View style={styles.noResultsContainer}>
                                    <Feather name="search" size={40} color={themeColors.textMuted} />
                                    <Text style={[styles.noResultsText, { color: themeColors.textMuted }]}>No exercises found</Text>
                                    <Text style={[styles.noResultsSubtext, { color: themeColors.textTertiary }]}>Tap "Create New Exercise" above to add one</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirm Dialog */}
            <ConfirmDialog
                visible={showDeleteConfirm}
                title="Delete Workout"
                message="Are you sure you want to delete this workout? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
                onConfirm={handleDeleteWorkout}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            {/* Complete Confirm Dialog */}
            <ConfirmDialog
                visible={showCompleteConfirm}
                title={workout.is_completed ? 'Mark Incomplete' : 'Complete Workout'}
                message={
                    workout.is_completed
                        ? 'Mark this workout as incomplete?'
                        : 'Mark this workout as completed?'
                }
                confirmText={workout.is_completed ? 'Mark Incomplete' : 'Complete'}
                onConfirm={handleCompleteWorkout}
                onCancel={() => setShowCompleteConfirm(false)}
            />

            {/* Incomplete Warning Dialog */}
            <ConfirmDialog
                visible={showIncompleteWarning}
                title="Incomplete Sets"
                message={`Complete all sets first! You've finished ${completedSets.length} of ${totalSets} sets.`}
                confirmText="Got it"
                onConfirm={() => setShowIncompleteWarning(false)}
                onCancel={() => setShowIncompleteWarning(false)}
            />

            {/* Badge Earned Celebration */}
            {newBadge && (
                <Pressable style={styles.badgeOverlay} onPress={() => { setNewBadge(null); navigation.navigate('Main' as any, { screen: 'Home' }); }}>
                    <View style={[styles.badgeModal, { backgroundColor: themeColors.bgSecondary }]}>
                        <Text style={styles.badgeEmoji}>{newBadge.emoji}</Text>
                        <Text style={[styles.badgeUnlocked, { color: userColors.secondary_color }]}>
                            Achievement Unlocked!
                        </Text>
                        <Text style={[styles.badgeName, { color: themeColors.textPrimary }]}>
                            {newBadge.name}
                        </Text>
                        <Text style={[styles.badgeDescription, { color: themeColors.textSecondary }]}>
                            {newBadge.description}
                        </Text>
                        <Pressable
                            style={[styles.badgeButton, { backgroundColor: userColors.accent_color }]}
                            onPress={() => { setNewBadge(null); navigation.navigate('Main' as any, { screen: 'Home' }); }}
                        >
                            <Text style={styles.badgeButtonText}>Awesome!</Text>
                        </Pressable>
                    </View>
                </Pressable>
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    titleBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        gap: spacing.sm,
    },
    backButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleInfo: {
        flex: 1,
        alignItems: 'center',
    },
    titleText: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
    },
    dateText: {
        fontSize: typography.sizes.xs,
    },
    deleteButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: spacing.md,
        paddingBottom: spacing.sm,
    },
    colorBar: {
        height: 4,
        borderRadius: radii.full,
        marginBottom: spacing.md,
    },
    completedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radii.md,
        marginBottom: spacing.lg,
    },
    completedBannerText: {
        color: '#fff',
        fontWeight: typography.weights.medium,
    },
    exercisesList: {
        gap: 0,
        marginBottom: spacing.md,
    },
    addExerciseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginBottom: spacing.md,
    },
    addExerciseText: {
        color: '#c9a227',
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    emptyExercises: {
        padding: spacing.xl,
        borderRadius: radii.md,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.base,
    },
    completeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        minHeight: MIN_TOUCH_TARGET + 8,
        marginBottom: spacing.lg,
    },
    completeButtonText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        height: '90%',
        paddingBottom: spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        height: MIN_TOUCH_TARGET,
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.sizes.base,
    },
    exerciseList: {
        flex: 1,
    },
    createExerciseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    createExerciseBtnText: {
        color: '#c9a227',
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    createExerciseForm: {
        margin: spacing.md,
        padding: spacing.md,
        borderRadius: radii.md,
        gap: spacing.sm,
    },
    createExerciseTitle: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.xs,
    },
    createExerciseInput: {
        borderWidth: 1,
        borderRadius: radii.sm,
        padding: spacing.sm,
        fontSize: typography.sizes.sm,
    },
    createExerciseTextArea: {
        height: 70,
        textAlignVertical: 'top',
    },
    createExerciseButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    createExerciseCancelBtn: {
        flex: 1,
        padding: spacing.sm,
        borderRadius: radii.sm,
        borderWidth: 1,
        alignItems: 'center',
    },
    createExerciseCancelText: {
        fontSize: typography.sizes.sm,
    },
    createExerciseSaveBtn: {
        flex: 1,
        flexDirection: 'row',
        padding: spacing.sm,
        borderRadius: radii.sm,
        backgroundColor: '#c9a227',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    createExerciseSaveText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
    },
    exerciseRowInfo: {
        flex: 1,
    },
    exerciseRowName: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    exerciseRowMuscle: {
        fontSize: typography.sizes.xs,
        marginTop: 2,
    },
    noResultsContainer: {
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.sm,
    },
    noResultsText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    noResultsSubtext: {
        fontSize: typography.sizes.sm,
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    loadingText: {
        fontSize: typography.sizes.base,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
    },
    errorText: {
        fontSize: typography.sizes.base,
    },
    button: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        minHeight: MIN_TOUCH_TARGET,
    },
    buttonText: {
        color: '#fff',
        fontWeight: typography.weights.semibold,
    },
    badgeOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
    },
    badgeModal: {
        borderRadius: radii.xl,
        padding: spacing.xl,
        alignItems: 'center',
        maxWidth: 320,
        margin: spacing.md,
    },
    badgeEmoji: {
        fontSize: 80,
        marginBottom: spacing.md,
    },
    badgeUnlocked: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.xs,
    },
    badgeName: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        marginBottom: spacing.sm,
    },
    badgeDescription: {
        fontSize: typography.sizes.sm,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    badgeButton: {
        width: '100%',
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        alignItems: 'center',
        minHeight: MIN_TOUCH_TARGET,
    },
    badgeButtonText: {
        color: '#fff',
        fontWeight: typography.weights.semibold,
        fontSize: typography.sizes.base,
    },
});
