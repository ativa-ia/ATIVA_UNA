from marshmallow import Schema, fields, validate, ValidationError


class RegisterSchema(Schema):
    """Schema de validação para registro"""
    email = fields.Email(required=True, error_messages={'required': 'Email é obrigatório'})
    password = fields.Str(
        required=True,
        validate=validate.Length(min=6, error='Senha deve ter no mínimo 6 caracteres'),
        error_messages={'required': 'Senha é obrigatória'}
    )
    role = fields.Str(
        required=True,
        validate=validate.OneOf(['student', 'teacher'], error='Role deve ser student ou teacher'),
        error_messages={'required': 'Role é obrigatório'}
    )
    name = fields.Str(
        required=True,
        validate=validate.Length(min=1, error='Nome não pode estar vazio'),
        error_messages={'required': 'Nome é obrigatório'}
    )


class LoginSchema(Schema):
    """Schema de validação para login"""
    email = fields.Email(required=True, error_messages={'required': 'Email é obrigatório'})
    password = fields.Str(required=True, error_messages={'required': 'Senha é obrigatória'})


class ForgotPasswordSchema(Schema):
    """Schema de validação para recuperação de senha"""
    email = fields.Email(required=True, error_messages={'required': 'Email é obrigatório'})


# Instâncias dos schemas
register_schema = RegisterSchema()
login_schema = LoginSchema()
forgot_password_schema = ForgotPasswordSchema()
