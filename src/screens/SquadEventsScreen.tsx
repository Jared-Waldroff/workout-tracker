import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSquadEvents, SquadEvent } from '../hooks/useSquadEvents';
import { useEventWorkouts } from '../hooks/useEventWorkouts';
import ScreenLayout from '../components/ScreenLayout';
import EventCard from '../components/EventCard';
import { spacing, radii, typography } from '../theme';
import { RootStackParamList } from '../navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = 'my_events' | 'discover';

export default function SquadEventsScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { themeColors, colors: userColors } = useTheme();
    const {
        myEvents,
        events,
        loading,
        loadEvents,
        joinEvent,
    } = useSquadEvents();
    const { getParticipantProgress } = useEventWorkouts();

    const [activeTab, setActiveTab] = useState<TabType>('my_events');
    const [refreshing, setRefreshing] = useState(false);
    const [eventProgress, setEventProgress] = useState<Record<string, { completed: number; total: number }>>({});

    // Refresh events when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadEvents();
        }, [loadEvents])
    );

    // Load progress for my events
    useEffect(() => {
        const loadProgress = async () => {
            const progressMap: Record<string, { completed: number; total: number }> = {};

            for (const event of myEvents) {
                const progress = await getParticipantProgress(event.id);
                // Find current user's progress
                const myProgress = progress.find(p => p.completed_workouts >= 0);
                if (myProgress) {
                    progressMap[event.id] = {
                        completed: myProgress.completed_workouts,
                        total: myProgress.total_workouts,
                    };
                }
            }

            setEventProgress(progressMap);
        };

        if (myEvents.length > 0) {
            loadProgress();
        }
    }, [myEvents, getParticipantProgress]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadEvents();
        setRefreshing(false);
    };

    const handleEventPress = (event: SquadEvent) => {
        navigation.navigate('EventDetail' as any, { id: event.id });
    };

    const handleJoinEvent = async (eventId: string) => {
        await joinEvent(eventId);
    };

    const handleCreateEvent = () => {
        navigation.navigate('CreateEvent' as any);
    };

    // Filter discover events (not in my events)
    const discoverEvents = events.filter(e => !e.is_participating && e.creator_id !== e.id);

    const renderEmptyState = () => {
        if (activeTab === 'my_events') {
            return (
                <View style={styles.emptyState}>
                    <View style={[styles.emptyIcon, { backgroundColor: `${userColors.accent_color}20` }]}>
                        <Feather name="calendar" size={48} color={userColors.accent_color} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                        No Events Yet
                    </Text>
                    <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                        Create an event for your squad or join an existing one to start training together.
                    </Text>
                    <Pressable
                        style={[styles.createButton, { backgroundColor: userColors.accent_color }]}
                        onPress={handleCreateEvent}
                    >
                        <Feather name="plus" size={20} color={themeColors.accentText} />
                        <Text style={[styles.createButtonText, { color: themeColors.accentText }]}>
                            Create Event
                        </Text>
                    </Pressable>
                </View>
            );
        }

        return (
            <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: `${userColors.accent_color}20` }]}>
                    <Feather name="search" size={48} color={userColors.accent_color} />
                </View>
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                    No Events to Discover
                </Text>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                    There are no public events available right now. Check back later or create your own!
                </Text>
            </View>
        );
    };

    return (
        <ScreenLayout hideHeader>
            {/* Tabs */}
            <View style={[styles.tabContainer, { borderBottomColor: themeColors.divider }]}>
                <Pressable
                    style={[
                        styles.tab,
                        activeTab === 'my_events' && [styles.activeTab, { borderBottomColor: userColors.accent_color }]
                    ]}
                    onPress={() => setActiveTab('my_events')}
                >
                    <Feather
                        name="user"
                        size={16}
                        color={activeTab === 'my_events' ? userColors.accent_color : themeColors.textMuted}
                    />
                    <Text style={[
                        styles.tabText,
                        { color: activeTab === 'my_events' ? userColors.accent_color : themeColors.textMuted }
                    ]}>
                        My Events
                    </Text>
                    {myEvents.length > 0 && (
                        <View style={[styles.badge, { backgroundColor: userColors.accent_color }]}>
                            <Text style={styles.badgeText}>{myEvents.length}</Text>
                        </View>
                    )}
                </Pressable>

                <Pressable
                    style={[
                        styles.tab,
                        activeTab === 'discover' && [styles.activeTab, { borderBottomColor: userColors.accent_color }]
                    ]}
                    onPress={() => setActiveTab('discover')}
                >
                    <Feather
                        name="compass"
                        size={16}
                        color={activeTab === 'discover' ? userColors.accent_color : themeColors.textMuted}
                    />
                    <Text style={[
                        styles.tabText,
                        { color: activeTab === 'discover' ? userColors.accent_color : themeColors.textMuted }
                    ]}>
                        Discover
                    </Text>
                </Pressable>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={userColors.accent_color} />
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={userColors.accent_color}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'my_events' ? (
                        myEvents.length > 0 ? (
                            <>
                                {myEvents.map(event => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        progress={eventProgress[event.id]}
                                        onPress={() => handleEventPress(event)}
                                    />
                                ))}
                            </>
                        ) : (
                            renderEmptyState()
                        )
                    ) : (
                        discoverEvents.length > 0 ? (
                            discoverEvents.map(event => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    onPress={() => handleEventPress(event)}
                                    onJoin={() => handleJoinEvent(event.id)}
                                />
                            ))
                        ) : (
                            renderEmptyState()
                        )
                    )}
                </ScrollView>
            )}

            {/* FAB */}
            <Pressable
                style={[styles.fab, { backgroundColor: userColors.accent_color }]}
                onPress={handleCreateEvent}
            >
                <Feather name="plus" size={24} color={themeColors.accentText} />
            </Pressable>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginHorizontal: spacing.md,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        gap: spacing.xs,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomWidth: 2,
    },
    tabText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    badge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#ffffff',
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.base,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.md,
        gap: spacing.xs,
    },
    createButtonText: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
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
});
