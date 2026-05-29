import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListAgentAuditDto {
  @IsString()
  @IsOptional()
  entityType?: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  actorType?: string;

  @IsString()
  @IsOptional()
  actorId?: string;

  @IsDateString()
  @IsOptional()
  since?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit?: number;

  @IsDateString()
  @IsOptional()
  cursor?: string;
}
