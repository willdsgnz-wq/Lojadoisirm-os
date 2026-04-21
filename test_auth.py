from backend.auth import hash_password, verify_password

# senha que vamos testar
senha = "123456"

# gera o hash
hash_gerado = hash_password(senha)

print("Senha original:", senha)
print("Hash gerado:", hash_gerado)

# teste correto
print("Senha correta:", verify_password("123456", hash_gerado))

# teste errado
print("Senha errada:", verify_password("999999", hash_gerado))