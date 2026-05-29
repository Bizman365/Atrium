import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class CreateAgentProjectUpdateDto {
  @IsString()
  projectId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @MaxLength(8000)
  body!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  externalId?: string;

  @IsBoolean()
  @IsOptional()
  clientVisible?: boolean;
}

export class UpdateAgentProjectUpdateDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(8000)
  body?: string;

  @IsBoolean()
  @IsOptional()
  clientVisible?: boolean;
}

export class ListAgentProjectUpdatesDto {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  cursor?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
