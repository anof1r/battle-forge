import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadSlideDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sectionId!: string;
}
