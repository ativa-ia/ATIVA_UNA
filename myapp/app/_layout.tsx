import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // ── Interceptor Global de Manutenção ─────────────────────────────────────
    // Fazemos um monkey-patch do global.fetch para que qualquer chamada à API
    // que retorne 503 + { maintenance: true } redirecione automaticamente para
    // a tela de manutenção, sem ter que modificar cada função em api.ts.
    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);

      if (response.status === 503) {
        // Clonamos para não consumir o body já que o caller pode querer ler também
        const clone = response.clone();
        try {
          const data = await clone.json();
          if (data?.maintenance === true) {
            // Redireciona para a tela de manutenção
            router.replace('/maintenance');
          }
        } catch {
          // Se não conseguir ler o JSON, retorna a resposta normalmente
        }
      }

      return response;
    };

    return () => {
      // Restaura o fetch original ao desmontar (hot reload seguro)
      global.fetch = originalFetch;
    };
  }, [router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F8FAFC' }, // colors.slate50
      }}
      initialRouteName="index"
    />
  );
}
