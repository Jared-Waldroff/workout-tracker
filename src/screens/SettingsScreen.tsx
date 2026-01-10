import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Alert, Modal, TextInput, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { supabase } from '../lib/supabaseClient';
import { spacing, radii, typography, colors, presetThemes } from '../theme';
import ScreenLayout from '../components/ScreenLayout';

export default function SettingsScreen() {
    const { signOut, user } = useAuth();
    const { theme, toggleTheme, themeColors, colors: userColors, updateColors, showCF, updateShowCF, presetThemeId, updatePresetTheme } = useTheme();
    const { profile, updateProfile, fetchProfile, loading: profileLoading } = useAthleteProfile();
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [editingColor, setEditingColor] = useState<'primary' | 'secondary'>('primary');
    const [customColor, setCustomColor] = useState('');
    const [bio, setBio] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const [savingProfile, setSavingProfile] = useState(false);

    // Initialize bio and display name from profile
    useEffect(() => {
        if (profile) {
            setBio(profile.bio || '');
            setDisplayName(profile.display_name || '');
        }
    }, [profile]);

    // Photo picker handler
    const handlePickPhoto = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert('Permission Required', 'Please allow access to your photo library.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadPhoto(result.assets[0].uri);
        }
    };

    // Upload photo to Supabase
    const uploadPhoto = async (uri: string) => {
        if (!user) return;
        setUploadingPhoto(true);

        try {
            console.log('Starting photo upload...', uri);

            // Read the file as base64 for React Native compatibility
            const response = await fetch(uri);
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            const fileName = `${user.id}-${Date.now()}.jpg`;
            const filePath = `${user.id}/${fileName}`;

            console.log('Uploading to path:', filePath);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, uint8Array, {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                throw uploadError;
            }

            console.log('Upload successful:', uploadData);

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            console.log('Public URL:', publicUrl);

            const result = await updateProfile({ avatar_url: publicUrl });
            console.log('Profile update result:', result);

            // Refresh profile to show the new photo
            await fetchProfile();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            console.error('Error uploading photo:', err);
            Alert.alert('Upload Failed', err.message || 'Could not upload photo. Please try again.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // Save profile changes
    const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
            await updateProfile({
                display_name: displayName,
                bio: bio,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', 'Could not save profile.');
        } finally {
            setSavingProfile(false);
        }
    };

    // Get preset theme array from presetThemes object
    const presetThemeArray = Object.values(presetThemes);

    // Color palette for custom picker
    const COLOR_PALETTE = [
        '#1e3a5f', '#0f766e', '#166534', '#3b82f6', '#6366f1',
        '#7c3aed', '#a855f7', '#ec4899', '#f43f5e', '#ef4444',
        '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#14b8a6', '#06b6d4', '#0ea5e9', '#64748b', '#c9a227',
        '#0a141f', '#0a1929', '#0d1f12', '#1f0f0a', '#140a1f', // Dark backgrounds
        '#1a1a1a', '#f8f9fc', '#faf8f3', '#ffffff', '#000000', // Light/dark extras
    ];

    // Helper to check if color is light (for text contrast)
    const isLightColor = (hex: string) => {
        if (!hex || hex.length < 7) return false;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5;
    };

    const handlePresetSelect = async (themeId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        updatePresetTheme(themeId);
    };

    const openColorPicker = (colorType: 'primary' | 'secondary') => {
        setEditingColor(colorType);
        if (colorType === 'primary') {
            setCustomColor(userColors.accent_color);
        } else {
            setCustomColor(userColors.secondary_color);
        }
        setShowCustomPicker(true);
    };

    const handleColorSelect = (color: string) => {
        setCustomColor(color);
    };

    const handleCustomColorApply = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (editingColor === 'primary') {
            await updateColors({ accent_color: customColor });
        } else {
            await updateColors({ secondary_color: customColor });
        }
        setShowCustomPicker(false);
    };

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        await signOut();
                    },
                },
            ]
        );
    };

    const SettingsRow = ({
        icon,
        label,
        value,
        onPress,
        showChevron = true,
    }: {
        icon: keyof typeof Feather.glyphMap;
        label: string;
        value?: string;
        onPress?: () => void;
        showChevron?: boolean;
    }) => (
        <Pressable
            style={[styles.settingsRow, { backgroundColor: themeColors.inputBg }]}
            onPress={onPress}
            disabled={!onPress}
        >
            <View style={styles.settingsRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: userColors.accent_color }]}>
                    <Feather name={icon} size={18} color="#fff" />
                </View>
                <Text style={[styles.settingsLabel, { color: themeColors.textPrimary }]}>{label}</Text>
            </View>
            <View style={styles.settingsRowRight}>
                {value && (
                    <Text style={[styles.settingsValue, { color: themeColors.textSecondary }]}>{value}</Text>
                )}
                {showChevron && onPress && (
                    <Feather name="chevron-right" size={20} color={themeColors.textMuted} />
                )}
            </View>
        </Pressable>
    );

    return (
        <ScreenLayout hideHeader>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Profile Section */}
                <View style={[styles.section, styles.profileSection, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>PROFILE</Text>

                    {/* Avatar */}
                    <View style={styles.avatarSection}>
                        <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto}>
                            <View style={[styles.avatarContainer, { borderColor: userColors.accent_color }]}>
                                {profile?.avatar_url ? (
                                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                                ) : (
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.inputBg }]}>
                                        <Feather name="user" size={40} color={themeColors.textMuted} />
                                    </View>
                                )}
                                {uploadingPhoto && (
                                    <View style={styles.uploadingOverlay}>
                                        <ActivityIndicator color="#fff" />
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.changePhotoText, { color: userColors.accent_color }]}>
                                {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                            </Text>
                        </Pressable>
                    </View>

                    {/* Display Name */}
                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Display Name</Text>
                    <TextInput
                        style={[styles.textInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.inputBorder }]}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Your name"
                        placeholderTextColor={themeColors.textMuted}
                    />

                    {/* Bio */}
                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary, marginTop: spacing.md }]}>Bio</Text>
                    <TextInput
                        style={[styles.textInput, styles.bioInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.inputBorder }]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell others about yourself..."
                        placeholderTextColor={themeColors.textMuted}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />

                    {/* Save Button */}
                    <Pressable
                        style={[styles.saveButton, { backgroundColor: userColors.accent_color }]}
                        onPress={handleSaveProfile}
                        disabled={savingProfile}
                    >
                        {savingProfile ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>Save Profile</Text>
                        )}
                    </Pressable>
                </View>
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Account</Text>
                    <View style={styles.sectionContent}>
                        <SettingsRow icon="mail" label="Email" value={user?.email} showChevron={false} />
                    </View>
                </View>

                {/* Appearance Section - Dark Mode */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Appearance</Text>
                    <View style={styles.sectionContent}>
                        <View style={[styles.settingsRow, { backgroundColor: themeColors.inputBg }]}>
                            <View style={styles.settingsRowLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: userColors.accent_color }]}>
                                    <Feather name="moon" size={18} color="#fff" />
                                </View>
                                <Text style={[styles.settingsLabel, { color: themeColors.textPrimary }]}>
                                    Dark Mode
                                </Text>
                            </View>
                            <Switch
                                value={theme === 'dark'}
                                onValueChange={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    toggleTheme();
                                }}
                                trackColor={{ false: themeColors.inputBorder, true: userColors.accent_color }}
                                ios_backgroundColor={themeColors.inputBorder}
                            />
                        </View>
                    </View>
                </View>

                {/* App Colors Section */}
                <View style={[styles.section, styles.colorSection, { backgroundColor: themeColors.glassBg, borderColor: themeColors.glassBorder }]}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>APP COLORS</Text>

                    {/* Preset Themes */}
                    <Text style={[styles.subsectionTitle, { color: themeColors.textPrimary }]}>Preset Themes</Text>
                    <View style={styles.presetGrid}>
                        {presetThemeArray.map((preset) => (
                            <Pressable
                                key={preset.id}
                                style={[
                                    styles.presetItem,
                                    presetThemeId === preset.id && styles.presetItemSelected,
                                ]}
                                onPress={() => handlePresetSelect(preset.id)}
                            >
                                <LinearGradient
                                    colors={[preset.primary, preset.secondary]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[
                                        styles.presetGradient,
                                        presetThemeId === preset.id && styles.presetGradientSelected,
                                    ]}
                                />
                                <Text style={[styles.presetLabel, { color: themeColors.textSecondary }]}>
                                    {preset.name.toUpperCase()}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Custom Colors */}
                    <Text style={[styles.subsectionTitle, { color: themeColors.textPrimary, marginTop: spacing.lg }]}>Customize Colors</Text>
                    <Text style={[styles.colorHint, { color: themeColors.textMuted }]}>Tap a color to customize it</Text>
                    <View style={styles.customColorsRow}>
                        <View style={styles.customColorItem}>
                            <Text style={[styles.customColorLabel, { color: themeColors.textSecondary }]}>Primary</Text>
                            <Pressable
                                style={[styles.customColorSwatch, { backgroundColor: userColors.accent_color }]}
                                onPress={() => openColorPicker('primary')}
                            />
                        </View>
                        <View style={styles.customColorItem}>
                            <Text style={[styles.customColorLabel, { color: themeColors.textSecondary }]}>Secondary</Text>
                            <Pressable
                                style={[styles.customColorSwatch, { backgroundColor: userColors.secondary_color }]}
                                onPress={() => openColorPicker('secondary')}
                            />
                        </View>
                    </View>

                    {/* Preview */}
                    <Text style={[styles.subsectionTitle, { color: themeColors.textPrimary, marginTop: spacing.lg }]}>Preview</Text>
                    <LinearGradient
                        colors={[userColors.accent_color, userColors.secondary_color]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.previewButton}
                    >
                        <Text style={styles.previewText}>Your Theme</Text>
                    </LinearGradient>
                </View>

                {/* Features Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Features</Text>
                    <View style={styles.sectionContent}>
                        {/* CrossFit Toggle */}
                        <View style={[styles.settingsRow, { backgroundColor: themeColors.inputBg }]}>
                            <View style={styles.settingsRowLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: '#1e3a5f', borderWidth: 1, borderColor: '#c9a227' }]}>
                                    <Text style={{ color: '#c9a227', fontWeight: '700', fontSize: 10 }}>CF</Text>
                                </View>
                                <View>
                                    <Text style={[styles.settingsLabel, { color: themeColors.textPrimary }]}>
                                        CrossFit Workouts
                                    </Text>
                                    <Text style={[styles.settingsSubLabel, { color: themeColors.textMuted }]}>
                                        Show CrossFit Open button on home
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={showCF}
                                onValueChange={(value) => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    updateShowCF(value);
                                }}
                                trackColor={{ false: themeColors.inputBorder, true: '#c9a227' }}
                                ios_backgroundColor={themeColors.inputBorder}
                            />
                        </View>

                        {/* Private Profile Toggle */}
                        <View style={[styles.settingsRow, { backgroundColor: themeColors.inputBg }]}>
                            <View style={styles.settingsRowLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: userColors.accent_color }]}>
                                    <Feather name="lock" size={18} color="#fff" />
                                </View>
                                <View>
                                    <Text style={[styles.settingsLabel, { color: themeColors.textPrimary }]}>
                                        Private Profile
                                    </Text>
                                    <Text style={[styles.settingsSubLabel, { color: themeColors.textMuted }]}>
                                        Hide workouts from followers
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={profile?.is_private ?? false}
                                onValueChange={(value) => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    updateProfile({ is_private: value });
                                }}
                                trackColor={{ false: themeColors.inputBorder, true: userColors.accent_color }}
                                ios_backgroundColor={themeColors.inputBorder}
                            />
                        </View>
                    </View>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Account</Text>
                    <View style={styles.sectionContent}>
                        <Pressable
                            style={[styles.settingsRow, styles.dangerRow, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                            onPress={handleSignOut}
                        >
                            <View style={styles.settingsRowLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: colors.error }]}>
                                    <Feather name="log-out" size={18} color="#fff" />
                                </View>
                                <Text style={[styles.settingsLabel, { color: colors.error }]}>Sign Out</Text>
                            </View>
                            <Feather name="chevron-right" size={20} color={colors.error} />
                        </Pressable>
                    </View>
                </View>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={[styles.appName, { color: themeColors.textMuted }]}>Workout Tracker</Text>
                    <Text style={[styles.appVersion, { color: themeColors.textMuted }]}>Version 1.0.0</Text>
                </View>
            </ScrollView>

            {/* Custom Color Picker Modal */}
            <Modal
                visible={showCustomPicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCustomPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: themeColors.bgSecondary }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Custom Colors</Text>
                            <Pressable onPress={() => setShowCustomPicker(false)}>
                                <Feather name="x" size={24} color={themeColors.textSecondary} />
                            </Pressable>
                        </View>

                        {/* Color Picker Title */}
                        <Text style={[styles.modalSectionTitle, { color: themeColors.textPrimary }]}>
                            Select {editingColor.charAt(0).toUpperCase() + editingColor.slice(1)} Color
                        </Text>

                        {/* Color Palette */}
                        <View style={styles.paletteGrid}>
                            {COLOR_PALETTE.map((color) => (
                                <Pressable
                                    key={`color-${color}`}
                                    style={[
                                        styles.paletteColor,
                                        { backgroundColor: color },
                                        customColor === color && styles.paletteColorSelected,
                                    ]}
                                    onPress={() => handleColorSelect(color)}
                                >
                                    {customColor === color && <Feather name="check" size={16} color="#fff" />}
                                </Pressable>
                            ))}
                        </View>

                        {/* Current Selection Preview */}
                        <View style={[styles.colorPreviewBox, { backgroundColor: customColor, marginTop: spacing.lg }]}>
                            <Text style={[styles.colorPreviewText, { color: isLightColor(customColor) ? '#000' : '#fff' }]}>
                                {customColor.toUpperCase()}
                            </Text>
                        </View>

                        {/* Apply Button */}
                        <Pressable
                            style={[styles.applyButton, { backgroundColor: userColors.accent_color }]}
                            onPress={handleCustomColorApply}
                        >
                            <Text style={styles.applyButtonText}>Apply {editingColor.charAt(0).toUpperCase() + editingColor.slice(1)} Color</Text>
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
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: spacing.md,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.sm,
        marginLeft: spacing.sm,
    },
    sectionContent: {
        borderRadius: radii.lg,
        overflow: 'hidden',
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: 52,
        marginBottom: 1,
    },
    settingsRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    settingsRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: radii.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingsLabel: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.medium,
    },
    settingsValue: {
        fontSize: typography.sizes.sm,
    },
    colorPickerRow: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        marginBottom: 1,
    },
    colorPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginLeft: 44, // Align with text after icon
    },
    colorOption: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorOptionSelected: {
        borderWidth: 3,
        borderColor: '#fff',
    },
    dangerRow: {
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    appInfo: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    appName: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    appVersion: {
        fontSize: typography.sizes.xs,
        marginTop: spacing.xs,
    },
    // New styles for dual-color theme system
    colorSection: {
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
    },
    subsectionTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.sm,
    },
    presetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    presetItem: {
        alignItems: 'center',
        width: 68,
    },
    presetItemSelected: {
        opacity: 1,
    },
    presetGradientSelected: {
        borderWidth: 3,
        borderColor: '#fff',
    },
    presetGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginBottom: spacing.xs,
        justifyContent: 'center',
        alignItems: 'center',
    },
    presetAccentDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    presetLabel: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
        textAlign: 'center',
    },
    customColorsRow: {
        flexDirection: 'row',
        gap: spacing.lg,
    },
    customColorItem: {
        flex: 1,
    },
    customColorLabel: {
        fontSize: typography.sizes.sm,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    customColorSwatch: {
        height: 44,
        borderRadius: radii.md,
    },
    colorHint: {
        fontSize: typography.sizes.xs,
        marginBottom: spacing.sm,
    },
    colorPreviewBox: {
        height: 60,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorPreviewText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    previewButton: {
        height: 52,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewText: {
        color: '#fff',
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
    },
    // Modal styles for custom color picker
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        padding: spacing.lg,
        maxHeight: '80%',
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
    modalSectionTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.sm,
    },
    paletteGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    paletteColor: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paletteColorSelected: {
        borderWidth: 3,
        borderColor: '#fff',
    },
    applyButton: {
        height: 52,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.md,
    },
    applyButtonText: {
        color: '#fff',
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
    },
    // Profile section styles
    profileSection: {
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    changePhotoText: {
        marginTop: spacing.sm,
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    // Input styles
    inputLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        marginBottom: spacing.xs,
        marginLeft: spacing.sm,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: radii.md,
        padding: spacing.sm,
        fontSize: typography.sizes.base,
    },
    bioInput: {
        minHeight: 80,
        paddingTop: spacing.sm,
    },
    saveButton: {
        height: 48,
        borderRadius: radii.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
    },
    settingsSubLabel: {
        fontSize: typography.sizes.xs,
        marginTop: 2,
    },
});
