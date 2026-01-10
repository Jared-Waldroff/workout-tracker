import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Image,
    Dimensions,
    Modal,
    ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, radii, typography } from '../theme';
import { FeedPost, formatRelativeTime, formatDuration } from '../hooks/useActivityFeed';

import { FEELING_OPTIONS } from '../hooks/useEventWorkouts';
import WorkoutCard from './WorkoutCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FeedPostCardProps {
    post: FeedPost;
    onLfg: () => void;
    onComment: () => void;
    onUserPress?: (userId: string) => void;
    onEventPress?: (eventId: string) => void;
    isOwner?: boolean;
    onOptions?: () => void;
}

export default function FeedPostCard({
    post,
    onLfg,
    onComment,
    onUserPress,
    onEventPress,
    isOwner,
    onOptions,
}: FeedPostCardProps) {
    const { themeColors, colors: userColors } = useTheme();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageAspectRatio, setImageAspectRatio] = useState(1);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showWorkoutDetails, setShowWorkoutDetails] = useState(false);

    // Calculate aspect ratio for current image
    useEffect(() => {
        if (post.photo_urls && post.photo_urls.length > 0) {
            const currentUrl = post.photo_urls[currentImageIndex];
            Image.getSize(currentUrl, (width, height) => {
                setImageAspectRatio(width / height);
            }, (error) => {
                console.error('Failed to get image size:', error);
            });
        }
    }, [post.photo_urls, currentImageIndex]);

    // Get feeling emoji
    const feeling = FEELING_OPTIONS.find(f => f.id === post.completion?.feeling);

    // Format workout result
    const formatResult = () => {
        if (!post.completion) return null;

        const parts: string[] = [];

        if (post.completion.actual_value && post.completion.actual_unit) {
            parts.push(`${post.completion.actual_value} ${post.completion.actual_unit}`);
        }

        if (post.completion.actual_zone) {
            const zoneNum = post.completion.actual_zone.replace('zone', '');
            parts.push(`Zone ${zoneNum}`);
        }

        if (post.completion.duration_seconds) {
            parts.push(formatDuration(post.completion.duration_seconds));
        }

        return parts.length > 0 ? parts.join(' • ') : null;
    };

    const result = formatResult();
    const hasPhotos = post.photo_urls && post.photo_urls.length > 0;

    return (
        <View style={[styles.container, { backgroundColor: themeColors.bgSecondary }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.userInfo}
                    onPress={() => onUserPress?.(post.user_id)}
                >
                    {post.user?.avatar_url ? (
                        <Image
                            source={{ uri: post.user.avatar_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.bgTertiary }]}>
                            <Text style={[styles.avatarInitial, { color: themeColors.textSecondary }]}>
                                {post.user?.display_name?.[0]?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                    <View style={styles.userDetails}>
                        <Text style={[styles.userName, { color: themeColors.textPrimary }]}>
                            {post.user?.display_name || 'Unknown'}
                        </Text>
                        <View style={styles.headerMeta}>
                            <Text style={[styles.timeAgo, { color: themeColors.textMuted }]}>
                                {formatRelativeTime(post.created_at)}
                            </Text>
                            {post.event && (
                                <>
                                    <Text style={[styles.metaDot, { color: themeColors.textMuted }]}>•</Text>
                                    <Pressable onPress={() => onEventPress?.(post.event_id)}>
                                        <Text style={[styles.eventName, { color: userColors.accent_color }]}>
                                            {post.event.name}
                                        </Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    </View>
                </Pressable>

                {feeling && (
                    <View style={[styles.feelingBadge, { backgroundColor: `${feeling.color}20` }]}>
                        <Text style={styles.feelingEmoji}>{feeling.emoji}</Text>
                    </View>
                )}

                {isOwner && (
                    <Pressable
                        style={styles.optionsButton}
                        onPress={onOptions}
                        hitSlop={10}
                    >
                        <Feather name="more-horizontal" size={20} color={themeColors.textSecondary} />
                    </Pressable>
                )}
            </View>

            {/* Photos (Top) */}
            {hasPhotos && (
                <Pressable
                    style={[styles.photoContainer, { aspectRatio: imageAspectRatio }]}
                    onPress={() => setShowImageModal(true)}
                >
                    <Image
                        source={{ uri: post.photo_urls[currentImageIndex] }}
                        style={styles.photo}
                        resizeMode="cover"
                        onError={(e) => console.log('Image Load Error:', e.nativeEvent.error)}
                    />

                    {/* Photo counter */}
                    {post.photo_urls.length > 1 && (
                        <View style={[styles.photoCounter, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                            <Text style={styles.photoCounterText}>
                                {currentImageIndex + 1}/{post.photo_urls.length}
                            </Text>
                        </View>
                    )}

                    {/* Photo dots */}
                    {post.photo_urls.length > 1 && (
                        <View style={styles.photoDots}>
                            {post.photo_urls.map((_, index) => (
                                <Pressable
                                    key={index}
                                    style={[
                                        styles.photoDot,
                                        {
                                            backgroundColor: index === currentImageIndex
                                                ? '#ffffff'
                                                : 'rgba(255,255,255,0.5)'
                                        }
                                    ]}
                                    onPress={() => setCurrentImageIndex(index)}
                                />
                            ))}
                        </View>
                    )}
                </Pressable>
            )}

            {/* Caption (Middle) - Added padding */}
            {post.caption && (
                <Text style={[styles.caption, { color: themeColors.textPrimary, paddingTop: spacing.sm }]}>
                    {post.caption}
                </Text>
            )}

            {/* Workout Info (Bottom) */}
            {post.completion?.training_workout && (
                <View style={[
                    styles.workoutCard,
                    {
                        backgroundColor: themeColors.glassBg,
                        borderColor: themeColors.glassBorder,
                        borderWidth: 1,
                        padding: 0,
                        overflow: 'hidden'
                    }
                ]}>
                    {/* Color Bar */}
                    <View style={[
                        styles.colorBar,
                        { backgroundColor: post.completion.training_workout.color || userColors.accent_color }
                    ]} />

                    <View style={styles.workoutContent}>
                        <View style={styles.workoutHeader}>
                            <Text style={[styles.workoutName, { color: themeColors.textPrimary }]}>
                                {post.completion.training_workout.name}
                            </Text>
                            {post.completion.training_workout.target_zone && (
                                <View style={[styles.zoneBadge, { backgroundColor: '#ef4444' + '20' }]}>
                                    <Text style={[styles.zoneText, { color: '#ef4444' }]}>
                                        {post.completion.training_workout.target_zone.replace('zone', 'Zone ')}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {post.completion.training_workout.description && (
                            <Text style={[styles.description, { color: themeColors.textSecondary }]} numberOfLines={2}>
                                {post.completion.training_workout.description}
                            </Text>
                        )}

                        <View style={styles.statsRow}>
                            {result && (
                                <View style={styles.statItem}>
                                    <Feather name="check-circle" size={14} color={userColors.accent_color} />
                                    <Text style={[styles.statValue, { color: userColors.accent_color }]}>
                                        {result}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            )}

            {/* Regular Workout Linked Card (Simplified with Exercise List) */}
            {post.workout && (
                <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
                    <Pressable
                        style={[
                            styles.workoutAttachment,
                            {
                                backgroundColor: themeColors.glassBg,
                                borderColor: themeColors.glassBorder,
                                borderLeftColor: post.workout.color || userColors.accent_color
                            }
                        ]}
                        onPress={() => {
                            console.log('[FeedPostCard] Opening workout details, exercises:', post.workout?.workout_exercises?.length);
                            if (post.workout?.workout_exercises?.length) {
                                console.log('[FeedPostCard] First exercise sets:', JSON.stringify(post.workout.workout_exercises[0]));
                            }
                            setShowWorkoutDetails(true);
                        }}
                    >
                        <View style={styles.attachmentContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                                <Text style={[styles.attachmentTitle, { color: themeColors.textPrimary }]}>
                                    {post.workout.name}
                                </Text>
                                <Feather name="chevron-right" size={20} color={themeColors.textSecondary} />
                            </View>

                            {/* Exercise Summary List */}
                            {post.workout.workout_exercises && post.workout.workout_exercises.length > 0 ? (
                                <View style={{ gap: 4 }}>
                                    {post.workout.workout_exercises.slice(0, 3).map((we: any, idx: number) => (
                                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: post.workout?.color || userColors.accent_color }} />
                                            <Text style={{ fontSize: typography.sizes.sm, color: themeColors.textSecondary }} numberOfLines={1}>
                                                {we.exercise?.name}
                                            </Text>
                                        </View>
                                    ))}
                                    {post.workout.workout_exercises.length > 3 && (
                                        <Text style={{ fontSize: typography.sizes.xs, color: themeColors.textMuted, marginTop: 2 }}>
                                            +{post.workout.workout_exercises.length - 3} more
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <Text style={[styles.attachmentSubtitle, { color: themeColors.textSecondary }]}>
                                    View Workout Details
                                </Text>
                            )}
                        </View>
                    </Pressable>
                </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
                <Pressable
                    style={styles.actionButton}
                    onPress={onLfg}
                >
                    <View style={[
                        styles.lfgButton,
                        post.has_lfg && { backgroundColor: `${userColors.accent_color}20` }
                    ]}>
                        <Text style={styles.lfgEmoji}>🔥</Text>
                        <Text style={[
                            styles.lfgText,
                            { color: post.has_lfg ? userColors.accent_color : themeColors.textSecondary }
                        ]}>
                            LFG{post.lfg_count > 0 ? ` (${post.lfg_count})` : ''}
                        </Text>
                    </View>
                </Pressable>

                <Pressable
                    style={styles.actionButton}
                    onPress={onComment}
                >
                    <View style={styles.commentButton}>
                        <Feather name="message-circle" size={18} color={themeColors.textSecondary} />
                        <Text style={[styles.commentText, { color: themeColors.textSecondary }]}>
                            {post.comment_count > 0 ? post.comment_count : 'Comment'}
                        </Text>
                    </View>
                </Pressable>
            </View>

            {/* Image Modal */}
            <Modal
                visible={showImageModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowImageModal(false)}
            >
                <Pressable
                    style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.95)' }]}
                    onPress={() => setShowImageModal(false)}
                >
                    <View style={styles.modalContent}>
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                                setCurrentImageIndex(index);
                            }}
                        >
                            {post.photo_urls.map((url, index) => (
                                <Image
                                    key={index}
                                    source={{ uri: url }}
                                    style={styles.modalImage}
                                    resizeMode="contain"
                                />
                            ))}
                        </ScrollView>

                        <Pressable
                            style={styles.closeButton}
                            onPress={() => setShowImageModal(false)}
                        >
                            <Feather name="x" size={24} color="#ffffff" />
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Workout Details Modal */}
            <Modal
                visible={showWorkoutDetails}
                animationType="fade" // Changed to fade for standard overlay feel
                transparent
                onRequestClose={() => setShowWorkoutDetails(false)}
            >
                <Pressable
                    style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }]}
                    onPress={() => setShowWorkoutDetails(false)}
                >
                    <Pressable
                        style={[
                            styles.detailsModalContent,
                            {
                                backgroundColor: themeColors.bgSecondary,
                                margin: spacing.lg,
                                borderRadius: radii.xl,
                                maxHeight: '80%',
                                minHeight: undefined, // Let it adapt
                                flex: 0 // Prevents expanding to full height if not needed
                            }
                        ]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.detailsModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={[styles.detailsColorDot, { backgroundColor: post.workout?.color || userColors.accent_color }]} />
                                <Text style={[styles.detailsModalTitle, { color: themeColors.textPrimary }]}>
                                    {post.workout?.name}
                                </Text>
                            </View>
                            <Pressable onPress={() => setShowWorkoutDetails(false)}>
                                <Feather name="x" size={24} color={themeColors.textSecondary} />
                            </Pressable>
                        </View>

                        <ScrollView style={styles.detailsScrollView} showsVerticalScrollIndicator={false}>
                            {post.workout?.workout_exercises?.map((we: any, index: number) => (
                                <View key={index} style={[styles.detailsExerciseItem, { borderColor: themeColors.glassBorder }]}>
                                    <Text style={[styles.detailsExerciseName, { color: themeColors.textPrimary }]}>
                                        {we.exercise?.name}
                                    </Text>

                                    {/* Sets Display */}
                                    {we.sets && we.sets.length > 0 ? (
                                        <View style={styles.detailsSetsContainer}>
                                            <View style={styles.detailsSetHeader}>
                                                <Text style={[styles.detailsSetHeaderText, { color: themeColors.textSecondary, width: 40 }]}>Set</Text>
                                                <Text style={[styles.detailsSetHeaderText, { color: themeColors.textSecondary, flex: 1, textAlign: 'center' }]}>lbs</Text>
                                                <Text style={[styles.detailsSetHeaderText, { color: themeColors.textSecondary, flex: 1, textAlign: 'center' }]}>Reps</Text>
                                            </View>
                                            {we.sets.map((set: any, setIndex: number) => (
                                                <View key={set.id || setIndex} style={styles.detailsSetRow}>
                                                    <Text style={[styles.detailsSetText, { color: themeColors.textSecondary, width: 40 }]}>
                                                        {setIndex + 1}
                                                    </Text>
                                                    <Text style={[styles.detailsSetText, { color: themeColors.textPrimary, flex: 1, textAlign: 'center' }]}>
                                                        {String(set.weight || 0)}
                                                    </Text>
                                                    <Text style={[styles.detailsSetText, { color: themeColors.textPrimary, flex: 1, textAlign: 'center' }]}>
                                                        {String(set.reps || 0)}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text style={{ color: themeColors.textMuted, fontSize: typography.sizes.sm, marginTop: 4 }}>
                                            No sets recorded
                                        </Text>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal >
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: radii.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
    },
    userDetails: {
        marginLeft: spacing.sm,
        flex: 1,
    },
    userName: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    timeAgo: {
        fontSize: typography.sizes.sm,
    },
    metaDot: {
        marginHorizontal: spacing.xs,
        fontSize: typography.sizes.sm,
    },
    eventName: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    feelingBadge: {
        padding: spacing.xs,
        borderRadius: radii.full,
    },
    feelingEmoji: {
        fontSize: 20,
    },
    optionsButton: {
        padding: spacing.xs,
        marginLeft: spacing.sm,
    },
    workoutCard: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        borderRadius: radii.md,
    },
    colorBar: {
        height: 4,
        width: '100%',
    },
    workoutContent: {
        padding: spacing.md,
    },
    workoutHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    workoutName: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
        flex: 1,
    },
    zoneBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radii.sm,
    },
    zoneText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    description: {
        fontSize: typography.sizes.sm,
        marginBottom: spacing.sm,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    statValue: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    caption: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        fontSize: typography.sizes.base,
        lineHeight: 22,
    },
    photoContainer: {
        position: 'relative',
        width: '100%',
        backgroundColor: '#f0f0f0', // Visible background to debug layout size
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    photoCounter: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.sm,
    },
    photoCounterText: {
        color: '#ffffff',
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    photoDots: {
        position: 'absolute',
        bottom: spacing.md,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    photoDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: spacing.md,
    },
    actionButton: {
        flex: 1,
    },
    lfgButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        gap: spacing.xs,
    },
    lfgEmoji: {
        fontSize: 18,
    },
    lfgText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
    },
    commentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        gap: spacing.xs,
    },
    commentText: {
        fontSize: typography.sizes.base,
    },
    modalOverlay: {
        flex: 1,
        // backgroundColor removed here to allow overrides
        justifyContent: 'center',
    },
    modalContent: {
        flex: 1,
        justifyContent: 'center',
    },
    modalImage: {
        width: SCREEN_WIDTH,
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: spacing.md,
        padding: spacing.sm,
    },
    // New styles for simplified workout attachment
    workoutAttachment: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderLeftWidth: 4,
    },
    attachmentContent: {
        flex: 1,
    },
    attachmentTitle: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
        marginBottom: 2,
    },
    attachmentSubtitle: {
        fontSize: typography.sizes.sm,
    },
    // Workout Details Modal
    detailsModalContent: {
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        maxHeight: '80%',
        minHeight: '50%',
        padding: spacing.lg,
        paddingBottom: 40,
    },
    detailsModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    detailsModalTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    detailsColorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    detailsScrollView: {
        flex: 1,
    },
    detailsExerciseItem: {
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderRadius: radii.lg,
    },
    detailsExerciseName: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.sm,
    },
    detailsSetsContainer: {
        gap: 4,
    },
    detailsSetHeader: {
        flexDirection: 'row',
        paddingVertical: 4,
        marginBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    detailsSetHeaderText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
        textTransform: 'uppercase',
    },
    detailsSetRow: {
        flexDirection: 'row',
        paddingVertical: 4,
    },
    detailsSetText: {
        fontSize: typography.sizes.sm,
    },
});
