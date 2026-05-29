import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAgentProjectDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  externalId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;
}
