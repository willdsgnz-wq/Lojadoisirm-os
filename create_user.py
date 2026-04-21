from backend import services

user = services.create_user({
    "username": "will",
    "password": "123456",
    "full_name": "Will"
})

print("Usuário criado:", user)