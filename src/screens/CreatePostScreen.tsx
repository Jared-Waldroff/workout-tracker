import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    Image,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Alert,
    Modal,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { usePostDraft } from '../context/PostDraftContext';
import { useActivityFeed, uploadFeedPhotos } from '../hooks/useActivityFeed';
import { useWorkouts } from '../hooks/useWorkouts';
import ScreenLayout from '../components/ScreenLayout';
import AppHeader from '../components/AppHeader';
import { spacing, radii, typography } from '../theme';

export default function CreatePostScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>(); // Cast to any to access params
    const { themeColors, colors: userColors } = useTheme();
    const { width } = useWindowDimensions();
    const { user } = useAuth();
    const { createPost } = useActivityFeed();
    const { getRecentCompletedWorkouts, loading: workoutsLoading } = useWorkouts();

    // Use context for draft state
    const {
        caption,
        setCaption,
        selectedPhotos,
        setSelectedPhotos,
        selectedWorkout,
        setSelectedWorkout,
        clearDraft
    } = usePostDraft();

    const [uploading, setUploading] = useState(false);

    // Workout selection modal
    const [showWorkoutModal, setShowWorkoutModal] = useState(false);
    const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);

    useEffect(() => {
        loadRecentWorkouts();
    }, []);

    const loadRecentWorkouts = async () => {
        const workouts = await getRecentCompletedWorkouts();
        setRecentWorkouts(workouts);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            // allowsEditing: false, // Default is false, ensures original aspect ratio
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            // Append new photos or replace? Instagram usually replaces main or adds to carousel.
            // For now, let's append to allow multiple.
            setSelectedPhotos([...selectedPhotos, ...result.assets]);
        }
    };

    const removePhoto = (index: number) => {
        const newPhotos = [...selectedPhotos];
        newPhotos.splice(index, 1);
        setSelectedPhotos(newPhotos);
    };

    const handlePost = async () => {
        if (!caption.trim() && selectedPhotos.length === 0 && !selectedWorkout) {
            Alert.alert('Empty Post', 'Please add a caption, photo, or workout to your post.');
            return;
        }

        try {
            setUploading(true);

            let photoUrls: string[] = [];
            if (selectedPhotos.length > 0) {
                const { urls, error } = await uploadFeedPhotos(
                    user?.id || 'anonymous',
                    selectedPhotos.map(asset => ({ uri: asset.uri, type: asset.type }))
                );

                if (error) throw new Error(error);
                photoUrls = urls;

            }

            const { error } = await createPost({
                caption: caption.trim(),
                photo_urls: photoUrls,
                workout_id: selectedWorkout?.id, // Pass linked workout ID
                event_id: route.params?.eventId, // Pass event ID if from event feed
            });

            if (error) {
                throw new Error(error);
            }

            // Clear draft on success
            clearDraft();
            navigation.goBack();

        } catch (err: any) {
            // For now, if it fails due to event_id, let's just show an alert
            // But primarily we want to build the UI first.
            Alert.alert('Error', err.message);
        } finally {
            setUploading(false);
        }
    };

    const renderWorkoutModal = () => (
        <Modal visible={showWorkoutModal} animationType="slide" transparent>
            <Pressable style={styles.modalOverlay} onPress={() => setShowWorkoutModal(false)}>
                <Pressable
                    style={[styles.modalContent, { backgroundColor: themeColors.bgSecondary }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                            Recent Workouts
                        </Text>
                        <Pressable onPress={() => setShowWorkoutModal(false)}>
                            <Feather name="x" size={24} color={themeColors.textSecondary} />
                        </Pressable>
                    </View>

                    {workoutsLoading ? (
                        <ActivityIndicator color={userColors.accent_color} />
                    ) : (
                        <FlatList
                            data={recentWorkouts}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={[styles.workoutItem, { borderColor: themeColors.glassBorder }]}
                                    onPress={() => {
                                        setSelectedWorkout(item);
                                        setShowWorkoutModal(false);
                                    }}
                                >
                                    <View>
                                        <Text style={[styles.workoutName, { color: themeColors.textPrimary }]}>
                                            {item.name}
                                        </Text>
                                        <Text style={[styles.workoutDate, { color: themeColors.textSecondary }]}>
                                            {new Date(item.scheduled_date).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    {item.color && (
                                        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                                    )}
                                </Pressable>
                            )}
                            ListEmptyComponent={
                                <Text style={{ color: themeColors.textMuted, textAlign: 'center', padding: 20 }}>
                                    No completed workouts found.
                                </Text>
                            }
                        />
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );

    const scrollViewRef = React.useRef<ScrollView>(null);
    const [inputLayoutY, setInputLayoutY] = useState(0);

    const handleInputFocus = () => {
        // Scroll to the input position with a bit of offset (e.g. 20px overlap)
        if (scrollViewRef.current) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: inputLayoutY, animated: true });
            }, 100); // Small delay for keyboard animation
        }
    };

    return (
        <ScreenLayout hideHeader>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
                <View style={{ flex: 1, paddingTop: 16 }}>

                    {/* Event Indicator (if applicable) */}
                    {(route.params?.eventName || selectedWorkout?.event_name) && (
                        <View style={styles.eventIndicator}>
                            <Feather name="calendar" size={14} color={userColors.accent_color} />
                            <Text style={[styles.eventIndicatorText, { color: userColors.accent_color }]}>
                                Posting to {route.params?.eventName || selectedWorkout?.event_name}
                            </Text>
                        </View>
                    )}

                    <ScrollView
                        ref={scrollViewRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 150 }}
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* 1. Photo Section (Top) */}
                        <View style={styles.photoSection}>
                            {selectedPhotos.length > 0 ? (
                                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.photoScrollView}>
                                    {selectedPhotos.map((asset, index) => (
                                        <View key={index} style={[styles.photoContainer, { width: width - (spacing.md * 2), height: width - (spacing.md * 2) }]}>
                                            <Image
                                                source={{ uri: asset.uri }}
                                                style={styles.photo}
                                            />
                                            <Pressable
                                                style={styles.removePhotoBtn}
                                                onPress={() => removePhoto(index)}
                                            >
                                                <Feather name="x" size={16} color="#fff" />
                                            </Pressable>
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <Pressable
                                    style={[
                                        styles.addPhotoPlaceholder,
                                        {
                                            backgroundColor: themeColors.inputBg,
                                            width: width - (spacing.md * 2),
                                            height: width - (spacing.md * 2)
                                        }
                                    ]}
                                    onPress={pickImage}
                                >
                                    <Feather name="plus" size={48} color={themeColors.textMuted} />
                                    <Text style={[styles.addPhotoText, { color: themeColors.textMuted }]}>Add Photo</Text>
                                </Pressable>
                            )}
                        </View>

                        {/* 2. Description (Caption) */}
                        <View
                            style={styles.inputContainer}
                            onLayout={(event) => setInputLayoutY(event.nativeEvent.layout.y)}
                        >
                            <TextInput
                                style={[styles.input, { color: themeColors.textPrimary }]}
                                placeholder="Write a caption..."
                                placeholderTextColor={themeColors.textSecondary}
                                multiline
                                value={caption}
                                onChangeText={setCaption}
                                autoFocus={false}
                                scrollEnabled={false}
                                onFocus={handleInputFocus}
                            />
                        </View>

                        {/* 3. Attach Workout */}
                        <View style={styles.workoutSection}>
                            {selectedWorkout ? (
                                <View style={[styles.workoutCard, { backgroundColor: themeColors.bgSecondary }]}>
                                    <View style={styles.workoutHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={[styles.colorDot, { backgroundColor: selectedWorkout.color || userColors.accent_color }]} />
                                            <Text style={[styles.workoutTitle, { color: themeColors.textPrimary }]}>
                                                {selectedWorkout.name}
                                            </Text>
                                        </View>
                                        <Pressable onPress={() => setSelectedWorkout(null)}>
                                            <Feather name="x" size={16} color={themeColors.textSecondary} />
                                        </Pressable>
                                    </View>
                                    <Text style={[styles.workoutDate, { color: themeColors.textSecondary }]}>
                                        Completed on {new Date(selectedWorkout.scheduled_date).toLocaleDateString()}
                                    </Text>
                                </View>
                            ) : (
                                <Pressable
                                    style={[styles.attachWorkoutItem, { borderTopColor: themeColors.glassBorder, borderBottomColor: themeColors.glassBorder }]}
                                    onPress={() => setShowWorkoutModal(true)}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={[styles.iconBox, { backgroundColor: themeColors.inputBg }]}>
                                            <Feather name="activity" size={20} color={userColors.accent_color} />
                                        </View>
                                        <Text style={[styles.attachText, { color: themeColors.textPrimary }]}>
                                            Attach Workout
                                        </Text>
                                    </View>
                                    <Feather name="chevron-right" size={20} color={themeColors.textSecondary} />
                                </Pressable>
                            )}
                        </View>

                    </ScrollView>

                    {/* Footer / Post Button */}
                    <View style={[styles.footer, { borderTopColor: themeColors.glassBorder }]}>
                        <Pressable
                            style={[styles.postBtn, { backgroundColor: !caption.trim() && !selectedWorkout && selectedPhotos.length === 0 ? themeColors.textMuted : userColors.accent_color }]}
                            onPress={handlePost}
                            disabled={(!caption.trim() && !selectedWorkout && selectedPhotos.length === 0) || uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.postBtnText}>Post</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {renderWorkoutModal()}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    eventIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        gap: 6,
    },
    eventIndicatorText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    photoSection: {
        padding: spacing.md,
        alignItems: 'center',
    },
    photoScrollView: {
        flexGrow: 0,
    },
    photoContainer: {
        marginRight: spacing.sm,
        borderRadius: radii.md,
        overflow: 'hidden',
        position: 'relative',
    },
    photo: {
        width: '100%',
        height: '100%',
        backgroundColor: '#eee',
    },
    addPhotoPlaceholder: {
        borderRadius: radii.md,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    addPhotoText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    inputContainer: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    input: {
        fontSize: typography.sizes.base,
        minHeight: 60,
    },
    workoutSection: {
        paddingHorizontal: spacing.md,
    },
    workoutCard: {
        padding: spacing.md,
        borderRadius: radii.lg,
    },
    workoutHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    workoutTitle: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.bold,
    },
    workoutDate: {
        fontSize: typography.sizes.sm,
    },
    colorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    attachWorkoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: 1,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    attachText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    removePhotoBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 4,
        borderRadius: 20,
    },
    footer: {
        padding: spacing.md,
        marginTop: 'auto',
        alignItems: 'flex-end',
    },
    postBtn: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: radii.full,
    },
    postBtnText: {
        color: '#fff',
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.base,
    },
    // Modal Styles (Unchanged)
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        maxHeight: '80%',
        minHeight: '50%',
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    workoutItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderRadius: radii.lg,
    },
    workoutName: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
        marginBottom: 2,
    },
});
