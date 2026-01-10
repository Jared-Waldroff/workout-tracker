import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Image as RNImage,
    Alert,
    Share,
    Modal,
    Animated,
    Dimensions,
    PanResponder,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSquadEvents, SquadEvent, TrainingWorkout, EVENT_TYPES } from '../hooks/useSquadEvents';
import { useEventWorkouts, ParticipantProgress } from '../hooks/useEventWorkouts';
import ScreenLayout from '../components/ScreenLayout';
import { spacing, radii, typography } from '../theme';
import { RootStackParamList } from '../navigation';
import { supabase } from '../lib/supabaseClient';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type EventDetailRouteProp = RouteProp<RootStackParamList, 'EventDetail'>;

type TabType = 'overview' | 'training';

export default function EventDetailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<EventDetailRouteProp>();
    const { user } = useAuth();
    const { themeColors, colors: userColors } = useTheme();
    const { getEventById, joinEvent, leaveEvent, getTrainingPlan, updateEvent } = useSquadEvents();
    const { getParticipantProgress } = useEventWorkouts();

    const [event, setEvent] = useState<SquadEvent | null>(null);
    const [trainingPlan, setTrainingPlan] = useState<TrainingWorkout[]>([]);
    const [participants, setParticipants] = useState<ParticipantProgress[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // Tab animation
    const tabs: TabType[] = ['overview', 'training'];
    const screenWidth = Dimensions.get('window').width;
    const tabWidth = (screenWidth - spacing.md * 2) / tabs.length;

    // PagerView animations for 1:1 finger tracking
    const positionAnim = useRef(new Animated.Value(0)).current;
    const offsetAnim = useRef(new Animated.Value(0)).current;
    const pagerRef = useRef<PagerView>(null);

    // Keep track of activeTab in a ref to avoid stale closures in PanResponder
    const activeTabRef = useRef<TabType>('overview');
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    const onPageScroll = React.useMemo(() =>
        Animated.event(
            [{ nativeEvent: { position: positionAnim, offset: offsetAnim } }],
            { useNativeDriver: false }
        ),
        []
    );

    // PanResponder for swipe gestures
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
                if (!isHorizontal) return false;

                if (activeTabRef.current === 'overview' && gestureState.dx > 50) {
                    return true;
                }
                return false;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (activeTabRef.current === 'overview' && gestureState.dx > 50) {
                    navigation.goBack();
                }
            },
        })
    ).current;

    // Handle tab press
    const handleTabPress = (tab: TabType) => {
        const index = tabs.indexOf(tab);
        setActiveTab(tab);
        pagerRef.current?.setPage(index);
    };

    const handlePageSelected = (e: any) => {
        const index = e.nativeEvent.position;
        setActiveTab(tabs[index]);
    };

    const loadEventData = useCallback(async () => {
        const eventData = await getEventById(route.params.id);
        setEvent(eventData);

        if (eventData) {
            const [plan, progress] = await Promise.all([
                getTrainingPlan(eventData.id),
                getParticipantProgress(eventData.id),
            ]);
            setTrainingPlan(plan);
            setParticipants(progress);
        }

        setLoading(false);
    }, [route.params.id, getEventById, getTrainingPlan, getParticipantProgress]);

    useEffect(() => {
        loadEventData();
    }, [loadEventData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadEventData();
        setRefreshing(false);
    };

    const handleJoin = async () => {
        if (!event) return;
        const result = await joinEvent(event.id);
        if (!result.error) {
            await loadEventData();
        }
    };

    const handleLeave = async () => {
        if (!event) return;
        Alert.alert(
            'Leave Event',
            'Are you sure you want to leave this event? Your progress will be preserved.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await leaveEvent(event.id);
                        if (!result.error) {
                            navigation.goBack();
                        }
                    }
                },
            ]
        );
    };

    const handleWorkoutPress = (workout: TrainingWorkout) => {
        if (!event) return;
        navigation.navigate('CompleteEventWorkout', {
            trainingWorkoutId: workout.id,
            eventId: event.id,
        });
    };

    const handleInvite = async () => {
        if (!event) return;

        let inviteLink = `https://hybrid.app/event/${event.id}`;
        if (event.invite_code) {
            inviteLink += `?code=${event.invite_code}`;
        }

        try {
            await Share.share({
                message: `Join me for ${event.name} on HYBRID! ${inviteLink}`,
                title: 'Join Event',
            });
        } catch (err) {
            console.log('Share error', err);
        }
    };

    const handleCreatePost = () => {
        if (!event) return;
        navigation.navigate('CreatePost', {
            eventId: event.id,
            eventName: event.name
        } as any); // Type assertion until nav types updated
    };

    const handleEditPlan = () => {
        if (!event) return;
        navigation.navigate('ManageEventPlan', {
            eventId: event.id,
            eventName: event.name,
            eventDate: event.event_date
        });
    };

    const handleUpdatePhoto = async () => {
        if (!event) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true, // Square crop on iOS, custom aspect on Android
            aspect: [16, 9],
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setUploadingPhoto(true);
            try {
                const asset = result.assets[0];
                const fileExt = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
                const fileName = `event-${event.id}-${Date.now()}.${fileExt}`;
                const filePath = `event-covers/${fileName}`;

                // Fetch the image and convert to arraybuffer (more reliable in React Native)
                const response = await fetch(asset.uri);
                const arrayBuffer = await response.arrayBuffer();

                console.log('Uploading to path:', filePath);
                console.log('ArrayBuffer size:', arrayBuffer.byteLength);

                // Upload to Supabase storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('activity-photos')
                    .upload(filePath, arrayBuffer, {
                        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                        upsert: true,
                    });

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    throw uploadError;
                }

                console.log('Upload success:', uploadData);

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('activity-photos')
                    .getPublicUrl(filePath);

                console.log('Public URL:', urlData.publicUrl);

                // Update event with new cover URL
                console.log('Calling updateEvent with:', { cover_image_url: urlData.publicUrl });
                const { error } = await updateEvent(event.id, {
                    cover_image_url: urlData.publicUrl,
                });

                console.log('updateEvent result - error:', error);

                if (error) {
                    Alert.alert('Error', error);
                } else {
                    console.log('Reloading event data...');
                    await loadEventData();
                    console.log('Event data reloaded, cover_image_url:', event?.cover_image_url);
                }
            } catch (err: any) {
                console.error('Upload error:', err);
                Alert.alert('Error', 'Failed to upload photo');
            } finally {
                setUploadingPhoto(false);
            }
        }
    };

    if (loading) {
        return (
            <ScreenLayout hideHeader>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={userColors.accent_color} />
                </View>
            </ScreenLayout>
        );
    }

    if (!event) {
        return (
            <ScreenLayout hideHeader>
                <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={48} color={themeColors.textMuted} />
                    <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
                        Event not found
                    </Text>
                </View>
            </ScreenLayout>
        );
    }

    // Calculate days until event
    const eventDate = new Date(event.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Get event type info
    const eventType = EVENT_TYPES.find(t => t.id === event.event_type) || EVENT_TYPES[EVENT_TYPES.length - 1];

    // Calculate overall progress
    const myProgress = participants.find(p => p.user_id === user?.id);
    const completedCount = trainingPlan.filter(w => w.is_completed).length;
    const progressPercent = trainingPlan.length > 0
        ? Math.round((completedCount / trainingPlan.length) * 100)
        : 0;

    const renderOverviewTab = () => (
        <View style={styles.tabContent}>
            {/* Progress Card */}
            {event.is_participating && (
                <View style={[styles.progressCard, { backgroundColor: themeColors.bgSecondary }]}>
                    <View style={styles.progressHeader}>
                        <Text style={[styles.progressTitle, { color: themeColors.textPrimary }]}>
                            Your Progress
                        </Text>
                        <Text style={[styles.progressPercent, { color: userColors.accent_color }]}>
                            {progressPercent}%
                        </Text>
                    </View>
                    <View style={[styles.progressBar, { backgroundColor: themeColors.bgTertiary }]}>
                        <View
                            style={[
                                styles.progressFill,
                                { backgroundColor: userColors.accent_color, width: `${progressPercent}%` }
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressStats, { color: themeColors.textSecondary }]}>
                        {completedCount} of {trainingPlan.length} workouts completed
                    </Text>
                </View>
            )}

            {/* Leaderboard */}
            <View style={[styles.section, { backgroundColor: themeColors.bgSecondary }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                    Leaderboard
                </Text>
                {participants.length > 0 ? (
                    participants.map((participant, index) => (
                        <View
                            key={participant.user_id}
                            style={[
                                styles.participantRow,
                                index < participants.length - 1 && { borderBottomWidth: 1, borderBottomColor: themeColors.divider }
                            ]}
                        >
                            <View style={styles.participantRank}>
                                <Text style={[styles.rankNumber, { color: themeColors.textMuted }]}>
                                    #{index + 1}
                                </Text>
                            </View>
                            {participant.avatar_url ? (
                                <RNImage
                                    source={{ uri: participant.avatar_url }}
                                    style={styles.participantAvatar}
                                />
                            ) : (
                                <View style={[styles.participantAvatarPlaceholder, { backgroundColor: themeColors.bgTertiary }]}>
                                    <Text style={[styles.avatarInitial, { color: themeColors.textSecondary }]}>
                                        {participant.display_name?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.participantInfo}>
                                <Text style={[styles.participantName, { color: themeColors.textPrimary }]}>
                                    {participant.display_name}
                                    {participant.user_id === user?.id && ' (You)'}
                                </Text>
                                <Text style={[styles.participantStats, { color: themeColors.textSecondary }]}>
                                    {participant.completed_workouts}/{participant.total_workouts} workouts
                                </Text>
                            </View>
                            <Text style={[styles.participantPercent, { color: userColors.accent_color }]}>
                                {participant.completion_percentage}%
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                        No participants yet
                    </Text>
                )}
            </View>
        </View>
    );

    const renderTrainingTab = () => (
        <View style={styles.tabContent}>
            {/* Creator Actions */}
            {event?.creator_id === user?.id && (
                <Pressable
                    style={[styles.actionButton, { backgroundColor: themeColors.bgSecondary, marginBottom: spacing.md }]}
                    onPress={handleEditPlan}
                >
                    <Feather name="plus-circle" size={20} color={userColors.accent_color} />
                    <Text style={[styles.actionButtonText, { color: userColors.accent_color }]}>
                        Manage Training Plan
                    </Text>
                </Pressable>
            )}

            {trainingPlan.length > 0 ? (
                trainingPlan.map((workout, index) => {
                    const workoutDate = new Date(workout.scheduled_date || '');
                    const isPast = workoutDate < today;
                    const isToday = workout.scheduled_date === today.toISOString().split('T')[0];

                    return (
                        <Pressable
                            key={workout.id}
                            style={[
                                styles.workoutCard,
                                { backgroundColor: themeColors.bgSecondary },
                                workout.is_completed && styles.completedWorkout,
                            ]}
                            onPress={() => handleWorkoutPress(workout)}
                        >
                            <View style={[styles.workoutColor, { backgroundColor: workout.color }]} />
                            <View style={styles.workoutContent}>
                                <View style={styles.workoutHeader}>
                                    <Text style={[styles.workoutName, { color: themeColors.textPrimary }]}>
                                        {workout.name}
                                    </Text>
                                    {workout.is_completed ? (
                                        <View style={[styles.completedBadge, { backgroundColor: '#10b98120' }]}>
                                            <Feather name="check" size={14} color="#10b981" />
                                        </View>
                                    ) : isToday ? (
                                        <View style={[styles.todayBadge, { backgroundColor: `${userColors.accent_color}20` }]}>
                                            <Text style={[styles.todayText, { color: userColors.accent_color }]}>Today</Text>
                                        </View>
                                    ) : null}
                                </View>

                                <Text style={[styles.workoutDate, { color: themeColors.textSecondary }]}>
                                    {workoutDate.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                    {isPast && !workout.is_completed && (
                                        <Text style={{ color: '#ef4444' }}> (Overdue)</Text>
                                    )}
                                </Text>

                                {(workout.target_value || workout.target_notes) && (
                                    <View style={styles.targetRow}>
                                        <Feather name="target" size={14} color={themeColors.textMuted} />
                                        <Text style={[styles.targetText, { color: themeColors.textMuted }]}>
                                            {workout.target_value && workout.target_unit
                                                ? `${workout.target_value} ${workout.target_unit}`
                                                : workout.target_notes
                                            }
                                            {workout.target_zone && ` • ${workout.target_zone.replace('zone', 'Zone ')}`}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Feather name="chevron-right" size={20} color={themeColors.textMuted} />
                        </Pressable>
                    );
                })
            ) : (
                <View style={styles.emptyState}>
                    <Feather name="clipboard" size={48} color={themeColors.textMuted} />
                    <Text style={[styles.emptyTitle, { color: themeColors.textSecondary }]}>
                        No Training Plan
                    </Text>
                    <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                        This event doesn't have a training plan yet.
                    </Text>
                </View>
            )}
        </View>
    );

    return (
        <ScreenLayout hideHeader>
            <View
                style={styles.container}
                collapsable={false}
                {...panResponder.panHandlers}
            >
                {/* Event Header */}
                <View style={[styles.header, { backgroundColor: themeColors.bgSecondary }]}>
                    {event.cover_image_url ? (
                        <ExpoImage
                            key={event.cover_image_url}
                            source={{ uri: event.cover_image_url }}
                            style={styles.coverImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={200}
                        />
                    ) : (
                        <View style={[styles.coverPlaceholder, { backgroundColor: `${userColors.accent_color}30` }]}>
                            <Feather name={eventType.icon as any} size={64} color={userColors.accent_color} />
                        </View>
                    )}

                    <View style={styles.headerContent}>
                        {/* Top row: Type badges + Action buttons */}
                        <View style={styles.headerTopRow}>
                            <View style={styles.typeBadges}>
                                <View style={[styles.typeBadge, { backgroundColor: `${userColors.accent_color}20` }]}>
                                    <Feather name={eventType.icon as any} size={14} color={userColors.accent_color} />
                                    <Text style={[styles.typeText, { color: userColors.accent_color }]}>
                                        {eventType.name}
                                    </Text>
                                </View>
                                {event.is_private && (
                                    <View style={[styles.privateBadge, { backgroundColor: themeColors.bgTertiary }]}>
                                        <Feather name="lock" size={12} color={themeColors.textSecondary} />
                                        <Text style={[styles.privateText, { color: themeColors.textSecondary }]}>Private</Text>
                                    </View>
                                )}
                            </View>

                            {/* Action buttons on right */}
                            <View style={styles.actionRow}>
                                {event.is_participating && (
                                    <View style={[styles.participatingBadge, { backgroundColor: `${userColors.accent_color}20` }]}>
                                        <Feather name="check-circle" size={14} color={userColors.accent_color} />
                                        <Text style={[styles.participatingText, { color: userColors.accent_color }]}>Joined</Text>
                                    </View>
                                )}
                                <Pressable
                                    style={[styles.shareButton, { backgroundColor: themeColors.bgTertiary }]}
                                    onPress={handleInvite}
                                >
                                    <Feather name="share" size={18} color={themeColors.textPrimary} />
                                </Pressable>
                                <Pressable
                                    style={[styles.menuButton, { backgroundColor: themeColors.bgTertiary }]}
                                    onPress={() => setShowMenu(true)}
                                >
                                    <Feather name="more-horizontal" size={20} color={themeColors.textPrimary} />
                                </Pressable>
                            </View>
                        </View>

                        <Text style={[styles.eventName, { color: themeColors.textPrimary }]}>
                            {event.name}
                        </Text>

                        {/* Event meta + Join button row */}
                        <View style={styles.metaJoinRow}>
                            <View style={styles.eventMeta}>
                                <View style={styles.metaItem}>
                                    <Feather name="calendar" size={16} color={themeColors.textSecondary} />
                                    <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                                        {eventDate.toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </Text>
                                </View>
                                <View style={styles.metaItem}>
                                    <Feather name="clock" size={16} color={daysUntil <= 7 ? '#ef4444' : themeColors.textSecondary} />
                                    <Text style={[
                                        styles.metaText,
                                        { color: daysUntil <= 7 ? '#ef4444' : themeColors.textSecondary }
                                    ]}>
                                        {daysUntil <= 0 ? 'Event passed' : `${daysUntil} days`}
                                    </Text>
                                </View>
                                <View style={styles.metaItem}>
                                    <Feather name="users" size={16} color={themeColors.textSecondary} />
                                    <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                                        {participants.length}
                                    </Text>
                                </View>
                            </View>

                            {/* Join button on right if not participating */}
                            {!event.is_participating && (
                                <Pressable
                                    style={[styles.joinButton, { backgroundColor: userColors.accent_color }]}
                                    onPress={handleJoin}
                                >
                                    <Feather name="plus" size={16} color={themeColors.accentText} />
                                    <Text style={[styles.joinButtonText, { color: themeColors.accentText }]}>
                                        Join
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>

                {/* Tabs with Animated Underline */}
                <View style={[styles.tabs, { borderBottomColor: themeColors.divider }]}>
                    {tabs.map((tab) => (
                        <Pressable
                            key={tab}
                            style={styles.tab}
                            onPress={() => handleTabPress(tab)}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: activeTab === tab ? userColors.accent_color : themeColors.textMuted }
                            ]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </Pressable>
                    ))}
                    <Animated.View
                        style={[
                            styles.tabUnderline,
                            {
                                width: tabWidth,
                                backgroundColor: userColors.accent_color,
                                transform: [{
                                    translateX: Animated.add(positionAnim, offsetAnim).interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, tabWidth],
                                    })
                                }],
                            }
                        ]}
                    />
                </View>

                {/* Swipeable Tab Content via PagerView */}
                <PagerView
                    ref={pagerRef}
                    style={{ flex: 1 }}
                    initialPage={0}
                    onPageSelected={handlePageSelected}
                    onPageScroll={onPageScroll}
                >
                    <View key="0" style={{ flex: 1 }}>
                        <ScrollView
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={handleRefresh}
                                    tintColor={userColors.accent_color}
                                />
                            }
                        >
                            {renderOverviewTab()}
                        </ScrollView>
                    </View>
                    <View key="1" style={{ flex: 1 }}>
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 100 }}
                        >
                            {renderTrainingTab()}
                        </ScrollView>
                    </View>
                </PagerView>
            </View>

            {/* 3-Dot Menu Modal */}
            <Modal
                visible={showMenu}
                transparent
                animationType="slide"
                onRequestClose={() => setShowMenu(false)}
            >
                <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
                    <View style={[styles.menuContent, { backgroundColor: themeColors.bgPrimary }]}>
                        <View style={[styles.menuHandle, { backgroundColor: themeColors.textMuted }]} />

                        {/* Leave Event (only if participating) */}
                        {event.is_participating && (
                            <Pressable
                                style={styles.menuOption}
                                onPress={() => {
                                    setShowMenu(false);
                                    handleLeave();
                                }}
                            >
                                <Feather name="log-out" size={20} color="#ef4444" />
                                <Text style={[styles.menuOptionText, { color: '#ef4444' }]}>Leave Event</Text>
                            </Pressable>
                        )}

                        {/* Edit Event (only if creator) */}
                        {event.creator_id === user?.id && (
                            <>
                                <Pressable
                                    style={styles.menuOption}
                                    onPress={() => {
                                        setShowMenu(false);
                                        handleUpdatePhoto();
                                    }}
                                >
                                    <Feather name="image" size={20} color={themeColors.textPrimary} />
                                    <Text style={[styles.menuOptionText, { color: themeColors.textPrimary }]}>Update Event Photo</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.menuOption}
                                    onPress={() => {
                                        setShowMenu(false);
                                        handleEditPlan();
                                    }}
                                >
                                    <Feather name="edit-2" size={20} color={themeColors.textPrimary} />
                                    <Text style={[styles.menuOptionText, { color: themeColors.textPrimary }]}>Manage Training Plan</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.menuOption}
                                    onPress={() => {
                                        setShowMenu(false);
                                        Alert.alert(
                                            'Delete Event',
                                            'Are you sure you want to delete this event? This cannot be undone.',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Delete',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        // TODO: Add deleteEvent to hook
                                                        navigation.goBack();
                                                    }
                                                },
                                            ]
                                        );
                                    }}
                                >
                                    <Feather name="trash-2" size={20} color="#ef4444" />
                                    <Text style={[styles.menuOptionText, { color: '#ef4444' }]}>Delete Event</Text>
                                </Pressable>
                            </>
                        )}

                        {/* Cancel */}
                        <Pressable
                            style={styles.menuOption}
                            onPress={() => setShowMenu(false)}
                        >
                            <Feather name="x" size={20} color={themeColors.textMuted} />
                            <Text style={[styles.menuOptionText, { color: themeColors.textMuted }]}>Cancel</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Loading Overlay for Photo Upload */}
            {uploadingPhoto && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={userColors.accent_color} />
                    <Text style={[styles.loadingText, { color: themeColors.textPrimary }]}>
                        Uploading photo...
                    </Text>
                </View>
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: spacing.xxl,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    errorText: {
        fontSize: typography.sizes.base,
    },
    header: {
        overflow: 'hidden',
    },
    coverImage: {
        width: '100%',
        height: 160,
    },
    coverPlaceholder: {
        width: '100%',
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    typeBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    typeRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        gap: spacing.xs,
    },
    typeText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    privateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.full,
        gap: 4,
    },
    privateText: {
        fontSize: typography.sizes.sm,
    },
    eventName: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        marginBottom: spacing.sm,
    },
    metaJoinRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    eventMeta: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    metaText: {
        fontSize: typography.sizes.sm,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: radii.md,
        gap: spacing.xs,
    },
    joinButtonText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
    },
    leaveButton: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
    },
    leaveButtonText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginHorizontal: spacing.md,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    tabText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    tabUnderline: {
        position: 'absolute',
        bottom: 0,
        height: 2,
        borderRadius: 1,
    },
    tabContentScrollView: {
        flex: 1,
    },
    tabContentInner: {
        flex: 1,
    },
    tabContent: {
        padding: spacing.md,
    },
    progressCard: {
        padding: spacing.md,
        borderRadius: radii.md,
        marginBottom: spacing.md,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    progressTitle: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    progressPercent: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressStats: {
        fontSize: typography.sizes.sm,
    },
    section: {
        padding: spacing.md,
        borderRadius: radii.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.md,
    },
    participantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        gap: spacing.sm,
    },
    participantRank: {
        width: 30,
    },
    rankNumber: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    participantAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    participantAvatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    participantInfo: {
        flex: 1,
    },
    participantName: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    participantStats: {
        fontSize: typography.sizes.sm,
    },
    participantPercent: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
    },
    workoutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radii.md,
        marginBottom: spacing.sm,
        overflow: 'hidden',
    },
    completedWorkout: {
        opacity: 0.7,
    },
    workoutColor: {
        width: 4,
        alignSelf: 'stretch',
    },
    workoutContent: {
        flex: 1,
        padding: spacing.md,
    },
    workoutHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    workoutName: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
        flex: 1,
    },
    completedBadge: {
        padding: 4,
        borderRadius: radii.full,
    },
    todayBadge: {
        paddingVertical: 2,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.sm,
    },
    todayText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    workoutDate: {
        fontSize: typography.sizes.sm,
        marginTop: 2,
    },
    targetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
        gap: 4,
    },
    targetText: {
        fontSize: typography.sizes.sm,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.medium,
        marginTop: spacing.md,
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    feedLoader: {
        marginTop: spacing.xl,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: radii.md,
        gap: spacing.sm,
    },
    actionButtonText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    inviteButton: {
        width: 44,
        height: 44,
        borderRadius: radii.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        marginLeft: spacing.xs,
    },
    fab: {
        position: 'absolute',
        right: spacing.md,
        bottom: spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    shareButton: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuButton: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    participatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        gap: spacing.xs,
    },
    participatingText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    // Menu modal styles
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    menuContent: {
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingBottom: spacing.xl,
    },
    menuHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginVertical: spacing.md,
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    menuOptionText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
});
