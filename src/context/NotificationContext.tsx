import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import {
    registerForPushNotificationsAsync,
    savePushToken,
    getNotificationPreferences,
    saveNotificationPreferences,
    addNotificationListeners,
    NotificationPreferences,
} from '../services/notificationService';

interface NotificationContextType {
    pushToken: string | null;
    preferences: NotificationPreferences;
    isRegistered: boolean;
    scheduledCount: number;
    registerForNotifications: () => Promise<boolean>;
    updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
    refreshScheduledCount: () => Promise<void>;
}

const defaultPreferences: NotificationPreferences = {
    workoutReminders: true,
    checkInReminders: true,
    squadActivity: true,
    reminderTime: '08:00',
};

const NotificationContext = createContext<NotificationContextType>({
    pushToken: null,
    preferences: defaultPreferences,
    isRegistered: false,
    scheduledCount: 0,
    registerForNotifications: async () => false,
    updatePreferences: async () => { },
    refreshScheduledCount: async () => { },
});

export function useNotifications() {
    return useContext(NotificationContext);
}

interface NotificationProviderProps {
    children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
    const { user } = useAuth();
    const navigation = useNavigation();
    const [pushToken, setPushToken] = useState<string | null>(null);
    const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
    const [isRegistered, setIsRegistered] = useState(false);
    const [scheduledCount, setScheduledCount] = useState(0);
    const notificationListener = useRef<(() => void) | null>(null);

    // Load preferences when user logs in
    useEffect(() => {
        if (user?.id) {
            loadPreferences();
        }
    }, [user?.id]);

    // Set up notification listeners
    useEffect(() => {
        const handleNotificationReceived = (notification: Notifications.Notification) => {
            console.log('Notification received:', notification);
        };

        const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
            const data = response.notification.request.content.data;
            console.log('Notification tapped:', data);

            // Navigate based on notification type
            if (data?.type === 'workout_reminder' && data?.eventId) {
                // Navigate to event detail
                (navigation as any).navigate('EventDetail', { id: data.eventId });
            } else if (data?.type === 'check_in' && data?.eventId) {
                (navigation as any).navigate('EventDetail', { id: data.eventId });
            } else if (data?.type === 'squad_activity') {
                (navigation as any).navigate('ActivityFeed');
            }
        };

        // Set up listeners
        notificationListener.current = addNotificationListeners(
            handleNotificationReceived,
            handleNotificationResponse
        );

        // Cleanup
        return () => {
            if (notificationListener.current) {
                notificationListener.current();
            }
        };
    }, [navigation]);

    const loadPreferences = async () => {
        if (!user?.id) return;
        const prefs = await getNotificationPreferences(user.id);
        setPreferences(prefs);
    };

    const registerForNotifications = useCallback(async (): Promise<boolean> => {
        if (!user?.id) return false;

        const token = await registerForPushNotificationsAsync();

        if (token) {
            setPushToken(token);
            setIsRegistered(true);
            await savePushToken(user.id, token);
            return true;
        }

        setIsRegistered(false);
        return false;
    }, [user?.id]);

    const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
        if (!user?.id) return;

        const updated = { ...preferences, ...newPrefs };
        setPreferences(updated);
        await saveNotificationPreferences(user.id, updated);
    }, [user?.id, preferences]);

    const refreshScheduledCount = useCallback(async () => {
        const notifications = await Notifications.getAllScheduledNotificationsAsync();
        setScheduledCount(notifications.length);
    }, []);

    // Refresh count periodically
    useEffect(() => {
        refreshScheduledCount();
        const interval = setInterval(refreshScheduledCount, 60000); // Every minute
        return () => clearInterval(interval);
    }, [refreshScheduledCount]);

    return (
        <NotificationContext.Provider
            value={{
                pushToken,
                preferences,
                isRegistered,
                scheduledCount,
                registerForNotifications,
                updatePreferences,
                refreshScheduledCount,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}
