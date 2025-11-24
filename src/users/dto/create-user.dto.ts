import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateUserDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name: string;
    
    @IsNotEmpty()
    @IsEmail()
    email: string;
    
    password: string;

    @IsOptional()
    @IsString()
    avatarUrl?: string;
  
    @IsOptional()
    configPreferencias?: Record<string, any>;
  }