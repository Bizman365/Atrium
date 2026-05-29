import { IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class CreateAgentProjectNoteDto {
  @IsString()
  projectId!: string;

  @IsString()
  @MaxLength(8000)
  body!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  externalId?: string;
}

export class UpdateAgentProjectNoteDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(8000)
  body?: string;
}

export class ListAgentProjectNotesDto {
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
