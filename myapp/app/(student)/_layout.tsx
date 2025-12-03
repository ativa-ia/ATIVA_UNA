import { Stack } from 'expo-router';

export default function StudentLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#101622' },
            }}
        />
    );
}
