import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Auth } from 'src/auth/decorator/auth.decorators';
import { Role } from 'src/common/enums/role.enum';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ActiveUser } from 'src/common/decorator/active-user.decorator';
import { ActiveUserInterface } from 'src/common/interfaces/active-user.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('profile')
  profile(@ActiveUser() user: ActiveUserInterface){
    return user;
  }

  @Get('sessions')
  session(@ActiveUser() user: ActiveUserInterface){
    return this.usersService.findSesiones(user.id);
  }

  @Get(':email/email')
  findOneByEmail(@Param('email') email: string) {
    const decodedEmail = decodeURIComponent(email);
    console.log(decodedEmail);
    return this.usersService.findOneByEmail(decodedEmail);
  }

  @Patch('preferences')
  preferences(@ActiveUser() user: ActiveUserInterface, @Body() preferencesDto: any) {
    return;
  }

  @Patch('profile')
  update(@ActiveUser() user: ActiveUserInterface, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(user.id, updateUserDto);
  }
}
