import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAgentTaskDto {
  @IsString()
  projectId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  externalId?: string;

  @IsBoolean()
  @IsOptional()
  clientVisible?: boolean;
}
