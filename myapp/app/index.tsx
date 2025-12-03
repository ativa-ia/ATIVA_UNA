import { Redirect } from 'expo-router';

export default function Index() {
  // Redireciona para a tela de login
  // Aqui você pode adicionar lógica de autenticação no futuro
  // Por exemplo: verificar se o usuário já está logado
  return <Redirect href="/(auth)/login" />;
}
