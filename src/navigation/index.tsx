import React from 'react';
import { View, Pressable, Text, Animated, Dimensions } from 'react-native';
import { NavigationContainer, DarkTheme, getFocusedRouteNameFromRoute, NavigatorScreenParams, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MIN_TOUCH_TARGET } from '../theme';
import AppHeader from '../components/AppHeader';
import StatusBarGlow from '../components/StatusBarGlow';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';

// Screens
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ExercisesScreen from '../screens/ExercisesScreen';
import CoachScreen from '../screens/CoachScreen';
import SquadScreen from '../screens/SquadScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreateWorkoutScreen from '../screens/CreateWorkoutScreen';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import ExerciseDetailScreen from '../screens/ExerciseDetailScreen';
import CrossFitWorkoutScreen from '../screens/CrossFitWorkoutScreen';
import AthleteProfileScreen from '../screens/AthleteProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SquadEventsScreen from '../screens/SquadEventsScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ActivityFeedScreen from '../screens/ActivityFeedScreen';
import CompleteEventWorkoutScreen from '../screens/CompleteEventWorkoutScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import ManageEventPlanScreen from '../screens/ManageEventPlanScreen';

// Type definitions for navigation
export type RootStackParamList = {
    Auth: undefined;
    Main: NavigatorScreenParams<MainTabParamList>; // Updated for nested linking
    Login: undefined;
    Onboarding: undefined;
    CreateWorkout: { date?: string };
    ActiveWorkout: { id: string };
    ExerciseDetail: { id: string };
    CrossFitWorkout: { id: string };
    AthleteProfile: { id: string };
    Notifications: undefined;
    NotificationSettings: undefined;
    Settings: undefined;
    // Squad Events
    SquadEvents: undefined;
    EventDetail: { id: string };
    ActivityFeed: { eventId?: string };
    CreatePost: { eventId?: string; eventName?: string };
    ManageEventPlan: { eventId: string; eventName: string; eventDate: string };
    CompleteEventWorkout: { trainingWorkoutId: string; eventId: string };
};

export type MainTabParamList = {
    Home: NavigatorScreenParams<HomeStackParamList> | undefined;
    Calendar: undefined;
    Exercises: undefined;
    Coach: undefined;
    Squad: NavigatorScreenParams<SquadStackParamList>; // Updated for nested linking
    SettingsTab: undefined;
    NotificationsTab: undefined;
};

export type HomeStackParamList = {
    HomeMain: { selectedDate?: string; timestamp?: number } | undefined;
    ActiveWorkout: { id: string };
    CrossFitWorkout: { id: string };
    ExerciseDetail: { id: string };
    CreateWorkout: { date?: string };
    AthleteProfile: { id: string };
    ActivityFeed: { eventId?: string };
};

export type SquadStackParamList = {
    SquadMain: { initialTab?: 'feed' | 'events' | 'members' };
    CreateEvent: undefined;
    CreatePost: { eventId?: string; eventName?: string };
    EventDetail: { id: string };
    ManageEventPlan: { eventId: string; eventName: string; eventDate: string };
    SquadEvents: undefined;
    ActivityFeed: { eventId?: string };
    CompleteEventWorkout: { trainingWorkoutId: string; eventId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createMaterialTopTabNavigator<MainTabParamList>();

// Tab icons mapping
const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof Feather.glyphMap> = {
    NotificationsTab: 'bell',
    Home: 'home',
    Calendar: 'calendar',
    Exercises: 'activity',
    Coach: 'user',
    Squad: 'users',
    SettingsTab: 'settings',
};

function MainTabs() {
    const { themeColors, colors: userColors } = useTheme();
    const screenWidth = Dimensions.get('window').width;

    // Custom tab bar that hides Notifications and Settings tabs
    const CustomTabBar = ({ state, descriptors, navigation, position }: any) => {
        // Only render tabs 1-5 (skip NotificationsTab at 0 and SettingsTab at 6)
        const visibleRoutes = state.routes.slice(1, 6);

        // Calculate which visible tab is focused (adjust for hidden tabs)
        // state.index 0 = Notifications (hidden), 1-5 = visible tabs, 6 = Settings (hidden)
        const getVisibleFocusedIndex = () => {
            if (state.index <= 0) return 0; // On Notifications, highlight Home
            if (state.index >= 6) return 4; // On Settings, highlight Squad
            return state.index - 1; // Adjust for hidden Notifications tab
        };
        const visibleFocusedIndex = getVisibleFocusedIndex();

        return (
            <View style={{
                backgroundColor: themeColors.bgSecondary,
                borderTopWidth: 1,
                borderTopColor: `${userColors.accent_color}30`,
                height: 70,
                paddingBottom: 10,
            }}>
                {/* Tab buttons */}
                <View style={{ flexDirection: 'row', flex: 1 }}>
                    {visibleRoutes.map((route: any, index: number) => {
                        const { options } = descriptors[route.key];
                        // Adjust index since we're showing tabs 1-5 (add 1 to match actual state.index)
                        const actualIndex = index + 1;
                        // Highlight if focused
                        const isFocused = state.index === actualIndex;
                        const color = isFocused ? userColors.accent_color : themeColors.textMuted;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });
                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name);
                            }
                        };

                        return (
                            <Pressable
                                key={route.key}
                                onPress={onPress}
                                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Feather name={TAB_ICONS[route.name as keyof MainTabParamList]} size={22} color={color} />
                                <Text style={{ fontSize: 13, fontWeight: '500', marginTop: 0, color }}>{options.tabBarLabel}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Animated underline indicator */}
                <Animated.View style={{
                    position: 'absolute',
                    bottom: 0,
                    height: 3,
                    width: '20%',
                    backgroundColor: userColors.accent_color,
                    transform: [{
                        translateX: position.interpolate({
                            // position goes from 0-6 (7 tabs total)
                            // Notifications slides off left, Settings slides off right
                            inputRange: [0, 1, 2, 3, 4, 5, 6],
                            outputRange: [
                                -screenWidth * 0.2,  // Notifications -> off screen left
                                0,  // Home
                                screenWidth * 0.2,  // Calendar
                                screenWidth * 0.4,  // Exercises
                                screenWidth * 0.6,  // Coach
                                screenWidth * 0.8,  // Squad
                                screenWidth,  // Settings -> off screen right
                            ],
                            extrapolate: 'clamp',
                        }),
                    }],
                }} />
            </View>
        );
    };

    return (
        <Tab.Navigator
            id="MainTabs"
            tabBarPosition="bottom"
            tabBar={CustomTabBar}
            initialRouteName="Home"
            screenOptions={{
                swipeEnabled: true,
                animationEnabled: true,
                lazy: true,
            }}
        >
            {/* Hidden Notifications tab - accessible by swiping left from Home */}
            <Tab.Screen
                name="NotificationsTab"
                component={NotificationsScreen}
                options={{ tabBarLabel: 'Notifications' }}
            />
            <Tab.Screen
                name="Home"
                component={HomeStack}
                options={{ tabBarLabel: 'Home' }}
                listeners={({ navigation, route }) => ({
                    tabPress: (e: any) => {
                        const state = navigation.getState();
                        const homeRoute = state.routes.find(r => r.name === 'Home');
                        if (homeRoute && homeRoute.state && homeRoute.state.index > 0) {
                            e.preventDefault();
                            navigation.navigate('Home', { screen: 'HomeMain' });
                        }
                    },
                })}
            />
            <Tab.Screen
                name="Calendar"
                component={CalendarScreen}
                options={{ tabBarLabel: 'Calendar' }}
            />
            <Tab.Screen
                name="Exercises"
                component={ExercisesScreen}
                options={{ tabBarLabel: 'Exercises' }}
            />
            <Tab.Screen
                name="Coach"
                component={CoachScreen}
                options={{ tabBarLabel: 'Coach' }}
            />
            <Tab.Screen
                name="Squad"
                component={SquadStack}
                options={({ route }: any) => {
                    const routeName = getFocusedRouteNameFromRoute(route);
                    // Only enable swipe on the main screen (undefined or 'SquadMain')
                    const isMainScreen = !routeName || routeName === 'SquadMain';
                    return {
                        tabBarLabel: 'Squad',
                        swipeEnabled: isMainScreen,
                    };
                }}
                listeners={({ navigation, route }) => ({
                    tabPress: (e: any) => {
                        // If we are already on the Squad tab
                        const state = navigation.getState();
                        // Find the Squad route
                        const squadRoute = state.routes.find(r => r.name === 'Squad');
                        if (squadRoute && squadRoute.state && squadRoute.state.index > 0) {
                            // There is a stack history, pop to top and go to events tab
                            e.preventDefault();
                            navigation.navigate('Squad', {
                                screen: 'SquadMain',
                                params: { initialTab: 'events' }
                            });
                        }
                    },
                })}
            />
            {/* Hidden Settings tab - accessible by swiping right from Squad */}
            <Tab.Screen
                name="SettingsTab"
                component={SettingsScreen}
                options={{ tabBarLabel: 'Settings' }}
            />
        </Tab.Navigator>
    );
}

const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();

function HomeStack() {
    const { themeColors } = useTheme();

    return (
        <HomeStackNav.Navigator
            id="HomeStack"
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: themeColors.bgPrimary },
                animation: 'slide_from_right',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                fullScreenGestureEnabled: true,
            }}
            initialRouteName="HomeMain"
        >
            <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
            <HomeStackNav.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
            <HomeStackNav.Screen name="CrossFitWorkout" component={CrossFitWorkoutScreen} />
            <HomeStackNav.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
            <HomeStackNav.Screen name="CreateWorkout" component={CreateWorkoutScreen} />
            <HomeStackNav.Screen name="AthleteProfile" component={AthleteProfileScreen} />
            <HomeStackNav.Screen name="ActivityFeed" component={ActivityFeedScreen} />
        </HomeStackNav.Navigator>
    );
}

const SquadStackNav = createNativeStackNavigator<SquadStackParamList>();

function SquadStack() {
    const { themeColors } = useTheme();

    return (
        <SquadStackNav.Navigator
            id="SquadStack"
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: themeColors.bgPrimary },
                animation: 'slide_from_right',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                fullScreenGestureEnabled: true,
            }}
            initialRouteName="SquadMain"
        >
            <SquadStackNav.Screen name="SquadMain" component={SquadScreen} />
            <SquadStackNav.Screen name="CreateEvent" component={CreateEventScreen} />
            <SquadStackNav.Screen name="CreatePost" component={CreatePostScreen} />
            <SquadStackNav.Screen name="EventDetail" component={EventDetailScreen} />
            <SquadStackNav.Screen name="ManageEventPlan" component={ManageEventPlanScreen} />
            <SquadStackNav.Screen name="SquadEvents" component={SquadEventsScreen} />
            <SquadStackNav.Screen name="ActivityFeed" component={ActivityFeedScreen} />
            <SquadStackNav.Screen name="CompleteEventWorkout" component={CompleteEventWorkoutScreen} />
        </SquadStackNav.Navigator>
    );
}

function AuthStack() {
    return (
        <Stack.Navigator id="AuthStack" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
    );
}

function AppStack() {
    return (
        <Stack.Navigator
            id="AppStack"
            screenOptions={{
                headerShown: false,
                animation: 'none', // Disable slide animation - ScreenLayout provides fixed header/footer
                contentStyle: {
                    backgroundColor: '#0a141f',
                },
            }}
        >
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="CreateWorkout" component={CreateWorkoutScreen} />
            <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
            <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
            <Stack.Screen name="CrossFitWorkout" component={CrossFitWorkoutScreen} />
            <Stack.Screen name="AthleteProfile" component={AthleteProfileScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            {/* Squad Events moved to SquadStack */}
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        </Stack.Navigator>
    );
}

// Wrapper that provides fixed header at navigation level
function AppStackWithHeader() {
    const { themeColors, theme } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: themeColors.bgPrimary }}>
            {/* Status bar styling */}
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

            {/* Status bar glow effect */}
            <StatusBarGlow />

            {/* Fixed Header */}
            <View style={{ paddingTop: insets.top }}>
                <AppHeader />
            </View>

            {/* Navigator Content */}
            <View style={{ flex: 1 }}>
                <AppStack />
            </View>
        </View>
    );
}

export default function Navigation() {
    const { user, loading } = useAuth();

    // Show nothing while loading auth state
    if (loading) {
        return null;
    }

    const linking: LinkingOptions<RootStackParamList> = {
        prefixes: [Linking.createURL('/'), 'https://hybrid.app'],
        config: {
            screens: {
                Main: {
                    screens: {
                        Squad: {
                            screens: {
                                SquadMain: {
                                    path: 'join/:inviteCode',
                                },
                            },
                        },
                    },
                },
                // Add other root screens if needed for type safety, but optional
                CreateWorkout: 'create-workout',
                ActiveWorkout: 'workout/:id',
                ExerciseDetail: 'exercise/:id',
                CrossFitWorkout: 'crossfit/:id',
                AthleteProfile: 'profile/:id',
                Notifications: 'notifications',
                NotificationSettings: 'notification-settings',
                Settings: 'settings',
                SquadEvents: 'squad-events',
                EventDetail: 'event/:id',
                ActivityFeed: 'feed/:eventId',
                CreatePost: 'create-post',
                ManageEventPlan: 'manage-plan/:eventId',
                CompleteEventWorkout: 'complete-workout/:eventId/:trainingWorkoutId',
            },
        },
    };

    return (
        <NavigationContainer theme={DarkTheme} linking={linking}>
            {user ? <AppStackWithHeader /> : <AuthStack />}
        </NavigationContainer>
    );
}
