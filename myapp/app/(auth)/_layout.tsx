import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#F8FAFC' },
                animation: 'slide_from_right',
            }}
        />
    );
}
