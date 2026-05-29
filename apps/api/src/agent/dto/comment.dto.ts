import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class CreateAgentCommentDto {
  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  externalId?: string;

  @IsBoolean()
  @IsOptional()
  clientVisible?: boolean;
}

export class UpdateAgentCommentDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsBoolean()
  @IsOptional()
  clientVisible?: boolean;
}

export class ListAgentCommentsDto {
  @IsString()
  @IsOptional()
  taskId?: string;

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
