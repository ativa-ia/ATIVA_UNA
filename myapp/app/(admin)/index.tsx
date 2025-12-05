import { Redirect } from 'expo-router';

export default function AdminIndex() {
    // Redireciona para o dashboard dentro do grupo admin
    return <Redirect href="/(admin)/dashboard" />;
}
