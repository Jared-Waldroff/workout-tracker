import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ScrollView,
    FlatList,
    ActivityIndicator,
    Modal,
    Share,
    Alert,
    RefreshControl,
    Image,
    PanResponder,
    Animated,
    Dimensions,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import ScreenLayout from '../components/ScreenLayout';
import FeedPostCard from '../components/FeedPostCard';
import EventCard from '../components/EventCard';
import { useActivityFeed, FeedPost } from '../hooks/useActivityFeed';
import { useSquadEvents, SquadEvent } from '../hooks/useSquadEvents';
import { useSquad, SquadMember } from '../hooks/useSquad';
import { spacing, radii, typography } from '../theme';
import { RootStackParamList } from '../navigation';
import { SquadStackParamList } from '../navigation';
// Combine or use partial types. 
// Ideally we want composite nav prop but for simplicity given strict errors: 
type NavigationProp = NativeStackNavigationProp<RootStackParamList & SquadStackParamList>;
type TabType = 'feed' | 'events' | 'members';

// Connection interface removed in favor of CrewMember
// interface Connection { ... }

interface SearchResult {
    user_id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
    is_private?: boolean;
}

export default function SquadScreen({ route }: any) {
    const navigation = useNavigation<NavigationProp>();
    const { themeColors, colors: userColors } = useTheme();
    const { user } = useAuth();

    // Main tab state
    const [activeTab, setActiveTab] = useState<TabType>('feed');

    // Handle initialTab param
    useEffect(() => {
        if (route?.params?.initialTab) {
            const tab = route.params.initialTab as TabType;
            if (tab === 'feed' || tab === 'events' || tab === 'members') {
                // Determine page index
                const pageIndex = tab === 'feed' ? 0 : tab === 'events' ? 1 : 2;
                // Wait a tick for ref to be ready if mounting
                setTimeout(() => {
                    pagerRef.current?.setPage(pageIndex);
                    setActiveTab(tab);
                }, 100);
            }
        }
    }, [route?.params?.initialTab]);

    // Handle Deep Link Invite
    useEffect(() => {
        if (route?.params?.inviteCode && user) {
            const code = route.params.inviteCode;
            // Verify code and prompt
            (async () => {
                try {
                    const { data, error } = await supabase.rpc('get_user_by_invite_code', { invite_code_input: code });
                    if (error) throw error;
                    if (data && data.length > 0) {
                        const inviter = data[0]; // { user_id, display_name, ... }
                        if (inviter.user_id === user.id) {
                            Alert.alert('Squad', 'You cannot join your own squad!');
                            return;
                        }

                        Alert.alert(
                            'Join Squad',
                            `Do you want to join ${inviter.display_name}'s Squad?`,
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Join',
                                    onPress: () => handleAddSquad(inviter.user_id)
                                }
                            ]
                        );
                    } else {
                        Alert.alert('Error', 'Invalid invite code.');
                    }
                } catch (err) {
                    console.error('Invite check failed:', err);
                    Alert.alert('Error', 'Failed to verify invite link.');
                }
            })();
            // Clear param to prevent loop? (Navigation preserves params unless replaced)
            // Maybe navigation.setParams({ inviteCode: undefined })?
            // navigation.setParams({ inviteCode: undefined });
        }
    }, [route?.params?.inviteCode, user]);

    // Squad state
    const [membersTab, setMembersTab] = useState<'squad' | 'requests'>('squad');
    const { squad, requests, loading: squadLoading, loadSquad, addSquadMember, acceptSquadRequest, removeSquadMember, searchUsers } = useSquad();
    // derived state for compatibility if needed, or used directly


    // Activity Feed
    const { feed, loading: feedLoading, loadFeed, toggleLfg, deletePost } = useActivityFeed();

    // Events
    const { myEvents, events, loading: eventsLoading, loadEvents, joinEvent } = useSquadEvents();

    // Search modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [inviteTab, setInviteTab] = useState<'search' | 'link'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [inviteCode, setInviteCode] = useState('');

    const [refreshing, setRefreshing] = useState(false);

    const pagerRef = useRef<PagerView>(null);
    const positionAnim = useRef(new Animated.Value(0)).current;
    const offsetAnim = useRef(new Animated.Value(0)).current;

    // Use ref for activeTab to avoid stale closures in PanResponder
    const activeTabRef = useRef<TabType>('feed');
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    // Swipe gesture to navigate to Settings or Previous screen
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
                if (!isHorizontal) return false;

                const currentTab = activeTabRef.current;

                // If on Feed (first tab) and swiping Right -> Capture to go to Coach
                if (currentTab === 'feed' && gestureState.dx > 50) {
                    return true;
                }

                // If on Members (last tab) and swiping Left -> Capture to go to Settings
                if (currentTab === 'members' && gestureState.dx < -50) {
                    return true;
                }

                return false;
            },
            onPanResponderRelease: (_, gestureState) => {
                const currentTab = activeTabRef.current;

                if (currentTab === 'feed' && gestureState.dx > 50) {
                    // @ts-ignore - Coach is in Main tab navigator
                    navigation.navigate('Main', { screen: 'Coach' });
                } else if (currentTab === 'members' && gestureState.dx < -50) {
                    // @ts-ignore - SettingsTab is in Main tab navigator
                    navigation.navigate('Main', { screen: 'SettingsTab' });
                }
            },
        })
    ).current;

    const handlePageSelected = (e: any) => {
        const index = e.nativeEvent.position;
        if (index === 0) setActiveTab('feed');
        else if (index === 1) setActiveTab('events');
        else if (index === 2) setActiveTab('members');
    };

    const handleTabPress = (tab: TabType) => {
        setActiveTab(tab);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (tab === 'feed') pagerRef.current?.setPage(0);
        else if (tab === 'events') pagerRef.current?.setPage(1);
        else if (tab === 'members') pagerRef.current?.setPage(2);
    };

    useEffect(() => {
        if (user) {
            loadInviteCode();
            loadFeed();
        }
    }, [user]);

    // Refresh feed when screen comes into focus
    // ... removed legacy focus effect


    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            loadSquad(),
            loadFeed(),
            loadEvents(),
        ]);
        setRefreshing(false);
    };

    const loadInviteCode = async () => {
        const { data } = await supabase
            .from('athlete_profiles')
            .select('invite_code')
            .eq('user_id', user?.id)
            .single();

        if (data?.invite_code) {
            setInviteCode(data.invite_code);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const results = await searchUsers(query);
            // Map RPC results to SearchResult interface
            setSearchResults(results.map((r: any) => ({
                user_id: r.user_id,
                username: r.username,
                display_name: r.display_name,
                avatar_url: r.avatar_url,
                is_private: false // Default to logic handled in hook
            })));
        } catch (err) {
            console.error('Error searching users:', err);
        } finally {
            setSearching(false);
        }
    };

    const handleAddSquad = async (userId: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const { error } = await addSquadMember(userId);

        if (!error) {
            setSearchResults(prev => prev.filter(u => u.user_id !== userId));
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Request Sent', 'Squad invitation sent!');
        } else {
            Alert.alert('Error', error);
        }
    };

    const handleAcceptRequest = async (id: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const { error } = await acceptSquadRequest(id);
        if (!error) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Alert.alert('Error', error);
        }
    };

    const handleRejectRequest = async (id: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const { error } = await removeSquadMember(id);
        if (error) {
            console.error('Error rejecting:', error);
        }
    };

    const shareInviteLink = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const inviteLink = `https://hybrid.app/join/${inviteCode}`;
        try {
            await Share.share({
                message: `Join my Squad on HYBRID! ${inviteLink}`,
                title: 'Join my Squad',
            });
        } catch (err) {
            console.log('Share cancelled');
        }
    };

    const copyInviteLink = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const inviteLink = `https://hybrid.app/join/${inviteCode}`;
        await Clipboard.setStringAsync(inviteLink);
        Alert.alert('Copied!', 'Invite link copied to clipboard');
    };

    const getInitials = (name?: string) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleEventPress = (event: SquadEvent) => {
        navigation.navigate('EventDetail', { id: event.id });
    };

    const handleJoinEvent = async (eventId: string) => {
        await joinEvent(eventId);
    };

    const handleCreateEvent = () => {
        navigation.navigate('CreateEvent');
    };

    const handleLfg = async (postId: string) => {
        await toggleLfg(postId);
    };

    const handlePostOptions = (post: FeedPost) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            'Post Options',
            'What would you like to do?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete Post',
                    style: 'destructive',
                    onPress: () => confirmDeletePost(post.id),
                },
            ]
        );
    };

    const confirmDeletePost = (postId: string) => {
        Alert.alert(
            'Delete Post',
            'Are you sure? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deletePost(postId);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                }
            ]
        );
    };

    // RENDER: Stats Bar


    // RENDER: Main Tabs
    const renderTabs = () => {
        const screenWidth = Dimensions.get('window').width;
        const tabWidth = screenWidth / 3;
        const translateX = Animated.add(positionAnim, offsetAnim).interpolate({
            inputRange: [0, 1, 2],
            outputRange: [0, tabWidth, tabWidth * 2],
        });

        return (
            <View style={[styles.tabsContainer, { borderBottomColor: themeColors.divider }]}>
                {(['feed', 'events', 'members'] as TabType[]).map(tab => (
                    <Pressable
                        key={tab}
                        style={styles.tab}
                        onPress={() => handleTabPress(tab)}
                    >
                        <Feather
                            name={tab === 'feed' ? 'activity' : tab === 'events' ? 'calendar' : 'users'}
                            size={18}
                            color={activeTab === tab ? userColors.accent_color : themeColors.textMuted}
                        />
                        <Text style={[
                            styles.tabText,
                            { color: activeTab === tab ? userColors.accent_color : themeColors.textMuted }
                        ]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </Pressable>
                ))}

                {/* Animated Underline */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: tabWidth,
                        height: 2,
                        backgroundColor: userColors.accent_color,
                        transform: [{ translateX }],
                    }}
                />
            </View>
        );
    };

    // RENDER: Feed Tab
    const renderFeedTab = () => {
        if (feedLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={userColors.accent_color} />
                </View>
            );
        }

        if (feed.length === 0) {
            return (
                <ScrollView
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={userColors.accent_color}
                        />
                    }
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                >
                    <View style={styles.emptyState}>
                        <View style={[styles.emptyIcon, { backgroundColor: `${userColors.accent_color}20` }]}>
                            <Feather name="activity" size={48} color={userColors.accent_color} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                            No Activity Yet
                        </Text>
                        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                            Activity from your squad will appear here. Follow athletes and join events to see their progress!
                        </Text>
                    </View>
                </ScrollView>
            );
        }

        return (
            <ScrollView
                style={styles.feedContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={userColors.accent_color}
                    />
                }
            >
                {feed.map(post => (
                    <FeedPostCard
                        key={post.id}
                        post={post}
                        onLfg={() => handleLfg(post.id)}
                        onComment={() => {/* TODO */ }}
                        isOwner={user?.id === post.user_id}
                        onOptions={() => handlePostOptions(post)}
                    />
                ))}
            </ScrollView>
        );
    };

    // RENDER: Events Tab
    const renderEventsTab = () => {
        if (eventsLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={userColors.accent_color} />
                </View>
            );
        }

        const discoverEvents = events.filter(e => !e.is_participating);

        return (
            <ScrollView
                style={styles.eventsContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.eventsContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={userColors.accent_color}
                    />
                }
            >
                {/* My Events Section */}
                {myEvents.length > 0 && (
                    <View style={styles.eventsSection}>
                        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                            My Events
                        </Text>
                        {myEvents.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onPress={() => handleEventPress(event)}
                            />
                        ))}
                    </View>
                )}

                {/* Discover Section */}
                <View style={styles.eventsSection}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                        Discover Events
                    </Text>
                    {discoverEvents.length > 0 ? (
                        discoverEvents.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onPress={() => handleEventPress(event)}
                                onJoin={() => handleJoinEvent(event.id)}
                            />
                        ))
                    ) : (
                        <Text style={[styles.noEventsText, { color: themeColors.textMuted }]}>
                            No public events available
                        </Text>
                    )}
                </View>
            </ScrollView>
        );
    };

    // RENDER: Members Tab
    const renderMembersTab = () => {
        const renderMember = (member: SquadMember) => {
            return (
                <Pressable
                    key={member.user_id}
                    style={[styles.memberItem, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate('AthleteProfile', { id: member.user_id });
                    }}
                >
                    <View style={[styles.avatar, { backgroundColor: themeColors.bgTertiary }]}>
                        {member.avatar_url ? (
                            <Image source={{ uri: member.avatar_url }} style={styles.avatarImage} />
                        ) : (
                            <Text style={[styles.avatarText, { color: themeColors.textPrimary }]}>
                                {getInitials(member.display_name)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: themeColors.textPrimary }]}>{member.display_name}</Text>
                        <Text style={[styles.memberBio, { color: themeColors.textSecondary }]}>@{member.username}</Text>
                    </View>
                    {/* Add Remove Option? For now just profile link */}
                    <Pressable
                        style={{ padding: 8 }}
                        onPress={() => {
                            Alert.alert('Remove Squad Member', `Allow ${member.display_name} to leave your squad?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => removeSquadMember(member.relationship_id) }
                            ]);
                        }}
                    >
                        <Feather name="user-x" size={20} color={themeColors.textMuted} />
                    </Pressable>
                </Pressable>
            );
        };

        const renderRequest = (request: SquadMember) => {
            return (
                <View key={request.relationship_id} style={[styles.requestItem, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}>
                    <View style={[styles.avatar, { backgroundColor: themeColors.bgTertiary }]}>
                        <Text style={[styles.avatarText, { color: themeColors.textPrimary }]}>
                            {getInitials(request.display_name)}
                        </Text>
                    </View>
                    <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: themeColors.textPrimary }]}>{request.display_name}</Text>
                        <Text style={[styles.requestLabel, { color: themeColors.textMuted }]}>wants to join your Squad</Text>
                    </View>
                    <View style={styles.requestActions}>
                        <Pressable
                            style={[styles.acceptBtn, { backgroundColor: userColors.accent_color }]}
                            onPress={() => handleAcceptRequest(request.relationship_id)}
                        >
                            <Feather name="check" size={18} color="#fff" />
                        </Pressable>
                        <Pressable
                            style={[styles.rejectBtn, { backgroundColor: themeColors.inputBg }]}
                            onPress={() => handleRejectRequest(request.relationship_id)}
                        >
                            <Feather name="x" size={18} color={themeColors.textSecondary} />
                        </Pressable>
                    </View>
                </View>
            );
        };

        if (squadLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={userColors.accent_color} />
                </View>
            );
        }

        return (
            <ScrollView
                style={styles.membersContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={userColors.accent_color}
                    />
                }
            >
                <View style={styles.membersContent}>
                    {/* Requests Section */}
                    {requests.length > 0 && (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary, marginBottom: 12, marginLeft: 4 }]}>
                                Requests ({requests.length})
                            </Text>
                            {requests.map(c => renderRequest(c))}
                        </View>
                    )}

                    {/* Squad List */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                            Squad Members ({squad.length})
                        </Text>
                    </View>

                    {squad.length > 0 ? (
                        squad.map(c => renderMember(c))
                    ) : (
                        <View style={styles.emptyMembers}>
                            <Text style={[styles.emptyMembersText, { color: themeColors.textMuted }]}>
                                Your Squad is empty.
                            </Text>
                            <Pressable
                                style={[styles.findAthletesBtn, { borderColor: userColors.accent_color }]}
                                onPress={() => setShowAddModal(true)}
                            >
                                <Feather name="user-plus" size={16} color={userColors.accent_color} />
                                <Text style={[styles.findAthletesBtnText, { color: userColors.accent_color }]}>
                                    Add Squad Members
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </ScrollView>
        );
    };

    return (
        <ScreenLayout hideHeader>
            <View style={{ flex: 1 }} {...panResponder.panHandlers}>
                {/* Stats Bar (Static) - Moved to Settings */
                    /* renderStatsBar() */
                }

                {/* Main Tabs (Static) */}
                {renderTabs()}

                {/* Tab Content (Pager) */}
                <PagerView
                    ref={pagerRef}
                    style={{ flex: 1 }}
                    initialPage={0}
                    onPageSelected={handlePageSelected}
                    onPageScroll={Animated.event(
                        [{ nativeEvent: { position: positionAnim, offset: offsetAnim } }],
                        { useNativeDriver: false }
                    )}
                >
                    <View key="1" style={{ flex: 1 }}>
                        {renderFeedTab()}
                    </View>
                    <View key="2" style={{ flex: 1 }}>
                        {renderEventsTab()}
                    </View>
                    <View key="3" style={{ flex: 1 }}>
                        {renderMembersTab()}
                    </View>
                </PagerView>

                {/* FAB - Create Event, Post, or Add Member */}
                <Pressable
                    style={[styles.fab, { backgroundColor: userColors.accent_color }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (activeTab === 'events') {
                            handleCreateEvent();
                        } else if (activeTab === 'members') {
                            setShowAddModal(true);
                        } else {
                            navigation.navigate('CreatePost');
                        }
                    }}
                >
                    <Feather name="plus" size={24} color="#fff" />
                </Pressable>

                {/* Add to Squad Modal */}
                <Modal visible={showAddModal} animationType="slide" transparent>
                    <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
                        <Pressable style={[styles.modalContent, { backgroundColor: themeColors.bgSecondary }]} onPress={(e) => e.stopPropagation()}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Find Athletes</Text>
                                <Pressable onPress={() => setShowAddModal(false)}>
                                    <Feather name="x" size={24} color={themeColors.textSecondary} />
                                </Pressable>
                            </View>

                            {/* Invite Tabs */}
                            <View style={styles.inviteTabs}>
                                <Pressable
                                    style={[styles.inviteTab, inviteTab === 'search' && styles.inviteTabActive]}
                                    onPress={() => setInviteTab('search')}
                                >
                                    <Feather name="search" size={16} color={inviteTab === 'search' ? userColors.accent_color : themeColors.textSecondary} />
                                    <Text style={[styles.inviteTabText, inviteTab === 'search' && { color: userColors.accent_color }]}>Search</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.inviteTab, inviteTab === 'link' && styles.inviteTabActive]}
                                    onPress={() => setInviteTab('link')}
                                >
                                    <Feather name="link" size={16} color={inviteTab === 'link' ? userColors.accent_color : themeColors.textSecondary} />
                                    <Text style={[styles.inviteTabText, inviteTab === 'link' && { color: userColors.accent_color }]}>Invite Link</Text>
                                </Pressable>
                            </View>

                            {inviteTab === 'search' && (
                                <View style={styles.searchSection}>
                                    <TextInput
                                        style={[styles.searchInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.textPrimary }]}
                                        placeholder="Search by username..."
                                        placeholderTextColor={themeColors.textMuted}
                                        value={searchQuery}
                                        onChangeText={handleSearch}
                                        autoCapitalize="none"
                                    />

                                    {searching && (
                                        <View style={styles.searchLoading}>
                                            <ActivityIndicator size="small" color={themeColors.textSecondary} />
                                            <Text style={[styles.searchLoadingText, { color: themeColors.textSecondary }]}>Searching...</Text>
                                        </View>
                                    )}

                                    <ScrollView style={styles.searchResults}>
                                        {searchResults.map(result => (
                                            <View key={result.user_id} style={[styles.searchResult, { borderBottomColor: themeColors.glassBorder }]}>
                                                <View style={[styles.avatar, { backgroundColor: themeColors.inputBg }]}>
                                                    <Text style={[styles.avatarText, { color: themeColors.textPrimary }]}>
                                                        {getInitials(result.display_name || result.username)}
                                                    </Text>
                                                </View>
                                                <View style={styles.resultInfo}>
                                                    <Text style={[styles.resultName, { color: themeColors.textPrimary }]}>
                                                        {result.display_name || result.username}
                                                    </Text>
                                                    {result.username && (
                                                        <Text style={[styles.resultUsername, { color: themeColors.textSecondary }]}>
                                                            @{result.username}
                                                        </Text>
                                                    )}
                                                </View>
                                                <Pressable
                                                    style={[styles.followBtn, { backgroundColor: userColors.accent_color }]}
                                                    onPress={() => handleAddSquad(result.user_id)}
                                                >
                                                    <Text style={styles.followBtnText}>Add</Text>
                                                </Pressable>
                                            </View>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {inviteTab === 'link' && (
                                <View style={styles.linkSection}>
                                    <View style={styles.qrContainer}>
                                        <QRCode
                                            value={`https://hybrid.app/join/${inviteCode || 'loading'}`}
                                            size={160}
                                            backgroundColor="transparent"
                                            color={themeColors.textPrimary}
                                        />
                                    </View>
                                    <View style={[styles.linkBox, { backgroundColor: themeColors.inputBg }]}>
                                        <Text style={[styles.linkText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                                            https://.../{inviteCode || 'loading...'}
                                        </Text>
                                        <Pressable style={styles.copyBtn} onPress={copyInviteLink}>
                                            <Feather name="copy" size={18} color={themeColors.textSecondary} />
                                        </Pressable>
                                    </View>
                                    <Pressable style={[styles.shareBtn, { backgroundColor: userColors.accent_color }]} onPress={shareInviteLink}>
                                        <Feather name="share" size={18} color="#fff" />
                                        <Text style={styles.shareBtnText}>Share Invite</Text>
                                    </Pressable>
                                </View>
                            )}
                        </Pressable>
                    </Pressable>
                </Modal>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    // Stats Bar
    statsBar: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    statNumber: {
        fontSize: typography.sizes.xl,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: typography.sizes.sm,
    },
    statDivider: {
        width: 1,
        height: 30,
    },
    requestsBadge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    requestsBadgeText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
    },
    // Tabs
    tabsContainer: {
        flexDirection: 'row' as const,
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        paddingVertical: spacing.md,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: typography.sizes.base,
        fontWeight: '500',
    },
    tabContent: {
        flex: 1,
        minHeight: 400,
    },
    // Loading & Empty
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyState: {
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
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    emptyText: {
        fontSize: typography.sizes.base,
        textAlign: 'center',
        lineHeight: 22,
    },
    // Feed Tab
    feedContainer: {
        flex: 1,
    },
    feedContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    // Events Tab
    eventsContainer: {
        flex: 1,
    },
    eventsContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    eventsSection: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: '600',
        marginBottom: spacing.md,
    },
    noEventsText: {
        fontSize: typography.sizes.base,
        textAlign: 'center',
        paddingVertical: spacing.lg,
    },
    // Members Tab
    membersContainer: {
        flex: 1,
    },
    subTabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginHorizontal: spacing.md,
    },
    subTab: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    subTabText: {
        fontSize: typography.sizes.sm,
        fontWeight: '500',
    },
    membersContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        marginBottom: spacing.sm,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontSize: typography.sizes.base,
        fontWeight: '600',
    },
    memberInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    memberName: {
        fontSize: typography.sizes.base,
        fontWeight: '500',
    },
    memberBio: {
        fontSize: typography.sizes.sm,
        marginTop: 2,
    },
    emptyMembers: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    emptyMembersText: {
        fontSize: typography.sizes.base,
        marginBottom: spacing.md,
    },
    findAthletesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: 6,
    },
    findAthletesBtnText: {
        fontSize: typography.sizes.base,
        fontWeight: '500',
    },
    // Requests
    requestItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        marginBottom: spacing.sm,
    },
    requestLabel: {
        fontSize: typography.sizes.sm,
    },
    requestActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    acceptBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rejectBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // FAB
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
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: '600',
    },
    inviteTabs: {
        flexDirection: 'row',
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    inviteTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        gap: 6,
    },
    inviteTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#c9a227',
    },
    inviteTabText: {
        fontSize: typography.sizes.base,
    },
    searchSection: {
        paddingHorizontal: spacing.md,
    },
    searchInput: {
        height: 48,
        borderRadius: radii.md,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        fontSize: typography.sizes.base,
    },
    searchLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    searchLoadingText: {
        fontSize: typography.sizes.sm,
    },
    searchResults: {
        maxHeight: 300,
    },
    searchResult: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    resultInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    resultName: {
        fontSize: typography.sizes.base,
        fontWeight: '500',
    },
    resultUsername: {
        fontSize: typography.sizes.sm,
    },
    followBtn: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radii.sm,
    },
    followBtnText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
    linkSection: {
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    qrContainer: {
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    linkBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        width: '100%',
        marginBottom: spacing.md,
    },
    linkText: {
        flex: 1,
        fontSize: typography.sizes.sm,
    },
    copyBtn: {
        padding: spacing.xs,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.md,
        gap: spacing.xs,
    },
    shareBtnText: {
        color: '#fff',
        fontSize: typography.sizes.base,
        fontWeight: '600',
    },
});
