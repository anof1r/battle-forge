import { IsDefined, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class SetDataDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsDefined()
  data!: unknown;
}

export class UpdateDataDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsObject()
  data!: Record<string, unknown>;
}
