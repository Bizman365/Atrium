import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAgentTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

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
  assigneeId?: string | null;

  @IsDateString()
  @IsOptional()
  dueDate?: string | null;

  @IsBoolean()
  @IsOptional()
  clientVisible?: boolean;
}
