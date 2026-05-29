import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAgentProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  slug?: string | null;

  @IsString()
  @IsOptional()
  clientId?: string | null;
}
