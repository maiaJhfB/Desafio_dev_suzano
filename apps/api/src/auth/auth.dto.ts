import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ type: String, format: 'email', minLength: 1, maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: String, format: 'password', minLength: 1, maxLength: 1024, writeOnly: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}

export class AdminUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ enum: ['admin'] }) role!: 'admin';
}

export class LoginResponseDto {
  @ApiProperty() access_token!: string;
  @ApiProperty({ enum: ['Bearer'] }) token_type!: 'Bearer';
  @ApiProperty({ type: 'integer', enum: [900] }) expires_in!: number;
  @ApiProperty({ type: AdminUserResponseDto }) user!: AdminUserResponseDto;
}
