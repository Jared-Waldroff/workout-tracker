import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Modal,
    Share,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import ScreenLayout from '../components/ScreenLayout';

interface Connection {
    id: string;
    following?: {
        id: string;
        email: string;
        athlete_profiles?: { display_name?: string; avatar_url?: string; bio?: string }[];
    };
    follower?: {
        id: string;
        email: string;
        athlete_profiles?: { display_name?: string; avatar_url?: string; bio?: string }[];
    };
}

interface SearchResult {
    user_id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
    is_private?: boolean;
}

export default function SquadScreen() {
    const navigation = useNavigation();
    const { themeColors } = useTheme();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<'squad' | 'followers' | 'requests'>('squad');
    const [following, setFollowing] = useState<Connection[]>([]);
    const [followers, setFollowers] = useState<Connection[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);

    const [showAddModal, setShowAddModal] = useState(false);
    const [inviteTab, setInviteTab] = useState<'search' | 'link'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [inviteCode, setInviteCode] = useState('');

    useEffect(() => {
        if (user) {
            loadConnections();
            loadInviteCode();
        }
    }, [user]);

    const loadConnections = async () => {
        setLoading(true);
        try {
            // Load people I follow (my squad)
            const { data: followingData } = await supabase
                .from('connections')
                .select(`
                    id, 
                    following:following_id (
                        id, 
                        email,
                        athlete_profiles (display_name, avatar_url, bio)
                    )
                `)
                .eq('follower_id', user?.id)
                .eq('status', 'accepted');

            // Load my followers
            const { data: followersData } = await supabase
                .from('connections')
                .select(`
                    id, 
                    follower:follower_id (
                        id, 
                        email,
                        athlete_profiles (display_name, avatar_url, bio)
                    )
                `)
                .eq('following_id', user?.id)
                .eq('status', 'accepted');

            // Load pending requests (people wanting to follow me)
            const { data: requestsData } = await supabase
                .from('connections')
                .select(`
                    id, 
                    follower:follower_id (
                        id, 
                        email,
                        athlete_profiles (display_name, avatar_url, bio)
                    )
                `)
                .eq('following_id', user?.id)
                .eq('status', 'pending');

            setFollowing(followingData || []);
            setFollowers(followersData || []);
            setPendingRequests(requestsData || []);
        } catch (err) {
            console.error('Error loading connections:', err);
        } finally {
            setLoading(false);
        }
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
            const { data } = await supabase
                .from('athlete_profiles')
                .select('user_id, username, display_name, avatar_url, is_private')
                .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
                .neq('user_id', user?.id)
                .limit(10);

            setSearchResults(data || []);
        } catch (err) {
            console.error('Error searching users:', err);
        } finally {
            setSearching(false);
        }
    };

    const handleFollow = async (userId: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const { error } = await supabase
                .from('connections')
                .insert({
                    follower_id: user?.id,
                    following_id: userId,
                    status: 'pending'
                });

            if (!error) {
                setSearchResults(prev => prev.filter(u => u.user_id !== userId));
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Request Sent', 'Your follow request has been sent!');
            }
        } catch (err) {
            console.error('Error following user:', err);
        }
    };

    const handleAcceptRequest = async (connectionId: string, userId: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await supabase
                .from('connections')
                .update({ status: 'accepted' })
                .eq('id', connectionId);

            await loadConnections();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('Error accepting request:', err);
        }
    };

    const handleRejectRequest = async (connectionId: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await supabase
                .from('connections')
                .delete()
                .eq('id', connectionId);

            await loadConnections();
        } catch (err) {
            console.error('Error rejecting request:', err);
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

    const renderMember = (connection: Connection, type: 'squad' | 'follower') => {
        const userData = type === 'squad' ? connection.following : connection.follower;
        const profile = userData?.athlete_profiles?.[0];
        const displayName = profile?.display_name || userData?.email?.split('@')[0] || 'Unknown';

        return (
            <Pressable
                key={connection.id}
                style={[styles.memberItem, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('AthleteProfile' as never, { userId: userData?.id } as never);
                }}
            >
                <View style={[styles.avatar, { backgroundColor: themeColors.inputBg }]}>
                    <Text style={[styles.avatarText, { color: themeColors.textPrimary }]}>
                        {getInitials(displayName)}
                    </Text>
                </View>
                <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: themeColors.textPrimary }]}>
                        {displayName}
                    </Text>
                    {profile?.bio && (
                        <Text style={[styles.memberBio, { color: themeColors.textSecondary }]} numberOfLines={1}>
                            {profile.bio}
                        </Text>
                    )}
                </View>
                <Feather name="chevron-right" size={20} color={themeColors.textMuted} />
            </Pressable>
        );
    };

    const renderRequest = (connection: Connection) => {
        const userData = connection.follower;
        const profile = userData?.athlete_profiles?.[0];
        const displayName = profile?.display_name || userData?.email?.split('@')[0] || 'Unknown';

        return (
            <View
                key={connection.id}
                style={[styles.memberItem, styles.requestItem, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}
            >
                <View style={[styles.avatar, { backgroundColor: themeColors.inputBg }]}>
                    <Text style={[styles.avatarText, { color: themeColors.textPrimary }]}>
                        {getInitials(displayName)}
                    </Text>
                </View>
                <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: themeColors.textPrimary }]}>
                        {displayName}
                    </Text>
                    <Text style={[styles.memberBio, { color: themeColors.textSecondary }]}>
                        Wants to join your Squad
                    </Text>
                </View>
                <View style={styles.requestActions}>
                    <Pressable
                        style={[styles.acceptBtn]}
                        onPress={() => handleAcceptRequest(connection.id, userData?.id || '')}
                    >
                        <Feather name="check" size={18} color="#fff" />
                    </Pressable>
                    <Pressable
                        style={[styles.rejectBtn, { backgroundColor: themeColors.inputBg }]}
                        onPress={() => handleRejectRequest(connection.id)}
                    >
                        <Feather name="x" size={18} color={themeColors.textSecondary} />
                    </Pressable>
                </View>
            </View>
        );
    };

    return (
        <ScreenLayout>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: themeColors.glassBorder }]}>
                <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Your Squad</Text>
                <Pressable style={styles.addBtn} onPress={() => { setShowAddModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Feather name="user-plus" size={20} color="#fff" />
                </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <Pressable
                    style={[styles.tab, activeTab === 'squad' && styles.tabActive]}
                    onPress={() => { setActiveTab('squad'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                    <Text style={[styles.tabText, activeTab === 'squad' && styles.tabTextActive]}>
                        Squad ({following.length})
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, activeTab === 'followers' && styles.tabActive]}
                    onPress={() => { setActiveTab('followers'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                    <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>
                        Followers ({followers.length})
                    </Text>
                </Pressable>
                {pendingRequests.length > 0 && (
                    <Pressable
                        style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
                        onPress={() => { setActiveTab('requests'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    >
                        <View style={styles.requestsBadge}>
                            <Text style={styles.requestsBadgeText}>{pendingRequests.length}</Text>
                        </View>
                        <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
                            Requests
                        </Text>
                    </Pressable>
                )}
            </View>

            {loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={themeColors.textPrimary} />
                    <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading Squad...</Text>
                </View>
            ) : (
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Squad Tab */}
                    {activeTab === 'squad' && (
                        following.length === 0 ? (
                            <View style={[styles.emptyCard, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}>
                                <Text style={styles.emptyEmoji}>👥</Text>
                                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Squad Members Yet</Text>
                                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                                    Add athletes to your Squad to see their workouts and compete together!
                                </Text>
                                <Pressable style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
                                    <Text style={styles.emptyBtnText}>Find Athletes</Text>
                                </Pressable>
                            </View>
                        ) : (
                            following.map(c => renderMember(c, 'squad'))
                        )
                    )}

                    {/* Followers Tab */}
                    {activeTab === 'followers' && (
                        followers.length === 0 ? (
                            <View style={[styles.emptyCard, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}>
                                <Text style={styles.emptyEmoji}>🏃</Text>
                                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Followers Yet</Text>
                                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                                    Share your invite link to grow your Squad!
                                </Text>
                                <Pressable style={styles.emptyBtn} onPress={shareInviteLink}>
                                    <Text style={styles.emptyBtnText}>Share Invite</Text>
                                </Pressable>
                            </View>
                        ) : (
                            followers.map(c => renderMember(c, 'follower'))
                        )
                    )}

                    {/* Requests Tab */}
                    {activeTab === 'requests' && pendingRequests.map(c => renderRequest(c))}

                    <View style={{ height: 24 }} />
                </ScrollView>
            )}

            {/* Add to Squad Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: themeColors.bgSecondary }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Add to Squad</Text>
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
                                <Feather name="search" size={16} color={inviteTab === 'search' ? '#c9a227' : themeColors.textSecondary} />
                                <Text style={[styles.inviteTabText, inviteTab === 'search' && styles.inviteTabTextActive]}>Search</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.inviteTab, inviteTab === 'link' && styles.inviteTabActive]}
                                onPress={() => setInviteTab('link')}
                            >
                                <Feather name="link" size={16} color={inviteTab === 'link' ? '#c9a227' : themeColors.textSecondary} />
                                <Text style={[styles.inviteTabText, inviteTab === 'link' && styles.inviteTabTextActive]}>Invite Link</Text>
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
                                                style={styles.followBtn}
                                                onPress={() => handleFollow(result.user_id)}
                                            >
                                                <Text style={styles.followBtnText}>
                                                    {result.is_private ? 'Request' : 'Add'}
                                                </Text>
                                            </Pressable>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {inviteTab === 'link' && (
                            <View style={styles.linkSection}>
                                {/* QR Code */}
                                <View style={styles.qrContainer}>
                                    {inviteCode ? (
                                        <View style={styles.qrWrapper}>
                                            <QRCode
                                                value={`https://hybrid.app/join/${inviteCode}`}
                                                size={180}
                                                color="#0a141f"
                                                backgroundColor="#fff"
                                            />
                                        </View>
                                    ) : (
                                        <ActivityIndicator color="#c9a227" />
                                    )}
                                    <Text style={[styles.qrHint, { color: themeColors.textSecondary }]}>
                                        Scan to join my Squad
                                    </Text>
                                </View>

                                {/* Invite Link */}
                                <Text style={[styles.linkLabel, { color: themeColors.textSecondary }]}>
                                    Or share your invite link
                                </Text>
                                <View style={[styles.linkBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder }]}>
                                    <Text style={[styles.linkText, { color: themeColors.textPrimary }]} numberOfLines={1}>
                                        https://.../{inviteCode || 'loading...'}
                                    </Text>
                                    <Pressable style={styles.copyBtn} onPress={copyInviteLink}>
                                        <Feather name="copy" size={18} color={themeColors.textSecondary} />
                                    </Pressable>
                                </View>
                                <Pressable style={styles.shareBtn} onPress={shareInviteLink}>
                                    <Feather name="share" size={18} color="#fff" />
                                    <Text style={styles.shareBtnText}>Share Invite</Text>
                                </Pressable>
                            </View>
                        )}
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    addBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#1e3a5f',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        gap: 4,
    },
    tabActive: {
        backgroundColor: 'rgba(201, 162, 39, 0.15)',
    },
    tabText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.6)',
    },
    tabTextActive: {
        color: '#c9a227',
        fontWeight: '600',
    },
    requestsBadge: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 20,
        alignItems: 'center',
    },
    requestsBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        padding: 16,
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
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    requestItem: {
        paddingRight: 8,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '600',
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 15,
        fontWeight: '600',
    },
    memberBio: {
        fontSize: 13,
        marginTop: 2,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 8,
    },
    acceptBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#10b981',
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
    emptyCard: {
        padding: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },
    emptyBtn: {
        backgroundColor: '#1e3a5f',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
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
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    inviteTabs: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    inviteTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    inviteTabActive: {
        backgroundColor: 'rgba(201, 162, 39, 0.15)',
    },
    inviteTabText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
    },
    inviteTabTextActive: {
        color: '#c9a227',
        fontWeight: '600',
    },
    searchSection: {},
    searchInput: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 12,
    },
    searchLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    searchLoadingText: {
        fontSize: 13,
    },
    searchResults: {
        maxHeight: 200,
    },
    searchResult: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        fontSize: 14,
        fontWeight: '600',
    },
    resultUsername: {
        fontSize: 12,
        marginTop: 2,
    },
    followBtn: {
        backgroundColor: '#1e3a5f',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
    },
    followBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 8,
    },
    qrWrapper: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
    },
    qrHint: {
        fontSize: 14,
        fontWeight: '500',
    },
    linkSection: {
        gap: 16,
    },
    linkLabel: {
        fontSize: 14,
    },
    linkBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingLeft: 16,
        paddingRight: 8,
        height: 48,
    },
    linkText: {
        flex: 1,
        fontSize: 14,
    },
    copyBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#1e3a5f',
        paddingVertical: 14,
        borderRadius: 12,
    },
    shareBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
});
