"""
Script para gerar hash de senha para inserir manualmente na tabela admin_users do Supabase.
Rode: python scripts/generate_admin_hash.py

Depois copie o hash gerado e cole no INSERT SQL no Supabase.
"""
import bcrypt
import sys


def generate_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


if __name__ == '__main__':
    if len(sys.argv) > 1:
        password = sys.argv[1]
    else:
        password = input('Digite a senha do Super Admin: ')

    hashed = generate_hash(password)

    print('\n' + '=' * 60)
    print('Hash gerado com sucesso!')
    print('=' * 60)
    print(f'\nHash: {hashed}')
    print('\nCopie o hash acima e cole no SQL do Supabase:')
    print(f"""
INSERT INTO admin_users (name, email, password_hash) VALUES
  ('Seu Nome', 'seu@email.com', '{hashed}');
""")
