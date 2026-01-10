import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Modal,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useExercises } from '../hooks/useExercises';
import ScreenLayout from '../components/ScreenLayout';

const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
    'Core', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Full Body', 'Cardio', 'Other'
];

export default function ExercisesScreen() {
    const navigation = useNavigation();
    const { themeColors } = useTheme();
    const { groupedExercises, loading, createExercise, updateExercise, deleteExercise } = useExercises();

    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingExercise, setEditingExercise] = useState<any>(null);
    const [formName, setFormName] = useState('');
    const [formMuscleGroup, setFormMuscleGroup] = useState('Chest');
    const [saving, setSaving] = useState(false);

    // Filter exercises by search
    const filteredGroups = useMemo(() => {
        if (!groupedExercises) return {};
        return Object.entries(groupedExercises).reduce((acc: any, [group, exercises]: [string, any[]]) => {
            if (!search) {
                acc[group] = exercises;
            } else {
                const filtered = exercises.filter(e =>
                    e.name.toLowerCase().includes(search.toLowerCase())
                );
                if (filtered.length > 0) {
                    acc[group] = filtered;
                }
            }
            return acc;
        }, {});
    }, [groupedExercises, search]);

    const handleExercisePress = async (exercise: any) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        (navigation as any).navigate('ExerciseDetail', { exerciseId: exercise.id, exerciseName: exercise.name });
    };

    const handleAddPress = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingExercise(null);
        setFormName('');
        setFormMuscleGroup('Chest');
        setShowForm(true);
    };

    const handleEditPress = async (exercise: any) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingExercise(exercise);
        setFormName(exercise.name);
        setFormMuscleGroup(exercise.muscle_group || 'Other');
        setShowForm(true);
    };

    const handleDeletePress = async (exercise: any) => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            'Delete Exercise',
            `Are you sure you want to delete "${exercise.name}"? This will also remove it from any workouts.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteExercise(exercise.id);
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                },
            ]
        );
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            Alert.alert('Error', 'Please enter an exercise name');
            return;
        }

        setSaving(true);
        try {
            if (editingExercise) {
                await updateExercise(editingExercise.id, {
                    name: formName.trim(),
                    muscle_group: formMuscleGroup,
                });
            } else {
                await createExercise({
                    name: formName.trim(),
                    muscle_group: formMuscleGroup,
                });
            }
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowForm(false);
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ScreenLayout hideHeader>
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={themeColors.textPrimary} />
                    <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
                        Loading exercises...
                    </Text>
                </View>
            </ScreenLayout>
        );
    }

    return (
        <ScreenLayout hideHeader>
            {/* Header with Search and Add */}
            <View style={styles.header}>
                <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder }]}>
                    <Feather name="search" size={18} color={themeColors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: themeColors.textPrimary }]}
                        placeholder="Search exercises..."
                        placeholderTextColor={themeColors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {search.length > 0 && (
                        <Pressable onPress={() => setSearch('')}>
                            <Feather name="x" size={18} color={themeColors.textSecondary} />
                        </Pressable>
                    )}
                </View>
                <Pressable style={styles.addBtn} onPress={handleAddPress}>
                    <Feather name="plus" size={20} color="#fff" />
                </Pressable>
            </View>

            {/* Exercise List */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {Object.keys(filteredGroups).length === 0 ? (
                    <View style={styles.empty}>
                        <Feather name="inbox" size={48} color={themeColors.textMuted} />
                        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                            {search ? 'No exercises match your search' : 'No exercises yet'}
                        </Text>
                    </View>
                ) : (
                    Object.entries(filteredGroups).map(([group, exercises]: [string, any[]]) => (
                        <View key={group} style={styles.group}>
                            <Text style={[styles.groupTitle, { color: themeColors.textSecondary }]}>
                                {group}
                            </Text>
                            {exercises.map(exercise => (
                                <Pressable
                                    key={exercise.id}
                                    style={[styles.exerciseItem, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}
                                    onPress={() => handleExercisePress(exercise)}
                                >
                                    <View style={styles.exerciseInfo}>
                                        <Text style={[styles.exerciseName, { color: themeColors.textPrimary }]}>
                                            {exercise.name}
                                        </Text>
                                        {!exercise.is_default && (
                                            <View style={[styles.badge, { backgroundColor: themeColors.inputBg }]}>
                                                <Text style={[styles.badgeText, { color: themeColors.textSecondary }]}>Custom</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.exerciseActions}>
                                        {!exercise.is_default && (
                                            <>
                                                <Pressable
                                                    style={styles.actionBtn}
                                                    onPress={() => handleEditPress(exercise)}
                                                    hitSlop={8}
                                                >
                                                    <Feather name="edit-2" size={16} color={themeColors.textSecondary} />
                                                </Pressable>
                                                <Pressable
                                                    style={styles.actionBtn}
                                                    onPress={() => handleDeletePress(exercise)}
                                                    hitSlop={8}
                                                >
                                                    <Feather name="trash-2" size={16} color="#ef4444" />
                                                </Pressable>
                                            </>
                                        )}
                                        <Feather name="chevron-right" size={18} color={themeColors.textMuted} />
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    ))
                )}
                <View style={{ height: 24 }} />
            </ScrollView>

            {/* Add/Edit Exercise Modal */}
            <Modal visible={showForm} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: themeColors.bgSecondary }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                                {editingExercise ? 'Edit Exercise' : 'Add Exercise'}
                            </Text>
                            <Pressable onPress={() => setShowForm(false)}>
                                <Feather name="x" size={24} color={themeColors.textSecondary} />
                            </Pressable>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Exercise Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.textPrimary }]}
                                placeholder="e.g. Bench Press"
                                placeholderTextColor={themeColors.textMuted}
                                value={formName}
                                onChangeText={setFormName}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Muscle Group</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.muscleScroll}>
                                {MUSCLE_GROUPS.map(group => (
                                    <Pressable
                                        key={group}
                                        style={[
                                            styles.muscleChip,
                                            { borderColor: themeColors.glassBorder },
                                            formMuscleGroup === group && styles.muscleChipActive,
                                        ]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setFormMuscleGroup(group);
                                        }}
                                    >
                                        <Text style={[
                                            styles.muscleChipText,
                                            { color: formMuscleGroup === group ? '#c9a227' : themeColors.textSecondary },
                                        ]}>
                                            {group}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>

                        <Pressable
                            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>
                                    {editingExercise ? 'Update Exercise' : 'Create Exercise'}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        height: '100%',
    },
    addBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#1e3a5f',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 64,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
    },
    group: {
        marginBottom: 20,
    },
    groupTitle: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    exerciseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    exerciseInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '500',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    exerciseActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionBtn: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    muscleScroll: {
        marginHorizontal: -24,
        paddingHorizontal: 24,
    },
    muscleChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    muscleChipActive: {
        backgroundColor: 'rgba(201, 162, 39, 0.15)',
        borderColor: '#c9a227',
    },
    muscleChipText: {
        fontSize: 14,
        fontWeight: '500',
    },
    saveBtn: {
        height: 52,
        backgroundColor: '#1e3a5f',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
